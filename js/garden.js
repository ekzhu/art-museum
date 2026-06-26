/**
 * garden.js — a Chinese scholar's-garden courtyard (开池叠山), modelled on the
 * classical gardens of Suzhou (拙政园 / 留园 / 网师园). The vocabulary is the real
 * one: 粉墙黛瓦 (white plaster walls capped with dark grey tile), 漏窗 (latticed
 * leak-windows) and a 月洞门 (moon gate) that frame the view; a layered 太湖石
 * rockery (假山) of craggy, perforated limestone read against the white wall like
 * ink on paper; an irregular pond with a rough stone embankment (驳岸), lotus and
 * koi, crossed by a low arched stone bridge; a hexagonal pavilion (亭) with
 * flying upturned eaves; a covered corridor (廊); and a restrained planting
 * palette — pine, bamboo, maple, plum, banana (芭蕉) — over pebble-mosaic paving.
 *
 * The cell's doorways (north + east) are kept clear; freestanding walls are kept
 * short so the player can always walk around them.
 */
import * as THREE from 'three';
import { CELL_W, CELL_D } from './building.js';

// ---- muted, elegant palette (the opposite of a toy rainbow) --------------
const PLASTER  = new THREE.MeshStandardMaterial({ color: 0xeae5d9, roughness: 0.96 });
const TILE     = new THREE.MeshStandardMaterial({ color: 0x36393b, roughness: 0.8, metalness: 0.1 });
const TILE_R   = new THREE.MeshStandardMaterial({ color: 0x474b4e, roughness: 0.8 });
const WOOD     = new THREE.MeshStandardMaterial({ color: 0x5a2a20, roughness: 0.6 });   // dark chestnut
const WOOD_L   = new THREE.MeshStandardMaterial({ color: 0x6f3a2a, roughness: 0.6 });
const STONE    = new THREE.MeshStandardMaterial({ color: 0x938c7e, roughness: 0.95 });
const STONE_L  = new THREE.MeshStandardMaterial({ color: 0xa9a294, roughness: 0.9 });
const STONE_D  = new THREE.MeshStandardMaterial({ color: 0x7b7568, roughness: 1 });
const GOLD     = new THREE.MeshStandardMaterial({ color: 0xb8902f, roughness: 0.4, metalness: 0.6 });
const WATER    = new THREE.MeshStandardMaterial({ color: 0x33505a, roughness: 0.05, metalness: 0.85, transparent: true, opacity: 0.9 });
const BARK     = new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 1 });
const rockMat  = () => new THREE.MeshStandardMaterial({ color: 0x8c867b, roughness: 1, flatShading: true });
const leaf     = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true });

// deterministic jitter so the scene is identical every load (Math.random-free)
let _s = 1337;
const rnd = () => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; };

// ---- a craggy, vertically-elongated Taihu stone: lumpy + eroded hollows ----
// Displacement is driven by low-frequency functions of the vertex DIRECTION, so
// neighbouring vertices move together into rounded lobes (not chaotic spikes),
// with a few broad concavities standing in for the stone's famous perforations.
function taihuStone(h, w) {
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    let d = 0.20 * Math.sin(n.x * 3.1 + 1.0) * Math.cos(n.y * 2.6)
          + 0.15 * Math.sin(n.y * 3.9 + 0.4) * Math.cos(n.z * 3.1 + 2.0)
          + 0.11 * Math.sin(n.z * 4.7 + 0.5) * Math.cos(n.x * 2.2);
    const hollow = Math.sin(n.x * 5.0 + 1.2) * Math.sin(n.y * 5.0 + 0.3) * Math.sin(n.z * 5.0);
    if (hollow > 0.5) d -= 0.16;                       // a broad, rounded erosion hollow
    const f = 1 + d;
    p.setXYZ(i, v.x * w * f, v.y * h * f, v.z * w * f);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, rockMat());
}

