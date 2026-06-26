/**
 * garden.js — a Chinese scholar's-garden courtyard (open to the sky): a craggy
 * Taihu-style faux mountain (假山), a still reflecting pond with lotus and an
 * arched stone moon-bridge, a resting pavilion (亭), a moon gate (月洞门), a
 * stone lantern and plantings. Collision is added for the solid features.
 */
import * as THREE from 'three';
import { CELL_W, CELL_D, WALL_H } from './building.js';

const ROCK = () => new THREE.MeshStandardMaterial({ color: 0x6f6b64, roughness: 1, flatShading: true });
const STONE = new THREE.MeshStandardMaterial({ color: 0x9a9082, roughness: 0.9 });
const REDWOOD = new THREE.MeshStandardMaterial({ color: 0x7c1f17, roughness: 0.5 });
const ROOF = new THREE.MeshStandardMaterial({ color: 0x2b3a44, roughness: 0.7, metalness: 0.2 });
const GOLD = new THREE.MeshStandardMaterial({ color: 0xb8902f, roughness: 0.4, metalness: 0.6 });
const FOLIAGE = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true });

function craggyRock(size) {
  const geo = new THREE.IcosahedronGeometry(size, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const f = 1 + (Math.sin(i * 12.9) * 0.5 + Math.sin(i * 4.1) * 0.3) * 0.5;
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * (f * 1.1), pos.getZ(i) * f);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, ROCK());
}

export function buildGarden(parent, room, world) {
  const { cx, cz } = room;
  const g = new THREE.Group(); parent.add(g);

  // raked-gravel ground patch
  const sand = new THREE.Mesh(new THREE.CircleGeometry(CELL_W * 0.46, 40), new THREE.MeshStandardMaterial({ color: 0xd8cfb6, roughness: 1 }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(cx, 0.02, cz); g.add(sand);

  // ---- faux mountain (假山) in the back-left ----
  const mtX = cx - CELL_W * 0.28, mtZ = cz - CELL_D * 0.28;
  const peaks = [[0, 0, 2.4, 6.2], [1.6, 0.6, 1.6, 4.4], [-1.4, 0.8, 1.5, 4.0], [0.4, -1.4, 1.3, 3.4], [-0.8, -0.6, 1.1, 2.6]];
  for (const [dx, dz, s, h] of peaks) {
    const rock = craggyRock(s);
    rock.scale.y = h / (s * 2);
    rock.position.set(mtX + dx, h * 0.42, mtZ + dz);
    rock.rotation.y = dx + dz; g.add(rock);
  }
  // a little waterfall ledge + lower boulders
  for (const [dx, dz, s] of [[2.6, 1.8, 0.9], [-2.4, 1.4, 1.1], [0.2, 2.6, 0.8]]) {
    const r = craggyRock(s); r.position.set(mtX + dx, s * 0.6, mtZ + dz); g.add(r);
  }
  world.collide.push({ minX: mtX - 3.4, minZ: mtZ - 3.4, maxX: mtX + 3.4, maxZ: mtZ + 3.4 });

  // ---- reflecting pond ----
  const pondShape = new THREE.Shape();
  const pr = 7.0, pcx = cx + 2.5, pcz = cz + 2.0;
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 12) {
    const rr = pr * (0.78 + 0.22 * Math.sin(a * 3) + 0.12 * Math.cos(a * 2));
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.8;
    a === 0 ? pondShape.moveTo(px, py) : pondShape.lineTo(px, py);
  }
  const pond = new THREE.Mesh(new THREE.ShapeGeometry(pondShape),
    new THREE.MeshStandardMaterial({ color: 0x2f5b66, roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.9 }));
  pond.rotation.x = -Math.PI / 2; pond.position.set(pcx, 0.06, pcz); g.add(pond);
  // stone rim
  const rim = new THREE.Mesh(new THREE.RingGeometry(pr * 0.95, pr * 1.06, 32), STONE);
  rim.rotation.x = -Math.PI / 2; rim.position.set(pcx, 0.05, pcz); rim.scale.y = 0.8; g.add(rim);
  // lotus pads + flowers
  for (let i = 0; i < 9; i++) {
    const a = i * 2.3, rr = 1.5 + (i % 3) * 1.6;
    const x = pcx + Math.cos(a) * rr, z = pcz + Math.sin(a) * rr * 0.8;
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.45, 10), FOLIAGE(0x3f7a43));
    pad.rotation.x = -Math.PI / 2; pad.position.set(x, 0.08, z); g.add(pad);
    if (i % 2 === 0) {
      const flower = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 8), new THREE.MeshStandardMaterial({ color: 0xe3a6c2, roughness: 0.7 }));
      flower.position.set(x + 0.1, 0.22, z); g.add(flower);
    }
  }
  // koi (simple orange ellipsoids)
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7, koi = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xe8783a : 0xf0e0d0, roughness: 0.5 }));
    koi.scale.set(1, 0.4, 0.5); koi.position.set(pcx + Math.cos(a) * 2.2, 0.12, pcz + Math.sin(a) * 1.8); g.add(koi);
  }

  // ---- arched stone moon-bridge across the pond (walkable) ----
  buildBridge(g, world, pcx - pr * 0.7, pcz, pcx + pr * 0.7, pcz);
  // water is the obstacle, but leave the bridge corridor (z within ±1.1) open
  const pcW = pr * 0.92;
  world.collide.push({ minX: pcx - pcW, minZ: pcz - pr * 0.75, maxX: pcx + pcW, maxZ: pcz - 1.1 });
  world.collide.push({ minX: pcx - pcW, minZ: pcz + 1.1, maxX: pcx + pcW, maxZ: pcz + pr * 0.65 });

  // ---- pavilion (亭) back-right ----
  buildPavilion(g, world, cx + CELL_W * 0.3, cz - CELL_D * 0.26);

  // ---- moon gate (月洞门) against the south wall ----
  const moon = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.32, 14, 36), new THREE.MeshStandardMaterial({ color: 0xeae3d4, roughness: 0.9 }));
  moon.position.set(cx - 2, 2.3, cz + CELL_D * 0.42); g.add(moon);
  const moonBase = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.4, 0.5), STONE); moonBase.position.set(cx - 2, 0.2, cz + CELL_D * 0.42); g.add(moonBase);

  // ---- stone lantern ----
  buildLantern(g, world, cx - CELL_W * 0.34, cz + CELL_D * 0.1);

  // ---- plantings: pine, maple, blossoms, bamboo, flowers, grass ----
  pine(g, cx + CELL_W * 0.34, cz + CELL_D * 0.3);
  maple(g, mtX + 3.5, mtZ + 3.0);
  blossomTree(g, cx + CELL_W * 0.36, cz - CELL_D * 0.05, 0xe6a9c7); // cherry
  blossomTree(g, cx - CELL_W * 0.3, cz + CELL_D * 0.34, 0xf0e6dc);  // plum
  weepingWillow(g, cx - 4, cz + CELL_D * 0.3);
  for (const [bx, bz] of [[-0.36, -0.05], [0.1, 0.38], [-0.42, 0.2], [0.3, -0.36], [0.42, 0.42]])
    bambooClump(g, cx + bx * CELL_W, cz + bz * CELL_D);
  // flower clusters along the pond rim + edges
  for (let i = 0; i < 7; i++) flowerCluster(g, pcx + Math.cos(i * 1.6) * (pr + 1.4), pcz + Math.sin(i * 1.6) * (pr * 0.8 + 1.2));
  flowerCluster(g, cx - CELL_W * 0.4, cz - CELL_D * 0.35);
  flowerCluster(g, cx + CELL_W * 0.42, cz - CELL_D * 0.2);
  // scattered grass tufts on the gravel
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x6f9b46, roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
  for (let i = 0; i < 40; i++) {
    const gx = cx + (Math.random() - 0.5) * CELL_W * 0.8, gz = cz + (Math.random() - 0.5) * CELL_D * 0.8;
    if (Math.hypot(gx - pcx, gz - pcz) < pr) continue;
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 4), grassMat);
    tuft.position.set(gx, 0.2, gz); g.add(tuft);
  }

  // warm garden fill light (sun), no shadows for perf
  const sun = new THREE.DirectionalLight(0xfff3da, 0.5); sun.position.set(cx + 10, 30, cz + 10); g.add(sun);
  return g;
}

