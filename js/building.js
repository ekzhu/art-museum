/**
 * building.js — procedural museum architecture.
 *
 * The plan is a 3×4 grid of rooms (a Chinese palace enfilade around a central
 * axis). The middle cell is a grand skylit Atrium; the front-centre cell is the
 * Entrance lobby (player spawn); the nine art halls and a garden courtyard fill
 * the rest. Adjacent rooms are joined by doorways, giving an open, wanderable
 * plan. Each art hall is "lined" with walls tinted to its curated palette, on
 * which the artworks hang.
 *
 * buildMuseum(scene) returns:
 *   { collide:[{minX,minZ,maxX,maxZ}], roomAt(x,z), rooms:{id->room}, spawn,
 *     hallRuns:{hallId->[run]}, lights:[] }
 * where each `run` is a horizontal wall stretch usable for hanging art:
 *   { x,z (mid, at wall face), dirX,dirZ (along wall), nx,nz (inward normal),
 *     length, hall }
 */
import * as THREE from 'three';
import { HALL_BY_ID, BUILDING } from './curation.js';
import * as TX from './textures.js';

export const CELL_W = 27;   // room size along X
export const CELL_D = 23;   // room size along Z
export const WALL_H = 7.6;  // interior height
export const T = 0.6;       // wall thickness
export const DOOR_W = 4.4;  // doorway clear width
export const DOOR_H = 4.6;  // doorway clear height

// Grid plan. null = solid block (none here). Special ids: atrium, entrance, garden.
const MAP = [
  ['jade', 'sculpture', 'tomb', 'bronze'],
  ['calligraphy', 'atrium', 'ceramics', 'textiles'],
  ['painting', 'entrance', 'decorative', 'garden'],
];
const ROWS = MAP.length, COLS = MAP[0].length;
const OFFX = -(COLS * CELL_W) / 2;
const OFFZ = -(ROWS * CELL_D) / 2;

const occ = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS && MAP[r][c];
const center = (r, c) => ({ x: c * CELL_W + CELL_W / 2 + OFFX, z: r * CELL_D + CELL_D / 2 + OFFZ });

const col = (s) => new THREE.Color(s);

