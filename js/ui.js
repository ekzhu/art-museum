/**
 * ui.js — all DOM/HUD: start screen, loading bar, crosshair, live hall banner,
 * interaction prompt, the artwork detail panel (lazy high-res image + full
 * metadata + Wikimedia credit), the hall directory (with teleport), and the
 * pause/resume overlay tied to pointer-lock.
 */
import { composeStoryHTML } from './lore.js';

// High-resolution detail image via Special:FilePath (HTML <img>, any width, no CORS needed).
function detailURL(d) {
  if (d.file) return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(d.file)}?width=1500`;
  return d.thumb || d.full;
}

export function createUI(opts) {
  const { halls, periodInfo, building, stats, onEnter, onTeleport } = opts;
  const root = document.createElement('div');
  root.id = 'ui';
  document.body.appendChild(root);

  root.innerHTML = `
    <div id="crosshair"></div>
    <div id="hud-top"><div id="hall-name"></div><div id="hall-sub"></div></div>
    <div id="prompt" class="hidden"><kbd>E</kbd> / click — <span id="prompt-action">view</span> <span id="prompt-title"></span></div>
    <div id="hint">
      <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move</span>
      <span><kbd>Shift</kbd> stride</span><span>mouse look</span>
      <span><kbd>E</kbd> view</span><span><kbd>M</kbd> map</span><span><kbd>Esc</kbd> release</span>
    </div>

    <div id="overlay" class="screen">
      <div class="screen-card">
        <div class="zh-title">${building.nameZh}</div>
        <h1>${building.name}</h1>
        <p class="tagline">${building.tagline}</p>
        <div id="loadwrap"><div id="loadbar"></div></div>
        <p id="loadtext">Loading the collection…</p>
        <button id="enter" disabled>Enter the Museum</button>
        <div class="controls-legend">
          <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk</span>
          <span><kbd>Shift</kbd> stride</span>
          <span>move mouse to look</span>
          <span><kbd>E</kbd> view a piece</span>
          <span><kbd>M</kbd> hall directory</span>
        </div>
        <p class="src-note">Artworks &amp; data from <b>Wikimedia Commons</b> &amp; <b>Wikidata</b>. Built with three.js.</p>
      </div>
    </div>

    <div id="resume" class="screen hidden"><div class="screen-card small">
      <h2>Paused</h2><p>Click to resume your visit</p><button id="resume-btn">Resume</button>
    </div></div>

    <div id="detail" class="panel hidden">
      <button class="close" data-close>✕</button>
      <div class="detail-img"><div class="spinner"></div><img id="detail-img" alt=""></div>
      <div class="detail-meta">
        <div id="d-period" class="d-chip"></div>
        <h2 id="d-title"></h2>
        <div id="d-creator" class="d-creator"></div>
        <dl id="d-facts"></dl>
        <div id="d-desc" class="d-story"></div>
        <div class="d-credit"><span id="d-credit"></span> · <a id="d-source" target="_blank" rel="noopener">View on Wikimedia ↗</a></div>
      </div>
    </div>

    <div id="cinema" class="panel hidden">
      <button class="close" data-close>✕</button>
      <div class="cinema-main">
        <div class="cinema-frame"><div class="spinner"></div><iframe id="cinema-iframe" allow="autoplay; encrypted-media; fullscreen" allowfullscreen frameborder="0"></iframe></div>
        <div id="cinema-now"></div>
      </div>
      <div class="cinema-list">
        <h3>纪录片影院<span class="muted"> · Now Showing</span></h3>
        <div id="cinema-films"></div>
      </div>
    </div>

    <div id="directory" class="panel wide hidden">
      <button class="close" data-close>✕</button>
      <h2>Hall Directory <span class="muted">中华艺术博物馆</span></h2>
      <p class="muted">${stats.total} works across ${halls.length} halls. Click a hall to walk there.</p>
      <div id="dir-grid"></div>
    </div>
  `;

  const $ = (s) => root.querySelector(s);
  const hallsById = Object.fromEntries((halls || []).map((h) => [h.id, h]));
  const overlay = $('#overlay'), resume = $('#resume');
  const hallName = $('#hall-name'), hallSub = $('#hall-sub');
  const prompt = $('#prompt'), promptTitle = $('#prompt-title');
  const detail = $('#detail'), directory = $('#directory');

  // ---- start / loading ----
  $('#enter').addEventListener('click', () => { overlay.classList.add('hidden'); onEnter(); });
  $('#resume-btn').addEventListener('click', () => onEnter());

  function setLoading(text, frac) {
    $('#loadtext').textContent = text;
    $('#loadbar').style.width = Math.round((frac || 0) * 100) + '%';
  }
  function ready() {
    const b = $('#enter'); b.disabled = false; b.textContent = 'Enter the Museum';
    $('#loadtext').textContent = 'Ready — ' + stats.total + ' works await.';
    $('#loadbar').style.width = '100%';
  }

  // ---- hall banner ----
  let lastRoom = null;
  function setRoom(room) {
    if (room === lastRoom) return;
    lastRoom = room;
    if (!room) { hallName.textContent = ''; hallSub.textContent = ''; return; }
    if (room.hall) { hallName.innerHTML = `${room.hall.nameZh}　<em>${room.hall.name}</em>`; hallSub.textContent = room.hall.subtitle; }
    else if (room.isAtrium) { hallName.innerHTML = '中庭　<em>Grand Atrium</em>'; hallSub.textContent = 'Welcome — choose a hall to begin'; }
    else if (room.isGarden) { hallName.innerHTML = '庭园　<em>Scholar’s Garden</em>'; hallSub.textContent = 'A moment of stillness'; }
    else if (room.isLobby) { hallName.innerHTML = '门厅　<em>Entrance Hall</em>'; hallSub.textContent = ''; }
    else if (room.isPortico) { hallName.innerHTML = '门廊　<em>Portico</em>'; hallSub.textContent = 'Welcome'; }
    else if (room.isCafe) { hallName.innerHTML = '咖啡　<em>Café</em>'; hallSub.textContent = 'Tea, coffee & sweets'; }
    else if (room.isShop) { hallName.innerHTML = '礼品店　<em>Museum Shop</em>'; hallSub.textContent = 'Books, prints & replicas'; }
    hallName.classList.remove('flash'); void hallName.offsetWidth; hallName.classList.add('flash');
  }

  // ---- interaction prompt ---- (guarded so we don't touch the DOM every frame)
  const promptAction = $('#prompt-action');
  let lastPromptLabel = undefined;
  function setPrompt(label, action) {
    if (label === lastPromptLabel) return;
    lastPromptLabel = label;
    if (label) { prompt.classList.remove('hidden'); promptAction.textContent = action || 'view'; promptTitle.textContent = '— ' + label; }
    else prompt.classList.add('hidden');
  }

  // ---- detail panel ----
  let modal = false;
  const img = $('#detail-img');
  function openDetail(piece) {
    const d = piece.data;
    modal = true;
    $('#d-period').textContent = d.period || d.type || '';
    $('#d-period').title = d.period ? (periodInfo[d.period] || '') : '';
    $('#d-title').textContent = d.title || 'Untitled';
    $('#d-creator').textContent = d.creator && d.creator !== 'Unknown' ? d.creator : 'Artist unknown';
    const facts = [];
    if (d.type) facts.push(['Object', d.type]);
    if (d.period) facts.push(['Period', d.period]);
    if (d.materials && d.materials.length) facts.push(['Medium', d.materials.join(', ')]);
    if (d.collection) facts.push(['Collection', d.collection]);
    if (d.origin) facts.push(['Origin', d.origin]);
    $('#d-facts').innerHTML = facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
    $('#d-desc').innerHTML = composeStoryHTML(d, periodInfo, hallsById);
    $('#d-credit').textContent = (d.credit || 'Wikimedia Commons') + (d.license ? ' · ' + d.license : '');
    $('#d-source').href = d.source || '#';

    detail.classList.remove('hidden');
    detail.classList.add('loading');
    img.style.opacity = 0;
    img.onload = () => { detail.classList.remove('loading'); img.style.opacity = 1; };
    img.onerror = () => { detail.classList.remove('loading'); img.style.opacity = 1; };
    img.src = detailURL(d);
  }
  function closeModals() {
    modal = false;
    detail.classList.add('hidden');
    directory.classList.add('hidden');
    cinema.classList.add('hidden');
    cinemaIframe.src = 'about:blank'; // stop playback
    img.src = '';
  }

  // ---- cinema ----
  const cinema = $('#cinema'), cinemaIframe = $('#cinema-iframe'), cinemaNow = $('#cinema-now'), cinemaFilms = $('#cinema-films');
  let cinemaBuilt = false;
  function playFilm(f) {
    cinema.classList.add('loading');
    cinemaIframe.onload = () => cinema.classList.remove('loading');
    cinemaIframe.src = `https://www.youtube-nocookie.com/embed/${f.id}?autoplay=1&rel=0&modestbranding=1`;
    cinemaNow.innerHTML = `<div class="now-topic">${f.topic}</div><div class="now-title">${esc(f.title)}</div>`;
    cinemaFilms.querySelectorAll('.film').forEach((el) => el.classList.toggle('active', el.dataset.id === f.id));
  }
  function openCinema(films) {
    modal = true;
    if (!cinemaBuilt) {
      cinemaFilms.innerHTML = films.map((f) => `<button class="film" data-id="${f.id}"><span class="film-topic">${f.topic}</span><span class="film-title">${esc(f.title)}</span></button>`).join('');
      cinemaFilms.querySelectorAll('.film').forEach((el) => el.addEventListener('click', () => playFilm(films.find((f) => f.id === el.dataset.id))));
      cinemaBuilt = true;
    }
    cinema.classList.remove('hidden');
    playFilm(films[0]);
  }

  // ---- directory ----
  const dirGrid = $('#dir-grid');
  function buildDirectory(countsByHall) {
    dirGrid.innerHTML = halls.map((h) => `
      <button class="dir-card" data-room="${h.id}" style="--accent:${h.palette.accent}">
        <div class="dir-zh">${h.nameZh}</div>
        <div class="dir-en">${h.name}</div>
        <div class="dir-sub">${h.subtitle}</div>
        <div class="dir-count">${countsByHall[h.id] || 0} works</div>
      </button>`).join('') +
      `<button class="dir-card" data-room="garden" style="--accent:#6f9b6a">
        <div class="dir-zh">庭园</div><div class="dir-en">Scholar’s Garden</div>
        <div class="dir-sub">A quiet courtyard</div><div class="dir-count">rest &amp; reflect</div></button>`;
    dirGrid.querySelectorAll('.dir-card').forEach((b) =>
      b.addEventListener('click', () => { closeModals(); onTeleport(b.dataset.room); }));
  }
  function toggleDirectory() {
    if (!directory.classList.contains('hidden')) { closeModals(); return false; }
    closeModals(); // close/stop any other modal (incl. the cinema iframe) first
    directory.classList.remove('hidden');
    modal = true;
    return true;
  }

  // ---- pause / resume ----
  function showResume(show) { resume.classList.toggle('hidden', !show); }

  // close buttons + backdrop
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { closeModals(); onEnter(); }));

  return {
    setLoading, ready, setRoom, setPrompt, openDetail, openCinema, closeModals, toggleDirectory, showResume, buildDirectory,
    isModalOpen: () => modal,
  };
}

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
