/**
 * decor.js — interior ornament that gives each hall its character:
 * glowing palace lanterns, hanging name-banners, lattice screens, corner
 * vitrines with procedurally-turned vases (for object halls), planters, and a
 * scholar's-garden courtyard with rockery and a still pond. Lanterns and the
 * skylight read as light through emissive materials, so the scene stays cheap.
 */
import * as THREE from 'three';
import { HALL_BY_ID } from './curation.js';
import { WALL_H, CELL_W, CELL_D } from './building.js';
import * as TX from './textures.js';
import { buildGarden } from './garden.js';
import { placeBench, placeReception, placeStanchion, placeRope, signPanel } from './furniture.js';

export function buildDecor(scene, world) {
  const g = new THREE.Group();
  g.name = 'decor';
  scene.add(g);

  for (const id in world.rooms) {
    const room = world.rooms[id];
    if (room.isAtrium) decorAtrium(g, room, world);
    else if (room.isGarden) buildGarden(g, room, world);
    else if (room.isLobby) decorLobby(g, room, world);
    else if (room.hall) decorHall(g, room, world);
  }
  return g;
}

// --- shared builders ----------------------------------------------------------
function lantern(parent, x, y, z, scale = 1, color = 0xd9342b) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.45 * scale, 16, 12),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.85, roughness: 0.6 })
  );
  body.scale.y = 0.8;
  grp.add(body);
  const capMat = new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.7 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.28 * scale, 0.12 * scale, 10), capMat);
  top.position.y = 0.42 * scale; grp.add(top);
  const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * scale, 0.12 * scale, 0.12 * scale, 10), capMat);
  bot.position.y = -0.42 * scale; grp.add(bot);
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.06 * scale, 0.5 * scale, 8), new THREE.MeshStandardMaterial({ color: 0xe7b53b, emissive: 0x6a4d10, roughness: 0.5 }));
  tassel.position.y = -0.72 * scale; tassel.rotation.x = Math.PI; grp.add(tassel);
  // cord up to ceiling
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, WALL_H - y, 4), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  cord.position.y = (WALL_H - y) / 2 + 0.42 * scale; grp.add(cord);
  grp.position.set(x, y, z);
  parent.add(grp);
  return grp;
}

function banner(parent, x, y, z, ry, hall) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 700;
  const x2 = c.getContext('2d');
  const grad = x2.createLinearGradient(0, 0, 0, 700);
  const base = new THREE.Color(hall.palette.accent);
  grad.addColorStop(0, '#' + base.clone().offsetHSL(0, 0, -0.18).getHexString());
  grad.addColorStop(1, '#' + base.clone().offsetHSL(0, 0, -0.05).getHexString());
  x2.fillStyle = grad; x2.fillRect(0, 0, 256, 700);
  x2.fillStyle = 'rgba(255,245,220,0.9)'; x2.fillRect(14, 14, 228, 672); x2.clearRect(22, 22, 212, 656);
  x2.fillStyle = grad; x2.fillRect(22, 22, 212, 656);
  x2.fillStyle = '#fdf3da'; x2.textAlign = 'center';
  x2.font = 'bold 116px "KaiTi","STKaiti",serif';
  const zh = (hall.nameZh || '').replace(/\s/g, '');
  for (let i = 0; i < zh.length; i++) x2.fillText(zh[i], 128, 150 + i * 124);
  x2.font = '600 30px Georgia, serif';
  x2.fillText((hall.name || '').toUpperCase(), 128, 660);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 3.4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide }));
  m.position.set(x, y, z); m.rotation.y = ry; parent.add(m);
  // pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8), new THREE.MeshStandardMaterial({ color: 0x4a2f1c }));
  pole.rotation.z = Math.PI / 2; pole.position.set(x, y + 1.75, z); pole.rotation.y = ry; parent.add(pole);
}

function vase(color = 0x2552a0, h = 1.0) {
  const pts = [];
  const prof = [[0.0, 0], [0.18, 0.0], [0.26, 0.12], [0.34, 0.34], [0.28, 0.6], [0.16, 0.82], [0.2, 0.95], [0.14, 1.0]];
  for (const [r, y] of prof) pts.push(new THREE.Vector2(r * h * 1.0, y * h));
  const geo = new THREE.LatheGeometry(pts, 24);
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.1 }));
}

