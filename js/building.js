/**
 * building.js — procedural museum architecture.
 *
 * A Chinese palace plan organised on a central south–north axis (中轴线):
 * the visitor arrives on an exterior plaza, climbs the steps through a columned
 * Portico, crosses the Grand Lobby into the skylit Atrium, and from there into
 * nine themed halls, a theatre and a scholar's-garden courtyard. Adjacent rooms
 * are joined by doorways for an open, wanderable plan. Each art hall is "lined"
 * with palette-tinted walls carrying dimensional mouldings on which art hangs.
 *
 * buildMuseum(scene) returns { collide, rooms, roomAt, spawn, hallRuns, lights,
 *   MAP, CELL_W, CELL_D, OFFX, OFFZ, ROWS, COLS }.
 */
import * as THREE from 'three';
import { HALL_BY_ID, BUILDING } from './curation.js';
import * as TX from './textures.js';

export const CELL_W = 30;   // room size along X (wider halls, generous spacing)
export const CELL_D = 26;   // room size along Z
export const WALL_H = 8.4;  // interior height
export const T = 0.7;       // wall thickness
export const DOOR_W = 5.0;  // doorway clear width
export const DOOR_H = 5.0;  // doorway clear height

// Grid plan, south (front, row 3) to north (back, row 0). Special ids:
// atrium, lobby, portico (open front), theatre, garden.
const MAP = [
  ['jade', 'sculpture', 'tomb', 'bronze'],
  ['calligraphy', 'atrium', 'ceramics', 'textiles'],
  ['painting', 'lobby', 'decorative', 'theatre'],
  ['garden', 'portico', 'cafe', 'shop'],
];
const ROWS = MAP.length, COLS = MAP[0].length;
const OFFX = -(COLS * CELL_W) / 2;
const OFFZ = -(ROWS * CELL_D) / 2;

const occ = (r, c) => (r >= 0 && r < ROWS && c >= 0 && c < COLS ? MAP[r][c] : null);
const center = (r, c) => ({ x: c * CELL_W + CELL_W / 2 + OFFX, z: r * CELL_D + CELL_D / 2 + OFFZ });
const col = (s) => new THREE.Color(s);
const flagsFor = (id) => ({
  isAtrium: id === 'atrium', isGarden: id === 'garden', isLobby: id === 'lobby',
  isPortico: id === 'portico', isTheatre: id === 'theatre',
  isCafe: id === 'cafe', isShop: id === 'shop',
});

