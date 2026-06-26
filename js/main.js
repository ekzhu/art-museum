/**
 * main.js — bootstrap & game loop.
 * Loads the database, raises the building, hangs the art, wires first-person
 * controls + interaction, and renders with per-hall visibility culling so only
 * the player's current hall and its neighbours are drawn (smooth & low-latency).
 */
import * as THREE from 'three';
import { HALLS, PERIOD_INFO, BUILDING } from './curation.js';
import { buildMuseum, CELL_D } from './building.js';
import { buildDecor } from './decor.js';
import { placeArtworks } from './artworks.js';
import { buildTheatre, FILMS } from './theatre.js';
import { createPlayer } from './player.js';
import { createUI } from './ui.js';

const frame = () => new Promise((r) => requestAnimationFrame(r));

async function boot() {
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14110d);
  scene.fog = new THREE.Fog(0x14110d, 26, 84);

  const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.1, 150);

  // lighting (architecture only — artworks are unlit for fidelity + zero cost)
  scene.add(new THREE.HemisphereLight(0xfff4e2, 0x3a3326, 1.05));
  scene.add(new THREE.AmbientLight(0xffffff, 0.42));
  const sun = new THREE.DirectionalLight(0xfff0d8, 0.55);
  sun.position.set(24, 50, 16);
  scene.add(sun);

  // ---- data ----
  let artworks = [];
  try {
    artworks = await (await fetch('data/artworks.json', { cache: 'force-cache' })).json();
  } catch (e) {
    document.getElementById('boot-splash').textContent = 'Could not load the collection. Please refresh.';
    return;
  }
  let stats = { total: artworks.length };
  try { stats = Object.assign(stats, await (await fetch('data/stats.json')).json()); } catch { /* ok */ }
  stats.total = artworks.length;
  const counts = {};
  artworks.forEach((a) => (counts[a.hall] = (counts[a.hall] || 0) + 1));

  // ---- forward decls used by UI callbacks ----
  let player, world, ui;
  const onEnter = () => { ui.showResume(false); player && player.lock(); };
  const onTeleport = (roomId) => {
    const r = world.rooms[roomId];
    if (r) camera.position.set(r.cx, 1.7, r.isGarden ? r.cz + 4 : r.cz + CELL_D * 0.32);
    ui.showResume(false);
    setTimeout(() => player.lock(), 60);
  };

  ui = createUI({ halls: HALLS, periodInfo: PERIOD_INFO, building: BUILDING, stats, onEnter, onTeleport });
  document.getElementById('boot-splash')?.remove();

  ui.setLoading('Raising the halls…', 0.3);
  await frame();
  world = buildMuseum(scene);

  ui.setLoading('Hanging seventeen centuries of art…', 0.6);
  await frame();
  buildDecor(scene, world);
  const art = placeArtworks(scene, world, artworks);
  const theatre = buildTheatre(scene, world);
  ui.buildDirectory(counts);

  ui.setLoading('Lighting the lanterns…', 0.92);
  await frame();
  player = createPlayer(camera, renderer.domElement, world);
  player.controls.addEventListener('unlock', () => { if (!ui.isModalOpen()) ui.showResume(true); });
  player.controls.addEventListener('lock', () => ui.showResume(false));
  ui.ready();

  // debug hook (used by the headless smoke test; harmless in production)
  window.__museum = {
    go(roomId, yaw = 0) { const r = world.rooms[roomId]; if (r) { camera.position.set(r.cx, 1.7, r.cz); camera.rotation.set(0, yaw, 0); } },
    look(yaw) { camera.rotation.set(0, yaw, 0); },
    pos: () => camera.position.toArray().map((n) => +n.toFixed(1)),
    stats: () => ({ pieces: art.pieces.length, rooms: Object.keys(world.rooms).length, collide: world.collide.length }),
    debug: () => art.debug(),
  };

  // ---- interaction ----
  let looked = null;
  const iray = new THREE.Raycaster(); iray.far = 9;
  const center2 = new THREE.Vector2(0, 0);
  const lookInteractable = () => {
    if (!theatre.interactables.length) return null;
    iray.setFromCamera(center2, camera);
    const hits = iray.intersectObjects(theatre.interactables, false);
    return hits.length ? hits[0].object : null;
  };
  const interact = () => {
    if (ui.isModalOpen() || !looked) return;
    if (looked.kind === 'art') { ui.openDetail(looked.piece); player.controls.unlock(); }
    else if (looked.kind === 'cinema') { ui.openCinema(FILMS); player.controls.unlock(); }
  };
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE') interact();
    else if (e.code === 'KeyM') { if (ui.toggleDirectory()) player.controls.unlock(); else onEnter(); }
    else if (e.code === 'Escape' && ui.isModalOpen()) { ui.closeModals(); ui.showResume(true); }
  });
  renderer.domElement.addEventListener('click', () => { if (player.isLocked()) interact(); });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // ---- active-hall culling (cached; recomputed only when the room changes) ----
  let activeRoom = false;
  const activeSet = new Set();
  function activeHalls(room) {
    if (room === activeRoom) return activeSet;
    activeRoom = room;
    activeSet.clear();
    if (!room) return activeSet; // outside (plaza): no halls to draw
    const { r, c } = room;
    const add = (rr, cc) => { const id = world.MAP[rr] && world.MAP[rr][cc]; if (id && world.rooms[id] && world.rooms[id].hall) activeSet.add(id); };
    add(r, c); add(r - 1, c); add(r + 1, c); add(r, c - 1); add(r, c + 1);
    return activeSet;
  }

  // ---- loop ----
  const clock = new THREE.Clock();
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    player.update(dt);
    const room = world.roomAt(camera.position.x, camera.position.z);
    ui.setRoom(room);
    art.update(camera, activeHalls(room));
    if (player.isLocked() && !ui.isModalOpen()) {
      const piece = art.getLookedAt(camera);
      if (piece) { looked = { kind: 'art', piece }; ui.setPrompt(piece.data.title, 'view artwork'); }
      else {
        const it = lookInteractable();
        if (it && it.userData.kind === 'cinema') { looked = { kind: 'cinema' }; ui.setPrompt('a documentary film', 'enter the theatre'); }
        else { looked = null; ui.setPrompt(null); }
      }
    } else { looked = null; ui.setPrompt(null); }
    renderer.render(scene, camera);
  }
  loop();
}

boot();