export function buildGarden(parent, room, world) {
  const { cx, cz } = room;
  const g = new THREE.Group(); parent.add(g);
  const add = (m, x, y, z, ry = 0) => { m.position.set(x, y, z); if (ry) m.rotation.y = ry; g.add(m); return m; };
  const collide = (x0, z0, x1, z1) => world.collide.push({ minX: Math.min(x0, x1), minZ: Math.min(z0, z1), maxX: Math.max(x0, x1), maxZ: Math.max(z0, z1) });

  // ---------------------------------------------------------------- ground
  // grey flagstone court (replaces the beige sand disc) + a winding pebble path
  const court = new THREE.Mesh(new THREE.PlaneGeometry(CELL_W - 1.4, CELL_D - 1.4),
    new THREE.MeshStandardMaterial({ color: 0x9d978a, roughness: 1 }));
  court.rotation.x = -Math.PI / 2; add(court, cx, 0.015, cz);
  // mossy joints hinted with a slightly greener underlay around the planting edges
  const moss = new THREE.Mesh(new THREE.PlaneGeometry(CELL_W - 1.4, CELL_D - 1.4),
    new THREE.MeshStandardMaterial({ color: 0x6f7d4f, roughness: 1, transparent: true, opacity: 0.18 }));
  moss.rotation.x = -Math.PI / 2; add(moss, cx, 0.012, cz);
  pebblePath(g, [[cx, cz - 11], [cx - 1, cz - 4], [cx - 2.5, cz + 1], [cx - 1, cz + 6], [cx + 4, cz + 9]]);

  // --------------------------------------------------- 粉墙: backdrop wall (W)
  // a free-standing white wall set in from the west perimeter, two leak-windows,
  // with bamboo planted in the gap behind so the lattice frames living green.
  const bwX = cx - 11.5;
  leakWall(g, collide, bwX, cz - 2, Math.PI / 2, 13.5, 3.4);
  for (let i = 0; i < 4; i++) bambooStalkClump(g, bwX - 1.1, cz - 7 + i * 3.2);

  // ----------------------------------------------------- 假山: Taihu rockery
  // layered against the white wall — the classic "rock as ink-painting" view.
  rockery(g, collide, cx - 8.4, cz - 4.5);
  peakStone(g, cx - 3.2, cz - 9.4, 3.0);                 // a lone standing specimen (立峰)

  // ------------------------------------------------------------------- pond
  const pcx = cx - 1.5, pcz = cz + 3.0, pr = 5.6;
  const shape = new THREE.Shape();
  const N = 28, edge = [];
  for (let k = 0; k <= N; k++) {
    const a = (k / N) * Math.PI * 2;
    const rr = pr * (0.82 + 0.2 * Math.sin(a * 3 + 0.5) + 0.1 * Math.cos(a * 2));
    const px = Math.cos(a) * rr * 1.15, pz = Math.sin(a) * rr * 0.85;
    edge.push([pcx + px, pcz + pz]);
    k === 0 ? shape.moveTo(px * 1.15, pz * 0.85) : shape.lineTo(px * 1.15, pz * 0.85);
  }
  const pond = new THREE.Mesh(new THREE.ShapeGeometry(shape), WATER);
  pond.rotation.x = -Math.PI / 2; add(pond, pcx, 0.06, pcz);
  // rough stone embankment (驳岸): individual blocks following the water edge
  for (let k = 0; k < N; k += 1) {
    const [ex, ez] = edge[k];
    const s = 0.5 + rnd() * 0.5;
    const blk = new THREE.Mesh(new THREE.BoxGeometry(0.7 + rnd() * 0.6, 0.35 + rnd() * 0.3, 0.7 + rnd() * 0.5), rnd() > 0.5 ? STONE : STONE_D);
    blk.rotation.y = rnd() * Math.PI; add(blk, ex, 0.12, ez); blk.scale.setScalar(1 + s * 0.2);
  }
  // lotus pads + a few blooms, koi
  for (let i = 0; i < 11; i++) {
    const a = i * 2.39966, rr = 1.2 + (i % 4) * 1.0;
    const lx = pcx + Math.cos(a) * rr * 1.1, lz = pcz + Math.sin(a) * rr * 0.8;
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.4 + rnd() * 0.2, 12), leaf(0x3f6e3f));
    pad.rotation.x = -Math.PI / 2; pad.rotation.z = rnd() * 6; add(pad, lx, 0.085, lz);
    if (i % 3 === 0) {
      const bud = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.34, 7), new THREE.MeshStandardMaterial({ color: 0xe6b3c6, roughness: 0.7 }));
      add(bud, lx + 0.15, 0.24, lz);
    }
  }
  for (let i = 0; i < 5; i++) {
    const a = i * 1.7, koi = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0xe06a2e : 0xeadcc8, roughness: 0.5 }));
    koi.scale.set(1, 0.35, 0.5); add(koi, pcx + Math.cos(a) * 2.4, 0.13, pcz + Math.sin(a) * 1.6, a);
  }
  // low arched stone bridge across the pond's waist (walkable); water blocks the flanks
  archBridge(g, pcx - pr * 0.95, pcz, pcx + pr * 0.95, pcz);
  collide(pcx - pr * 1.15, pcz + 1.1, pcx + pr * 1.15, pcz + pr * 0.95);
  collide(pcx - pr * 1.15, pcz - pr * 0.95, pcx + pr * 1.15, pcz - 1.1);

  // ------------------------------------------------- 月洞门: moon gate (entry)
  // on the path down from the north doorway — walking through frames the garden.
  moonGate(g, collide, cx, cz - 9.6, 0, 8.0, 3.4);

  // ------------------------------------------------------- 亭: garden pavilion
  pavilion(g, collide, cx + 6.5, cz + 6.2);

  // --------------------------------------------------------- 廊: covered corridor
  corridor(g, collide, cx - 6.5, cz + 11.0, cx + 4.5, cz + 11.0);

  // ------------------------------------------------------------- stone lantern
  lantern(g, collide, cx + 4.4, cz - 0.5);

  // ----------------------------------------------- restrained planting palette
  pine(g, cx + 9.5, cz - 2.0);                     // scholar pine by the pavilion
  pine(g, cx - 9.5, cz + 8.0);
  mapleTree(g, cx - 5.5, cz - 1.0);                // red maple by the rockery
  plumTree(g, cx + 3.2, cz - 7.5);                 // sparse plum by the moon gate
  banana(g, bwX + 0.9, cz + 4.2);                  // 芭蕉 beside a leak-window
  for (const [bx, bz] of [[cx + 8.5, cz + 9.5], [cx - 8.5, cz + 1.5], [cx + 2, cz + 9]]) bambooStalkClump(g, bx, bz);
  // a couple of restrained peony / fern clumps (no rainbow beds)
  fernClump(g, cx + 5.5, cz - 4.0); fernClump(g, cx - 3.0, cz + 8.5);
  peony(g, cx + 1.5, cz - 5.2);

  // soft, warm daylight
  const sun = new THREE.DirectionalLight(0xfff3da, 0.45); sun.position.set(cx + 12, 30, cz + 12); g.add(sun);
  return g;
}