function buildBridge(g, world, ax, az, bx, bz) {
  const segs = 9, dx = (bx - ax) / segs, dz = (bz - az) / segs;
  const len = Math.hypot(bx - ax, bz - az), rise = 1.6;
  for (let i = 0; i < segs; i++) {
    const t = (i + 0.5) / segs;
    const y = 0.2 + Math.sin(t * Math.PI) * rise;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(len / segs + 0.05, 0.18, 1.6), STONE);
    deck.position.set(ax + dx * (i + 0.5), y, az + dz * (i + 0.5));
    deck.rotation.z = Math.cos(t * Math.PI) * 0.5; g.add(deck);
    // railing posts
    for (const sz of [-0.85, 0.85]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), REDWOOD);
      post.position.set(ax + dx * (i + 0.5), y + 0.35, az + dz * (i + 0.5) + sz); g.add(post);
    }
  }
  // the bridge deck itself is walkable — no collision box here (the water is the
  // obstacle; see the pond-collision boxes that leave this corridor open).
}

function buildPavilion(g, world, x, z) {
  const r = 3.0;
  // raised stone platform
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.6, r + 0.8, 0.4, 8), STONE); base.position.set(x, 0.2, z); g.add(base);
  // four columns
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 4.2, 12), REDWOOD); c.position.set(px, 2.5, pz); g.add(c);
    world.collide.push({ minX: px - 0.3, minZ: pz - 0.3, maxX: px + 0.3, maxZ: pz + 0.3 });
  }
  // upturned hip roof (two stacked tapered boxes + finial)
  const r1 = new THREE.Mesh(new THREE.ConeGeometry(r + 1.3, 1.4, 4), ROOF); r1.position.set(x, 5.4, z); r1.rotation.y = Math.PI / 4; g.add(r1);
  const r2 = new THREE.Mesh(new THREE.ConeGeometry(r * 0.6, 1.0, 4), ROOF); r2.position.set(x, 6.4, z); r2.rotation.y = Math.PI / 4; g.add(r2);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), GOLD); finial.position.set(x, 7.0, z); g.add(finial);
  // a stone seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 0.6), STONE); seat.position.set(x, 0.75, z - r * 0.6); g.add(seat);
}