export function buildMuseum(scene) {
  const collide = [];
  const rooms = {};
  const hallRuns = {};
  const lights = [];
  const P = BUILDING.palette;

  const matCache = new Map();
  const mat = (key, make) => { if (!matCache.has(key)) matCache.set(key, make()); return matCache.get(key); };
  const beamMat = mat('beam', () => new THREE.MeshStandardMaterial({ map: TX.wood(P.beam, 3), roughness: 0.8 }));
  const trimMat = mat('trim', () => new THREE.MeshStandardMaterial({ color: col(P.columnGold), roughness: 0.62, metalness: 0.2 }));
  const columnMat = mat('col', () => new THREE.MeshStandardMaterial({ color: col(P.column), roughness: 0.5 }));
  const shellMat = mat('shell', () => new THREE.MeshStandardMaterial({ map: TX.plaster(P.wall, 2), color: 0xeae3d4, roughness: 0.95 }));
  const stoneMat = mat('stone', () => new THREE.MeshStandardMaterial({ map: TX.tiles('#cdc4ad', '#b3a98c', 4, 6), roughness: 0.8 }));

  const root = new THREE.Group();
  root.name = 'museum';
  scene.add(root);
  const placed = (mesh, x, y, z) => { mesh.position.set(x, y, z); root.add(mesh); return mesh; };

  // Cache frieze materials by (colour, repeat) so the fret texture isn't cloned
  // once per wall span (was ~95 GPU uploads).
  const friezeCache = new Map();
  const friezeMat = (fretTex, key, rep) => {
    const k = key + '|' + rep;
    let m = friezeCache.get(k);
    if (!m) {
      const tex = fretTex.clone(); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(rep, 1); tex.needsUpdate = true;
      m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
      friezeCache.set(k, m);
    }
    return m;
  };

  // ===========================================================================
  // Floors + ceilings
  // ===========================================================================
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = MAP[r][c];
      if (!id) continue;
      const ct = center(r, c);
      const hall = HALL_BY_ID[id];
      const f = flagsFor(id);
      const grand = f.isAtrium || f.isLobby || f.isPortico;

      // floor
      const floorColor = grand ? P.marble : (hall ? hall.palette.floor : (f.isTheatre ? '#26211b' : f.isCafe ? '#cdbfa0' : f.isShop ? '#6a4a30' : P.marbleDark));
      const floorTex = grand
        ? TX.marble(P.marble, P.marbleDark, 2)
        : TX.tiles(floorColor, col(floorColor).offsetHSL(0, 0, -0.08).getStyle(), 3, 3);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(CELL_W, CELL_D),
        new THREE.MeshStandardMaterial({ map: floorTex, roughness: grand ? 0.25 : 0.7, metalness: grand ? 0.12 : 0.02 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(ct.x, 0, ct.z);
      floor.receiveShadow = true;
      root.add(floor);

      // ceiling (garden open to sky; atrium has its own caisson roof)
      if (!f.isGarden && !f.isAtrium) {
        const accent = hall ? hall.palette.accent : P.column;
        const ceilTex = TX.coffer(f.isTheatre ? '#1c1813' : P.ceiling, P.columnGold, accent);
        ceilTex.repeat.set(2, 2);
        const ceil = new THREE.Mesh(new THREE.PlaneGeometry(CELL_W, CELL_D),
          new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.9, color: f.isTheatre ? 0x2a241c : 0xece6d6 }));
        ceil.rotation.x = Math.PI / 2;
        ceil.position.set(ct.x, WALL_H, ct.z);
        root.add(ceil);
        // coffer beams (lattice of timber)
        for (const ox of [-CELL_W / 3, 0, CELL_W / 3]) {
          const beam = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, CELL_D - 0.4), beamMat);
          beam.position.set(ct.x + ox, WALL_H - 0.32, ct.z); root.add(beam);
        }
        for (const oz of [-CELL_D / 3, 0, CELL_D / 3]) {
          const beam = new THREE.Mesh(new THREE.BoxGeometry(CELL_W - 0.4, 0.5, 0.6), beamMat);
          beam.position.set(ct.x, WALL_H - 0.5, ct.z + oz); root.add(beam);
        }
      }

      rooms[id] = { id, r, c, cx: ct.x, cz: ct.z, hall, ...f };
      if (hall) hallRuns[id] = [];
    }
  }

  // ===========================================================================
  // Walls — collision + structural shell + ornate doorway portals (grid lines)
  // ===========================================================================
  const addCollide = (minX, minZ, maxX, maxZ) => collide.push({ minX, minZ, maxX, maxZ });

  function addSolid(orient, fixed, segC, length, height, yBase, doCollide = true) {
    if (length < 0.05 || height < 0.05) return;
    const geo = orient === 'v' ? new THREE.BoxGeometry(T, height, length) : new THREE.BoxGeometry(length, height, T);
    const m = new THREE.Mesh(geo, shellMat);
    if (orient === 'v') m.position.set(fixed, yBase + height / 2, segC);
    else m.position.set(segC, yBase + height / 2, fixed);
    m.receiveShadow = true;
    root.add(m);
    if (doCollide && yBase < 2) {
      if (orient === 'v') addCollide(fixed - T / 2, segC - length / 2, fixed + T / 2, segC + length / 2);
      else addCollide(segC - length / 2, fixed - T / 2, segC + length / 2, fixed + T / 2);
    }
  }

  function addPortal(orient, fixed, segC, grand) {
    const postW = grand ? 0.7 : 0.55;
    const dw = grand ? DOOR_W + 1.0 : DOOR_W;
    for (const sgn of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(orient === 'v' ? T + 0.3 : postW, DOOR_H, orient === 'v' ? postW : T + 0.3), columnMat);
      if (orient === 'v') post.position.set(fixed, DOOR_H / 2, segC + sgn * (dw / 2));
      else post.position.set(segC + sgn * (dw / 2), DOOR_H / 2, fixed);
      post.castShadow = true; root.add(post);
    }
    const lintel = new THREE.Mesh(orient === 'v' ? new THREE.BoxGeometry(T + 0.4, 0.85, dw + 1.0) : new THREE.BoxGeometry(dw + 1.0, 0.85, T + 0.4), columnMat);
    lintel.position.set(orient === 'v' ? fixed : segC, DOOR_H + 0.12, orient === 'v' ? segC : fixed);
    root.add(lintel);
    const plaque = new THREE.Mesh(orient === 'v' ? new THREE.BoxGeometry(T + 0.42, 0.6, 2.0) : new THREE.BoxGeometry(2.0, 0.6, T + 0.42), trimMat);
    plaque.position.set(orient === 'v' ? fixed : segC, DOOR_H + 0.7, orient === 'v' ? segC : fixed);
    root.add(plaque);
    // dougong-style stepped brackets above the lintel
    for (const dy of [0, 0.34]) {
      const br = new THREE.Mesh(orient === 'v' ? new THREE.BoxGeometry(T + 0.6, 0.22, dw + 1.6 - dy * 3) : new THREE.BoxGeometry(dw + 1.6 - dy * 3, 0.22, T + 0.6), trimMat);
      br.position.set(orient === 'v' ? fixed : segC, DOOR_H + 1.1 + dy, orient === 'v' ? segC : fixed);
      root.add(br);
    }
  }

  function wallLine(orient, fixed, segC, length, interior, grand) {
    const a = segC - length / 2, b = segC + length / 2;
    if (interior) {
      const gA = segC - DOOR_W / 2, gB = segC + DOOR_W / 2;
      for (const [s, e] of [[a, gA], [gB, b]]) if (e - s >= 0.05) addSolid(orient, fixed, (s + e) / 2, e - s, WALL_H, 0);
      addSolid(orient, fixed, segC, DOOR_W, WALL_H - DOOR_H, DOOR_H, false);
      addPortal(orient, fixed, segC, grand);
    } else {
      addSolid(orient, fixed, segC, length, WALL_H, 0);
    }
  }

  // vertical grid lines (walls running along Z)
  for (let c = 0; c <= COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const left = occ(r, c - 1), right = occ(r, c);
      if (!left && !right) continue;
      const grand = (left === 'atrium' || right === 'atrium' || left === 'lobby' || right === 'lobby' || left === 'portico' || right === 'portico');
      wallLine('v', c * CELL_W + OFFX, r * CELL_D + CELL_D / 2 + OFFZ, CELL_D, !!(left && right), grand);
    }
  }
  // horizontal grid lines (walls running along X)
  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const top = occ(r - 1, c), bot = occ(r, c);
      if (!top && !bot) continue;
      if (r === ROWS && top === 'portico') continue;          // open the portico front
      const grand = (top === 'atrium' || bot === 'atrium' || top === 'lobby' || bot === 'lobby' || top === 'portico' || bot === 'portico');
      wallLine('h', r * CELL_D + OFFZ, c * CELL_W + CELL_W / 2 + OFFX, CELL_W, !!(top && bot), grand);
    }
  }

  // ===========================================================================
  // Per-room interior liners + dimensional mouldings + art runs
  // ===========================================================================
  const halfW = CELL_W / 2 - T / 2 - 0.06;
  const halfD = CELL_D / 2 - T / 2 - 0.06;

  for (const id in rooms) {
    const room = rooms[id];
    const { r, c, cx, cz, hall } = room;
    const isArt = !!hall;
    const wallColor = hall ? hall.palette.wall : (room.isTheatre ? '#241c16' : P.wall);
    const wainColor = hall ? hall.palette.wainscot : P.beam;
    const accent = hall ? hall.palette.accent : P.accent;
    const linerMat = new THREE.MeshStandardMaterial({ map: TX.plaster(wallColor, 2), roughness: 0.95, side: THREE.FrontSide });
    const wainMat = new THREE.MeshStandardMaterial({ map: TX.wood(wainColor, 4), roughness: 0.7 });
    const accentMat = new THREE.MeshStandardMaterial({ color: col(accent), roughness: 0.5, metalness: 0.35 });
    const baseMat = new THREE.MeshStandardMaterial({ color: col(wainColor).multiplyScalar(0.7), roughness: 0.6 });
    const fretTex = TX.fret(accent, wainColor);

    const sides = [
      { neigh: occ(r - 1, c), orient: 'h', fixed: cz - halfD, from: cx - halfW, to: cx + halfW, nx: 0, nz: 1 },
      { neigh: occ(r + 1, c), orient: 'h', fixed: cz + halfD, from: cx - halfW, to: cx + halfW, nx: 0, nz: -1 },
      { neigh: occ(r, c - 1), orient: 'v', fixed: cx - halfW, from: cz - halfD, to: cz + halfD, nx: 1, nz: 0 },
      { neigh: occ(r, c + 1), orient: 'v', fixed: cx + halfW, from: cz - halfD, to: cz + halfD, nx: -1, nz: 0 },
    ];
    // open portico front: skip its south liner
    if (room.isPortico) sides[1].skip = true;

    for (const s of sides) {
      if (s.skip) continue;
      const mid = (s.from + s.to) / 2;
      const spans = [];
      if (s.neigh) {
        if (mid - DOOR_W / 2 - s.from > 1.0) spans.push([s.from, mid - DOOR_W / 2]);
        if (s.to - (mid + DOOR_W / 2) > 1.0) spans.push([mid + DOOR_W / 2, s.to]);
      } else spans.push([s.from, s.to]);

      for (const [a, b] of spans) {
        const len = b - a, segC = (a + b) / 2;
        const place = (mesh, y, inward) => { orient(mesh, s, segC, inward); mesh.position.y = y; root.add(mesh); };

        // full-height liner
        const liner = new THREE.Mesh(new THREE.PlaneGeometry(len, WALL_H), linerMat);
        place(liner, WALL_H / 2, 0);
        // dimensional mouldings (boxes proud of the liner)
        const baseboard = new THREE.Mesh(boxFor(s, len, 0.4, 0.14), baseMat); place(baseboard, 0.2, 0.05);
        const wainscot = new THREE.Mesh(boxFor(s, len, 1.15, 0.1), wainMat); place(wainscot, 0.78, 0.04);
        const chair = new THREE.Mesh(boxFor(s, len, 0.18, 0.16), accentMat); place(chair, 1.42, 0.05);
        const rep = Math.max(1, Math.round(len / 1.1));
        const frieze = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.34), friezeMat(fretTex, hall ? hall.id : id, rep));
        place(frieze, 1.66, 0.085);
        const cornice = new THREE.Mesh(boxFor(s, len, 0.45, 0.22), trimMat); place(cornice, WALL_H - 0.35, 0.06);
        const cornice2 = new THREE.Mesh(boxFor(s, len, 0.18, 0.34), accentMat); place(cornice2, WALL_H - 0.7, 0.04);

        if (isArt && len >= 2.0) {
          const faceX = s.orient === 'v' ? s.fixed : segC;
          const faceZ = s.orient === 'v' ? segC : s.fixed;
          hallRuns[id].push({ x: faceX, z: faceZ, dirX: s.orient === 'v' ? 0 : 1, dirZ: s.orient === 'v' ? 1 : 0, nx: s.nx, nz: s.nz, length: len, hall: id });
        }
      }
    }
  }

  function orient(mesh, s, segC, inward) {
    const ox = s.nx * inward, oz = s.nz * inward;
    if (s.orient === 'v') { mesh.position.set(s.fixed + ox, mesh.position.y, segC + oz); mesh.rotation.y = s.nx > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { mesh.position.set(segC + ox, mesh.position.y, s.fixed + oz); mesh.rotation.y = s.nz > 0 ? 0 : Math.PI; }
  }
  function boxFor(s, len, h, depth) {
    return s.orient === 'v' ? new THREE.BoxGeometry(depth, h, len) : new THREE.BoxGeometry(len, h, depth);
  }

  // ===========================================================================
  // Columns at interior grid junctions
  // ===========================================================================
  const colGeo = new THREE.CylinderGeometry(0.5, 0.55, WALL_H - 0.5, 18);
  const capGeo = new THREE.CylinderGeometry(0.7, 0.55, 0.6, 18);
  for (let r = 1; r < ROWS; r++) for (let c = 1; c < COLS; c++) {
    if (occ(r - 1, c - 1) && occ(r - 1, c) && occ(r, c - 1) && occ(r, c)) {
      const x = c * CELL_W + OFFX, z = r * CELL_D + OFFZ;
      const cyl = new THREE.Mesh(colGeo, columnMat); cyl.position.set(x, (WALL_H - 0.5) / 2, z); cyl.castShadow = true; root.add(cyl);
      root.add(placed(new THREE.Mesh(capGeo, trimMat), x, WALL_H - 0.8, z));
      root.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.7, 0.5, 18), trimMat), x, 0.25, z));
      // bracket arms (stylised dougong)
      for (const a of [0, Math.PI / 2]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.28, 0.4), trimMat);
        arm.position.set(x, WALL_H - 1.1, z); arm.rotation.y = a; root.add(arm);
      }
    }
  }

  buildAtrium(root, rooms.atrium, mat, lights, P, columnMat, trimMat);
  buildEntrance(root, rooms.portico, mat, lights, P, columnMat, trimMat, stoneMat, addCollide);

  // outdoor sky dome + ground (seen over the plaza and from the open garden)
  const sky = new THREE.Mesh(new THREE.SphereGeometry(360, 28, 18),
    new THREE.MeshBasicMaterial({ map: TX.sky(), side: THREE.BackSide, fog: false }));
  scene.add(sky);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshStandardMaterial({ color: 0x8f9c79, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.06; scene.add(ground);
  const sunLight = new THREE.DirectionalLight(0xfff4e0, 0.32); sunLight.position.set(60, 90, 40); scene.add(sunLight);

  // spawn on the plaza, south of the portico, looking north (-Z)
  const por = rooms.portico;
  const spawn = { x: por.cx, z: por.cz + CELL_D / 2 + 11, yaw: 0 };

  function roomAt(x, z) {
    const c = Math.floor((x - OFFX) / CELL_W), r = Math.floor((z - OFFZ) / CELL_D);
    const id = occ(r, c);
    return id ? rooms[id] : null;
  }

  return { collide, rooms, roomAt, spawn, hallRuns, lights, ROWS, COLS, CELL_W, CELL_D, OFFX, OFFZ, MAP };
}

// -----------------------------------------------------------------------------
function buildAtrium(root, atrium, mat, lights, P, columnMat, trimMat) {
  const { cx, cz } = atrium;
  const placed = (mesh, x, y, z) => { mesh.position.set(x, y, z); root.add(mesh); return mesh; };
  // floor medallion
  const med = new THREE.Mesh(new THREE.CircleGeometry(5.0, 56),
    new THREE.MeshStandardMaterial({ map: TX.motif('coin', P.column, P.marble), roughness: 0.25, metalness: 0.12 }));
  med.rotation.x = -Math.PI / 2; med.position.set(cx, 0.02, cz); root.add(med);
  const ring = new THREE.Mesh(new THREE.RingGeometry(5.0, 5.6, 56),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(P.columnGold), roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(cx, 0.03, cz); root.add(ring);

  // caisson skylight (藻井): rising square rings to a bright sky panel
  const rings = 6, baseHalf = 7.5;
  for (let i = 0; i < rings; i++) {
    const half = baseHalf * (1 - i / (rings + 1)), y = WALL_H + i * 0.8;
    const m = new THREE.MeshStandardMaterial({ color: i % 2 ? new THREE.Color(P.column) : new THREE.Color(P.columnGold), roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide });
    const bar = (w, d, x, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, d), m); b.position.set(cx + x, y, cz + z); root.add(b); };
    bar(half * 2, 0.6, 0, -half); bar(half * 2, 0.6, 0, half); bar(0.6, half * 2, -half, 0); bar(0.6, half * 2, half, 0);
  }
  const topHalf = baseHalf * (1 - (rings - 1) / (rings + 1));
  const skyPanel = new THREE.Mesh(new THREE.PlaneGeometry(topHalf * 2, topHalf * 2), new THREE.MeshBasicMaterial({ map: TX.sky(), fog: false }));
  skyPanel.rotation.x = Math.PI / 2; skyPanel.position.set(cx, WALL_H + rings * 0.8, cz); root.add(skyPanel);
  const sun = new THREE.PointLight(0xfff2d6, 1.2, 90, 1.3); sun.position.set(cx, WALL_H + 2, cz); root.add(sun); lights.push(sun);

  // four grand columns framing the rotunda
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + sx * 7.5, z = cz + sz * 7.5;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.68, WALL_H - 0.4, 20), columnMat);
    c.position.set(x, (WALL_H - 0.4) / 2, z); c.castShadow = true; root.add(c);
    root.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.66, 0.7, 20), trimMat), x, WALL_H - 0.7, z));
  }
}