// =====================================================================
// walls: 粉墙黛瓦 — white plaster, dark grey tile coping, real openings
// =====================================================================
function copingRun(g, x, z, ry, len) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = ry; g.add(grp);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(len + 0.5, 0.16, 0.74), TILE); cap.position.y = 0.02; grp.add(cap);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(len + 0.6, 0.13, 0.2), TILE_R); ridge.position.y = 0.15; grp.add(ridge);
  // a hint of tube-tile texture along the eave
  for (let i = -Math.floor(len / 0.6); i <= Math.floor(len / 0.6); i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6, 1, false, 0, Math.PI), TILE_R);
    t.rotation.set(Math.PI / 2, 0, 0); t.position.set(i * 0.6, -0.04, 0.37); grp.add(t);
  }
  return grp;
}

// build a plaster wall (length along local X) carrying see-through holes
function holedWall(g, x, z, ry, len, h, holes) {
  const shape = new THREE.Shape();
  shape.moveTo(-len / 2, 0); shape.lineTo(len / 2, 0); shape.lineTo(len / 2, h); shape.lineTo(-len / 2, h); shape.lineTo(-len / 2, 0);
  for (const ho of holes) {
    const path = new THREE.Path();
    if (ho.shape === 'circle') path.absarc(ho.x, ho.y, ho.r, 0, Math.PI * 2, true);
    else { const w = ho.w / 2, hh = ho.hh / 2; path.moveTo(ho.x - w, ho.y - hh); path.lineTo(ho.x - w, ho.y + hh); path.lineTo(ho.x + w, ho.y + hh); path.lineTo(ho.x + w, ho.y - hh); path.lineTo(ho.x - w, ho.y - hh); }
    shape.holes.push(path);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.28, bevelEnabled: false });
  geo.translate(0, 0, -0.14);
  const wall = new THREE.Mesh(geo, PLASTER);
  wall.position.set(x, 0, z); wall.rotation.y = ry; g.add(wall);
  copingRun(g, x, z, ry, len).position.y = h;
  return wall;
}

