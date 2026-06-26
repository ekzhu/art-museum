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

const SLOT = 4.0;           // horizontal pitch between pieces (generous museum spacing)
const ART_Y = 2.85;         // vertical centre of a hung piece
const MAX_W = 3.3, MAX_H = 3.5;
const PED_H = 1.3;          // plinth height for free-standing object cases
const PED_OBJ_MAXW = 1.5, PED_OBJ_MAXH = 1.7;
const MAX_PARTITIONS = 3;
const LOAD_RADIUS = 46;     // metres: stream textures within this of player (covers a hall seen from its doorway)
const MAX_TEXTURES = 140;   // LRU cap on simultaneously-loaded wall textures (500px ≈ 1.6MB each)
const MAX_INFLIGHT = 8;

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

    const accent = hall.palette.accent;
    const placeholder = new THREE.Color(hall.palette.wall).offsetHSL(0, 0, -0.06);
    // featured masterpieces first (prime cases / prime wall slots)
    let ordered = [...list.filter((d) => d.featured), ...list.filter((d) => !d.featured)];

    // Object halls (工艺 / 陶瓷 / 青铜 / 玉 / 陶俑 / 佛造像): present the finest pieces
    // as free-standing exhibits — the object photograph stood upright on a plinth
    // inside a glass case — so the room reads as objects in the round, not a wall
    // of photos. (True single-photo 3-D reconstruction isn't possible, so this is
    // the museum-standard "object on a plinth under glass" presentation.)
    if (hall.display === 'pedestal' || hall.display === 'mixed') {
      const spots = findPedestalSpots(world, room, 8);
      const k = Math.min(spots.length, ordered.length);
      for (let i = 0; i < k; i++) {
        const piece = buildPedestalPiece(hg, world, ordered[i], spots[i], { wainscot: hall.palette.wainscot, accent, placeholder, hallId });
        pieces.push(piece);
      }
      ordered = ordered.slice(k);
    }

    // gather runs: perimeter (from building) + added partitions until capacity
    let runs = (world.hallRuns[hallId] || []).slice();
    let slots = countSlots(runs);
    let partitions = 0;
    while (slots < ordered.length && partitions < MAX_PARTITIONS) {
      const pr = addPartition(hg, world, room, partitions, hall);
      runs.push(...pr.runs);
      pr.collide.forEach((b) => world.collide.push(b));
      slots = countSlots(runs);
      partitions++;
    }
    const slotList = buildSlots(runs);

    const n = Math.min(ordered.length, slotList.length);
    for (let i = 0; i < n; i++) {
      const data = ordered[i];
      const slot = slotList[i];
      const piece = buildPiece(hg, data, slot, { frameWood, frameGilt, lampMat, accent, placeholder, hallId });
      pieces.push(piece);
      if (data.featured) {
        // a spotlight pool to highlight the masterpiece (auto-culled with the hall group)
        const sp = new THREE.SpotLight(0xfff2d8, 2.6, 15, 0.62, 0.5, 1.3);
        sp.position.set(slot.x + slot.nx * 3.4, ART_Y + 2.8, slot.z + slot.nz * 3.4);
        sp.target.position.set(slot.x, ART_Y, slot.z);
        hg.add(sp); hg.add(sp.target);
      }
    }
    hg.userData.placed = n;
    hg.userData.total = list.length;
  }

  // ---------------------------------------------------------------------------
  // Texture streaming (LRU)
  // ---------------------------------------------------------------------------
  let inflight = 0;
  let loadsCount = 0, evictCount = 0; // diagnostics (thrash detection)
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
          loadsCount++;
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
      evictCount++;
    }
  }

  const tmp = new THREE.Vector3();
  const frustum = new THREE.Frustum();
  const projScreen = new THREE.Matrix4();
  let frameCount = 0;
  function update(camera, activeHalls) {
    const playerPos = camera.position;
    // toggle hall visibility
    pictureMeshes.length = 0;
    for (const id in hallGroups) hallGroups[id].visible = activeHalls.has(id);

    // throttle streaming work to every few frames
    frameCount++;
    if (frameCount % 3 === 0) {
      projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projScreen);
      // re-prioritise the pending queue every tick: load NEAREST visible pieces first
      for (const p of queue) p.queued = false;
      queue.length = 0;
      const r2 = LOAD_RADIUS * LOAD_RADIUS;
      const cands = [];
      for (const piece of pieces) {
        if (!activeHalls.has(piece.hallId)) continue;
        const d = tmp.copy(piece.center).sub(playerPos).lengthSq();
        if (d >= r2) continue;
        const inView = frustum.containsPoint(piece.center);
        // Only what is actually on screen counts as "kept alive" or gets loaded,
        // so the working set ≈ visible pieces and never thrashes the LRU.
        if (piece.tex) { if (inView) piece.lastSeen = perfNow(); continue; }
        if (inView && !piece.failed) cands.push([d, piece]);
      }
      cands.sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < Math.min(cands.length, 48); i++) requestLoad(cands[i][1]);
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

  return { update, getLookedAt, pieces, hallGroups, group, debug: () => ({ loads: loadsCount, evicts: evictCount, live: loaded.length }) };
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
  const featured = !!data.featured;
  const maxH = featured ? 4.2 : MAX_H;   // featured stand out by height, not width (keeps them in-slot)
  const aspect = data.w && data.h ? data.w / data.h : 0.8;
  let w = MAX_W, h = w / aspect;
  if (h > maxH) { h = maxH; w = h * aspect; }
  w = Math.min(w, SLOT - 0.45);
  h = w / aspect;
  if (h > maxH) { h = maxH; w = h * aspect; }

  const assembly = new THREE.Group();
  // face the room interior
  const angle = Math.atan2(slot.nx, slot.nz);
  assembly.position.set(slot.x + slot.nx * 0.07, ART_Y, slot.z + slot.nz * 0.07);
  assembly.rotation.y = angle;
  hg.add(assembly);

  if (featured) {
    // a masterpiece: velvet backing, ornate double-gilt frame, gilded crest
    const velvet = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.55, h + 0.95), new THREE.MeshStandardMaterial({ color: 0x4e1212, roughness: 0.92 }));
    velvet.position.z = -0.065; assembly.add(velvet);
    const outer = new THREE.Mesh(new THREE.BoxGeometry(w + 0.42, h + 0.42, 0.18), M.frameGilt); outer.position.z = -0.05; assembly.add(outer);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, h + 0.2, 0.2), M.frameWood); inner.position.z = -0.055; assembly.add(inner);
    const crest = new THREE.Mesh(new THREE.CylinderGeometry(0.001, 0.36, 0.55, 3), M.frameGilt); crest.position.set(0, h / 2 + 0.5, 0); assembly.add(crest);
  } else {
    const gilt = M.hallId === 'painting' || M.hallId === 'textiles' || M.hallId === 'calligraphy';
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.26, h + 0.26, 0.12), gilt ? M.frameGilt : M.frameWood);
    frame.position.z = -0.04; assembly.add(frame);
    const liner = new THREE.Mesh(new THREE.BoxGeometry(w + (gilt ? 0.1 : 0.12), h + (gilt ? 0.1 : 0.12), 0.14), gilt ? M.frameWood : M.frameGilt);
    liner.position.z = -0.045; assembly.add(liner);
  }

  // picture plane (unlit BasicMaterial: crisp colour, zero light cost).
  // Sits clearly proud of the frame's front face (~0.02) to avoid z-fighting.
  const picMat = new THREE.MeshBasicMaterial({ color: M.placeholder, toneMapped: false });
  const picture = new THREE.Mesh(new THREE.PlaneGeometry(w, h), picMat);
  picture.position.z = 0.075;
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
    normalDir: { x: slot.nx, z: slot.nz },
    placeholderColor: new THREE.Color(M.placeholder),
    tex: null, queued: false, failed: false, lastSeen: 0, plaqueDrawn: false,
  };
  picture.userData.piece = piece;
  return piece;
}

