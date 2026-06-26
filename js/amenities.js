/**
 * amenities.js — the café (with a food bar) and the museum shop.
 * Both are furnished rooms with collision so visitors move around the fittings.
 */
import * as THREE from 'three';
import { CELL_W, CELL_D, WALL_H } from './building.js';
import { signPanel, woodGrain } from './furniture.js';

const WOOD = () => new THREE.MeshStandardMaterial({ color: 0x3a2417, roughness: 0.55 });
const DARK = () => new THREE.MeshStandardMaterial({ color: 0x241812, roughness: 0.5 });
const METAL = () => new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.35, metalness: 0.7 });
const GLASS = () => new THREE.MeshStandardMaterial({ color: 0xbfe0e6, transparent: true, opacity: 0.14, roughness: 0.05 });

function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }
function at(mesh, x, y, z, rx, ry, rz) { mesh.position.set(x, y, z); if (rx !== undefined) mesh.rotation.set(rx || 0, ry || 0, rz || 0); return mesh; }
function pendant(g, x, z, color = 0xffe2b0) {
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, WALL_H - 3.2, 4), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  cord.position.set(x, WALL_H - 1.6, z); g.add(cord);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.4, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a1c12, side: THREE.DoubleSide, roughness: 0.6 }));
  shade.position.set(x, WALL_H - 3.2, z); g.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9 }));
  bulb.position.set(x, WALL_H - 3.32, z); g.add(bulb);
}

function makeChair(mat) {
  const g = new THREE.Group();
  g.add(box(0.46, 0.07, 0.46, mat, 0, 0.48, 0));
  g.add(box(0.46, 0.5, 0.07, mat, 0, 0.74, -0.2));
  for (const [sx, sz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) g.add(box(0.06, 0.48, 0.06, mat, sx, 0.24, sz));
  return g;
}

function diningSet(parent, world, x, z) {
  const g = new THREE.Group();
  const wood = WOOD();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.07, 18), new THREE.MeshStandardMaterial({ map: woodGrain(), roughness: 0.4 }));
  top.position.y = 0.74; g.add(top);
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.74, 10), wood), 0, 0.37, 0));
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 14), wood), 0, 0.03, 0));
  // a teacup + small plate on top
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.4 })), 0.18, 0.83, 0));
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 14), new THREE.MeshStandardMaterial({ color: 0xe9e2d0 })), -0.18, 0.79, 0.05));
  for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.4; const ch = makeChair(wood); ch.position.set(Math.cos(a) * 1.18, 0, Math.sin(a) * 1.18); ch.rotation.y = -a - Math.PI / 2; g.add(ch); }
  g.position.set(x, 0, z); parent.add(g);
  world.collide.push({ minX: x - 0.85, minZ: z - 0.85, maxX: x + 0.85, maxZ: z + 0.85 });
}

function serviceCounter(parent, world, x, z, rotY, len, label) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, 1.1, 1.1), new THREE.MeshStandardMaterial({ map: woodGrain(), roughness: 0.5 }));
  body.position.y = 0.55; g.add(body);
  g.add(box(len + 0.2, 0.1, 1.25, DARK(), 0, 1.12, 0));               // counter top
  g.add(box(len + 0.04, 0.18, 1.14, METAL(), 0, 0.78, 0));            // kick band
  if (label) { const s = signPanel(label, '#3a1410', '#e6c66a', Math.min(len, 5), 0.7); s.position.set(0, 0.55, 0.58); g.add(s); }
  g.position.set(x, 0, z); g.rotation.y = rotY; parent.add(g);
  const hw = (Math.abs(Math.cos(rotY)) * len + Math.abs(Math.sin(rotY)) * 1.25) / 2;
  const hd = (Math.abs(Math.sin(rotY)) * len + Math.abs(Math.cos(rotY)) * 1.25) / 2;
  world.collide.push({ minX: x - hw, minZ: z - hd, maxX: x + hw, maxZ: z + hd });
  return g;
}