function leakWall(g, collide, x, z, ry, len, h) {
  const wy = h * 0.56, ww = 1.7, wh = 1.7;
  const offs = [-len * 0.26, len * 0.26];
  holedWall(g, x, z, ry, len, h, offs.map((o) => ({ shape: 'rect', x: o, y: wy, w: ww, hh: wh })));
  // stone frame + lattice grille in each opening
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = ry; g.add(grp);
  for (const o of offs) {
    const frame = new THREE.Mesh(new THREE.TorusGeometry(ww * 0.72, 0.08, 8, 4), STONE_L);
    frame.rotation.z = Math.PI / 4; frame.scale.set(1, 1, 1); frame.position.set(o, wy, 0); grp.add(frame);
    latticeGrille(grp, o, wy, ww, wh);
  }
  // collide the wall (it's solid below the windows)
  const cs = Math.sin(ry), cc = Math.cos(ry);
  collide(x - cc * len / 2 - cs * 0.2, z - cs * len / 2 - cc * 0.2, x + cc * len / 2 + cs * 0.2, z + cs * len / 2 + cc * 0.2);
}

function latticeGrille(grp, ox, oy, w, h) {
  const bar = (lx, ly, lw, lh) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(lw, lh, 0.06), STONE_L);
    m.position.set(ox + lx, oy + ly, 0); grp.add(m);
  };
  // a simple, elegant "square-in-circle" grille
  for (const gx of [-w * 0.18, w * 0.18]) bar(gx, 0, 0.05, h * 0.9);
  for (const gy of [-h * 0.18, h * 0.18]) bar(0, gy, w * 0.9, 0.05);
  // central diamond
  for (const r of [0, Math.PI / 2]) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(w * 0.34, 0.05, 0.06), STONE_L);
    d.position.set(ox, oy, 0); d.rotation.z = Math.PI / 4 + r; grp.add(d);
  }
}

function moonGate(g, collide, x, z, ry, len, h) {
  const R = 1.25, yc = 1.42;
  holedWall(g, x, z, ry, len, h, [{ shape: 'circle', x: 0, y: yc, r: R }]);
  // grey stone ring framing the opening (both faces) + threshold
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = ry; g.add(grp);
  for (const zz of [-0.17, 0.17]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.04, 0.1, 10, 40), STONE_L);
    ring.position.set(0, yc, zz); grp.add(ring);
  }
  const sill = new THREE.Mesh(new THREE.BoxGeometry(R * 2.1, 0.16, 0.5), STONE); sill.position.set(0, 0.08, 0); grp.add(sill);
  // collide the solid wall either side of the opening (centre stays walkable)
  const cs = Math.sin(ry), cc = Math.cos(ry), side = (len / 2 - R) / 2, off = R + side;
  for (const sgn of [-1, 1]) {
    const wx = x + cc * sgn * off, wz = z + cs * sgn * off;
    collide(wx - cc * side - cs * 0.18, wz - cs * side - cc * 0.18, wx + cc * side + cs * 0.18, wz + cs * side + cc * 0.18);
  }
}

// =====================================================================
// rockery
// =====================================================================
function rockery(g, collide, x, z) {
  const specs = [
    [0, 0, 1.5, 4.4, 0.0], [1.6, 0.5, 1.1, 3.2, 0.6], [-1.5, 0.4, 1.2, 2.9, -0.5],
    [0.6, -1.4, 1.0, 2.3, 0.3], [-0.7, -1.1, 0.9, 1.9, 1.0], [2.4, 1.5, 0.8, 1.6, 0.2],
    [-2.4, 1.3, 0.9, 1.7, -0.3], [0.2, 1.8, 0.8, 1.3, 0.0],
  ];
  for (const [dx, dz, w, h, rot] of specs) {
    const s = taihuStone(h, w);
    s.position.set(x + dx, h * 0.46, z + dz);
    s.rotation.set(Math.sin(dx) * 0.12, rot, Math.cos(dz) * 0.12);
    g.add(s);
  }
  collide(x - 3.0, z - 2.8, x + 3.2, z + 2.6);
}
function peakStone(g, x, z, h) {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.4, 8), STONE); base.position.set(x, 0.2, z); g.add(base);
  const s = taihuStone(h, 0.75); s.position.set(x, h * 0.5 + 0.4, z); s.rotation.y = 1.1; g.add(s);
}