function vitrine(parent, x, z, hall) {
  const grp = new THREE.Group();
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.1), new THREE.MeshStandardMaterial({ color: 0x2a211a, roughness: 0.6 }));
  plinth.position.y = 0.5; grp.add(plinth);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.08, 1.16), new THREE.MeshStandardMaterial({ color: new THREE.Color(hall.palette.accent), metalness: 0.4, roughness: 0.4 }));
  top.position.y = 1.02; grp.add(top);
  // object
  const obj = vase(new THREE.Color(hall.palette.accent).getHex(), 0.9);
  obj.position.y = 1.06; grp.add(obj);
  // glass case
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.3, 1.0), new THREE.MeshStandardMaterial({ color: 0xbfe0e6, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0 }));
  glass.position.y = 1.75; grp.add(glass);
  grp.position.set(x, 0, z); parent.add(grp);
}

function latticeScreen(parent, x, y, z, ry, w = 2.4, h = 3.2, accent = '#caa64a') {
  const tex = TX.lattice(accent, 'rgba(60,40,25,0.0)');
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, roughness: 0.7 }));
  m.position.set(x, y, z); m.rotation.y = ry; parent.add(m);
}

// --- per-room decorators ------------------------------------------------------
function decorHall(g, room, world) {
  const hall = room.hall;
  const { cx, cz } = room;
  // two lanterns flanking the room
  lantern(g, cx - CELL_W * 0.3, WALL_H - 1.4, cz - CELL_D * 0.32, 1.0, lanternColor(hall));
  lantern(g, cx + CELL_W * 0.3, WALL_H - 1.4, cz + CELL_D * 0.32, 1.0, lanternColor(hall));
  // name banner on the back wall, up high
  banner(g, cx + CELL_W * 0.36, 4.2, cz, -Math.PI / 2, hall);
  // soft warm fill light so the hall reads well; culled to active halls (perf)
  const fill = new THREE.PointLight(0xfff0d8, 0.32, CELL_W, 1.8);
  fill.position.set(cx, 3.6, cz); g.add(fill);
  room.fillLight = fill;
  // a gallery bench, clear of the central partitions and the doorways
  placeBench(g, world, cx - CELL_W * 0.24, cz + CELL_D * 0.3, 0, 3.2);
  placeBench(g, world, cx + CELL_W * 0.24, cz - CELL_D * 0.3, 0, 3.2);
  // corner vitrines for object halls
  if (hall.display === 'pedestal' || hall.display === 'mixed') {
    const dx = CELL_W * 0.36, dz = CELL_D * 0.36;
    vitrine(g, cx - dx, cz - dz, hall);
    vitrine(g, cx + dx, cz - dz, hall);
    if (hall.display === 'pedestal') { vitrine(g, cx - dx, cz + dz, hall); vitrine(g, cx + dx, cz + dz, hall); }
  } else {
    latticeScreen(g, cx - CELL_W * 0.38, 2.4, cz - CELL_D * 0.3, Math.PI / 2, 2.4, 3.6, hall.palette.accent);
  }
}

function lanternColor(hall) {
  // warmer halls keep red lanterns; cool halls get a softer tone
  const c = new THREE.Color(hall.palette.accent);
  return c.getHSL({}).l > 0.55 ? 0xd9342b : c.getHex();
}

function decorAtrium(g, room, world) {
  const { cx, cz } = room;
  // benches in the four diagonal bays (clear of the doorway axes)
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    placeBench(g, world, cx + sx * 6.4, cz + sz * 6.4, sx * sz > 0 ? Math.PI / 4 : -Math.PI / 4, 3.0);
  }
  // grand central lantern cluster
  lantern(g, cx, WALL_H - 1.0, cz, 1.8, 0xd9342b);
  lantern(g, cx - 3.2, WALL_H - 2.0, cz - 3.2, 1.0);
  lantern(g, cx + 3.2, WALL_H - 2.0, cz - 3.2, 1.0);
  lantern(g, cx - 3.2, WALL_H - 2.0, cz + 3.2, 1.0);
  lantern(g, cx + 3.2, WALL_H - 2.0, cz + 3.2, 1.0);
  // four corner planters with bamboo
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) planter(g, cx + sx * CELL_W * 0.32, cz + sz * CELL_D * 0.32);
  // a warm fill light for the hub
  const l = new THREE.PointLight(0xffe6c0, 0.5, 40, 2);
  l.position.set(cx, 4, cz); g.add(l);
  // welcome stele
  const stele = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.0, 0.4), new THREE.MeshStandardMaterial({ color: 0x6b6f63, roughness: 0.9 }));
  stele.position.set(cx, 1.5, cz + CELL_D * 0.36); g.add(stele);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.4, 0.6), new THREE.MeshStandardMaterial({ color: 0x7c1f17, roughness: 0.6 }));
  cap.position.set(cx, 3.1, cz + CELL_D * 0.36); g.add(cap);
}

