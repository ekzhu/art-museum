/**
 * npc.js — museum visitors. Low-poly figures that stroll to a spot near a wall,
 * pause to "view" the art, then move on. Grouped by room so they're only drawn
 * (and animated) when their hall is active. No real pathfinding: targets are
 * perimeter viewing-spots, which keeps them near the walls and looking alive.
 */
import * as THREE from 'three';
import { CELL_W, CELL_D } from './building.js';

const SKIN = [0xe7b98f, 0xd9a066, 0xf0c9a0, 0xc68642];
const CLOTHES = [0x44506b, 0x6b2b2b, 0x355e3b, 0x4a4a52, 0x7a5230, 0x2f4858, 0x8a6d3b, 0x5b3a53];
const HAIR = [0x1a120a, 0x2a1a10, 0x3a2a1a];

function rand(a) { return a[Math.floor(Math.random() * a.length)]; }

function makeFigure() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: rand(SKIN), roughness: 0.7 });
  const cloth = new THREE.MeshStandardMaterial({ color: rand(CLOTHES), roughness: 0.8 });
  const hair = new THREE.MeshStandardMaterial({ color: rand(HAIR), roughness: 0.9 });
  const scale = 0.92 + Math.random() * 0.22;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.72, 0.26), cloth); torso.position.y = 1.18; g.add(torso);
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.2, 0.26), cloth); hips.position.y = 0.82; g.add(hips);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), skin); head.position.y = 1.68; head.scale.z = 0.9; g.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.7), hair); cap.position.y = 1.7; g.add(cap);

  const legL = limb(0.16, 0.78, cloth, -0.12, 0.8); g.add(legL);
  const legR = limb(0.16, 0.78, cloth, 0.12, 0.8); g.add(legR);
  const armL = limb(0.13, 0.62, cloth, -0.3, 1.5); g.add(armL);
  const armR = limb(0.13, 0.62, cloth, 0.3, 1.5); g.add(armR);

  g.scale.setScalar(scale);
  return { group: g, legL, legR, armL, armR };
}

// a limb that pivots about its top (hip/shoulder)
function limb(w, len, mat, x, pivotY) {
  const pivot = new THREE.Group();
  pivot.position.set(x, pivotY, 0);
  const seg = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), mat);
  seg.position.y = -len / 2;
  pivot.add(seg);
  return pivot;
}

export function createVisitors(scene, world, perHall = 2) {
  const root = new THREE.Group(); root.name = 'visitors'; scene.add(root);
  const groups = {};        // roomId -> THREE.Group (visibility)
  const npcs = [];

  function spawnIn(room, n) {
    const grp = groups[room.id] || (groups[room.id] = new THREE.Group());
    if (!grp.parent) root.add(grp);
    for (let i = 0; i < n; i++) {
      const fig = makeFigure();
      grp.add(fig.group);
      const npc = { ...fig, roomId: room.id, room, state: 'walk', timer: 0, phase: Math.random() * 6.28, speed: 0.8 + Math.random() * 0.5, pos: new THREE.Vector3(), target: new THREE.Vector3(), face: 0 };
      pickTarget(npc); npc.pos.copy(npc.target); pickTarget(npc); // place, then head somewhere
      fig.group.position.copy(npc.pos);
      npcs.push(npc);
    }
  }

  for (const id in world.rooms) {
    const room = world.rooms[id];
    if (room.hall) spawnIn(room, perHall);
    else if (room.isAtrium) spawnIn(room, 3);
    else if (room.isLobby) spawnIn(room, 2);
  }

  function pickTarget(npc) {
    const { cx, cz } = npc.room;
    const hw = CELL_W / 2 - 2.4, hd = CELL_D / 2 - 2.4;
    const side = Math.floor(Math.random() * 4);
    // viewing spot ~2.5m off a wall, avoiding the doorway centre band
    let off = (Math.random() - 0.5) * 1.7; off += off >= 0 ? 0.35 : -0.35; // push away from centre
    if (side === 0) { npc.target.set(cx + off * CELL_W * 0.5, 0, cz - hd); npc.face = Math.PI; }
    else if (side === 1) { npc.target.set(cx + off * CELL_W * 0.5, 0, cz + hd); npc.face = 0; }
    else if (side === 2) { npc.target.set(cx - hw, 0, cz + off * CELL_D * 0.5); npc.face = Math.PI / 2; }
    else { npc.target.set(cx + hw, 0, cz + off * CELL_D * 0.5); npc.face = -Math.PI / 2; }
  }

  const dir = new THREE.Vector3();
  function update(dt, playerPos) {
    // only render/animate visitors in nearby rooms (current + adjacent)
    for (const id in groups) {
      const rm = world.rooms[id];
      groups[id].visible = Math.hypot(rm.cx - playerPos.x, rm.cz - playerPos.z) < CELL_W * 1.6;
    }
    for (const npc of npcs) {
      if (!groups[npc.roomId].visible) continue;
      if (npc.state === 'view') {
        npc.timer -= dt;
        npc.group.position.y = 0;
        // gentle idle sway
        const s = Math.sin(performance.now() / 700 + npc.phase) * 0.04;
        npc.group.rotation.y = npc.face + s;
        npc.legL.rotation.x = npc.legR.rotation.x = 0;
        npc.armL.rotation.x = npc.armR.rotation.x = 0;
        if (npc.timer <= 0) { pickTarget(npc); npc.state = 'walk'; }
        continue;
      }
      // walking
      dir.copy(npc.target).sub(npc.pos); dir.y = 0;
      const dist = dir.length();
      if (dist < 0.25) { npc.state = 'view'; npc.timer = 2.5 + Math.random() * 5; continue; }
      dir.normalize();
      // avoid the player a little
      if (playerPos && npc.pos.distanceTo(playerPos) < 1.6) { npc.state = 'view'; npc.timer = 1.5 + Math.random() * 2; continue; }
      const step = Math.min(npc.speed * dt, dist);
      npc.pos.addScaledVector(dir, step);
      npc.group.position.copy(npc.pos);
      npc.group.rotation.y = Math.atan2(dir.x, dir.z);
      npc.phase += dt * npc.speed * 6;
      const sw = Math.sin(npc.phase) * 0.5;
      npc.legL.rotation.x = sw; npc.legR.rotation.x = -sw;
      npc.armL.rotation.x = -sw * 0.7; npc.armR.rotation.x = sw * 0.7;
      npc.group.position.y = Math.abs(Math.sin(npc.phase)) * 0.04;
    }
  }

  return { update, npcs };
}