// =====================================================================
// pavilion (亭) with flying, upturned eaves
// =====================================================================
function pavilion(g, collide, x, z) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); g.add(grp);
  const R = 3.0, colY = 3.6;
  // stone platform (two steps)
  grp.add(disc(R + 1.1, 0.3, STONE, 0.15));
  grp.add(disc(R + 0.7, 0.3, STONE_L, 0.42));
  // six columns + 美人靠 seat-rail between the back four
  const colA = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + i * Math.PI / 3, px = Math.cos(a) * R, pz = Math.sin(a) * R; colA.push([px, pz, a]);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, colY, 12), WOOD); c.position.set(px, colY / 2 + 0.4, pz); grp.add(c);
    collide(x + px - 0.3, z + pz - 0.3, x + px + 0.3, z + pz + 0.3);
  }
  // goose-neck seat rail (美人靠) on the three rear bays
  for (let i = 0; i < 6; i++) {
    const [ax, az] = colA[i], [bx, bz] = colA[(i + 1) % 6];
    if (i === 0 || i === 5) continue;                 // leave front bays open
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, ang = Math.atan2(bz - az, bx - ax), L = Math.hypot(bx - ax, bz - az);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(L * 0.92, 0.12, 0.4), WOOD_L); seat.position.set(mx, 0.95, mz); seat.rotation.y = -ang; grp.add(seat);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(L * 0.92, 0.08, 0.1), WOOD_L); rail.position.set(mx, 1.45, mz); rail.rotation.y = -ang; grp.add(rail);
  }
  // entablature ring + the roof
  const ent = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.3, R + 0.3, 0.3, 6), WOOD); ent.position.y = colY + 0.55; ent.rotation.y = Math.PI / 6; grp.add(ent);
  const eaveY = colY + 0.7;
  // two stacked cones give the concave "sway-back" Chinese roofline
  const lower = new THREE.Mesh(new THREE.ConeGeometry(R + 1.5, 0.95, 6), TILE); lower.position.y = eaveY + 0.45; lower.rotation.y = Math.PI / 6; grp.add(lower);
  const upper = new THREE.Mesh(new THREE.ConeGeometry(R + 0.2, 1.7, 6), TILE); upper.position.y = eaveY + 1.4; upper.rotation.y = Math.PI / 6; grp.add(upper);
  // ridge lines from the finial down each hip
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + i * Math.PI / 3;
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, R + 1.6), TILE_R);
    ridge.position.set(Math.cos(a) * (R + 1.5) / 2, eaveY + 1.0, Math.sin(a) * (R + 1.5) / 2);
    ridge.rotation.set(-0.5, -a + Math.PI / 2, 0); grp.add(ridge);
  }
  // ★ flying upturned eave horns at the six corners (the signature element)
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + i * Math.PI / 3;
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(R + 1.2, eaveY + 0.15, 0),
      new THREE.Vector3(R + 1.95, eaveY + 0.2, 0),
      new THREE.Vector3(R + 2.15, eaveY + 1.05, 0));
    const horn = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.1, 6), TILE);
    horn.rotation.y = a; grp.add(horn);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), GOLD);
    tip.position.set(Math.cos(a) * (R + 2.15), eaveY + 1.1, Math.sin(a) * (R + 2.15)); grp.add(tip);
  }
  // finial
  const f1 = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), GOLD); f1.position.y = eaveY + 2.3; grp.add(f1);
  const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 8), GOLD); f2.position.y = eaveY + 2.7; grp.add(f2);
}

// =====================================================================
// covered corridor (廊)
// =====================================================================
function corridor(g, collide, ax, az, bx, bz) {
  const grp = new THREE.Group(); g.add(grp);
  const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax);
  const mx = (ax + bx) / 2, mz = (az + bz) / 2;
  // stone walkway
  const path = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 2.0), STONE_L); path.position.set(mx, 0.06, mz); path.rotation.y = -ang; grp.add(path);
  const n = Math.max(2, Math.round(len / 2.6));
  for (let i = 0; i <= n; i++) {
    const t = i / n, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
    for (const sgn of [-1, 1]) {
      const ox = Math.cos(ang + Math.PI / 2) * 0.85 * sgn, oz = Math.sin(ang + Math.PI / 2) * 0.85 * sgn;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 3.0, 8), WOOD); post.position.set(px + ox, 1.5, pz + oz); grp.add(post);
      if (sgn < 0) collide(px + ox - 0.25, pz + oz - 0.25, px + ox + 0.25, pz + oz + 0.25);
    }
  }
  // sloped tiled roof (two pitches)
  for (const sgn of [-1, 1]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(len + 0.6, 0.14, 1.5), TILE);
    const ox = Math.cos(ang + Math.PI / 2) * 0.55 * sgn, oz = Math.sin(ang + Math.PI / 2) * 0.55 * sgn;
    roof.position.set(mx + ox, 3.25 - 0.18, mz + oz); roof.rotation.set(sgn * 0.32, -ang, 0); grp.add(roof);
  }
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(len + 0.7, 0.16, 0.18), TILE_R); ridge.position.set(mx, 3.42, mz); ridge.rotation.y = -ang; grp.add(ridge);
}

