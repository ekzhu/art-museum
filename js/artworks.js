/**
 * artworks.js — lays out every artwork in the building and streams textures.
 *
 * Placement: pieces are distributed along each hall's perimeter wall "runs";
 * if a hall holds more pieces than the perimeter can show, free-standing
 * gallery partitions (fins) are added until it fits (or a partition budget is
 * reached). Each piece is a framed plane with a label plaque.
 *
 * Texture streaming: walls use small (~520px) textures, loaded only for pieces
 * in the active halls and near the player, with an LRU cap on GPU memory. The
 * detail view (ui.js) lazily fetches the larger 1280px image.
 */
import * as THREE from 'three';
import { HALL_BY_ID } from './curation.js';
import { WALL_H, CELL_W, CELL_D, T } from './building.js';

const SLOT = 3.0;           // horizontal pitch between pieces
const ART_Y = 2.75;         // vertical centre of a hung piece
const MAX_W = 2.7, MAX_H = 3.1;
const MAX_PARTITIONS = 5;
const LOAD_RADIUS = 32;     // metres: stream textures within this of player
const MAX_TEXTURES = 96;    // LRU cap on simultaneously-loaded wall textures (500px ≈ 1.6MB each)
const MAX_INFLIGHT = 6;

const loader = new THREE.TextureLoader();
loader.crossOrigin = 'anonymous';

export function placeArtworks(scene, world, artworks) {
  const group = new THREE.Group();
  group.name = 'artworks';
  scene.add(group);

  const hallGroups = {};   // hallId -> THREE.Group (for per-hall culling)
  const pieces = [];       // all placed piece records
  const pictureMeshes = []; // active raycast targets

  // shared frame materials
  const frameWood = new THREE.MeshStandardMaterial({ color: 0x2c1d12, roughness: 0.6, metalness: 0.05 });
  const frameGilt = new THREE.MeshStandardMaterial({ color: 0xb78a32, roughness: 0.35, metalness: 0.6 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xcaa64a, roughness: 0.4, metalness: 0.7, emissive: 0x4a3a18, emissiveIntensity: 0.4 });

  // group artworks by hall, preserving order (already chronological from data)
  const byHall = {};
  for (const a of artworks) (byHall[a.hall] ??= []).push(a);

  for (const hallId in byHall) {
    const room = world.rooms[hallId];
    if (!room) continue;
    const hall = HALL_BY_ID[hallId];
    const list = byHall[hallId];
    const hg = new THREE.Group();
    hg.name = 'hall-' + hallId;
    group.add(hg);
    hallGroups[hallId] = hg;

    // gather runs: perimeter (from building) + added partitions until capacity
    let runs = (world.hallRuns[hallId] || []).slice();
    let slots = countSlots(runs);
    let partitions = 0;
    while (slots < list.length && partitions < MAX_PARTITIONS) {
      const pr = addPartition(hg, world, room, partitions, hall);
      runs.push(...pr.runs);
      pr.collide.forEach((b) => world.collide.push(b));
      slots = countSlots(runs);
      partitions++;
    }

    // build flat ordered slot list
    const slotList = buildSlots(runs);
    const accent = hall.palette.accent;
    const placeholder = new THREE.Color(hall.palette.wall).offsetHSL(0, 0, -0.06);

    const n = Math.min(list.length, slotList.length);
    for (let i = 0; i < n; i++) {
      const data = list[i];
      const slot = slotList[i];
      const piece = buildPiece(hg, data, slot, { frameWood, frameGilt, lampMat, accent, placeholder, hallId });
      pieces.push(piece);
      pictureMeshes.push(piece.picture);
    }
    hg.userData.placed = n;
    hg.userData.total = list.length;
  }

  // ---------------------------------------------------------------------------
  // Texture streaming (LRU)
  // ---------------------------------------------------------------------------
  let inflight = 0;
  const queue = [];
  const loaded = []; // pieces with a live texture, most-recent last

  function requestLoad(piece) {
    if (piece.tex || piece.queued || piece.loading || piece.failed) return;
    piece.queued = true;
    queue.push(piece);
  }
  function pump() {
    while (inflight < MAX_INFLIGHT && queue.length) {
      const piece = queue.shift();
      piece.queued = false;
      if (piece.tex || piece.loading) continue;
      inflight++;
      piece.loading = true; // guard against concurrent re-loads of the same piece
      loader.load(
        piece.data.thumb,
        (tex) => {
          inflight--;
          piece.loading = false;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 4;
          tex.generateMipmaps = true;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          piece.tex = tex;
          piece.picture.material.map = tex;
          piece.picture.material.color.set(0xffffff);
          piece.picture.material.needsUpdate = true;
          piece.lastSeen = perfNow();
          drawPlaque(piece); // generate the label lazily, alongside the image
          loaded.push(piece);
          evict();
        },
        undefined,
        () => { inflight--; piece.loading = false; piece.failed = true; pump(); }
      );
    }
  }
  function evict() {
    if (loaded.length <= MAX_TEXTURES) return;
    loaded.sort((a, b) => a.lastSeen - b.lastSeen);
    while (loaded.length > MAX_TEXTURES) {
      const p = loaded.shift();
      if (!p.tex) continue;
      p.tex.dispose();
      p.tex = null;
      p.picture.material.map = null;
      p.picture.material.color.copy(p.placeholderColor);
      p.picture.material.needsUpdate = true;
      if (p.plaqueTex) { p.plaqueTex.dispose(); p.plaqueTex = null; p.plaqueDrawn = false; p.plaqueMat.map = null; p.plaqueMat.color.set(0xcfc3a3); p.plaqueMat.needsUpdate = true; }
    }
  }

  const tmp = new THREE.Vector3();
  let frameCount = 0;
  function update(playerPos, activeHalls) {
    // toggle hall visibility
    pictureMeshes.length = 0;
    for (const id in hallGroups) {
      const vis = activeHalls.has(id);
      hallGroups[id].visible = vis;
    }
    // throttle streaming work to every few frames
    frameCount++;
    if (frameCount % 4 === 0) {
      // re-prioritise the pending queue every tick: load NEAREST pieces first
      for (const p of queue) p.queued = false;
      queue.length = 0;
      const r2 = LOAD_RADIUS * LOAD_RADIUS;
      const cands = [];
      for (const piece of pieces) {
        if (!activeHalls.has(piece.hallId)) continue;
        const d = tmp.copy(piece.center).sub(playerPos).lengthSq();
        if (d >= r2) continue;
        if (piece.tex) { piece.lastSeen = perfNow(); continue; }
        if (!piece.failed) cands.push([d, piece]);
      }
      cands.sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < Math.min(cands.length, 28); i++) requestLoad(cands[i][1]);
      pump();
    }
    // rebuild active raycast list
    for (const piece of pieces) if (activeHalls.has(piece.hallId)) pictureMeshes.push(piece.picture);
  }

  // ---------------------------------------------------------------------------
  // Interaction
  // ---------------------------------------------------------------------------
  const ray = new THREE.Raycaster();
  ray.far = 7.5;
  const screenCenter = new THREE.Vector2(0, 0);
  function getLookedAt(camera) {
    ray.setFromCamera(screenCenter, camera);
    const hits = ray.intersectObjects(pictureMeshes, false);
    return hits.length ? hits[0].object.userData.piece : null;
  }

  return { update, getLookedAt, pieces, hallGroups, group };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function perfNow() { return (typeof performance !== 'undefined' ? performance.now() : 0); }