// ---------------------------------------------------------------------------
export function buildCafe(parent, room, world) {
  const { cx, cz } = room;
  const g = new THREE.Group(); parent.add(g);
  const hd = CELL_D / 2 - 1.2;

  // food bar along the south wall (solid; no doorway there)
  const counter = serviceCounter(g, world, cx, cz + hd - 0.7, Math.PI, 11, '咖  啡  ·  C A F É');
  // pastry display case + treats on the counter
  const caseG = new THREE.Group();
  caseG.add(box(4.2, 0.7, 1.0, GLASS(), 0, 1.55, 0));
  const treat = [0xe7a23a, 0xd94f5c, 0x8a5a2b, 0xf0e6cf, 0xe87fae];
  for (let i = 0; i < 10; i++) g.add(box(0.3, 0.18, 0.3, new THREE.MeshStandardMaterial({ color: treat[i % treat.length], roughness: 0.6 }), cx - 1.8 + i * 0.4, 1.28, cz + hd - 0.7));
  caseG.position.set(cx - 1, 0, cz + hd - 0.7); g.add(caseG);
  // espresso machine + cups
  g.add(box(0.9, 0.7, 0.6, METAL(), cx + 3.6, 1.45, cz + hd - 0.7));
  g.add(box(0.2, 0.4, 0.2, DARK(), cx + 3.4, 1.95, cz + hd - 0.7));
  for (let i = 0; i < 6; i++) g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0xf2efe6 })), cx + 4.5 + (i % 3) * 0.16, 1.25 + Math.floor(i / 3) * 0.14, cz + hd - 0.7));
  // menu board on the wall above the bar
  const menu = makeMenuBoard();
  menu.position.set(cx, 3.4, cz + hd - 0.06); menu.rotation.y = Math.PI; g.add(menu);

  // dining sets, clear of the W/N/E doorways
  for (const [dx, dz] of [[-0.32, -0.28], [0.32, -0.28], [-0.32, 0.12], [0.32, 0.12], [0, -0.08]])
    diningSet(g, world, cx + dx * CELL_W, cz + dz * CELL_D);
  pendant(g, cx - CELL_W * 0.32, cz - CELL_D * 0.28); pendant(g, cx + CELL_W * 0.32, cz - CELL_D * 0.28);
  pendant(g, cx - CELL_W * 0.32, cz + CELL_D * 0.12); pendant(g, cx + CELL_W * 0.32, cz + CELL_D * 0.12);
  const fill = new THREE.PointLight(0xffe6c0, 0.4, CELL_W, 1.8); fill.position.set(cx, 3.6, cz); g.add(fill); room.fillLight = fill;
}

function makeMenuBoard() {
  const c = document.createElement('canvas'); c.width = 900; c.height = 360; const x = c.getContext('2d');
  x.fillStyle = '#1c140e'; x.fillRect(0, 0, 900, 360);
  x.strokeStyle = '#caa64a'; x.lineWidth = 8; x.strokeRect(12, 12, 876, 336);
  x.fillStyle = '#e6c66a'; x.font = 'bold 56px "KaiTi",serif'; x.textAlign = 'center'; x.fillText('菜 单  ·  MENU', 450, 70);
  x.font = '34px Georgia, serif'; x.fillStyle = '#f0e6cf'; x.textAlign = 'left';
  const items = [['Dragon-Well Green Tea', '龙井  ¥18'], ['Pu-erh Tea', '普洱  ¥20'], ['Osmanthus Cake', '桂花糕  ¥22'], ['Mooncake', '月饼  ¥16'], ['Almond Cookies', '杏仁酥  ¥14'], ['Coffee', '咖啡  ¥25']];
  items.forEach(([en, zh], i) => { const yy = 130 + i * 38; x.fillText(en, 60, yy); x.textAlign = 'right'; x.fillText(zh, 840, yy); x.textAlign = 'left'; });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return new THREE.Mesh(new THREE.PlaneGeometry(6.5, 2.6), new THREE.MeshBasicMaterial({ map: tex }));
}