function decorLobby(g, room, world) {
  const { cx, cz } = room;
  lantern(g, cx - 5, WALL_H - 1.6, cz, 1.2);
  lantern(g, cx + 5, WALL_H - 1.6, cz, 1.2);
  lantern(g, cx, WALL_H - 1.2, cz, 1.5, 0xd9342b);
  // reception desk (west side, facing arriving visitors), clear of the N–S axis
  placeReception(g, world, cx - CELL_W * 0.27, cz - CELL_D * 0.16, Math.PI);
  // gallery-guide / directory board on the west wall
  const guide = signPanel('馆区导览  ·  Gallery Guide', '#2a1c12', '#e6c66a', 4.2, 1.0);
  guide.position.set(cx - CELL_W * 0.5 + 0.35, 3.0, cz); guide.rotation.y = Math.PI / 2; g.add(guide);
  // seating + greenery
  placeBench(g, world, cx + CELL_W * 0.26, cz - 3, Math.PI / 2, 3.2);
  placeBench(g, world, cx + CELL_W * 0.26, cz + 3, Math.PI / 2, 3.2);
  planter(g, cx - CELL_W * 0.34, cz + CELL_D * 0.28);
  planter(g, cx + CELL_W * 0.34, cz + CELL_D * 0.28);
  // velvet rope leading the eye toward the atrium
  placeStanchion(g, world, cx - 3.2, cz - CELL_D * 0.34);
  placeStanchion(g, world, cx + 3.2, cz - CELL_D * 0.34);
  placeRope(g, cx - 3.2, cz - CELL_D * 0.34, cx + 3.2, cz - CELL_D * 0.34);
}

function planter(g, x, z) {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.38, 0.7, 12), new THREE.MeshStandardMaterial({ color: 0x9c3b2a, roughness: 0.6 }));
  pot.position.set(x, 0.35, z); g.add(pot);
  const stalkMat = new THREE.MeshStandardMaterial({ color: 0x4f7a35, roughness: 0.8 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x5f8f3e, roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const hgt = 2.2 + Math.random() * 1.2;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, hgt, 6), stalkMat);
    stalk.position.set(x + Math.cos(a) * 0.18, 0.7 + hgt / 2, z + Math.sin(a) * 0.18);
    stalk.rotation.z = (Math.random() - 0.5) * 0.2; g.add(stalk);
    for (let j = 0; j < 4; j++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.16), leafMat);
      leaf.position.set(x + Math.cos(a) * 0.18, 1.2 + j * 0.5 + Math.random() * 0.3, z + Math.sin(a) * 0.18);
      leaf.rotation.set(0, a + Math.random(), 0.5 + Math.random() * 0.4); g.add(leaf);
    }
  }
}

function decorGarden(g, room) {
  const { cx, cz } = room;
  // ground patch (sand/gravel)
  const sand = new THREE.Mesh(new THREE.CircleGeometry(CELL_W * 0.42, 32), new THREE.MeshStandardMaterial({ color: 0xcfc6ad, roughness: 1 }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(cx, 0.03, cz); g.add(sand);
  // still pond
  const pond = new THREE.Mesh(new THREE.CircleGeometry(4.0, 32), new THREE.MeshStandardMaterial({ color: 0x3a6b78, roughness: 0.12, metalness: 0.5, transparent: true, opacity: 0.85 }));
  pond.rotation.x = -Math.PI / 2; pond.position.set(cx - 2, 0.05, cz + 2); g.add(pond);
  // rockery (scholar's rocks)
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b6660, roughness: 1, flatShading: true });
  for (const [rx, rz, s] of [[2, -2, 1.4], [3.2, -1, 0.8], [1, -3, 0.6], [-3, -3, 1.0]]) {
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), rockMat);
    rock.position.set(cx + rx, s * 0.6, cz + rz);
    rock.scale.set(1, 1.4 + Math.random() * 0.6, 1);
    rock.rotation.set(Math.random(), Math.random(), Math.random()); g.add(rock);
  }
  // bamboo clumps + a maple-ish tree
  planter(g, cx + CELL_W * 0.28, cz - CELL_D * 0.28);
  tree(g, cx - 3, cz - 4);
  // lanterns
  lantern(g, cx, WALL_H - 1.6, cz, 1.0);
  // perimeter lattice screens evoke garden windows
  latticeScreen(g, cx, 2.2, cz - CELL_D * 0.46, 0, 4, 3.2);
}

function tree(g, x, z) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0x5b3a23, roughness: 0.9 }));
  trunk.position.set(x, 1.6, z); g.add(trunk);
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0xb5532b, roughness: 0.9, flatShading: true });
  for (let i = 0; i < 5; i++) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0 + Math.random() * 0.5, 0), foliageMat);
    blob.position.set(x + (Math.random() - 0.5) * 1.6, 3.2 + Math.random() * 1.2, z + (Math.random() - 0.5) * 1.6);
    g.add(blob);
  }
}
