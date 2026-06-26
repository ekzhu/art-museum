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

  // ---- touch / on-screen controls (no pointer lock on phones & tablets) ----
  const moveVec = { f: 0, s: 0 };   // analog joystick, each axis in [-1, 1]
  let runFlag = false;
  let active = false;               // "inside the museum" on touch (replaces pointer-lock)
  const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const PITCH_LIMIT = Math.PI / 2 - 0.02;
  function setMove(f, s) { moveVec.f = f; moveVec.s = s; }
  function setRun(b) { runFlag = !!b; }
  function setActive(b) { active = !!b; if (!active) velocity.set(0, 0, 0); }
  // drag-to-look: yaw on X, pitch on Y (clamped) — mirrors PointerLockControls' math
  function look(dx, dy) {
    if (!active) return;   // only when navigating on touch (never moves the camera otherwise)
    _euler.setFromQuaternion(camera.quaternion);
    _euler.y -= dx * 0.0026;
    _euler.x -= dy * 0.0026;
    _euler.x = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, _euler.x));
    _euler.z = 0;
    camera.quaternion.setFromEuler(_euler);
  }

  function blocked(x, z) {
    const c = world.collide;
    for (let i = 0; i < c.length; i++) {
      const b = c[i];
      if (x > b.minX - RADIUS && x < b.maxX + RADIUS && z > b.minZ - RADIUS && z < b.maxZ + RADIUS) return true;
    }
    return false;
  }

  function update(dt) {
    if (!controls.isLocked && !active) { velocity.set(0, 0, 0); return; }
    // keyboard (digital) + joystick (analog) combine; joystick push controls speed
    const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + moveVec.f;
    const str = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + moveVec.s;
    const speed = keys.ShiftLeft || keys.ShiftRight || runFlag ? RUN : WALK;

    camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
    right.set(-dir.z, 0, dir.x);
    wish.set(0, 0, 0).addScaledVector(dir, fwd).addScaledVector(right, str);
    const mag = wish.length();
    if (mag > 0) wish.multiplyScalar((speed * Math.min(mag, 1)) / mag);   // normalise, but keep analog throttle

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
    isLocked: () => controls.isLocked || active,
    // touch API
    setMove, setRun, setActive, look,
  };
}
