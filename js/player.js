/**
 * player.js — first-person navigation: pointer-lock mouselook + WASD/arrows,
 * Shift to stride, with circle-vs-AABB wall collision (axis-separated, so the
 * player slides along walls) and a subtle head-bob.
 */
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const EYE = 1.7;
const RADIUS = 0.5;
const WALK = 4.6;
const RUN = 8.6;

export function createPlayer(camera, dom, world) {
  const controls = new PointerLockControls(camera, dom);
  camera.position.set(world.spawn.x, EYE, world.spawn.z);
  camera.rotation.set(0, world.spawn.yaw, 0);

  const keys = Object.create(null);
  const onKey = (v) => (e) => {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space'].includes(e.code)) {
      keys[e.code] = v;
      if (controls.isLocked) e.preventDefault();
    }
  };
  document.addEventListener('keydown', onKey(true));
  document.addEventListener('keyup', onKey(false));

  const dir = new THREE.Vector3();
  const right = new THREE.Vector3();
  const wish = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  let bob = 0;

  function blocked(x, z) {
    const c = world.collide;
    for (let i = 0; i < c.length; i++) {
      const b = c[i];
      if (x > b.minX - RADIUS && x < b.maxX + RADIUS && z > b.minZ - RADIUS && z < b.maxZ + RADIUS) return true;
    }
    return false;
  }

  function update(dt) {
    if (!controls.isLocked) { velocity.set(0, 0, 0); return; }
    const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const str = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const speed = keys.ShiftLeft || keys.ShiftRight ? RUN : WALK;

    camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
    right.set(-dir.z, 0, dir.x);
    wish.set(0, 0, 0).addScaledVector(dir, fwd).addScaledVector(right, str);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

    const k = 1 - Math.exp(-14 * dt);
    velocity.x += (wish.x - velocity.x) * k;
    velocity.z += (wish.z - velocity.z) * k;

    const nx = camera.position.x + velocity.x * dt;
    const nz = camera.position.z + velocity.z * dt;
    if (!blocked(nx, camera.position.z)) camera.position.x = nx; else velocity.x = 0;
    if (!blocked(camera.position.x, nz)) camera.position.z = nz; else velocity.z = 0;

    const moving = velocity.lengthSq() > 1;
    bob += dt * (moving ? speed * 1.5 : 0);
    camera.position.y = EYE + (moving ? Math.sin(bob) * 0.045 : 0);
  }

  return {
    controls,
    update,
    get position() { return camera.position; },
    lock: () => controls.lock(),
    isLocked: () => controls.isLocked,
  };
}
