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
  ['garden', 'portico', null, null],
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
  const trimMat = mat('trim', () => new THREE.MeshStandardMaterial({ color: col(P.columnGold), roughness: 0.4, metalness: 0.55 }));
  const columnMat = mat('col', () => new THREE.MeshStandardMaterial({ color: col(P.column), roughness: 0.5 }));
  const shellMat = mat('shell', () => new THREE.MeshStandardMaterial({ map: TX.plaster(P.wall, 2), color: 0xeae3d4, roughness: 0.95 }));
  const stoneMat = mat('stone', () => new THREE.MeshStandardMaterial({ map: TX.tiles('#cdc4ad', '#b3a98c', 4, 6), roughness: 0.8 }));

  const root = new THREE.Group();
  root.name = 'museum';
  scene.add(root);
  const placed = (mesh, x, y, z) => { mesh.position.set(x, y, z); root.add(mesh); return mesh; };

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
      const floorColor = grand ? P.marble : (hall ? hall.palette.floor : (f.isTheatre ? '#26211b' : P.marbleDark));
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
        const fm = new THREE.MeshStandardMaterial({ map: fretTex.clone(), roughness: 0.6 });
        fm.map.wrapS = THREE.RepeatWrapping; fm.map.repeat.set(Math.max(1, Math.round(len / 1.1)), 1); fm.map.needsUpdate = true;
        const frieze = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.34), fm); place(frieze, 1.66, 0.085);
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
  const sun = new THREE.PointLight(0xfff2d6, 1.7, 90, 1.3); sun.position.set(cx, WALL_H + 2, cz); root.add(sun); lights.push(sun);

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

  // portico roof beam + colonnade across the open front
  const nCols = 5;
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

  // a pair of guardian lion plinths flanking the steps
  for (const sgn of [-1, 1]) {
    const px = cx + sgn * (CELL_W / 2 - 1), pz = frontZ + 1 + steps * stepDepth + 1.5;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 2), stoneMat); plinth.position.set(px, 0.7, pz); root.add(plinth);
    const lion = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), new THREE.MeshStandardMaterial({ color: 0x8d8473, roughness: 0.8, flatShading: true }));
    lion.scale.set(1, 1.1, 1.3); lion.position.set(px, 1.9, pz); root.add(lion);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), lion.material); head.position.set(px, 2.5, pz + 0.5); root.add(head);
    addCollide(px - 1.1, pz - 1.1, px + 1.1, pz + 1.1);
  }

  // bright entrance sign over the doorway (museum name)
  const sign = makeSign(`${BUILDING.nameZh}`, '#7c1f17', '#f5e6bf');
  sign.position.set(cx, WALL_H - 1.6, frontZ - 1.25); root.add(sign);

  // warm light under the portico
  const l = new THREE.PointLight(0xffe2b0, 0.7, 40, 2); l.position.set(cx, WALL_H - 2, frontZ - 4); root.add(l); lights.push(l);
}

function makeSign(text, bg, fg) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 1024, 256);
  x.strokeStyle = fg; x.lineWidth = 10; x.strokeRect(16, 16, 992, 224);
  x.fillStyle = fg; x.font = 'bold 150px "KaiTi","STKaiti",serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 512, 138);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 1.9), new THREE.MeshBasicMaterial({ map: tex }));
  return m;
}