// ---------------------------------------------------------------------------
export function buildShop(parent, room, world) {
  const { cx, cz } = room;
  const g = new THREE.Group(); parent.add(g);
  const hw = CELL_W / 2 - 1.0, hd = CELL_D / 2 - 1.0;

  // wall shelving on the solid south & east walls
  for (let i = 0; i < 4; i++) shelfUnit(g, world, cx - hw + 2.5 + i * 3.2, cz + hd - 0.4, 0);
  for (let i = 0; i < 3; i++) shelfUnit(g, world, cx + hw - 0.4, cz - hd + 3 + i * 3.4, -Math.PI / 2);

  // central merchandise tables
  for (const [dx, dz] of [[-0.18, -0.05], [0.18, -0.05], [0, 0.22]]) merchTable(g, world, cx + dx * CELL_W, cz + dz * CELL_D);

  // checkout counter near the west side, clear of the W/N doorways
  serviceCounter(g, world, cx - CELL_W * 0.3, cz + CELL_D * 0.28, 0, 4.5, '礼品店  ·  S H O P');
  const reg = box(0.5, 0.3, 0.4, DARK(), cx - CELL_W * 0.3 + 1.4, 1.28, cz + CELL_D * 0.28); g.add(reg);

  // sign + lighting
  const sign = signPanel('博物馆礼品店  ·  Museum Shop', '#2a1c12', '#e6c66a', 6, 1.0);
  sign.position.set(cx, WALL_H - 1.0, cz + hd - 0.06); sign.rotation.y = Math.PI; g.add(sign);
  const fill = new THREE.PointLight(0xfff0d8, 0.42, CELL_W, 1.8); fill.position.set(cx, 3.8, cz); g.add(fill); room.fillLight = fill;
}

const ITEM_COLORS = [0x7c1f17, 0x2552a0, 0x355e3b, 0xb8902f, 0x6b2b2b, 0x3f5a6a, 0xe0b955, 0x4a4a52];
function shelfUnit(parent, world, x, z, rotY) {
  const g = new THREE.Group();
  const wood = WOOD();
  g.add(box(2.8, 2.6, 0.5, wood, 0, 1.3, 0));                          // back
  for (let s = 0; s < 4; s++) {
    g.add(box(2.8, 0.06, 0.5, wood, 0, 0.5 + s * 0.6, 0.02));          // shelves
    // merchandise: books (thin boxes) + boxes + a replica vase
    for (let i = 0; i < 7; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: ITEM_COLORS[(s * 7 + i) % ITEM_COLORS.length], roughness: 0.6 });
      g.add(box(0.18, 0.42, 0.34, mat, -1.15 + i * 0.32, 0.74 + s * 0.6, 0.06));
    }
  }
  g.position.set(x, 0, z); g.rotation.y = rotY; parent.add(g);
  const hwd = Math.abs(Math.cos(rotY)) * 1.4 + Math.abs(Math.sin(rotY)) * 0.3;
  const hdd = Math.abs(Math.sin(rotY)) * 1.4 + Math.abs(Math.cos(rotY)) * 0.3;
  world.collide.push({ minX: x - hwd, minZ: z - hdd, maxX: x + hwd, maxZ: z + hdd });
}
function merchTable(parent, world, x, z) {
  const g = new THREE.Group();
  g.add(box(2.2, 0.1, 1.4, new THREE.MeshStandardMaterial({ map: woodGrain(), roughness: 0.4 }), 0, 0.9, 0));
  for (const [sx, sz] of [[-0.95, -0.55], [0.95, -0.55], [-0.95, 0.55], [0.95, 0.55]]) g.add(box(0.1, 0.9, 0.1, WOOD(), sx, 0.45, sz));
  // wares: stacked books, scroll tubes, a replica vase, postcards
  for (let i = 0; i < 5; i++) g.add(box(0.5, 0.1, 0.36, new THREE.MeshStandardMaterial({ color: ITEM_COLORS[i % ITEM_COLORS.length], roughness: 0.6 }), -0.7, 1.0 + i * 0.1, -0.4));
  for (let i = 0; i < 4; i++) g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0x9c3b2a })), 0.2 + i * 0.14, 1.25, 0.2, 0, 0, Math.PI / 2));
  const vase = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.12, 0], [0.18, 0.1], [0.12, 0.3], [0.08, 0.4]].map(([r, y]) => new THREE.Vector2(r, y)), 14), new THREE.MeshStandardMaterial({ color: 0x2552a0, roughness: 0.3 }));
  vase.position.set(0.7, 0.95, -0.3); g.add(vase);
  g.position.set(x, 0, z); parent.add(g);
  world.collide.push({ minX: x - 1.3, minZ: z - 0.9, maxX: x + 1.3, maxZ: z + 0.9 });
}