function buildLantern(g, world, x, z) {
  const parts = [[0.45, 0.4, 0.2], [0.18, 0.9, 0.65], [0.5, 0.5, 1.45], [0.55, 0.35, 1.95], [0.3, 0.4, 2.3]];
  for (const [rad, h, y] of parts) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.05, h, 8), STONE); seg.position.set(x, y, z); g.add(seg);
  }
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.4, 8), STONE); cap.position.set(x, 2.7, z); g.add(cap);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffdf9e, emissive: 0xffcf66, emissiveIntensity: 0.8 }));
  glow.position.set(x, 1.95, z); g.add(glow);
  world.collide.push({ minX: x - 0.6, minZ: z - 0.6, maxX: x + 0.6, maxZ: z + 0.6 });
}

function pine(g, x, z) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 4.2, 8), new THREE.MeshStandardMaterial({ color: 0x5b3a23, roughness: 0.9 }));
  trunk.position.set(x, 2.1, z); g.add(trunk);
  for (let i = 0; i < 4; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.2 - i * 0.4, 1.6, 8), FOLIAGE(0x2f5d3a));
    cone.position.set(x, 3.2 + i * 1.0, z); g.add(cone);
  }
}
function maple(g, x, z) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 3.0, 8), new THREE.MeshStandardMaterial({ color: 0x5b3a23, roughness: 0.9 }));
  trunk.position.set(x, 1.5, z); g.add(trunk);
  for (let i = 0; i < 5; i++) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + Math.sin(i) * 0.3, 0), FOLIAGE(0xb5532b));
    blob.position.set(x + Math.cos(i * 2) * 1.2, 3.0 + (i % 3) * 0.7, z + Math.sin(i * 2) * 1.2); g.add(blob);
  }
}
function blossomTree(g, x, z, color) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0x5b4634, roughness: 0.9 }));
  trunk.position.set(x, 1.6, z); g.add(trunk);
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.92, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, r = 1.2 + (i % 3) * 0.4;
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85 + Math.sin(i) * 0.3, 0), mat);
    blob.position.set(x + Math.cos(a) * r, 3.2 + (i % 4) * 0.55, z + Math.sin(a) * r); g.add(blob);
  }
  // a few fallen petals on the ground
  for (let i = 0; i < 6; i++) {
    const petal = new THREE.Mesh(new THREE.CircleGeometry(0.12, 5), mat);
    petal.rotation.x = -Math.PI / 2; petal.position.set(x + (Math.random() - 0.5) * 3, 0.04, z + (Math.random() - 0.5) * 3); g.add(petal);
  }
}
function weepingWillow(g, x, z) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, 3.6, 8), new THREE.MeshStandardMaterial({ color: 0x5b4634, roughness: 0.9 }));
  trunk.position.set(x, 1.8, z); g.add(trunk);
  const mat = new THREE.MeshStandardMaterial({ color: 0x7fa64a, roughness: 0.9, flatShading: true });
  const crown = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), mat); crown.position.set(x, 4.2, z); crown.scale.y = 0.7; g.add(crown);
  // drooping strands
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, r = 1.9 + Math.random() * 0.4;
    const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 2.4, 4), mat);
    strand.position.set(x + Math.cos(a) * r, 3.0, z + Math.sin(a) * r); g.add(strand);
  }
}
function flowerCluster(g, x, z) {
  const colors = [0xd94f5c, 0xe8b13a, 0xe87fae, 0xf0e6cf, 0x9a6fc0, 0xe05a3a];
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshStandardMaterial({ color: 0x4f7a3f, roughness: 0.9, flatShading: true }));
  leaf.scale.y = 0.4; leaf.position.set(x, 0.12, z); g.add(leaf);
  for (let i = 0; i < 10; i++) {
    const fx = x + (Math.random() - 0.5) * 1.0, fz = z + (Math.random() - 0.5) * 1.0;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4), new THREE.MeshStandardMaterial({ color: 0x4f7a3f }));
    stem.position.set(fx, 0.32, fz); g.add(stem);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.7 }));
    head.position.set(fx, 0.55, fz); g.add(head);
  }
}
function bambooClump(g, x, z) {
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, h = 3.6 + (i % 3) * 1.0;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, h, 6), FOLIAGE(0x6b9b46));
    stalk.position.set(x + Math.cos(a) * 0.3, h / 2, z + Math.sin(a) * 0.3); stalk.rotation.z = (i / 7 - 0.5) * 0.3; g.add(stalk);
    for (let j = 0; j < 3; j++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 4), FOLIAGE(0x76a851));
      leaf.position.set(x + Math.cos(a) * 0.3, h - 0.4 - j * 0.6, z + Math.sin(a) * 0.3); leaf.rotation.set(0.4, a, 0.6); g.add(leaf);
    }
  }
}