export function buildMuseum(scene) {
  const collide = [];
  const rooms = {};
  const hallRuns = {};
  const lights = [];
  const P = BUILDING.palette;

  const matCache = new Map();
  const mat = (key, make) => { if (!matCache.has(key)) matCache.set(key, make()); return matCache.get(key); };

  // ---- shared materials ----
  const beamMat = mat('beam', () => new THREE.MeshStandardMaterial({ map: TX.wood(P.beam, 3), color: 0xffffff, roughness: 0.8 }));
  const trimMat = mat('trim', () => new THREE.MeshStandardMaterial({ color: col(P.columnGold), roughness: 0.4, metalness: 0.5 }));
  const columnMat = mat('col', () => new THREE.MeshStandardMaterial({ color: col(P.column), roughness: 0.5 }));

  const root = new THREE.Group();
  root.name = 'museum';
  scene.add(root);

  // ===========================================================================
  // Floors + ceilings, one per occupied cell
  // ===========================================================================
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = MAP[r][c];
      if (!id) continue;
      const ct = center(r, c);
      const hall = HALL_BY_ID[id];
      const isAtrium = id === 'atrium';
      const isGarden = id === 'garden';
      const isLobby = id === 'entrance';

      // floor
      const floorColor = isAtrium || isLobby ? P.marble : (hall ? hall.palette.floor : P.marbleDark);
      const floorTex = isAtrium || isLobby ? TX.marble(P.marble, P.marbleDark, 2) : TX.tiles(floorColor, col(floorColor).offsetHSL(0, 0, -0.08).getStyle(), 3, 3);
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(CELL_W, CELL_D),
        new THREE.MeshStandardMaterial({ map: floorTex, roughness: isAtrium ? 0.25 : 0.7, metalness: isAtrium ? 0.12 : 0.02 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(ct.x, 0, ct.z);
      floor.receiveShadow = true;
      root.add(floor);

      // ceiling (garden is open to sky; atrium handled separately below)
      if (!isGarden && !isAtrium) {
        const ceilTex = TX.coffer(P.ceiling, P.columnGold, hall ? hall.palette.accent : P.column);
        ceilTex.repeat.set(2, 2);
        const ceil = new THREE.Mesh(
          new THREE.PlaneGeometry(CELL_W, CELL_D),
          new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.9, color: 0xece6d6 })
        );
        ceil.rotation.x = Math.PI / 2;
        ceil.position.set(ct.x, WALL_H, ct.z);
        root.add(ceil);
        // ceiling beams
        for (const off of [-CELL_W / 4, CELL_W / 4]) {
          const beam = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, CELL_D - 0.5), beamMat);
          beam.position.set(ct.x + off, WALL_H - 0.3, ct.z);
          root.add(beam);
        }
      }

      rooms[id] = { id, r, c, cx: ct.x, cz: ct.z, hall, isAtrium, isGarden, isLobby };
      if (hall) hallRuns[id] = [];
    }
  }

  // ===========================================================================
  // Walls: collision (per grid-line, deduped) + visual liners (per room side)
  // ===========================================================================

  // -- collision + structural doorway portals from grid lines --
  const addCollide = (minX, minZ, maxX, maxZ) => collide.push({ minX, minZ, maxX, maxZ });

  function buildWallLine(orient, fixedWorld, segCenter, length, interior, hallAColor) {
    // orient 'v' → wall runs along Z at x=fixedWorld; 'h' → along X at z=fixedWorld
    const half = length / 2;
    const a = segCenter - half, b = segCenter + half;
    if (interior) {
      // doorway centered: two flanking solid pieces + lintel
      const gA = segCenter - DOOR_W / 2, gB = segCenter + DOOR_W / 2;
      for (const [s, e] of [[a, gA], [gB, b]]) {
        if (e - s < 0.05) continue;
        addSolid(orient, fixedWorld, (s + e) / 2, e - s, WALL_H, 0);
      }
      // lintel above door
      addSolid(orient, fixedWorld, segCenter, DOOR_W, WALL_H - DOOR_H, DOOR_H, false);
      // portal frame (gold posts + red lintel beam)
      addPortal(orient, fixedWorld, segCenter);
    } else {
      addSolid(orient, fixedWorld, segCenter, length, WALL_H, 0);
    }
  }

  function addSolid(orient, fixedWorld, segCenter, length, height, yBase, doCollide = true) {
    if (length < 0.05 || height < 0.05) return;
    const geo = orient === 'v'
      ? new THREE.BoxGeometry(T, height, length)
      : new THREE.BoxGeometry(length, height, T);
    const m = new THREE.Mesh(geo, mat('shell', () => new THREE.MeshStandardMaterial({ map: TX.plaster(P.wall, 2), color: 0xeae3d4, roughness: 0.95 })));
    if (orient === 'v') m.position.set(fixedWorld, yBase + height / 2, segCenter);
    else m.position.set(segCenter, yBase + height / 2, fixedWorld);
    m.castShadow = false; m.receiveShadow = true;
    root.add(m);
    if (doCollide && yBase < 2) {
      if (orient === 'v') addCollide(fixedWorld - T / 2, segCenter - length / 2, fixedWorld + T / 2, segCenter + length / 2);
      else addCollide(segCenter - length / 2, fixedWorld - T / 2, segCenter + length / 2, fixedWorld + T / 2);
    }
  }

  function addPortal(orient, fixedWorld, segCenter) {
    // two jamb posts and a lintel beam, lacquer-red with gold trim (moon-gate flavour)
    const postH = DOOR_H;
    for (const sgn of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(orient === 'v' ? T + 0.25 : 0.5, postH, orient === 'v' ? 0.5 : T + 0.25), columnMat);
      if (orient === 'v') post.position.set(fixedWorld, postH / 2, segCenter + sgn * (DOOR_W / 2));
      else post.position.set(segCenter + sgn * (DOOR_W / 2), postH / 2, fixedWorld);
      root.add(post);
    }
    const lintel = new THREE.Mesh(
      orient === 'v' ? new THREE.BoxGeometry(T + 0.3, 0.7, DOOR_W + 0.9) : new THREE.BoxGeometry(DOOR_W + 0.9, 0.7, T + 0.3),
      columnMat
    );
    if (orient === 'v') lintel.position.set(fixedWorld, DOOR_H + 0.1, segCenter);
    else lintel.position.set(segCenter, DOOR_H + 0.1, fixedWorld);
    root.add(lintel);
    const plaque = new THREE.Mesh(
      orient === 'v' ? new THREE.BoxGeometry(T + 0.32, 0.5, 1.6) : new THREE.BoxGeometry(1.6, 0.5, T + 0.32),
      trimMat
    );
    if (orient === 'v') plaque.position.set(fixedWorld, DOOR_H + 0.55, segCenter);
    else plaque.position.set(segCenter, DOOR_H + 0.55, fixedWorld);
    root.add(plaque);
  }

  // vertical grid lines
  for (let c = 0; c <= COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const left = occ(r, c - 1), right = occ(r, c);
      if (!left && !right) continue;
      const xWorld = c * CELL_W + OFFX;
      const zc = r * CELL_D + CELL_D / 2 + OFFZ;
      buildWallLine('v', xWorld, zc, CELL_D, !!(left && right));
    }
  }
  // horizontal grid lines
  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const top = occ(r - 1, c), bot = occ(r, c);
      if (!top && !bot) continue;
      const zWorld = r * CELL_D + OFFZ;
      const xc = c * CELL_W + CELL_W / 2 + OFFX;
      buildWallLine('h', zWorld, xc, CELL_W, !!(top && bot));
    }
  }

  // ===========================================================================
  // Per-room interior wall liners (hall colour) + collect art runs
  // ===========================================================================
  const halfW = CELL_W / 2 - T / 2 - 0.05;
  const halfD = CELL_D / 2 - T / 2 - 0.05;

  for (const id in rooms) {
    const room = rooms[id];
    const { r, c, cx, cz, hall } = room;
    const wallColor = hall ? hall.palette.wall : P.wall;
    const wainColor = hall ? hall.palette.wainscot : P.beam;
    const accent = hall ? hall.palette.accent : P.accent;
    const linerMat = new THREE.MeshStandardMaterial({ map: TX.plaster(wallColor, 2), color: 0xffffff, roughness: 0.95, side: THREE.FrontSide });
    const wainMat = new THREE.MeshStandardMaterial({ map: TX.wood(wainColor, 4), color: 0xffffff, roughness: 0.7 });
    const fretTex = TX.fret(accent, wainColor);
    const fretMat = new THREE.MeshStandardMaterial({ map: fretTex, roughness: 0.6 });

    const sides = [
      { neigh: occ(r - 1, c), orient: 'h', fixed: cz - halfD, from: cx - halfW, to: cx + halfW, nx: 0, nz: 1 },  // N
      { neigh: occ(r + 1, c), orient: 'h', fixed: cz + halfD, from: cx - halfW, to: cx + halfW, nx: 0, nz: -1 }, // S
      { neigh: occ(r, c - 1), orient: 'v', fixed: cx - halfW, from: cz - halfD, to: cz + halfD, nx: 1, nz: 0 },  // W
      { neigh: occ(r, c + 1), orient: 'v', fixed: cx + halfW, from: cz - halfD, to: cz + halfD, nx: -1, nz: 0 }, // E
    ];

    for (const s of sides) {
      const mid = (s.from + s.to) / 2;
      const spans = [];
      if (s.neigh) {
        if (mid - DOOR_W / 2 - s.from > 1.0) spans.push([s.from, mid - DOOR_W / 2]);
        if (s.to - (mid + DOOR_W / 2) > 1.0) spans.push([mid + DOOR_W / 2, s.to]);
      } else {
        spans.push([s.from, s.to]);
      }
      for (const [a, b] of spans) {
        const len = b - a, segC = (a + b) / 2;
        // liner plane
        const liner = new THREE.Mesh(new THREE.PlaneGeometry(len, WALL_H), linerMat);
        orientPlane(liner, s, segC);
        liner.position.y = WALL_H / 2;
        root.add(liner);
        // wainscot band
        const wain = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.15), wainMat);
        orientPlane(wain, s, segC);
        wain.position.y = 0.575;
        root.add(wain);
        // fret border above wainscot
        const fm = fretMat.clone(); fm.map = fretTex.clone(); fm.map.wrapS = THREE.RepeatWrapping; fm.map.repeat.set(Math.max(1, Math.round(len / 1.1)), 1); fm.map.needsUpdate = true;
        const border = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.32), fm);
        orientPlane(border, s, segC);
        border.position.y = 1.32;
        root.add(border);
        // crown frieze near ceiling
        const crown = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.5), new THREE.MeshStandardMaterial({ color: col(accent).multiplyScalar(0.9), roughness: 0.6 }));
        orientPlane(crown, s, segC);
        crown.position.y = WALL_H - 0.4;
        root.add(crown);

        // art run (only for halls; usable wall strip is the mid band)
        if (hall && len >= 2.0) {
          const faceX = s.orient === 'v' ? s.fixed : segC;
          const faceZ = s.orient === 'v' ? segC : s.fixed;
          hallRuns[id].push({ x: faceX, z: faceZ, dirX: s.orient === 'v' ? 0 : 1, dirZ: s.orient === 'v' ? 1 : 0, nx: s.nx, nz: s.nz, length: len, hall: id });
        }
      }
    }
  }

  function orientPlane(mesh, s, segC) {
    if (s.orient === 'v') {
      mesh.position.set(s.fixed, mesh.position.y, segC);
      mesh.rotation.y = s.nx > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      mesh.position.set(segC, mesh.position.y, s.fixed);
      mesh.rotation.y = s.nz > 0 ? 0 : Math.PI;
    }
  }

  // ===========================================================================
  // Columns at interior grid intersections (lacquer red + gilt capital)
  // ===========================================================================
  const colGeo = new THREE.CylinderGeometry(0.45, 0.5, WALL_H - 0.4, 16);
  const capGeo = new THREE.CylinderGeometry(0.62, 0.5, 0.5, 16);
  const colInst = [];
  for (let r = 1; r < ROWS; r++) {
    for (let c = 1; c < COLS; c++) {
      // only where surrounded by occupied cells (interior junctions)
      if (occ(r - 1, c - 1) && occ(r - 1, c) && occ(r, c - 1) && occ(r, c)) {
        colInst.push({ x: c * CELL_W + OFFX, z: r * CELL_D + OFFZ });
      }
    }
  }
  for (const p of colInst) {
    const cyl = new THREE.Mesh(colGeo, columnMat);
    cyl.position.set(p.x, (WALL_H - 0.4) / 2, p.z);
    cyl.castShadow = true;
    root.add(cyl);
    const cap = new THREE.Mesh(capGeo, trimMat);
    cap.position.set(p.x, WALL_H - 0.65, p.z);
    root.add(cap);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.62, 0.4, 16), trimMat);
    base.position.set(p.x, 0.2, p.z);
    root.add(base);
  }

  // ===========================================================================
  // Atrium: caisson skylight (藻井), central medallion, ring of columns
  // ===========================================================================
  buildAtrium(root, rooms.atrium, mat, lights, P);

  // spawn: entrance cell, facing the atrium (-Z)
  const ent = rooms.entrance;
  const spawn = { x: ent.cx, z: ent.cz + CELL_D / 2 - 3.0, yaw: 0 }; // face -Z, toward the atrium

  // helper: which room contains a world point
  function roomAt(x, z) {
    const c = Math.floor((x - OFFX) / CELL_W);
    const r = Math.floor((z - OFFZ) / CELL_D);
    const id = occ(r, c);
    return id ? rooms[id] : null;
  }

  return { collide, rooms, roomAt, spawn, hallRuns, lights, ROWS, COLS, CELL_W, CELL_D, OFFX, OFFZ, MAP };
}