// -----------------------------------------------------------------------------
function buildEntrance(root, por, mat, lights, P, columnMat, trimMat, stoneMat, addCollide) {
  const { cx, cz } = por;
  const placed = (mesh, x, y, z) => { mesh.position.set(x, y, z); root.add(mesh); return mesh; };
  const frontZ = cz + CELL_D / 2;     // portico open edge
  const colMat = columnMat;

  // portico roof beam + colonnade across the open front (even count → clear centre)
  const nCols = 6;
  for (let i = 0; i < nCols; i++) {
    const x = cx - CELL_W / 2 + 2 + (i * (CELL_W - 4)) / (nCols - 1);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, WALL_H - 0.3, 18), colMat);
    c.position.set(x, (WALL_H - 0.3) / 2, frontZ - 0.6); c.castShadow = true; root.add(c);
    root.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.6, 0.6, 18), trimMat), x, WALL_H - 0.6, frontZ - 0.6));
    addCollide(x - 0.6, frontZ - 1.2, x + 0.6, frontZ);
  }
  // entablature beam
  const beam = new THREE.Mesh(new THREE.BoxGeometry(CELL_W - 1, 1.0, 1.2), colMat);
  beam.position.set(cx, WALL_H - 0.2, frontZ - 0.6); root.add(beam);

  // sweeping tiled roof over the portico (two stacked hip tiers)
  for (const [w, d, y, depth] of [[CELL_W + 3, 6.0, WALL_H + 1.0, frontZ - CELL_D / 4], [CELL_W - 4, 4.0, WALL_H + 2.6, frontZ - CELL_D / 4]]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), new THREE.MeshStandardMaterial({ color: 0x2b3a44, roughness: 0.7, metalness: 0.2 }));
    roof.position.set(cx, y, depth); roof.rotation.x = -0.18; root.add(roof);
    // gilt ridge
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.18, 0.3), trimMat);
    ridge.position.set(cx, y + 0.5, depth - d / 2 + 0.2); root.add(ridge);
  }

  // grand stone staircase down to the plaza
  const steps = 6, stepDepth = 0.9, stepH = 0.18;
  for (let i = 0; i < steps; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(CELL_W - 2, stepH, stepDepth), stoneMat);
    s.position.set(cx, (steps - i) * stepH - stepH / 2, frontZ + 1 + i * stepDepth);
    s.receiveShadow = true; root.add(s);
  }
  // plaza
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(CELL_W + 24, 40), stoneMat);
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(cx, 0.01, frontZ + 1 + steps * stepDepth + 18); root.add(plaza);

  // a pair of carved guardian lions (石狮) on plinths flanking the steps
  for (const sgn of [-1, 1]) {
    const px = cx + sgn * (CELL_W / 2 - 1), pz = frontZ + 1 + steps * stepDepth + 1.5;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 2), stoneMat); plinth.position.set(px, 0.7, pz); root.add(plinth);
    const moulding = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.22, 2.3), stoneMat); moulding.position.set(px, 1.4, pz); root.add(moulding);
    const lion = makeGuardianLion(sgn); lion.position.set(px, 1.51, pz); root.add(lion);
    addCollide(px - 1.2, pz - 1.2, px + 1.2, pz + 1.2);
  }

  // name plaque (匾额) hung below the eave in the clear CENTRAL bay — the gap
  // between the two centre columns, below the entablature beam and roof, so
  // neither a column nor the roof edge can block it.
  const plaqueY = WALL_H - 1.7;
  const trimB = new THREE.Mesh(new THREE.BoxGeometry(5.3, 1.7, 0.2), trimMat);
  trimB.position.set(cx, plaqueY, frontZ - 0.5); root.add(trimB);
  const board = new THREE.Mesh(new THREE.BoxGeometry(5.0, 1.4, 0.3), new THREE.MeshStandardMaterial({ color: 0x3a1410, roughness: 0.6 }));
  board.position.set(cx, plaqueY, frontZ - 0.42); root.add(board);
  const sign = makeSign(`${BUILDING.nameZh}`, '#3a1410', '#e6c66a');
  sign.scale.set(0.62, 0.66, 1); sign.position.set(cx, plaqueY, frontZ - 0.26); root.add(sign);

  // approach landscaping + warm portico light
  buildLandscaping(root, cx, frontZ, steps * stepDepth, addCollide);
  const l = new THREE.PointLight(0xffe2b0, 0.7, 40, 2); l.position.set(cx, WALL_H - 2, frontZ - 4); root.add(l); lights.push(l);
}