// =====================================================================
// small props
// =====================================================================
function disc(r, h, mat, y) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.15, h, 24), mat); m.position.y = y; return m; }

function archBridge(g, ax, az, bx, bz) {
  const segs = 9, dx = (bx - ax) / segs, dz = (bz - az) / segs, len = Math.hypot(bx - ax, bz - az), rise = 1.15;
  for (let i = 0; i < segs; i++) {
    const t = (i + 0.5) / segs, y = 0.25 + Math.sin(t * Math.PI) * rise;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(len / segs + 0.06, 0.16, 1.5), STONE_L);
    deck.position.set(ax + dx * (i + 0.5), y, az + dz * (i + 0.5)); deck.rotation.z = Math.cos(t * Math.PI) * 0.42; g.add(deck);
    for (const sz of [-0.8, 0.8]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.46, 0.09), STONE); post.position.set(ax + dx * (i + 0.5), y + 0.32, az + dz * (i + 0.5) + sz); g.add(post);
      if (i > 0 && i < segs - 1) {
        const railSeg = new THREE.Mesh(new THREE.BoxGeometry(len / segs + 0.1, 0.08, 0.08), STONE);
        railSeg.position.set(ax + dx * (i + 0.5), y + 0.55, az + dz * (i + 0.5) + sz); railSeg.rotation.z = Math.cos(t * Math.PI) * 0.42; g.add(railSeg);
      }
    }
  }
}

function lantern(g, collide, x, z) {
  const parts = [[0.42, 0.4, 0.2], [0.16, 0.9, 0.65], [0.46, 0.5, 1.4], [0.5, 0.32, 1.85], [0.28, 0.36, 2.18]];
  for (const [rad, h, y] of parts) { const seg = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.05, h, 6), STONE); seg.position.set(x, y, z); g.add(seg); }
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.42, 6), STONE); cap.position.set(x, 2.5, z); g.add(cap);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffcf66, emissiveIntensity: 0.7 }));
  glow.position.set(x, 1.85, z); g.add(glow);
  collide(x - 0.55, z - 0.55, x + 0.55, z + 0.55);
}

function pebblePath(g, pts) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const n = 60;
  for (let i = 0; i <= n; i++) {
    const p = curve.getPoint(i / n), tan = curve.getTangent(i / n);
    const nx = -tan.z, nz = tan.x;
    for (let j = -2; j <= 2; j++) {
      const sx = p.x + nx * j * 0.32 + (rnd() - 0.5) * 0.12, sz = p.z + nz * j * 0.32 + (rnd() - 0.5) * 0.12;
      const peb = new THREE.Mesh(new THREE.SphereGeometry(0.1 + rnd() * 0.05, 6, 5), rnd() > 0.5 ? STONE : STONE_D);
      peb.scale.y = 0.4; peb.position.set(sx, 0.04, sz); g.add(peb);
    }
  }
}