// -----------------------------------------------------------------------------
function buildAtrium(root, atrium, mat, lights, P) {
  const { cx, cz } = atrium;
  const col = (s) => new THREE.Color(s);

  // central polished medallion (taiji-style compass) on the floor
  const med = new THREE.Mesh(
    new THREE.CircleGeometry(4.2, 48),
    new THREE.MeshStandardMaterial({ map: TX.motif('coin', P.column, P.marble), roughness: 0.25, metalness: 0.1 })
  );
  med.rotation.x = -Math.PI / 2;
  med.position.set(cx, 0.02, cz);
  root.add(med);
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.2, 4.7, 48), new THREE.MeshStandardMaterial({ color: col(P.columnGold), roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(cx, 0.03, cz);
  root.add(ring);

  // caisson skylight: shrinking square rings rising above WALL_H to a sky panel
  const rings = 5;
  const baseHalf = 6.5;
  for (let i = 0; i < rings; i++) {
    const half = baseHalf * (1 - i / (rings + 1));
    const y = WALL_H + i * 0.7;
    const frameMat = new THREE.MeshStandardMaterial({ color: i % 2 ? col(P.column) : col(P.columnGold), roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide });
    // four bars of a square ring
    const bar = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, d), frameMat); m.position.set(cx + x, y, cz + z); root.add(m); };
    bar(half * 2, 0.5, 0, -half); bar(half * 2, 0.5, 0, half);
    bar(0.5, half * 2, -half, 0); bar(0.5, half * 2, half, 0);
  }
  // bright sky panel at the top (emissive = daylight pouring in)
  const topHalf = baseHalf * (1 - (rings - 1) / (rings + 1));
  const skyPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(topHalf * 2, topHalf * 2),
    new THREE.MeshBasicMaterial({ map: TX.sky(), fog: false })
  );
  skyPanel.rotation.x = Math.PI / 2;
  skyPanel.position.set(cx, WALL_H + rings * 0.7, cz);
  root.add(skyPanel);

  // daylight from the skylight
  const sun = new THREE.PointLight(0xfff2d6, 1.5, 70, 1.4);
  sun.position.set(cx, WALL_H + 2, cz);
  root.add(sun);
  lights.push(sun);
}
