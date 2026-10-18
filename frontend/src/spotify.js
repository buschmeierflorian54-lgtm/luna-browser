// Spotify-Widget: Chip in der Werkzeugleiste, Banner auf der Startseite und Vollbild-Overlay innerhalb des Fensters.
// Der Zustand kommt per AppleScript aus Go (api.spotifyState); nichts ist simuliert.
import * as api from './api.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mmss = (n) => { n = Math.max(0, Math.floor(n)); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'); };

const M = {
  st: { status: 'off', duration: 0, position: 0, volume: 0 }, at: Date.now(),
  ov: false, collapsed: (() => { try { return localStorage.getItem('fm-sp-collapsed') === '1'; } catch { return false; } })(), banner: null, bannerLabel: '', hidden: {}, sig: { side: '', banner: '', ov: '' },
  seeking: false, volDrag: false, pollTimer: null,
};
const playing = () => M.st.status === 'playing';
const active = () => ['playing', 'paused'].includes(M.st.status);
function pos() {
  const s = M.st; if (!active()) return 0;
  return Math.min(s.duration, s.position + (playing() ? (Date.now() - M.at) / 1000 : 0));
}

/* ---------- Icons ---------- */
const I = {
  play: (n) => `<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>`,
  pause: (n) => `<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="1.5"/><rect x="14" y="4" width="5" height="16" rx="1.5"/></svg>`,
  prev: (n) => `<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="4" y="5" width="3" height="14" rx="1"/><path d="M20 5.5v13a1 1 0 0 1-1.55.83L9 13a1.2 1.2 0 0 1 0-2l9.45-6.33A1 1 0 0 1 20 5.5z"/></svg>`,
  next: (n) => `<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="17" y="5" width="3" height="14" rx="1"/><path d="M4 5.5v13a1 1 0 0 0 1.55.83L15 13a1.2 1.2 0 0 0 0-2L5.55 4.67A1 1 0 0 0 4 5.5z"/></svg>`,
  shuffle: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
  repeat: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
  vol: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4zM16 9a4 4 0 0 1 0 6"/></svg>',
  close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

/* ---------- Bausteine ---------- */
function art(size, radius, fs) {
  const s = M.st, initial = esc((s.title || 'S').trim().charAt(0).toUpperCase());
  const img = s.artwork ? `<img src="${esc(s.artwork)}" alt="" draggable="false" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">` : initial;
  return `<div class="spArt" style="width:${size}px;height:${size}px;border-radius:${radius}px;font-size:${fs}px">${img}</div>`;
}
function statusText() {
  const s = M.st;
  return { off: 'Spotify ist nicht geöffnet', stopped: 'Keine Wiedergabe', playing: 'Läuft gerade', paused: 'Pausiert', denied: 'Zugriff nicht erlaubt', error: 'Fehler' }[s.status] || '';
}
const toggleBtn = (n, cls) => `<button class="${cls}" data-sp-act="toggle" data-sp="toggle" aria-label="Abspielen/Pause">${playing() ? I.pause(n) : I.play(n)}</button>`;

function sideHTML() {
  const s = M.st;
  return `<div class="spChip" data-sp-act="open-ov" role="button" tabindex="0" aria-label="Spotify öffnen" title="Spotify">
    ${art(26, 7, 11)}
    <div class="spChipT"><div class="spT1">${esc(active() ? s.title : 'Spotify')}</div><div class="spT2">${esc(active() ? s.artist : statusText())}</div></div>
    ${active() ? toggleBtn(12, 'spPlay sm') : ''}</div>`;
}
function bannerHTML() {
  const s = M.st;
  const mini = active() ? `${s.title} · ${s.artist}` : statusText();
  return `<div class="banner ${M.collapsed ? 'collapsed' : ''}"><div class="bh"><button class="bhT" data-sp-act="toggle-banner" aria-expanded="${!M.collapsed}" aria-label="Spotify ein- oder ausklappen"><svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg><span>${esc(M.bannerLabel)}</span><em class="bhMini">${esc(mini)}</em></button><span class="bhHint">${M.collapsed ? 'Ausklappen' : 'Einklappen'}</span></div>
  <div class="spCollapse"><div class="spCI"><div class="spBan" data-sp-act="open-ov" role="button" tabindex="0" aria-label="Spotify öffnen">${art(96, 14, 28)}
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;justify-content:space-between;gap:12px"><div style="min-width:0"><div class="spS">${esc(statusText())}</div><div class="spB1">${esc(active() ? s.title : 'Spotify')}</div><div class="spS" style="font-size:13px;font-weight:600">${esc(active() ? s.artist : (s.message || ''))}</div></div><span class="spTag">Spotify</span></div>
      <div style="display:flex;align-items:center;gap:10px;font-size:11px;font-weight:700;color:#d9bccd"><span data-sp="pos" style="width:32px"></span><div class="spBar" style="flex:1;height:4px;margin:0"><div data-sp="pct"></div></div><span data-sp="dur" style="width:32px;text-align:right"></span></div></div>
    ${active() ? `<div style="display:flex;align-items:center;gap:8px;flex-shrink:0"><button class="spBtn" data-sp-act="prev" aria-label="Vorheriger Titel">${I.prev(16)}</button>${toggleBtn(18, 'spPlay')}<button class="spBtn" data-sp-act="next" aria-label="Nächster Titel">${I.next(16)}</button></div>` : ''}
  </div></div></div></div>`;
}
/* ---------- Mini-Player (Popover beim Überfahren des Chips) ---------- */
const P = { open: false, covered: false, timer: 0, settle: 0, sig: '' };
const EXPAND = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>';
function popHTML() {
  const s = M.st, bg = s.artwork ? `<div class="pBg" style="background-image:url('${esc(s.artwork)}')"></div>` : '';
  if (!active()) {
    const off = s.status === 'off', stop = s.status === 'stopped';
    return `${bg}<div class="pc"><div class="pMsg"><div class="pT">${esc(statusText())}</div><div class="pA">${esc(s.message || (off ? 'Starte Spotify, um hier Titel zu steuern.' : stop ? 'Wähle in Spotify einen Titel aus.' : ''))}</div>${off || stop ? `<button class="pBtn" data-sp-act="${off ? 'open-app' : 'toggle'}">${off ? 'Spotify starten' : 'Wiedergabe starten'}</button>` : ''}</div></div>`;
  }
  return `${bg}<div class="pc">
  <div class="pTop"><button class="pArt" data-sp-act="open-ov" aria-label="Vollbild öffnen" title="Vollbild">${art(66, 12, 22)}<span class="pExp">${EXPAND}</span></button>
    <div class="pInfo"><div class="pT">${esc(s.title)}</div><div class="pA">${esc(s.artist)}</div><div class="pAl">${esc(s.album)}</div></div></div>
  <div class="pSeek"><span data-sp="pos"></span><input type="range" min="0" max="${s.duration}" step="1" value="0" data-sp="seek" aria-label="Position"><span data-sp="dur"></span></div>
  <div class="pCtl"><button class="pIc ${s.shuffle ? 'on' : ''}" data-sp-act="shuffle" aria-label="Zufall" aria-pressed="${s.shuffle}">${I.shuffle}</button>
    <button class="pIc big" data-sp-act="prev" aria-label="Zurück">${I.prev(20)}</button>${toggleBtn(24, 'pPlay')}
    <button class="pIc big" data-sp-act="next" aria-label="Weiter">${I.next(20)}</button>
    <button class="pIc ${s.repeat ? 'on' : ''}" data-sp-act="repeat" aria-label="Wiederholen" aria-pressed="${s.repeat}">${I.repeat}</button></div>
  <div class="pVol">${I.vol}<input type="range" min="0" max="100" step="1" value="${s.volume}" data-sp="vol" aria-label="Lautstärke"></div></div>`;
}
const POP_W = 336;
function chipRect() { const r = $('#spChip').getBoundingClientRect(); return { top: Math.round(r.top), right: Math.max(10, Math.round(innerWidth - r.right)), w: Math.round(r.width), h: Math.round(r.height) }; }
function placePop() {              // bei Größenänderung: oben bündig mit dem Chip
  const el = $('#spPop'); if (!el || !P.open) return;
  const c = chipRect(); el.style.top = c.top + 'px'; el.style.right = c.right + 'px';
}
// Der Chip "wandert auf": Die Karte startet exakt auf dem Chip und dehnt sich nach unten und links aus (wie eine Insel).
async function openPop() {
  if (P.open || M.ov) return;
  P.open = true;
  await hooks.popOpen();                       // nativ gerenderte Seite verbergen (Foto der Seite bleibt stehen)
  if (!P.open) { hooks.popClose(); return; }   // inzwischen wieder zu
  P.covered = true;
  const el = $('#spPop'), chip = $('#spChip'), c = chipRect();
  clearTimeout(P.settle);
  el.hidden = false; el.classList.remove('show');
  el.innerHTML = popHTML(); P.sig = sigOf() + (playing() ? 1 : 0);
  // Zielhöhe messen
  el.style.transition = 'none'; el.style.top = c.top + 'px'; el.style.right = c.right + 'px'; el.style.width = POP_W + 'px'; el.style.height = 'auto';
  const H = el.offsetHeight;
  // Startzustand = Chip
  el.style.width = c.w + 'px'; el.style.height = c.h + 'px'; el.style.borderRadius = '12px';
  void el.offsetWidth; el.style.transition = '';
  chip.classList.add('morph');
  el.classList.add('show'); el.style.width = POP_W + 'px'; el.style.height = H + 'px'; el.style.borderRadius = '22px';
  P.settle = setTimeout(() => { if (P.open) el.style.height = 'auto'; }, 520);   // danach darf der Inhalt die Höhe bestimmen
  tick();
}
function closePop(immediate) {
  clearTimeout(P.timer); clearTimeout(P.settle);
  if (!P.open) return;
  P.open = false;
  const el = $('#spPop'), chip = $('#spChip');
  const done = () => { if (!P.open) { el.hidden = true; el.innerHTML = ''; chip.classList.remove('morph'); } };
  if (immediate) { el.classList.remove('show'); done(); }
  else {
    const c = chipRect();
    el.style.height = el.offsetHeight + 'px'; void el.offsetWidth;     // feste Höhe, damit sie zurückschrumpfen kann
    el.classList.remove('show'); el.style.width = c.w + 'px'; el.style.height = c.h + 'px'; el.style.borderRadius = '12px';
    setTimeout(done, 440);
  }
  if (P.covered) { P.covered = false; setTimeout(() => { if (!P.open) hooks.popClose(); }, immediate ? 0 : 380); }
}
const popLater = (fn, ms) => { clearTimeout(P.timer); P.timer = setTimeout(fn, ms); };
function wirePop() {
  const chip = $('#spChip'), pop = $('#spPop'); if (!chip || !pop) return;
  chip.addEventListener('mouseenter', () => popLater(openPop, 170));
  chip.addEventListener('mouseleave', () => popLater(() => closePop(), 300));
  pop.addEventListener('mouseenter', () => clearTimeout(P.timer));
  pop.addEventListener('mouseleave', () => popLater(() => closePop(), 300));
  chip.addEventListener('focusin', () => popLater(openPop, 60));
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && P.open) closePop(); });
  window.addEventListener('resize', placePop);
}

