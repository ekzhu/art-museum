/**
 * textures.js — procedural canvas textures, so the building needs no external
 * image assets (only the artworks themselves stream from Wikimedia). Every
 * generator returns a THREE.CanvasTexture. Results are cached by key.
 */
import * as THREE from 'three';

const cache = new Map();
function memo(key, make) {
  if (cache.has(key)) return cache.get(key);
  const t = make();
  cache.set(key, t);
  return t;
}

function canvas(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}
function tex(c, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---- Polished stone / marble -------------------------------------------------
export function marble(base = '#e8e2d4', vein = '#bcae90', repeat = 3) {
  return memo(`marble${base}${vein}${repeat}`, () => {
    const c = canvas(512), x = c.getContext('2d');
    x.fillStyle = base;
    x.fillRect(0, 0, 512, 512);
    // subtle mottling
    for (let i = 0; i < 2200; i++) {
      const a = Math.random() * 0.05;
      x.fillStyle = `rgba(150,140,115,${a})`;
      const r = 2 + Math.random() * 30;
      x.beginPath();
      x.arc(Math.random() * 512, Math.random() * 512, r, 0, 7);
      x.fill();
    }
    // veins
    x.strokeStyle = vein;
    x.globalAlpha = 0.35;
    for (let i = 0; i < 18; i++) {
      x.lineWidth = 0.5 + Math.random() * 1.5;
      x.beginPath();
      let px = Math.random() * 512, py = Math.random() * 512;
      x.moveTo(px, py);
      for (let s = 0; s < 12; s++) {
        px += (Math.random() - 0.5) * 90;
        py += (Math.random() - 0.5) * 90;
        x.lineTo(px, py);
      }
      x.stroke();
    }
    x.globalAlpha = 1;
    return tex(c, repeat);
  });
}

// ---- Stone tiles with grout lines -------------------------------------------
export function tiles(base = '#d8cfb8', grout = '#b3a98c', n = 4, repeat = 4) {
  return memo(`tiles|${base}|${grout}|${n}|${repeat}`, () => {
    const c = canvas(512), x = c.getContext('2d');
    x.fillStyle = base;
    x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1400; i++) {
      x.fillStyle = `rgba(120,108,80,${Math.random() * 0.04})`;
      x.fillRect(Math.random() * 512, Math.random() * 512, 6, 6);
    }
    const s = 512 / n;
    x.strokeStyle = grout;
    x.lineWidth = 4;
    for (let i = 0; i <= n; i++) {
      x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, 512); x.stroke();
      x.beginPath(); x.moveTo(0, i * s); x.lineTo(512, i * s); x.stroke();
    }
    return tex(c, repeat);
  });
}

// ---- Wood grain --------------------------------------------------------------
export function wood(base = '#5a4632', repeat = 2) {
  return memo(`wood${base}${repeat}`, () => {
    const c = canvas(512), x = c.getContext('2d');
    x.fillStyle = base;
    x.fillRect(0, 0, 512, 512);
    const col = new THREE.Color(base);
    for (let i = 0; i < 90; i++) {
      const shade = (Math.random() - 0.5) * 0.18;
      const cc = col.clone().offsetHSL(0, 0, shade);
      x.strokeStyle = `#${cc.getHexString()}`;
      x.globalAlpha = 0.5;
      x.lineWidth = 1 + Math.random() * 3;
      x.beginPath();
      const y = Math.random() * 512;
      x.moveTo(0, y);
      for (let px = 0; px <= 512; px += 16) x.lineTo(px, y + Math.sin(px / 40 + i) * 4 + (Math.random() - 0.5) * 3);
      x.stroke();
    }
    x.globalAlpha = 1;
    return tex(c, repeat);
  });
}

// ---- Plaster / painted wall --------------------------------------------------
export function plaster(base = '#efe9dc', repeat = 2) {
  return memo(`plaster${base}${repeat}`, () => {
    const c = canvas(256), x = c.getContext('2d');
    x.fillStyle = base;
    x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4000; i++) {
      const a = Math.random() * 0.035;
      x.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
      x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    return tex(c, repeat);
  });
}

// ---- 回纹 key-fret / meander border (tileable strip) -------------------------
export function fret(line = '#caa64a', bg = '#7c1f17') {
  return memo(`fret${line}${bg}`, () => {
    const c = canvas(128), x = c.getContext('2d');
    x.fillStyle = bg;
    x.fillRect(0, 0, 128, 128);
    x.strokeStyle = line;
    x.lineWidth = 8;
    x.lineJoin = 'miter';
    // a single Greek-key / 回 unit, repeated by texture wrap
    const p = new Path2D('M16 112 L16 40 L72 40 L72 72 L44 72 L44 56 L88 56 L88 96 L16 96');
    x.stroke(p);
    x.strokeRect(8, 8, 112, 112);
    return tex(c, 1);
  });
}

