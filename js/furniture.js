/**
 * furniture.js — reusable furnishings (gallery benches, reception desk, rope
 * stanchions, info pedestals). Each `place*` helper adds the mesh to `parent`
 * and a collision box to `world.collide` so visitors walk around them.
 */
import * as THREE from 'three';

const WOOD = new THREE.MeshStandardMaterial({ color: 0x3a2417, roughness: 0.55 });
const CUSHION = new THREE.MeshStandardMaterial({ color: 0x6b1f1a, roughness: 0.7 });
const BRASS = new THREE.MeshStandardMaterial({ color: 0xb8902f, roughness: 0.35, metalness: 0.7 });
const STONE = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });

function collideRot(world, x, z, rotY, len, depth) {
  const hw = (Math.abs(Math.cos(rotY)) * len + Math.abs(Math.sin(rotY)) * depth) / 2;
  const hd = (Math.abs(Math.sin(rotY)) * len + Math.abs(Math.cos(rotY)) * depth) / 2;
  world.collide.push({ minX: x - hw, minZ: z - hd, maxX: x + hw, maxZ: z + hd });
}

export function placeBench(parent, world, x, z, rotY = 0, len = 3.4) {
  const g = new THREE.Group();
  const depth = 0.8;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(len, 0.16, depth), WOOD);
  frame.position.y = 0.46; g.add(frame);
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(len - 0.12, 0.12, depth - 0.12), CUSHION);
  cushion.position.y = 0.58; g.add(cushion);
  for (const sx of [-len / 2 + 0.3, len / 2 - 0.3]) for (const sz of [-depth / 2 + 0.18, depth / 2 - 0.18]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.46, 0.12), WOOD);
    leg.position.set(sx, 0.23, sz); g.add(leg);
  }
  g.position.set(x, 0, z); g.rotation.y = rotY; parent.add(g);
  collideRot(world, x, z, rotY, len, depth);
  return g;
}

export function placeReception(parent, world, x, z, rotY = 0) {
  const g = new THREE.Group();
  const w = 5.2, d = 1.4, h = 1.15;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: woodGrain(), roughness: 0.5 }));
  body.position.y = h / 2; g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.1, d + 0.3), new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.3, metalness: 0.1 }));
  top.position.y = h + 0.05; g.add(top);
  const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.18, d + 0.05), BRASS);
  band.position.y = h - 0.25; g.add(band);
  // "Information" panel
  const info = signPanel('问询处  Information', '#7c1f17', '#f3e6c4', 3.2, 0.7);
  info.position.set(0, h + 0.55, -d / 2 - 0.06); g.add(info);
  g.position.set(x, 0, z); g.rotation.y = rotY; parent.add(g);
  collideRot(world, x, z, rotY, w, d);
  return g;
}

export function placeStanchion(parent, world, x, z) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.0, 12), BRASS);
  post.position.y = 0.5; g.add(post);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), BRASS);
  ball.position.y = 1.02; g.add(ball);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.08, 16), STONE);
  base.position.y = 0.04; g.add(base);
  g.position.set(x, 0, z); parent.add(g);
  world.collide.push({ minX: x - 0.22, minZ: z - 0.22, maxX: x + 0.22, maxZ: z + 0.22 });
  return g;
}

// A rope between two stanchions (visual only).
export function placeRope(parent, ax, az, bx, bz) {
  const a = new THREE.Vector3(ax, 0.85, az), b = new THREE.Vector3(bx, 0.85, bz);
  const mid = a.clone().add(b).multiplyScalar(0.5); mid.y -= 0.18;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.03, 6, false), new THREE.MeshStandardMaterial({ color: 0x7c1f17, roughness: 0.8 }));
  parent.add(tube);
}

export function woodGrain() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#3a2417'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) { x.strokeStyle = `rgba(20,10,4,${Math.random() * 0.3})`; x.lineWidth = 1 + Math.random() * 2; x.beginPath(); const y = Math.random() * 256; x.moveTo(0, y); for (let px = 0; px <= 256; px += 16) x.lineTo(px, y + Math.sin(px / 30 + i) * 3); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function signPanel(text, bg, fg, w = 3, h = 0.7) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w);
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(8, 8, c.width - 16, c.height - 16);
  x.fillStyle = fg; x.font = `bold ${Math.round(c.height * 0.4)}px "KaiTi","STKaiti",serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
}