// ----- free-standing object case (plinth + glass + upright photo standee) -----
// Finds collision-free spots that line the two side aisles of an object hall,
// clear of the central doorway cross and the central partitions (which only ever
// span |x-cx| ≤ ~10.5, so x = cx ± 11.8 is always safe).
function clearSpot(collide, x, z, r) {
  for (const b of collide) if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return false;
  return true;
}
function findPedestalSpots(world, room, max) {
  const { cx, cz } = room;
  const out = [];
  // Two rows of cases in the hall's open END zones — clear of the central
  // partitions (which only span |z-cz| ≲ 5) and of the N/S doorway lane (x≈cx).
  for (const gz of [-9.6, 9.6]) {
    for (const gx of [-11, -6, 6, 11]) {
      const x = cx + gx, z = cz + gz;
      if (!clearSpot(world.collide, x, z, 1.0)) continue;
      out.push({ x, z, nx: 0, nz: gz < 0 ? 1 : -1 });   // face the room centre
    }
  }
  return out.slice(0, max);
}

function buildPedestalPiece(hg, world, data, pos, M) {
  const { x, z, nx, nz } = pos;
  const angle = Math.atan2(nx, nz);
  const grp = new THREE.Group();
  grp.position.set(x, 0, z); grp.rotation.y = angle; hg.add(grp);

  const plinthMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(M.wainscot), roughness: 0.6 });
  const metalMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(M.accent), metalness: 0.45, roughness: 0.4 });
  // plinth + base trim + accent cap
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.2, PED_H, 1.2), plinthMat); plinth.position.y = PED_H / 2; grp.add(plinth);
  const baseTrim = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.18, 1.36), plinthMat); baseTrim.position.y = 0.09; grp.add(baseTrim);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.1, 1.32), metalMat); cap.position.y = PED_H + 0.05; grp.add(cap);

  // the object: its photograph stood upright on a small easel base
  const aspect = data.w && data.h ? data.w / data.h : 0.8;
  let w = PED_OBJ_MAXW, h = w / aspect;
  if (h > PED_OBJ_MAXH) { h = PED_OBJ_MAXH; w = h * aspect; }
  const objY = PED_H + 0.18 + h / 2;
  const standBase = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w * 0.9, 1.0), 0.08, 0.46), metalMat); standBase.position.set(0, PED_H + 0.14, 0); grp.add(standBase);
  const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, h * 0.85, 0.05), plinthMat); strut.position.set(0, objY, -0.05); strut.rotation.x = -0.1; grp.add(strut);
  const picMat = new THREE.MeshBasicMaterial({ color: M.placeholder, toneMapped: false });
  const picture = new THREE.Mesh(new THREE.PlaneGeometry(w, h), picMat);
  picture.position.set(0, objY, 0.045); grp.add(picture);

  // glass case (vitrine) with slender metal edges
  const glassH = h + 0.55, glassY = PED_H + 0.1 + glassH / 2;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.2, glassH, 1.2),
    new THREE.MeshStandardMaterial({ color: 0xcfe6ea, transparent: true, opacity: 0.09, roughness: 0.05, metalness: 0, depthWrite: false }));
  glass.position.y = glassY; grp.add(glass);
  for (const [ex, ez] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.05, glassH, 0.05), metalMat); e.position.set(ex, glassY, ez); grp.add(e);
  }
  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.07, 1.26), metalMat); topFrame.position.y = PED_H + 0.1 + glassH; grp.add(topFrame);

  // label on the plinth front
  const plaqueMat = new THREE.MeshBasicMaterial({ color: 0xcfc3a3, toneMapped: false });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.36), plaqueMat);
  plaque.position.set(0, PED_H * 0.6, 0.61); grp.add(plaque);

  const sn = Math.sin(angle), cs = Math.cos(angle);
  const piece = {
    data, hallId: M.hallId, picture, plaque, plaqueMat,
    center: new THREE.Vector3(x + sn * 0.05, objY, z + cs * 0.05),
    normalDir: { x: nx, z: nz },
    placeholderColor: new THREE.Color(M.placeholder),
    tex: null, queued: false, failed: false, lastSeen: 0, plaqueDrawn: false,
  };
  picture.userData.piece = piece;
  world.collide.push({ minX: x - 0.72, minZ: z - 0.72, maxX: x + 0.72, maxZ: z + 0.72 });
  return piece;
}