// A seated stone guardian lion: haunches, mane of curls, snout, paws and a ball.
function makeGuardianLion(sgn) {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x9a9082, roughness: 0.85, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x4f483f, roughness: 0.9 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xb8902f, roughness: 0.5, metalness: 0.5 });
  const add = (geo, mt, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mt); m.position.set(x, y, z); m.scale.set(sx, sy, sz); g.add(m); return m; };
  add(new THREE.SphereGeometry(0.55, 12, 10), stone, 0, 0.55, -0.32, 1, 1.1, 1.2);     // haunches
  add(new THREE.CylinderGeometry(0.4, 0.52, 1.05, 10), stone, 0, 0.98, 0.12).rotation.x = 0.16; // chest
  for (const lx of [-0.27, 0.27]) {                                                     // front legs + paws
    add(new THREE.CylinderGeometry(0.15, 0.17, 0.95, 8), stone, lx, 0.5, 0.5);
    add(new THREE.SphereGeometry(0.2, 8, 6), stone, lx, 0.12, 0.66, 1, 0.7, 1.3);
  }
  for (const lx of [-0.36, 0.36]) add(new THREE.SphereGeometry(0.2, 8, 6), stone, lx, 0.12, -0.5, 1, 0.7, 1.3); // rear paws
  add(new THREE.SphereGeometry(0.42, 12, 10), stone, 0, 1.55, 0.34);                    // head
  for (let i = 0; i < 13; i++) { const a = (i / 13) * Math.PI * 2; add(new THREE.SphereGeometry(0.13, 8, 6), stone, Math.cos(a) * 0.46, 1.55 + Math.sin(a) * 0.46, 0.18); } // mane
  add(new THREE.BoxGeometry(0.3, 0.26, 0.32), stone, 0, 1.49, 0.68);                     // snout
  add(new THREE.BoxGeometry(0.22, 0.1, 0.14), dark, 0, 1.42, 0.84);                      // mouth
  for (const ex of [-0.15, 0.15]) add(new THREE.SphereGeometry(0.055, 8, 6), dark, ex, 1.62, 0.64); // eyes
  for (const ex of [-0.34, 0.34]) add(new THREE.SphereGeometry(0.1, 8, 6), stone, ex, 1.85, 0.28, 0.6, 1, 0.6); // ears
  add(new THREE.SphereGeometry(0.28, 12, 10), gold, sgn * 0.3, 0.3, 0.72);               // ball under paw
  add(new THREE.SphereGeometry(0.2, 8, 6), stone, -0.42, 0.95, -0.62);                    // tail
  return g;
}