function ovHTML() {
  const s = M.st;
  let body;
  if (active()) {
    body = `<div class="ovArt">${art(320, 24, 96)}</div>
      <div class="ovInfo"><div class="ovTitle">${esc(s.title)}</div><div class="ovArtist">${esc(s.artist)}</div><div class="ovAlbum">${esc(s.album)}</div></div>
      <div class="ovSeek"><span data-sp="pos"></span><input type="range" min="0" max="${s.duration}" step="1" value="0" data-sp="seek" aria-label="Position"><span data-sp="dur"></span></div>
      <div class="ovCtl"><button class="ovBtn ${s.shuffle ? 'on' : ''}" data-sp-act="shuffle" aria-label="Zufall" aria-pressed="${s.shuffle}">${I.shuffle}</button>
        <button class="ovBtn big" data-sp-act="prev" aria-label="Vorheriger Titel">${I.prev(26)}</button>${toggleBtn(30, 'ovPlay')}
        <button class="ovBtn big" data-sp-act="next" aria-label="Nächster Titel">${I.next(26)}</button>
        <button class="ovBtn ${s.repeat ? 'on' : ''}" data-sp-act="repeat" aria-label="Wiederholen" aria-pressed="${s.repeat}">${I.repeat}</button></div>
      <div class="ovVol">${I.vol}<input type="range" min="0" max="100" step="1" value="${s.volume}" data-sp="vol" aria-label="Lautstärke"><span data-sp="volv">${s.volume}</span></div>`;
  } else {
    const off = s.status === 'off', stop = s.status === 'stopped';
    body = `<div class="ovMsg"><div style="font-size:22px;font-weight:800;margin-bottom:8px">${esc(statusText())}</div>
      <div style="max-width:420px;line-height:1.5;color:#d9bccd">${esc(s.message || (off ? 'Starte Spotify, um Titel hier zu sehen und zu steuern.' : stop ? 'Wähle in Spotify einen Titel aus oder starte die Wiedergabe.' : ''))}</div>
      ${off || stop ? `<button class="btn pri" style="margin-top:18px" data-sp-act="${off ? 'open-app' : 'toggle'}">${off ? 'Spotify starten' : 'Wiedergabe starten'}</button>` : ''}</div>`;
  }
  return `<div class="ovBg" style="${s.artwork ? `background-image:url('${esc(s.artwork)}')` : ''}"></div>
    <div class="ovTop"><span>Spotify</span><button class="ovX" data-sp-act="close-ov" aria-label="Schließen">${I.close}</button></div>
    <div class="ovMain">${body}</div>`;
}

