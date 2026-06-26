/**
 * theatre.js — the documentary screening room: a glowing cinema screen, raked
 * bench seating, and movie posters. Walk up to the screen and press E to pick a
 * film; ui.openCinema() plays it in an embedded YouTube player.
 *
 * All films are public, embeddable documentaries about Chinese art & history.
 */
import * as THREE from 'three';
import { CELL_W, CELL_D, WALL_H } from './building.js';
import { placeBench, signPanel } from './furniture.js';

export const FILMS = [
  { id: 'fD55ETUWig4', title: 'The Greatest Tomb on Earth: Secrets of Ancient China', topic: 'Terracotta Army · 秦' },
  { id: 'qBanFUILfZg', title: 'The Art of Preservation — The Forbidden City', topic: 'Imperial Palace · 故宫' },
  { id: '-LbyuIi9BYI', title: 'Cave Temples of Dunhuang: Art, History & Conservation', topic: 'Buddhist Caves · 敦煌' },
  { id: 'oQdobB0LK6A', title: 'Eternal Offerings: Chinese Ritual Bronzes', topic: 'Bronze Age · 青铜' },
  { id: 'FBKxT9Zhtg8', title: 'The History of Chinese Porcelain', topic: 'Ceramics · 瓷器' },
  { id: 'xhpW9usXFrw', title: 'A Very Long History of Chinese Jade', topic: 'Jade · 玉器' },
  { id: 'ue-93aSnHuI', title: 'Design, Function & Meaning of the Bronze Ritual Vessel', topic: 'Bronze · 礼器' },
];

export function buildTheatre(scene, world) {
  const room = world.rooms.theatre;
  if (!room) return { interactables: [] };
  const { cx, cz } = room;
  const g = new THREE.Group(); g.name = 'theatre'; scene.add(g);
  const hw = CELL_W / 2 - 1.0, hd = CELL_D / 2 - 1.0;
  const screenZ = cz + hd - 0.2;

  // --- screen: a dark mullioned surround + a bright (unlit) display ---
  const surround = new THREE.Mesh(new THREE.BoxGeometry(13.5, 7.6, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.6 }));
  surround.position.set(cx, 4.4, screenZ + 0.2); surround.rotation.y = Math.PI; g.add(surround);

  const screenTex = makeMarquee();
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(12.4, 6.6),
    new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.position.set(cx, 4.5, screenZ); screen.rotation.y = Math.PI;
  screen.userData.kind = 'cinema';
  g.add(screen);
  // soft glow spill from the screen
  const glow = new THREE.PointLight(0x9fc0ff, 0.5, 26, 2.0); glow.position.set(cx, 4.5, screenZ - 4); g.add(glow);
  // gilt frame
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xb8902f, roughness: 0.4, metalness: 0.6 });
  for (const [w, h, y, z] of [[13.0, 0.3, 7.9, 0], [13.0, 0.3, 0.9, 0]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), frameMat); bar.position.set(cx, y, screenZ + 0.1); g.add(bar);
  }

  // --- raked bench seating facing the screen ---
  for (let row = 0; row < 4; row++) {
    const z = cz + hd - 6 - row * 3.4;
    const y = row * 0.25; // gentle rake
    for (const sx of [cx - 4.6, cx + 4.6]) {
      const b = placeBench(g, world, sx, z, 0, 4.0);
      b.position.y = y;
    }
  }

  // --- film posters on the side walls ---
  FILMS.slice(0, 6).forEach((film, i) => {
    const east = i < 3;
    const poster = makePoster(film);
    const along = cz - 5 + (i % 3) * 6.5;
    poster.position.set(east ? cx + hw - 0.1 : cx - hw + 0.1, 3.0, along);
    poster.rotation.y = east ? -Math.PI / 2 : Math.PI / 2;
    g.add(poster);
  });

  // marquee header sign high on the screen wall
  const header = signPanel('纪录片影院  ·  Documentary Theatre', '#1a1014', '#e6c66a', 9, 1.0);
  header.position.set(cx, WALL_H - 0.9, screenZ - 0.05); header.rotation.y = Math.PI; g.add(header);

  // a "press E" hint pedestal in front of the screen
  return { interactables: [screen], group: g };
}

function makeMarquee() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 540;
  const x = c.getContext('2d');
  const grad = x.createLinearGradient(0, 0, 0, 540);
  grad.addColorStop(0, '#101826'); grad.addColorStop(1, '#1c2740');
  x.fillStyle = grad; x.fillRect(0, 0, 1024, 540);
  // film-strip border
  x.fillStyle = '#0a0a0c';
  for (let i = 0; i < 16; i++) { x.fillRect(20 + i * 62, 14, 36, 22); x.fillRect(20 + i * 62, 504, 36, 22); }
  x.fillStyle = '#e6c66a'; x.textAlign = 'center';
  x.font = 'bold 120px "KaiTi","STKaiti",serif'; x.fillText('影 院', 512, 210);
  x.fillStyle = '#cfe0ff'; x.font = '600 40px Georgia, serif'; x.fillText('CHINESE ART · DOCUMENTARY THEATRE', 512, 300);
  x.fillStyle = '#9fb6d8'; x.font = 'italic 32px Georgia, serif'; x.fillText('▶  Press E to choose a film', 512, 380);
  x.font = '26px Georgia, serif'; x.fillStyle = '#7e93b5';
  x.fillText('Terracotta Army · Forbidden City · Dunhuang · Bronzes · Porcelain · Jade', 512, 440);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function makePoster(film) {
  const c = document.createElement('canvas'); c.width = 360; c.height = 540;
  const x = c.getContext('2d');
  const hue = Math.abs(hash(film.id)) % 360;
  const g = x.createLinearGradient(0, 0, 0, 540);
  g.addColorStop(0, `hsl(${hue},45%,22%)`); g.addColorStop(1, `hsl(${hue},35%,10%)`);
  x.fillStyle = g; x.fillRect(0, 0, 360, 540);
  x.strokeStyle = '#caa64a'; x.lineWidth = 8; x.strokeRect(14, 14, 332, 512);
  x.fillStyle = '#f0e6cf'; x.textAlign = 'center';
  x.font = 'bold 34px "KaiTi",serif'; x.fillText(film.topic.split(' · ')[1] || '', 180, 110);
  x.font = '600 22px Georgia, serif';
  wrapText(x, film.title, 180, 380, 320, 30);
  x.fillStyle = '#caa64a'; x.font = 'italic 20px Georgia, serif'; x.fillText('— Documentary —', 180, 500);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.55), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
}

function wrapText(ctx, text, cx, cy, maxW, lh) {
  const words = String(text).split(/\s+/); const lines = []; let line = '';
  for (const w of words) { const t = line + w + ' '; if (ctx.measureText(t).width > maxW && line) { lines.push(line.trim()); line = w + ' '; } else line = t; }
  lines.push(line.trim());
  const startY = cy - (lines.length - 1) * lh / 2;
  lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * lh));
}
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return h; }