// ---- Chinese lattice window (棂花) -------------------------------------------
export function lattice(line = '#3f2a1d', bg = 'rgba(255,245,220,0.92)', repeat = 1) {
  return memo(`lattice${line}${bg}${repeat}`, () => {
    const c = canvas(256), x = c.getContext('2d');
    x.fillStyle = bg;
    x.fillRect(0, 0, 256, 256);
    x.strokeStyle = line;
    x.lineWidth = 7;
    const n = 4, s = 256 / n;
    for (let i = 0; i <= n; i++) {
      x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, 256); x.stroke();
      x.beginPath(); x.moveTo(0, i * s); x.lineTo(256, i * s); x.stroke();
    }
    // diagonal cross-bracing in each cell — the classic "cracked-ice"/cross motif
    x.lineWidth = 4;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const ox = i * s, oy = j * s;
        x.beginPath();
        x.moveTo(ox + s * 0.5, oy + s * 0.12); x.lineTo(ox + s * 0.88, oy + s * 0.5);
        x.lineTo(ox + s * 0.5, oy + s * 0.88); x.lineTo(ox + s * 0.12, oy + s * 0.5);
        x.closePath(); x.stroke();
      }
    return tex(c, repeat);
  });
}

// ---- Coffered / caisson ceiling panel (藻井-inspired) ------------------------
export function coffer(base = '#f3eee2', line = '#caa64a', accent = '#7c1f17') {
  return memo(`coffer${base}${line}${accent}`, () => {
    const c = canvas(256), x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = line; x.lineWidth = 10; x.strokeRect(6, 6, 244, 244);
    x.strokeStyle = accent; x.lineWidth = 5; x.strokeRect(28, 28, 200, 200);
    x.fillStyle = accent;
    x.beginPath(); x.arc(128, 128, 30, 0, 7); x.fill();
    x.fillStyle = line;
    x.beginPath(); x.arc(128, 128, 14, 0, 7); x.fill();
    return tex(c, 1);
  });
}

/**
 * Stylised ornamental medallion / motif on a transparent canvas, used on
 * banners, plinth fronts and wall roundels. `type` selects the emblem.
 */
export function motif(type, color = '#caa64a', bg = null) {
  return memo(`motif${type}${color}${bg}`, () => {
    const S = 256, c = canvas(S), x = c.getContext('2d');
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, S, S); }
    x.strokeStyle = color; x.fillStyle = color; x.lineWidth = 6;
    x.lineJoin = 'round'; x.lineCap = 'round';
    const cx = S / 2, cy = S / 2;
    const ring = (r) => { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke(); };
    const cloud = (ox, oy, s) => {
      x.beginPath();
      x.moveTo(ox, oy);
      x.bezierCurveTo(ox + s, oy - s, ox + 2 * s, oy - s, ox + 2 * s, oy);
      x.bezierCurveTo(ox + 2 * s, oy + s * 0.6, ox + s, oy + s * 0.6, ox, oy);
      x.stroke();
    };
    switch (type) {
      case 'taotie': { // monster-mask: two eyes, brows, horns
        ring(96);
        x.beginPath(); x.arc(cx - 34, cy - 6, 16, 0, 7); x.arc(cx + 34, cy - 6, 16, 0, 7); x.fill();
        x.lineWidth = 8;
        x.beginPath(); x.moveTo(cx - 70, cy - 40); x.quadraticCurveTo(cx - 34, cy - 70, cx - 6, cy - 38); x.stroke();
        x.beginPath(); x.moveTo(cx + 70, cy - 40); x.quadraticCurveTo(cx + 34, cy - 70, cx + 6, cy - 38); x.stroke();
        x.beginPath(); x.moveTo(cx - 50, cy + 40); x.quadraticCurveTo(cx, cy + 80, cx + 50, cy + 40); x.stroke();
        break;
      }
      case 'cloud': cloud(cx - 70, cy, 35); cloud(cx, cy - 30, 35); cloud(cx - 30, cy + 40, 30); break;
      case 'lotus': {
        for (let i = 0; i < 8; i++) {
          x.save(); x.translate(cx, cy); x.rotate((i / 8) * Math.PI * 2);
          x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(22, -50, 0, -92); x.quadraticCurveTo(-22, -50, 0, 0); x.stroke();
          x.restore();
        }
        x.beginPath(); x.arc(cx, cy, 16, 0, 7); x.fill();
        break;
      }
      case 'dragon-roundel': {
        ring(100); ring(70);
        x.lineWidth = 7;
        x.beginPath();
        for (let a = 0; a < Math.PI * 3.2; a += 0.25) {
          const rr = 20 + a * 12;
          const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
          a === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
        }
        x.stroke();
        break;
      }
      case 'seal': { // red seal stamp with a stylised character grid
        x.fillStyle = color; x.fillRect(40, 40, S - 80, S - 80);
        x.clearRect(52, 52, S - 104, S - 104);
        x.fillStyle = color;
        x.fillRect(60, 60, S - 120, 10); x.fillRect(60, 120, S - 120, 10);
        x.fillRect(60, 60, 10, S - 120); x.fillRect(120, 60, 10, S - 120);
        x.fillRect(186, 60, 10, S - 120); x.fillRect(60, 186, S - 120, 10);
        break;
      }
      case 'bi-disc': ring(96); ring(40); break;
      case 'coin': { ring(96); x.lineWidth = 10; x.strokeRect(cx - 26, cy - 26, 52, 52); break; }
      default: ring(90); ring(50);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  });
}

// ---- Sky gradient (for skylight / exterior) ---------------------------------
export function sky() {
  return memo('sky', () => {
    const c = canvas(256), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#aacbe8');
    g.addColorStop(0.5, '#cfe0ec');
    g.addColorStop(1, '#eef2ee');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}