function countSlots(runs) {
  let n = 0;
  for (const r of runs) n += Math.max(0, Math.floor(r.length / SLOT));
  return n;
}

function buildSlots(runs) {
  const slots = [];
  for (const r of runs) {
    const n = Math.max(0, Math.floor(r.length / SLOT));
    if (n === 0) continue;
    const used = n * SLOT;
    const start = -used / 2 + SLOT / 2; // along run dir from its centre
    for (let i = 0; i < n; i++) {
      const t = start + i * SLOT;
      slots.push({
        x: r.x + r.dirX * t,
        z: r.z + r.dirZ * t,
        nx: r.nx, nz: r.nz,
      });
    }
  }
  return slots;
}

function buildPiece(hg, data, slot, M) {
  const aspect = data.w && data.h ? data.w / data.h : 0.8;
  let w = MAX_W, h = w / aspect;
  if (h > MAX_H) { h = MAX_H; w = h * aspect; }
  w = Math.min(w, SLOT - 0.35);
  h = w / aspect;
  if (h > MAX_H) { h = MAX_H; w = h * aspect; }

  const assembly = new THREE.Group();
  // face the room interior
  const angle = Math.atan2(slot.nx, slot.nz);
  assembly.position.set(slot.x + slot.nx * 0.07, ART_Y, slot.z + slot.nz * 0.07);
  assembly.rotation.y = angle;
  hg.add(assembly);

  // frame (outer wood + gilt liner)
  const gilt = M.hallId === 'painting' || M.hallId === 'textiles' || M.hallId === 'calligraphy';
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.26, h + 0.26, 0.12), gilt ? M.frameGilt : M.frameWood);
  frame.position.z = -0.04;
  assembly.add(frame);
  if (gilt) {
    const liner = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, h + 0.1, 0.14), M.frameWood);
    liner.position.z = -0.045; assembly.add(liner);
  } else {
    const liner = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.14), M.frameGilt);
    liner.position.z = -0.045; assembly.add(liner);
  }

  // picture plane (unlit BasicMaterial: crisp colour, zero light cost)
  const picMat = new THREE.MeshBasicMaterial({ color: M.placeholder, toneMapped: false });
  const picture = new THREE.Mesh(new THREE.PlaneGeometry(w, h), picMat);
  picture.position.z = 0.03;
  assembly.add(picture);

  // small brass picture-lamp above
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w, 1.4), 0.08, 0.32), M.lampMat);
  lamp.position.set(0, h / 2 + 0.4, 0.22);
  assembly.add(lamp);

  // label plaque (text drawn lazily when the piece's image streams in)
  const plaqueMat = new THREE.MeshBasicMaterial({ color: 0xcfc3a3, toneMapped: false });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), plaqueMat);
  plaque.position.set(0, -h / 2 - 0.5, 0.02);
  assembly.add(plaque);

  const piece = {
    data, hallId: M.hallId,
    picture, plaque, plaqueMat,
    center: new THREE.Vector3(slot.x, ART_Y, slot.z),
    placeholderColor: new THREE.Color(M.placeholder),
    tex: null, queued: false, failed: false, lastSeen: 0, plaqueDrawn: false,
  };
  picture.userData.piece = piece;
  return piece;
}

