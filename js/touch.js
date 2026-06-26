/**
 * touch.js — on-screen controls for phones & tablets (no mouse, no pointer lock).
 *
 * Layout follows the familiar mobile-FPS convention:
 *   • left half of the screen  → a dynamic movement joystick (appears where the
 *     thumb lands; analog — a gentle push strolls, a full push strides),
 *   • right half               → drag to look around; a quick tap "views" / acts
 *     on whatever the crosshair is on,
 *   • floating buttons (bottom-right) → Run toggle, Map, and View.
 *
 * Multi-touch is handled by tracking each touch's identifier, so moving and
 * looking at the same time works. On a non-touch (fine-pointer) device this is a
 * no-op stub, leaving the keyboard + mouse path untouched.
 */
export function createTouchControls({ player, onView, onMap }) {
  const isMobile = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  if (!isMobile) return { isMobile: false, show() {}, setInteractable() {} };

  document.body.classList.add('touch-mode');

  // swap the start-screen's keyboard legend for touch instructions
  const legend = document.querySelector('.controls-legend');
  if (legend) legend.innerHTML =
    '<span><b>Left side</b> — move</span><span><b>Right side</b> — look</span>' +
    '<span>tap or <b>View</b> — open a piece</span><span><b>Map</b> — halls</span>';

  const root = document.createElement('div');
  root.id = 'touch';
  root.className = 'hidden';
  root.innerHTML = `
    <div id="move-zone" class="touch-zone"></div>
    <div id="look-zone" class="touch-zone"></div>
    <div id="joystick" class="hidden"><div id="joy-base"></div><div id="joy-knob"></div></div>
    <div id="touch-actions">
      <button id="btn-run" class="tbtn" type="button" aria-label="Run">Run</button>
      <button id="btn-map" class="tbtn" type="button" aria-label="Map">Map</button>
      <button id="btn-view" class="tbtn tbtn-primary" type="button" aria-label="View">View</button>
    </div>`;
  document.body.appendChild(root);

  const moveZone = root.querySelector('#move-zone');
  const lookZone = root.querySelector('#look-zone');
  const joystick = root.querySelector('#joystick');
  const knob = root.querySelector('#joy-knob');
  const btnRun = root.querySelector('#btn-run');
  const btnMap = root.querySelector('#btn-map');
  const btnView = root.querySelector('#btn-view');

  const JOY_R = 52;   // px of max knob travel

  // ---- movement joystick (left thumb, dynamic origin) ----
  let joyId = null, joyCx = 0, joyCy = 0;
  function joyStart(t) {
    joyId = t.identifier; joyCx = t.clientX; joyCy = t.clientY;
    joystick.style.left = joyCx + 'px'; joystick.style.top = joyCy + 'px';
    joystick.classList.remove('hidden');
    joyMove(t);
  }
  function joyMove(t) {
    let dx = t.clientX - joyCx, dy = t.clientY - joyCy;
    const d = Math.hypot(dx, dy) || 1;
    if (d > JOY_R) { dx = dx / d * JOY_R; dy = dy / d * JOY_R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    player.setMove(-dy / JOY_R, dx / JOY_R);   // forward = thumb up, strafe = thumb right
  }
  function joyEnd() { joyId = null; joystick.classList.add('hidden'); knob.style.transform = 'translate(0,0)'; player.setMove(0, 0); }

  // ---- look pad (right thumb) ----
  let lookId = null, lx = 0, ly = 0, moved = 0, downT = 0;
  function lookStart(t) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; moved = 0; downT = performance.now(); }
  function lookMove(t) {
    const dx = t.clientX - lx, dy = t.clientY - ly; lx = t.clientX; ly = t.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    player.look(dx, dy);
  }
  function lookEnd() {
    if (lookId !== null && moved < 12 && performance.now() - downT < 320) onView();  // a tap = act on what's centred
    lookId = null;
  }

  // ---- touch dispatch (by the zone each touch began on; routed by identifier) ----
  moveZone.addEventListener('touchstart', (e) => { e.preventDefault(); if (joyId === null) joyStart(e.changedTouches[0]); }, { passive: false });
  lookZone.addEventListener('touchstart', (e) => { e.preventDefault(); if (lookId === null) lookStart(e.changedTouches[0]); }, { passive: false });
  window.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) { e.preventDefault(); joyMove(t); }
      else if (t.identifier === lookId) { e.preventDefault(); lookMove(t); }
    }
  }, { passive: false });
  const MOVE_FRAC = 0.45;   // left 45% of the screen is the move-zone (matches CSS)
  const endAll = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        joyEnd();
        // if another finger is still down in the move-zone, let it take over the
        // joystick (otherwise movement would freeze until every finger lifts)
        const n = [...e.touches].find((o) => o.identifier !== lookId && o.clientX < innerWidth * MOVE_FRAC);
        if (n) joyStart(n);
      } else if (t.identifier === lookId) {
        lookEnd();
        const n = [...e.touches].find((o) => o.identifier !== joyId && o.clientX >= innerWidth * MOVE_FRAC);
        if (n) lookStart(n);
      }
    }
  };
  window.addEventListener('touchend', endAll);
  window.addEventListener('touchcancel', endAll);

  // ---- action buttons ---- (single click; buttons sit above the look-zone, so
  // their taps never reach the look/tap-to-view handler)
  const onTap = (el, fn) => el.addEventListener('click', (e) => { e.preventDefault(); fn(); });
  let running = false;
  onTap(btnRun, () => { running = !running; player.setRun(running); btnRun.classList.toggle('on', running); });
  onTap(btnMap, () => onMap());
  onTap(btnView, () => onView());

  return {
    isMobile: true,
    // hiding (a modal opened / nav paused) must also drop any in-progress look,
    // or a still-down finger would keep rotating the camera behind the panel
    show(v) { root.classList.toggle('hidden', !v); if (!v) { joyEnd(); lookId = null; moved = 0; } },
    setInteractable(v) { btnView.classList.toggle('lit', !!v); },
  };
}