// trees, hedges and flower beds flanking the approach to the portico
function buildLandscaping(root, cx, frontZ, stepRun, addCollide) {
  const plazaZ = frontZ + 1 + stepRun;
  for (const sgn of [-1, 1]) {
    const ex = cx + sgn * (CELL_W / 2 + 7);
    flowerTree(root, ex, plazaZ + 6, '#e6a9c7');        // blossoming tree
    flowerTree(root, ex, plazaZ + 16, '#dfe7c0', true); // willow-ish
    flowerBed(root, cx + sgn * (CELL_W / 2 - 3), plazaZ + 3.5, 5, 2);
    // a low clipped hedge running along the approach
    for (let k = 0; k < 5; k++) {
      const hz = plazaZ + 6 + k * 2.4;
      const hedge = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 2.2), new THREE.MeshStandardMaterial({ color: 0x4f7a3f, roughness: 0.9, flatShading: true }));
      hedge.position.set(cx + sgn * (CELL_W / 2 + 1.5), 0.45, hz); root.add(hedge);
      addCollide(cx + sgn * (CELL_W / 2 + 1.5) - 0.6, hz - 1.2, cx + sgn * (CELL_W / 2 + 1.5) + 0.6, hz + 1.2);
    }
  }
}
function flowerTree(root, x, z, blossom, weep = false) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x5b3a23, roughness: 0.9 }));
  trunk.position.set(x, 1.7, z); root.add(trunk);
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(blossom), roughness: 0.9, flatShading: true });
  for (let i = 0; i < 7; i++) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 + Math.sin(i * 2) * 0.4, 0), mat);
    const a = (i / 7) * Math.PI * 2;
    blob.position.set(x + Math.cos(a) * 1.3, (weep ? 3.0 : 3.8) + (i % 3) * 0.7, z + Math.sin(a) * 1.3);
    root.add(blob);
  }
}
function flowerBed(root, x, z, w, d) {
  const soil = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 1 }));
  soil.position.set(x, 0.15, z); root.add(soil);
  const colors = [0xd94f5c, 0xe8b13a, 0xe87fae, 0xf0e6cf, 0x9a6fc0];
  for (let i = 0; i < 26; i++) {
    const fx = x + (Math.random() - 0.5) * (w - 0.5), fz = z + (Math.random() - 0.5) * (d - 0.5);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 4), new THREE.MeshStandardMaterial({ color: 0x4f7a3f }));
    stem.position.set(fx, 0.42, fz); root.add(stem);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.7 }));
    head.position.set(fx, 0.62, fz); root.add(head);
  }
}

function makeSign(text, bg, fg) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 1024, 256);
  x.strokeStyle = fg; x.lineWidth = 10; x.strokeRect(16, 16, 992, 224);
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  // shrink the glyphs until the whole title sits comfortably inside the gilt border
  let fs = 150;
  do { x.font = `bold ${fs}px "KaiTi","STKaiti",serif`; fs -= 6; } while (x.measureText(text).width > 900 && fs > 60);
  x.fillText(text, 512, 138);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 1.9), new THREE.MeshBasicMaterial({ map: tex }));
  return m;
}