function drawPlaque(piece) {
  if (piece.plaqueDrawn) return;
  piece.plaqueDrawn = true;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 170;
  const x = c.getContext('2d');
  const d = piece.data;
  x.fillStyle = '#efe6d2'; x.fillRect(0, 0, 512, 170);
  x.fillStyle = d.featured ? '#caa64a' : '#b89a3f'; x.fillRect(0, 0, 512, d.featured ? 10 : 6);
  if (d.featured) {
    x.fillStyle = '#7c1f17'; x.fillRect(0, 10, 512, 30);
    x.fillStyle = '#f0e6cf'; x.font = 'bold 22px "KaiTi",Georgia,serif'; x.textAlign = 'center';
    x.fillText('名作  ·  MASTERPIECE', 256, 32); x.textAlign = 'left';
  }
  const top = d.featured ? 78 : 46;
  x.fillStyle = '#2a2118';
  x.font = 'bold 30px Georgia, serif';
  wrap(x, d.title || 'Untitled', 18, top, 478, 32, 2);
  x.fillStyle = '#5a4a30';
  x.font = 'italic 24px Georgia, serif';
  const line2 = [d.creator && d.creator !== 'Unknown' ? d.creator : null, d.period ? d.period : null, d.collection ? d.collection : null].filter(Boolean).join(' · ');
  x.fillText(clip(line2 || (d.type || ''), 52), 18, 156);
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