/* ---------- Rendern ---------- */
const sigOf = () => [M.st.status, M.st.title, M.st.artist, M.st.artwork, M.st.message, M.st.shuffle, M.st.repeat, M.st.duration].join('|');
function render() {
  const sig = sigOf() + '|' + (playing() ? 1 : 0);
  const side = $('#spChip');
  if (side && M.sig.side !== sig) { side.innerHTML = sideHTML(); M.sig.side = sig; }
  const ban = $('#widget-banner'), showBan = !!M.banner;
  if (ban) {            // existiert nur, solange die Startseite sichtbar ist
    ban.hidden = !showBan;
    const bsig = showBan ? sig + '|' + M.bannerLabel : '';
    if (M.sig.banner !== bsig) { ban.innerHTML = showBan ? bannerHTML() : ''; M.sig.banner = bsig; }
  }
  const ov = $('#spotify-ov');
  ov.hidden = !M.ov;
  if (M.ov && M.sig.ov !== sig) { ov.innerHTML = ovHTML(); M.sig.ov = sig; }
  if (!M.ov) M.sig.ov = '';
  if (P.open && P.covered) { const ps = sigOf() + (playing() ? 1 : 0); if (P.sig !== ps) { P.sig = ps; $('#spPop').innerHTML = popHTML(); } }
  tick();
}
function tick() {
  const s = M.st, p = pos(), pct = s.duration ? (p / s.duration * 100).toFixed(1) + '%' : '0%';
  document.querySelectorAll('[data-sp=pct]').forEach((e) => { e.style.width = pct; });
  document.querySelectorAll('[data-sp=pos]').forEach((e) => { e.textContent = mmss(p); });
  document.querySelectorAll('[data-sp=dur]').forEach((e) => { e.textContent = mmss(s.duration); });
  const seek = document.querySelector('[data-sp=seek]'); if (seek && !M.seeking) seek.value = Math.floor(p);
  document.querySelectorAll('input[type=range][data-sp]').forEach((r) => r.style.setProperty('--p', ((r.value - r.min) / ((r.max - r.min) || 1) * 100).toFixed(1) + '%'));
  const vol = document.querySelector('[data-sp=vol]'); if (vol && !M.volDrag) { vol.value = s.volume; const v = document.querySelector('[data-sp=volv]'); if (v) v.textContent = s.volume; }
}