// =====================================================================
// plantings — restrained, asymmetric, naturalistic
// =====================================================================
function pine(g, x, z) {
  // a leaning scholar-pine with flat, umbrella-like foliage layers
  const lean = (rnd() - 0.5) * 0.3;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 4.0, 8), BARK); trunk.position.set(x, 2.0, z); trunk.rotation.z = lean; g.add(trunk);
  const tip = [x + Math.sin(lean) * 2.0, 4.0, z];
  const layers = [[0, 4.0, 2.4], [1.4, 3.4, 1.7], [-1.5, 3.0, 1.5], [0.3, 4.7, 1.6]];
  for (const [dx, ly, r] of layers) {
    const pad = new THREE.Mesh(new THREE.ConeGeometry(r, 0.7, 9), leaf(0x33502f)); pad.scale.y = 0.5;
    pad.position.set(x + dx, ly, z + (rnd() - 0.5) * 1.4); g.add(pad);
    const pad2 = new THREE.Mesh(new THREE.ConeGeometry(r * 0.7, 0.5, 9), leaf(0x3c5d36)); pad2.scale.y = 0.5;
    pad2.position.set(x + dx, ly + 0.4, z + (rnd() - 0.5) * 1.2); g.add(pad2);
  }
}
function mapleTree(g, x, z) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 2.8, 8), BARK); trunk.position.set(x, 1.4, z); g.add(trunk);
  const mat = leaf(0x9c4324), mat2 = leaf(0xb05a2c);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, r = 0.9 + (i % 3) * 0.4;
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75 + Math.sin(i) * 0.2, 0), i % 2 ? mat : mat2);
    blob.position.set(x + Math.cos(a) * r, 2.9 + (i % 3) * 0.5, z + Math.sin(a) * r); g.add(blob);
  }
}
function plumTree(g, x, z) {
  // gnarled dark branches with sparse pale blossom — elegant, not a blob
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 2.2, 7), new THREE.MeshStandardMaterial({ color: 0x33271f, roughness: 1 }));
  trunk.position.set(x, 1.1, z); trunk.rotation.z = 0.12; g.add(trunk);
  const blossom = new THREE.MeshStandardMaterial({ color: 0xe7c2cf, roughness: 0.9, flatShading: true });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4, L = 1.4 + rnd() * 0.6;
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, L, 5), new THREE.MeshStandardMaterial({ color: 0x33271f, roughness: 1 }));
    br.position.set(x + Math.cos(a) * 0.5, 2.2 + i * 0.18, z + Math.sin(a) * 0.5); br.rotation.set(Math.cos(a) * 0.9, 0, Math.sin(a) * -0.9); g.add(br);
    for (let j = 0; j < 5; j++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), blossom);
      f.position.set(x + Math.cos(a) * (0.6 + j * 0.22), 2.4 + i * 0.18 + j * 0.12, z + Math.sin(a) * (0.6 + j * 0.22)); g.add(f);
    }
  }
}
function banana(g, x, z) {
  // 芭蕉 — a clump of big upright paddle leaves
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.6, 8), leaf(0x6f7d3f)); trunk.position.set(x, 0.8, z); g.add(trunk);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, tilt = 0.5 + rnd() * 0.4;
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.6), new THREE.MeshStandardMaterial({ color: 0x4f7d34, roughness: 0.9, side: THREE.DoubleSide }));
    blade.position.set(x + Math.cos(a) * 0.5, 2.2, z + Math.sin(a) * 0.5);
    blade.rotation.set(tilt * Math.cos(a + Math.PI / 2), -a, tilt * Math.sin(a + Math.PI / 2)); g.add(blade);
  }
}
function bambooStalkClump(g, x, z) {
  const stalkMat = leaf(0x6f8a3e), leafMat = leaf(0x83a44c);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, off = 0.18 + rnd() * 0.28, h = 4.4 + rnd() * 1.8;
    const sx = x + Math.cos(a) * off, sz = z + Math.sin(a) * off;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, h, 6), stalkMat);
    stalk.position.set(sx, h / 2, sz); stalk.rotation.z = (rnd() - 0.5) * 0.16; g.add(stalk);
    for (let j = 0; j < 3; j++) {
      const lf = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7, 4), leafMat);
      lf.position.set(sx, h - 0.5 - j * 0.7, sz); lf.rotation.set(0.5, a + j, 0.7); g.add(lf);
    }
  }
}
function fernClump(g, x, z) {
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, r = 0.15 + rnd() * 0.3;
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.8 + rnd() * 0.4, 4), leaf(0x4f7a3a));
    blade.position.set(x + Math.cos(a) * r, 0.45, z + Math.sin(a) * r); blade.rotation.set((rnd() - 0.5) * 0.6, a, (rnd() - 0.5) * 0.6); g.add(blade);
  }
}
function peony(g, x, z) {
  const bush = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), leaf(0x4f7a3f)); bush.scale.y = 0.6; bush.position.set(x, 0.5, z); g.add(bush);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xd9576b : 0xf0e3d0, roughness: 0.7 }));
    f.position.set(x + Math.cos(a) * 0.5, 0.7, z + Math.sin(a) * 0.5); g.add(f);
  }
}