function drawPlaque(piece) {
  if (piece.plaqueDrawn) return;
  piece.plaqueDrawn = true;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 170;
  const x = c.getContext('2d');
  x.fillStyle = '#efe6d2'; x.fillRect(0, 0, 512, 170);
  x.fillStyle = '#b89a3f'; x.fillRect(0, 0, 512, 6);
  const d = piece.data;
  x.fillStyle = '#2a2118';
  x.font = 'bold 30px Georgia, serif';
  wrap(x, d.title || 'Untitled', 18, 46, 478, 32, 2);
  x.fillStyle = '#5a4a30';
  x.font = 'italic 24px Georgia, serif';
  const line2 = [d.creator && d.creator !== 'Unknown' ? d.creator : null, d.period ? d.period : null].filter(Boolean).join(' · ');
  x.fillText(clip(line2 || (d.type || ''), 40), 18, 150);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  piece.plaqueTex = tex;
  piece.plaqueMat.map = tex; piece.plaqueMat.color.set(0xffffff); piece.plaqueMat.needsUpdate = true;
}

function wrap(ctx, text, x, y, maxW, lh, maxLines) {
  const words = String(text).split(/\s+/);
  let line = '', lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + ' ';
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line.trim(), x, y); line = words[i] + ' '; y += lh; lines++;
      if (lines >= maxLines - 1) {
        let rest = words.slice(i).join(' ');
        while (ctx.measureText(rest + '…').width > maxW && rest.length) rest = rest.slice(0, -1);
        ctx.fillText(rest + (words.slice(i).join(' ').length > rest.length ? '…' : ''), x, y); return;
      }
    } else line = test;
  }
  ctx.fillText(line.trim(), x, y);
}
function clip(s, n) { return s && s.length > n ? s.slice(0, n - 1) + '…' : (s || ''); }

// Free-standing partition wall ("fin") down a room, adding two faces of run.
function addPartition(hg, world, room, index, hall) {
  const finLen = CELL_W - 9;     // leaves cross-aisles at both ends
  const finH = WALL_H - 1.4;
  const margin = 3.2;
  const usableD = CELL_D - margin * 2;
  const count = MAX_PARTITIONS;
  const step = usableD / (count + 1);
  const z = room.cz - usableD / 2 + step * (index + 1);
  const x = room.cx;

  const mat = new THREE.MeshStandardMaterial({ map: tex(hall.palette.wall), color: 0xffffff, roughness: 0.95 });
  const wood = new THREE.MeshStandardMaterial({ color: new THREE.Color(hall.palette.wainscot), roughness: 0.7 });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(finLen, finH, 0.4), mat);
  wall.position.set(x, finH / 2, z);
  hg.add(wall);
  const base = new THREE.Mesh(new THREE.BoxGeometry(finLen + 0.2, 1.0, 0.6), wood);
  base.position.set(x, 0.5, z);
  hg.add(base);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(finLen + 0.2, 0.3, 0.7), new THREE.MeshStandardMaterial({ color: new THREE.Color(hall.palette.accent), roughness: 0.5, metalness: 0.3 }));
  cap.position.set(x, finH + 0.15, z);
  hg.add(cap);

  const half = finLen / 2;
  const runs = [
    { x, z: z - 0.27, dirX: 1, dirZ: 0, nx: 0, nz: -1, length: finLen, hall: room.id },
    { x, z: z + 0.27, dirX: 1, dirZ: 0, nx: 0, nz: 1, length: finLen, hall: room.id },
  ];
  const collide = [{ minX: x - half, minZ: z - 0.3, maxX: x + half, maxZ: z + 0.3 }];
  return { runs, collide };
}

// tiny cached plaster texture for partitions (avoid importing TX cycle weight)
const _ptex = new Map();
function tex(color) {
  if (_ptex.has(color)) return _ptex.get(color);
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.03})`; x.fillRect(Math.random() * 64, Math.random() * 64, 1, 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2);
  _ptex.set(color, t); return t;
}