/* ---------- Abfragen ---------- */
async function poll() {
  clearTimeout(M.pollTimer);
  if (!document.hidden) {
    try { M.st = await api.spotifyState(); M.at = Date.now(); } catch (e) { M.st = { status: 'error', message: String(e?.message || e), duration: 0, position: 0, volume: 0 }; }
    render();
  }
  M.pollTimer = setTimeout(poll, M.ov ? 1000 : 3000);
}
async function cmd(name, arg) {
  try { await api.spotifyCommand(name, arg || 0); } catch (e) { M.st = { ...M.st, status: 'error', message: String(e?.message || e) }; render(); return; }
  if (name === 'playpause') { M.st.status = playing() ? 'paused' : 'playing'; M.st.position = pos(); M.at = Date.now(); render(); }
  setTimeout(poll, name === 'next' || name === 'previous' ? 350 : 150);
}

/* ---------- Ereignisse ---------- */
const hooks = { open() {}, close() {}, popOpen() {}, popClose() {} };
function openOv() { closePop(true); M.ov = true; M.sig.ov = ''; hooks.open(); render(); poll(); }
function closeOv() { if (!M.ov) return; M.ov = false; render(); hooks.close(); }
document.addEventListener('click', (ev) => {
  const a = ev.target.closest('[data-sp-act]'); if (!a) return;
  // Innere Knöpfe haben Vorrang vor dem klickbaren Widget.
  const inner = ev.target.closest('button[data-sp-act]');
  const act = (inner || a).dataset.spAct;
  ev.stopPropagation();
  switch (act) {
    case 'open-ov': openOv(); break;
    case 'close-ov': closeOv(); break;
    case 'toggle': cmd('playpause'); break;
    case 'next': cmd('next'); break;
    case 'prev': cmd(pos() > 3 ? 'seek' : 'previous', 0); break;
    case 'shuffle': cmd('shuffle'); break;
    case 'repeat': cmd('repeat'); break;
    case 'open-app': cmd('open'); setTimeout(poll, 1500); break;
    case 'toggle-banner': {
      M.collapsed = !M.collapsed;
      try { localStorage.setItem('fm-sp-collapsed', M.collapsed ? '1' : '0'); } catch { /* nur für diese Sitzung */ }
      const b = document.querySelector('#widget-banner .banner');      // direkt umschalten, damit der Übergang animiert
      if (b) { b.classList.toggle('collapsed', M.collapsed); b.querySelector('.bhT')?.setAttribute('aria-expanded', String(!M.collapsed)); const h = b.querySelector('.bhHint'); if (h) h.textContent = M.collapsed ? 'Ausklappen' : 'Einklappen'; }
      break;
    }
  }
}, true);
document.addEventListener('keydown', (ev) => {
  if (M.ov && ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closeOv(); }
  else if (!M.ov && (ev.key === 'Enter' || ev.key === ' ') && ev.target.matches?.('[data-sp-act=open-ov]')) { ev.preventDefault(); openOv(); }
}, true);
// Klick irgendwohin (außer auf Knöpfe und Regler) klappt das Overlay wieder ein.
$('#spotify-ov').addEventListener('click', (ev) => { if (!ev.target.closest('button, input')) closeOv(); });
document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.dataset?.sp === 'seek') { M.seeking = true; document.querySelectorAll('[data-sp=pos]').forEach((e) => { e.textContent = mmss(+t.value); }); }
  if (t.dataset?.sp === 'vol') { M.volDrag = true; const vv = $('[data-sp=volv]'); if (vv) vv.textContent = t.value; clearTimeout(M.volT); M.volT = setTimeout(() => api.spotifyCommand('volume', +t.value).catch(() => {}), 80); }
});
document.addEventListener('change', async (ev) => {
  const t = ev.target;
  if (t.dataset?.sp === 'seek') { M.st.position = +t.value; M.at = Date.now(); await cmd('seek', +t.value); M.seeking = false; }
  if (t.dataset?.sp === 'vol') { await api.spotifyCommand('volume', +t.value).catch(() => {}); M.st.volume = +t.value; M.volDrag = false; }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });

/* ---------- Schnittstelle für main.js ---------- */
// open/close: nativ gerenderte Seiten müssen für das Overlay ausgeblendet werden.
export function setHooks(h) { Object.assign(hooks, h); }
export function refresh() { M.sig.banner = ''; render(); }
export function closeOverlay() { closeOv(); }
export function initSpotify() { wirePop(); render(); setInterval(tick, 500); return poll(); }   // wartet auf die erste Abfrage
// path: Ordner, in dem das Banner erscheinen soll (oder null)
export function setBanner(path, label) {
  if (M.banner === path && M.bannerLabel === (label || '')) return;
  M.banner = path; M.bannerLabel = label || ''; M.sig.banner = ''; render();
}
