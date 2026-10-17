import './style.css';
import * as api from './api.js';
import { searchHTML } from './searchview.js';
import { initSpotify, setBanner, refresh as spRefresh, setHooks, closeOverlay } from './spotify.js';

/* ---------- Helfer ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isSearchUrl = (u) => !!u && u.startsWith('search:');
const hostOf = (u) => { if (isSearchUrl(u)) return 'Suche'; try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const shownUrl = (u) => (isSearchUrl(u) ? decodeURIComponent(u.slice(7)) : u || '');   // Suchen zeigen nur den Suchbegriff
const initial = (t) => (t || '?').trim().charAt(0).toUpperCase() || '?';

// Eingabe → URL: echte Adressen bleiben, "beispiel.de" bekommt https://; alles andere ist eine Suche (null).
function toURL(input) {
  const s = input.trim();
  if (!s) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) || /^(about|data|file|mailto):/i.test(s)) return s;
  if (/^(localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?([/?#]|$)/i.test(s)) return 'http://' + s;
  if (!/\s/.test(s) && /^[^\s/]+\.[a-z]{2,}(:\d+)?([/?#]|$)/i.test(s)) return 'https://' + s;
  return null;
}
function resolve(input) {
  const s = input.trim(); if (!s) return null;
  if (isSearchUrl(s)) return { q: decodeURIComponent(s.slice(7)) };
  const u = toURL(s); return u ? { url: u } : { q: s };
}

const ICON = {
  reload: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/></svg>',
  stop: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  star: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1-4.5-4.3 6.1-.8z"/></svg>',
  starOn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="#a24d84" stroke="#a24d84" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1-4.5-4.3 6.1-.8z"/></svg>',
  lock: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  search: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  globe: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>',
  x: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
};

/* ---------- Erscheinungsbild (Hell/Dunkel/Automatisch) ---------- */
const THEME_KEY = 'fm-theme';
function themeMode() { try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch { return 'auto'; } }
const prefersDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
const isDark = () => document.documentElement.dataset.theme === 'dark';
function applyTheme(mode, persist) {
  if (persist) { try { localStorage.setItem(THEME_KEY, mode); } catch { /* ohne Speicher: gilt nur jetzt */ } }
  document.documentElement.dataset.theme = (mode === 'dark' || (mode === 'auto' && prefersDark())) ? 'dark' : 'light';
  api.setAppearance(mode);   // nativ: Webseiten folgen über prefers-color-scheme, Systemelemente passen sich an
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (themeMode() === 'auto') applyTheme('auto'); });

/* ---------- Native Ansichten: während des Startbildschirms verborgen ---------- */
let splashing = true, pendingShow = -1;
function nativeShow(id) { if (splashing) { pendingShow = id; return; } api.show(id); }

/* ---------- Zustand ---------- */
const S = {
  hasKey: false, tabs: [], active: 0, next: 1, bookmarks: [], downloads: [],
  side: false, sideTab: 'bookmarks', bar: true, cover: 0, sugg: [], suggSel: -1, findOpen: false,
};
const tabById = (id) => S.tabs.find((t) => t.id === id);
const cur = () => tabById(S.active);
// mode: 'start' (Startseite) | 'search' (eingebaute Suchansicht) | 'web' (nativer WKWebView)
const mkTab = (id, url) => ({
  id, url: url || '', title: '', icon: '', loading: false, progress: 0, back: false, fwd: false, native: false, lazy: false, error: false, zoom: 1,
  mode: 'start', webUrl: '', webTitle: '',
  q: '', page: 0, data: null, sErr: '', sLoading: false, sTok: 0, sel: 0, filter: 'all', sHist: [], sIdx: -1,
  under: false, cameFromSearch: false, fwdWeb: false, fwdSearch: false,
});

function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ---------- Tabs ---------- */
function newTab(url, opts = {}) {
  const t = mkTab(S.next++, '');
  S.tabs.push(t);
  if (url) visit(t, url);
  if (!opts.background) activate(t.id); else { renderTabs(); saveSession(); }
  return t;
}
function adoptPopup(id) {            // Tab, den eine Seite selbst geöffnet hat (window.open)
  const t = mkTab(id, ''); t.native = true; t.mode = 'web'; S.tabs.push(t);
  activate(id);
}
/* ---------- Navigation: Startseite · Suche · Web ---------- */
function visit(t, input) {
  const r = resolve(input); if (!r) return;
  if (r.q !== undefined) openSearch(t, r.q, 0); else openWeb(t, r.url);
}
function openWeb(t, url) {
  if (t.id === S.active) $('#url').blur();
  if (t.mode === 'search') { t.cameFromSearch = true; if (t.native) { api.close(t.id); t.native = false; } }   // frische Verlaufskette: Zurück führt zur Suche
  else if (t.mode === 'start') t.cameFromSearch = false;
  t.sTok++; t.sLoading = false;
  t.mode = 'web'; t.under = false; t.fwdWeb = false; t.fwdSearch = false;
  t.url = t.webUrl = url; t.title = t.webTitle = ''; t.native = true; t.lazy = false; t.error = false; t.icon = '';
  api.load(t.id, url);
  if (t.id === S.active) { nativeShow(t.id); renderAll(); }
  saveSession();
}
function openSearch(t, q, page = 0, opts = {}) {
  q = q.trim(); if (!q) return;
  if (t.id === S.active) $('#url').blur();
  if (t.mode === 'web' && t.native) t.under = true;           // Webseite bleibt (verborgen) darunter, Zurück kehrt zu ihr zurück
  if (t.mode === 'start') t.under = false;
  if (!opts.noPush) {
    if (t.mode !== 'search') { t.sHist = []; t.sIdx = -1; }
    t.sHist = t.sHist.slice(0, t.sIdx + 1); t.sHist.push({ q, page, data: null }); t.sIdx = t.sHist.length - 1;
  }
  t.mode = 'search'; t.lazy = false; t.fwdWeb = false; t.fwdSearch = false; t.error = false;
  loadEntry(t, opts.force);
  if (t.id === S.active) nativeShow(-1);
  saveSession();
}
// zeigt den Eintrag sHist[sIdx]; Ergebnisse werden pro Eintrag gemerkt (Zurück/Vor kostet keine Anfrage)
async function loadEntry(t, force) {
  const e = t.sHist[t.sIdx]; if (!e) return;
  t.q = e.q; t.page = e.page; t.url = 'search:' + encodeURIComponent(e.q); t.title = e.q + ' – Suche'; t.sel = 0; t.sErr = '';
  const tok = ++t.sTok;
  if (e.data && !force) { t.data = e.data; t.sLoading = false; t.loading = false; if (t.id === S.active) renderAll(); return; }
  t.data = null;
  if (!S.hasKey) { t.sErr = 'NOKEY'; t.sLoading = false; t.loading = false; if (t.id === S.active) renderAll(); return; }
  t.sLoading = true; t.loading = true; t.progress = 0.45;
  if (t.id === S.active) renderAll();
  try {
    const d = await api.search(e.q, e.page);
    if (tok !== t.sTok) return;
    e.data = t.data = d;
    if (e.page === 0) api.historyAdd(t.url, t.title);
  } catch (err) {
    if (tok !== t.sTok) return;
    t.sErr = String(err?.message || err);
  }
  t.sLoading = false; t.loading = false;
  if (t.id === S.active) { renderAll(); $('#searchView').scrollTop = 0; }
}
const canBack = (t) => (t.mode === 'web' ? (t.back || t.cameFromSearch) : t.mode === 'search');
const canFwd = (t) => (t.mode === 'web' ? (t.fwd || t.fwdSearch) : t.mode === 'search' ? (t.sIdx < t.sHist.length - 1 || t.fwdWeb) : t.fwdSearch);
function showWeb(t) { t.mode = 'web'; t.url = t.webUrl; t.title = t.webTitle; t.sTok++; t.sLoading = false; t.loading = false; if (t.id === S.active) { nativeShow(t.id); renderAll(); } }
function showSearchMode(t) { t.mode = 'search'; if (t.id === S.active) nativeShow(-1); loadEntry(t); }
function goBack(t) {
  if (t.mode === 'web') {
    if (t.back) api.back(t.id);
    else if (t.cameFromSearch) { t.fwdWeb = true; showSearchMode(t); }
  } else if (t.mode === 'search') {
    if (t.sIdx > 0) { t.sIdx--; loadEntry(t); }
    else if (t.under) { t.fwdSearch = true; showWeb(t); }
    else { t.fwdSearch = true; t.mode = 'start'; t.url = ''; t.title = ''; t.q = ''; t.data = null; t.sTok++; t.sLoading = false; t.loading = false; renderAll(); }
  }
}
function goForward(t) {
  if (t.mode === 'search') {
    if (t.sIdx < t.sHist.length - 1) { t.sIdx++; loadEntry(t); }
    else if (t.fwdWeb) { t.fwdWeb = false; showWeb(t); }
  } else if (t.mode === 'web') {
    if (t.fwd) api.forward(t.id);
    else if (t.fwdSearch) { t.fwdSearch = false; showSearchMode(t); }
  } else if (t.fwdSearch) { t.fwdSearch = false; showSearchMode(t); }
}
function activate(id) {
  closeOverlays();
  $('#url').blur();
  S.active = id;
  const t = cur();
  if (t.lazy) { t.lazy = false; visit(t, t.url); }
  nativeShow(t.mode === 'web' && t.native ? t.id : -1);
  if (t.native) api.zoom(t.id, t.zoom);
  renderAll();
  if (t.mode === 'start') setTimeout(() => $('#url').focus(), 0);
  saveSession();
}
function closeTab(id) {
  const i = S.tabs.findIndex((t) => t.id === id); if (i < 0) return;
  const t = S.tabs[i];
  if (t.native) api.close(id);
  S.tabs.splice(i, 1);
  if (!S.tabs.length) { newTab(); return; }
  if (S.active === id) activate(S.tabs[Math.min(i, S.tabs.length - 1)].id);
  else { renderTabs(); saveSession(); }
}
function stepTab(d) {
  const i = S.tabs.findIndex((t) => t.id === S.active);
  activate(S.tabs[(i + d + S.tabs.length) % S.tabs.length].id);
}

/* ---------- Sitzung ---------- */
let sessT;
function saveSession() {
  clearTimeout(sessT);
  sessT = setTimeout(() => {
    const tabs = S.tabs.filter((t) => t.url && !t.error).map((t) => ({ url: t.mode === 'web' ? t.webUrl || t.url : t.url, title: t.title }));
    const act = Math.max(0, S.tabs.filter((t) => t.url && !t.error).findIndex((t) => t.id === S.active));
    api.sessionSave(JSON.stringify({ tabs, active: act }));
  }, 700);
}
async function restoreSession() {
  try {
    const s = JSON.parse(await api.sessionLoad() || 'null');
    if (s && s.tabs && s.tabs.length) {
      s.tabs.forEach((x, i) => { const t = mkTab(S.next++, x.url); t.title = x.title || hostOf(x.url); t.lazy = true; S.tabs.push(t); if (i === s.active) S.active = t.id; });
      if (!S.active) S.active = S.tabs[0].id;
      activate(S.active);
      return;
    }
  } catch { /* leere/alte Sitzung */ }
  newTab();
}

/* ---------- Ereignisse aus den nativen Tabs ---------- */
api.onWeb((e) => {
  const t = tabById(e.tab);
  switch (e.t) {
    case 'state':
      if (!t) return;
      t.back = e.back; t.fwd = e.fwd;
      if (e.url && !(t.error && e.url === t.webUrl)) t.webUrl = e.url;
      if (e.title) t.webTitle = e.title;
      if (t.mode !== 'web') return;          // verborgene Webseite unter der Suche: nur merken
      t.loading = e.loading; t.progress = e.progress; t.url = t.webUrl; t.title = t.webTitle;
      renderTabs(); if (t.id === S.active) { renderToolbar(); saveSession(); }
      break;
    case 'loaded':
      if (!t) return;
      t.error = !!e.error;
      if (!e.error && e.url && t.mode === 'web') { api.historyAdd(e.url, e.title || ''); }
      break;
    case 'favicon': if (t && t.mode === 'web') { t.icon = e.icon; renderTabs(); } break;
    case 'error': if (t && t.mode === 'web') { t.error = true; t.url = t.webUrl = e.url || t.url; renderToolbar(); } break;
    case 'popup': adoptPopup(e.tab); break;
    case 'newtab': newTab(e.url, { background: true }); break;
    case 'close': closeTab(e.tab); break;
    case 'find': $('#findStat').textContent = e.found ? '' : 'Nicht gefunden'; break;
    case 'dl': onDownload(e); break;
  }
});

/* ---------- Rendern ---------- */
function renderTabs() {
  $('#tabs').innerHTML = S.tabs.map((t) => {
    const label = t.title || (t.url ? hostOf(t.url) : 'Neuer Tab');
    const ico = t.loading ? '<span class="spin"></span>' : t.mode === 'search' ? `<span class="fav">${ICON.search}</span>` : t.icon ? `<img class="fav" src="${esc(t.icon)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'fav',innerHTML:window.__globe}))">` : `<span class="fav">${ICON.globe}</span>`;
    return `<div class="tab ${t.id === S.active ? 'act' : ''}" title="${esc(label)}">${ico}<button class="tlab" role="tab" aria-selected="${t.id === S.active}" data-act="tab" data-id="${t.id}">${esc(label)}</button>${S.tabs.length > 1 ? `<button class="tx" data-act="close" data-id="${t.id}" aria-label="Tab schließen">${ICON.x}</button>` : ''}</div>`;
  }).join('') + `<button class="ib" id="newtab" data-act="new-tab" aria-label="Neuer Tab">${ICON.plus}</button>`;
  $('#body').style.borderRadius = '0';
}
window.__globe = ICON.globe;
function isBookmarked(url) { return S.bookmarks.some((b) => b.url === url); }
function renderToolbar() {
  const t = cur(); if (!t) return;
  $('#bBack').classList.toggle('off', !canBack(t));
  $('#bFwd').classList.toggle('off', !canFwd(t));
  $('#bReload').innerHTML = t.loading ? ICON.stop : ICON.reload;
  $('#bReload').classList.toggle('off', t.mode === 'start');
  const input = $('#url');
  if (document.activeElement !== input) input.value = shownUrl(t.mode === 'start' ? '' : t.url);
  $('#lock').innerHTML = t.mode === 'search' ? ICON.search : t.url.startsWith('https://') ? ICON.lock : '';
  const bm = !!t.url && isBookmarked(t.url);
  $('#bStar').innerHTML = bm ? ICON.starOn : ICON.star;
  $('#bStar').classList.toggle('off', t.mode === 'start');
  $('#bSide').classList.toggle('on', S.side);
  const p = $('#progress div');
  p.style.opacity = t.loading ? 1 : 0; p.style.width = (t.loading ? Math.max(8, t.progress * 100) : 100) + '%';
}
function renderBar() {
  const bar = $('#bmbar');
  bar.hidden = !(S.bar && S.bookmarks.length);
  bar.innerHTML = S.bookmarks.slice(0, 14).map((b) => `<button class="chip" data-act="open-url" data-url="${esc(b.url)}" title="${esc(b.title)}"><i class="dot">${esc(initial(b.title))}</i><span>${esc(b.title)}</span></button>`).join('');
  updateFrame();
}
function startHTML() {
  const bms = S.bookmarks.slice(0, 12);
  return `<div class="hero">Neuer Tab</div>
  <form id="startForm" style="width:100%;display:flex;justify-content:center"><input class="sbox" id="startQ" type="text" placeholder="Im Web suchen oder Adresse eingeben" spellcheck="false" autocomplete="off"></form>
  ${S.hasKey ? '' : '<div class="sec"><div class="keyhint"><b>Eigene Suche einrichten</b><span>Hinterlege deinen Brave-API-Schlüssel, dann sucht die Adressleiste über Brave.</span><button class="btn pri" data-act="settings">Einstellungen öffnen</button></div></div>'}
  <section id="widget-banner" hidden></section>
  ${bms.length ? `<div class="sec"><h3>Lesezeichen</h3><div class="tiles">${bms.map((b) => `<button class="tile" data-act="open-url" data-url="${esc(b.url)}"><div class="big">${esc(initial(b.title))}</div><span>${esc(b.title)}</span></button>`).join('')}</div></div>` : ''}
  <div class="sec" id="recent"><h3>Zuletzt besucht</h3><div class="hint">Lade …</div></div>`;
}
async function renderStart() {
  const t = cur(), el = $('#start');
  const show = t && t.mode === 'start' && !t.lazy;
  el.hidden = !show;
  if (!show) { setBanner(null); return; }
  el.innerHTML = startHTML();
  setBanner('start', 'Spotify'); spRefresh();
  const h = await api.history('', 8);
  const box = $('#recent'); if (!box) return;
  box.innerHTML = '<h3>Zuletzt besucht</h3>' + (h.length ? h.map((v) => `<button class="hrow" data-act="open-url" data-url="${esc(v.url)}"><b>${esc(v.title || hostOf(v.url))}</b><i>${esc(v.url)}</i></button>`).join('') : '<div class="hint">Noch nichts besucht.</div>');
}
function renderSearchView() {
  const t = cur(), el = $('#searchView');
  const show = !!t && t.mode === 'search';
  el.hidden = !show;
  if (!show) return;
  const top = el.scrollTop;
  el.innerHTML = searchHTML(t, isBookmarked);
  el.scrollTop = t.sLoading ? 0 : top;
}
function renderAll() { renderTabs(); renderToolbar(); renderBar(); renderStart(); renderSearchView(); renderSide(); updateFrame(); }

/* ---------- Seitenbereich ↔ native Ansicht ---------- */
let frameT;
function updateFrame() {
  clearTimeout(frameT);
  frameT = setTimeout(() => {
    const r = $('#page').getBoundingClientRect();
    api.setFrame(Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height));
  }, 0);
}
new ResizeObserver(updateFrame).observe($('#page'));
window.addEventListener('resize', updateFrame);

// Overlays (Menü, Vorschläge) müssen über der Seite liegen, native Ansichten liegen aber über der Oberfläche.
// Lösung: kurz ein Foto der Seite zeigen und die native Ansicht verbergen.
async function cover(on) {
  if (on) {
    S.cover++;
    if (S.cover !== 1) return;
    const t = cur(); if (!t || !t.native || t.mode !== 'web') return;
    let shot = '';
    try { shot = await api.snapshot(t.id); } catch { /* ohne Foto: Seite wird leer */ }
    if (S.cover < 1) return;
    const img = $('#pageShot');
    if (shot) { img.src = shot; img.hidden = false; }
    nativeShow(-1);
  } else {
    S.cover = Math.max(0, S.cover - 1);
    if (S.cover) return;
    $('#pageShot').hidden = true;
    const t = cur(); if (t && t.native && t.mode === 'web') nativeShow(t.id);
  }
}
function closeOverlays() { closeMenu(); closeSugg(); closeOverlay(); closeSettings(); }

/* ---------- Menü ---------- */
let menuOpen = false;
function closeMenu() { if (!menuOpen) return; menuOpen = false; $('#menu').style.display = 'none'; cover(false); }
function openMenu() {
  if (menuOpen) { closeMenu(); return; }
  const t = cur(), z = Math.round((t?.zoom || 1) * 100);
  const items = [
    ['Neuer Tab', '⌘T', 'new-tab'], ['Auf der Seite suchen', '⌘F', 'find'], '-',
    ['Vergrößern', '⌘+', 'zoom-in'], ['Verkleinern', '⌘−', 'zoom-out'], ['Tatsächliche Größe (' + z + ' %)', '⌘0', 'zoom-reset'], '-',
    ['Einstellungen …', '⌘,', 'settings'], [isDark() ? 'Heller Modus' : 'Dunkelmodus', '⇧⌘D', 'toggle-theme'], '-',
    ['Lesezeichen', '⌘⌥B', 'show-bookmarks'], ['Verlauf', '⌘Y', 'show-history'], ['Downloads', '⌘⌥L', 'show-downloads'], '-',
    [S.bar ? 'Lesezeichenleiste ausblenden' : 'Lesezeichenleiste einblenden', '⇧⌘B', 'toggle-bar'],
  ];
  const m = $('#menu'), r = $('#bMenu').getBoundingClientRect();
  m.innerHTML = items.map((it) => it === '-' ? '<div class="msep"></div>' : `<button class="mi" data-cmd="${it[2]}"><span>${it[0]}</span><small>${it[1]}</small></button>`).join('');
  m.style.display = 'block'; m.style.top = r.bottom + 6 + 'px'; m.style.left = Math.max(8, r.right - m.offsetWidth) + 'px';
  menuOpen = true; cover(true);
}
$('#menu').addEventListener('click', (ev) => { const b = ev.target.closest('[data-cmd]'); if (b) { closeMenu(); runCmd(b.dataset.cmd); } });

/* ---------- Adressleiste & Vorschläge ---------- */
const url = $('#url');
let suggOpen = false, suggToken = 0;
function closeSugg() { if (!suggOpen) return; suggOpen = false; $('#sugg').hidden = true; S.sugg = []; S.suggSel = -1; cover(false); }
async function openSugg(q) {
  const token = ++suggToken;
  const text = q.trim();
  if (!text) { closeSugg(); return; }
  const [hist] = await Promise.all([api.history(text, 6)]);
  if (token !== suggToken) return;
  const items = [{ kind: 'go', label: text, sub: /^[^\s]+\.[a-z]{2,}/i.test(text) || /:\/\//.test(text) ? 'Öffnen' : 'Mit Brave suchen', url: text }];
  const seen = new Set();
  for (const b of S.bookmarks) if ((b.title + b.url).toLowerCase().includes(text.toLowerCase()) && !seen.has(b.url)) { seen.add(b.url); items.push({ kind: 'bm', label: b.title, sub: shownUrl(b.url), url: b.url }); }
  for (const v of hist) if (!seen.has(v.url)) { seen.add(v.url); items.push({ kind: 'h', label: v.title || hostOf(v.url), sub: shownUrl(v.url), url: v.url }); }
  S.sugg = items.slice(0, 7); S.suggSel = 0;
  const box = $('#sugg'), r = $('#urlbox').getBoundingClientRect();
  box.style.left = r.left + 'px'; box.style.top = r.bottom + 6 + 'px'; box.style.width = r.width + 'px';
  paintSugg(); box.hidden = false;
  if (!suggOpen) { suggOpen = true; cover(true); }
}
function paintSugg() {
  $('#sugg').innerHTML = S.sugg.map((s, i) => `<button class="sg ${i === S.suggSel ? 'sel' : ''}" data-i="${i}"><span>${esc(s.label)}</span><i>${esc(s.sub)}</i></button>`).join('');
}
$('#sugg').addEventListener('mousedown', (ev) => { ev.preventDefault(); const b = ev.target.closest('.sg'); if (b) commitAddress(S.sugg[+b.dataset.i].url); });
function commitAddress(text) { closeSugg(); url.blur(); visit(cur(), text); }
url.addEventListener('focus', () => url.select());
url.addEventListener('input', () => openSugg(url.value));
url.addEventListener('blur', () => { setTimeout(() => { closeSugg(); renderToolbar(); }, 120); });
url.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') { ev.preventDefault(); commitAddress(S.sugg[S.suggSel]?.url ?? url.value); }
  else if (ev.key === 'Escape') { closeSugg(); url.value = shownUrl(cur()?.mode === 'start' ? '' : cur()?.url); url.blur(); }
  else if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && S.sugg.length) {
    ev.preventDefault(); S.suggSel = (S.suggSel + (ev.key === 'ArrowDown' ? 1 : -1) + S.sugg.length) % S.sugg.length;
    paintSugg();
  }
});

/* ---------- Suche auf der Seite ---------- */
const findIn = $('#findIn');
function openFind() { if (cur()?.mode !== 'web') { url.focus(); url.select(); toast('Neue Suche: einfach in die Adressleiste tippen'); return; }
  S.findOpen = true; $('#findbar').hidden = false; updateFrame(); findIn.focus(); findIn.select(); }
function closeFind() { S.findOpen = false; $('#findbar').hidden = true; $('#findStat').textContent = ''; const t = cur(); if (t?.native) api.find(t.id, '', true); updateFrame(); }
function doFind(fwd) { const t = cur(); if (t?.native && findIn.value) api.find(t.id, findIn.value, fwd); }
findIn.addEventListener('input', () => { $('#findStat').textContent = ''; doFind(true); });
findIn.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); doFind(!ev.shiftKey); } if (ev.key === 'Escape') closeFind(); });

/* ---------- Seitenleiste ---------- */
function fmtTime(ms) {
  const d = new Date(ms), n = new Date(), day = (x) => new Date(x).setHours(0, 0, 0, 0);
  const diff = Math.round((day(n) - day(d)) / 864e5), hm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return diff === 0 ? hm : diff === 1 ? 'Gestern, ' + hm : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ', ' + hm;
}
const fmtSize = (b) => (b < 1e6 ? Math.round(b / 1e3) + ' KB' : b < 1e9 ? (b / 1e6).toFixed(1).replace('.', ',') + ' MB' : (b / 1e9).toFixed(1).replace('.', ',') + ' GB');
let histQ = '';
async function renderSide() {
  const side = $('#side'); side.hidden = !S.side;
  if (!S.side) return;
  const tabs = [['bookmarks', 'Lesezeichen'], ['history', 'Verlauf'], ['downloads', 'Downloads']];
  let body = '';
  if (S.sideTab === 'bookmarks') {
    body = `<div class="slist">${S.bookmarks.length ? S.bookmarks.map((b) => `<div class="sitem"><button class="go" data-act="open-url" data-url="${esc(b.url)}"><div class="t"><b>${esc(b.title)}</b><small>${esc(b.url)}</small></div></button><button class="rm" data-act="rm-bm" data-url="${esc(b.url)}" aria-label="Entfernen">${ICON.x}</button></div>`).join('') : '<div class="hint">Mit dem Stern in der Adressleiste (⌘D) merkst du dir Seiten.</div>'}</div>`;
  } else if (S.sideTab === 'history') {
    const h = await api.history(histQ, 200);
    body = `<div class="shead"><input id="histQ" type="search" placeholder="Verlauf durchsuchen" value="${esc(histQ)}"><button class="link" data-act="clear-history">Löschen</button></div><div class="slist">${h.length ? h.map((v) => `<div class="sitem"><button class="go" data-act="open-url" data-url="${esc(v.url)}"><div class="t"><b>${esc(v.title || hostOf(v.url))}</b><small>${esc(fmtTime(v.last))} · ${esc(hostOf(v.url))}</small></div></button><button class="rm" data-act="rm-hist" data-url="${esc(v.url)}" aria-label="Entfernen">${ICON.x}</button></div>`).join('') : '<div class="hint">Keine Einträge.</div>'}</div>`;
  } else {
    const L = S.downloads.slice().reverse();
    body = `<div class="shead"><span class="hint" style="padding:0">${L.length} Einträge</span><button class="link" data-act="clear-dl">Liste leeren</button></div><div class="slist">${L.length ? L.map((d) => `<div class="sitem"><div class="t"><b>${esc(d.name)}</b>${d.state === 'progress' || d.state === 'start' ? `<div class="sbar"><div style="width:${d.total ? Math.min(100, d.received / d.total * 100) : 40}%"></div></div><small>${fmtSize(d.received || 0)}${d.total > 0 ? ' von ' + fmtSize(d.total) : ''}</small>` : d.state === 'failed' ? '<small style="color:#9c2f45">Fehlgeschlagen</small>' : `<small>${esc(d.path.replace(/^\/Users\/[^/]+/, '~'))}</small>`}</div>${d.state === 'done' ? `<button class="link" data-act="dl-open" data-path="${esc(d.path)}">Öffnen</button><button class="link" data-act="dl-reveal" data-path="${esc(d.path)}">Finder</button>` : ''}</div>`).join('') : '<div class="hint">Noch keine Downloads.</div>'}</div>`;
  }
  const keepFocus = document.activeElement?.id === 'histQ';
  side.innerHTML = `<div><div class="stabs">${tabs.map(([k, l]) => `<button class="${S.sideTab === k ? 'on' : ''}" data-act="side-tab" data-k="${k}">${l}</button>`).join('')}</div>${body}</div>`;
  if (keepFocus) { const i = $('#histQ'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}
document.addEventListener('input', (ev) => { if (ev.target.id === 'histQ') { histQ = ev.target.value; renderSide(); } });
function openSide(tab) { S.side = true; if (tab) S.sideTab = tab; renderToolbar(); renderSide(); }

/* ---------- Downloads ---------- */
function onDownload(e) {
  let d = S.downloads.find((x) => x.id === e.id);
  if (e.state === 'start') {
    S.downloads.push({ id: e.id, name: e.name, path: e.path, total: e.total, received: 0, state: 'progress' });
    openSide('downloads'); toast('Download: ' + e.name);
  } else if (d) {
    if (e.state === 'progress') { d.received = e.received; d.total = e.total || d.total; }
    if (e.state === 'done') { d.state = 'done'; api.downloadAdd(d.name, d.path); toast('Geladen: ' + d.name); }
    if (e.state === 'failed') { d.state = 'failed'; }
  }
  if (S.side && S.sideTab === 'downloads') renderSide();
}

/* ---------- Einstellungen ---------- */
let settingsOpen = false;
function closeSettings() {
  if (!settingsOpen) return;
  settingsOpen = false; $('#settings-ov').hidden = true; $('#settings-ov').innerHTML = '';
  const t = cur(); if (t && t.native && t.mode === 'web') nativeShow(t.id);
}
function settingsHTML(msg, kind) {
  return `<div class="card" role="document"><header><b>Einstellungen</b><button class="ib sm" data-act="settings-close" aria-label="Schließen">${ICON.x}</button></header>
    <div class="cbody"><h3>Darstellung</h3>
    <div class="stabs seg3" role="group" aria-label="Erscheinungsbild">${[['auto', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([k, l]) => `<button class="${themeMode() === k ? 'on' : ''}" data-act="theme" data-m="${k}">${l}</button>`).join('')}</div>
    <h3>Suche · Brave API</h3>
    <p class="muted">Die Adressleiste sucht über die Brave-Search-API; die Ergebnisse erscheinen direkt im Browser. Den Schlüssel erstellst du unter <button class="link" data-act="open-brave">brave.com/search/api</button>.</p>
    <div class="state ${S.hasKey ? 'ok' : ''}">${S.hasKey ? 'Schlüssel gespeichert ✓' : 'Kein Schlüssel gespeichert'}</div>
    <input id="keyIn" type="password" placeholder="${S.hasKey ? 'Neuen Schlüssel einfügen, um ihn zu ersetzen' : 'Brave-API-Schlüssel einfügen'}" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Brave-API-Schlüssel">
    <div class="row"><button class="btn pri" data-act="key-save">Speichern</button><button class="btn" data-act="key-test" ${S.hasKey ? '' : 'disabled'}>Verbindung testen</button><button class="btn" data-act="key-clear" ${S.hasKey ? '' : 'disabled'}>Entfernen</button></div>
    <div id="keyMsg" class="kmsg ${kind || ''}">${esc(msg || '')}</div>
    <p class="muted small">Der Schlüssel liegt in einer Datei im App-Ordner, die nur dein Benutzer lesen kann (Rechte 0600). Er wird nie angezeigt und nur an Brave gesendet.</p></div></div>`;
}
function openSettings(msg, kind) {
  closeMenu(); closeSugg(); closeOverlay();
  if (!settingsOpen) { settingsOpen = true; nativeShow(-1); }
  const ov = $('#settings-ov'); ov.hidden = false; ov.innerHTML = settingsHTML(msg, kind);
  setTimeout(() => $('#keyIn')?.focus(), 0);
}
function keyMsg(text, kind) { const m = $('#keyMsg'); if (m) { m.textContent = text; m.className = 'kmsg ' + (kind || ''); } }
async function testKey() {
  keyMsg('Teste …');
  try { await api.keyTest(); keyMsg('Verbindung zu Brave funktioniert ✓', 'ok'); } catch (e) { keyMsg(String(e?.message || e), 'err'); }
}
async function saveKey() {
  const i = $('#keyIn'); const v = i.value.trim(); if (!v) { keyMsg('Bitte zuerst einen Schlüssel einfügen.', 'err'); return; }
  try { await api.keySet(v); } catch (e) { keyMsg(String(e?.message || e), 'err'); return; }
  i.value = ''; S.hasKey = true; openSettings('Gespeichert. Teste …'); await testKey(); renderStart(); { const ct = cur(); if (ct?.mode === 'search' && ct.sErr) loadEntry(ct, true); }
}
$('#settings-ov').addEventListener('mousedown', (ev) => { if (ev.target.id === 'settings-ov') closeSettings(); });

/* ---------- Befehle (Menü, Tasten, Klicks) ---------- */
function setZoom(f) { const t = cur(); if (!t?.native || t.mode !== 'web') return; t.zoom = Math.min(3, Math.max(0.3, Math.round(f * 100) / 100)); api.zoom(t.id, t.zoom); toast('Zoom ' + Math.round(t.zoom * 100) + ' %'); }
async function toggleBookmark() {
  const t = cur(); if (!t || t.mode === 'start' || !t.url) return;
  const on = !isBookmarked(t.url);
  S.bookmarks = await api.setBookmark(t.url, t.mode === 'search' ? t.q + ' – Suche' : (t.title || hostOf(t.url)), on);
  toast(on ? 'Lesezeichen hinzugefügt' : 'Lesezeichen entfernt');
  renderToolbar(); renderBar(); renderSide();
}
async function runCmd(c) {
  const t = cur();
  switch (c) {
    case 'new-tab': newTab(); break;
    case 'close-tab': closeTab(S.active); break;
    case 'focus-url': await api.focusUI(); url.focus(); url.select(); break;
    case 'find': await api.focusUI(); openFind(); break;
    case 'reload':
      if (t?.mode === 'web' && t.native) (t.loading ? api.stop : api.reload)(t.id);
      else if (t?.mode === 'search') { if (t.loading) { t.sTok++; t.loading = false; t.sLoading = false; renderAll(); } else loadEntry(t, true); }
      break;
    case 'stop': if (t?.mode === 'web' && t.native) api.stop(t.id); break;
    case 'back': if (t) goBack(t); break;
    case 'forward': if (t) goForward(t); break;
    case 'zoom-in': setZoom((t?.zoom || 1) + 0.1); break;
    case 'zoom-out': setZoom((t?.zoom || 1) - 0.1); break;
    case 'zoom-reset': setZoom(1); break;
    case 'toggle-side': S.side = !S.side; renderToolbar(); renderSide(); break;
    case 'toggle-bar': S.bar = !S.bar; renderBar(); break;
    case 'show-history': openSide('history'); break;
    case 'show-bookmarks': openSide('bookmarks'); break;
    case 'show-downloads': openSide('downloads'); break;
    case 'bookmark': toggleBookmark(); break;
    case 'settings': openSettings(); break;
    case 'toggle-theme': applyTheme(isDark() ? 'light' : 'dark', true); break;
    case 'next-tab': stepTab(1); break;
    case 'prev-tab': stepTab(-1); break;
    default: if (/^tab-\d$/.test(c)) { const n = +c.slice(4); const x = n === 9 ? S.tabs[S.tabs.length - 1] : S.tabs[n - 1]; if (x) activate(x.id); }
  }
}
api.onCmd(runCmd);

document.addEventListener('click', async (ev) => {
  const a = ev.target.closest('[data-act]'); if (!a) return;
  const t = cur(), d = a.dataset;
  switch (d.act) {
    case 'tab': activate(+d.id); break;
    case 'close': closeTab(+d.id); break;
    case 'new-tab': newTab(); break;
    case 'back': runCmd('back'); break;
    case 'forward': runCmd('forward'); break;
    case 'reload': runCmd('reload'); break;
    case 'star': toggleBookmark(); break;
    case 'menu': openMenu(); break;
    case 'toggle-side': runCmd('toggle-side'); break;
    case 'open-url': (ev.metaKey ? newTab(d.url, { background: true }) : visit(t, d.url)); break;
    case 'sr-open': ev.preventDefault(); if (ev.metaKey) { newTab(d.url, { background: true }); toast('In neuem Tab geöffnet'); } else openWeb(t, d.url); break;
    case 'sr-tab': newTab(d.url, { background: true }); toast('In neuem Tab geöffnet'); break;
    case 'sr-bm': {
      const on = !isBookmarked(d.url); S.bookmarks = await api.setBookmark(d.url, d.title, on);
      toast(on ? 'Lesezeichen hinzugefügt' : 'Lesezeichen entfernt'); renderBar(); renderSearchView(); renderSide(); break;
    }
    case 'sv-page': openSearch(t, t.q, +d.p); break;
    case 'sv-filter': t.filter = d.k; renderSearchView(); break;
    case 'sv-alt': openSearch(t, d.q, 0); break;
    case 'sv-retry': loadEntry(t, true); break;
    case 'side-tab': S.sideTab = d.k; renderSide(); break;
    case 'rm-bm': S.bookmarks = await api.setBookmark(d.url, '', false); renderToolbar(); renderBar(); renderSide(); break;
    case 'rm-hist': await api.historyRemove(d.url); renderSide(); break;
    case 'clear-history': await api.historyClear(); renderSide(); toast('Verlauf gelöscht'); break;
    case 'clear-dl': S.downloads = []; await api.downloadsClear(); renderSide(); break;
    case 'dl-open': api.openFile(d.path, false); break;
    case 'dl-reveal': api.openFile(d.path, true); break;
    case 'find-next': doFind(true); break;
    case 'find-prev': doFind(false); break;
    case 'find-close': closeFind(); break;
    case 'theme': applyTheme(d.m, true); openSettings(); break;
    case 'settings': openSettings(); break;
    case 'settings-close': closeSettings(); break;
    case 'open-brave': closeSettings(); newTab('https://brave.com/search/api/'); break;
    case 'key-save': saveKey(); break;
    case 'key-test': testKey(); break;
    case 'key-clear': await api.keyClear(); S.hasKey = false; openSettings('Schlüssel entfernt.'); renderStart(); break;
  }
});
document.addEventListener('submit', (ev) => {
  if (ev.target.id !== 'startForm') return;
  ev.preventDefault(); const q = $('#startQ').value; if (q.trim()) visit(cur(), q);
});
document.addEventListener('mousedown', (ev) => { if (menuOpen && !ev.target.closest('#menu, #bMenu')) closeMenu(); });
document.addEventListener('keydown', (ev) => {
  const t = cur();
  if (t?.mode === 'search' && t.data && !settingsOpen && !['INPUT', 'TEXTAREA'].includes(ev.target.tagName) && !ev.altKey) {
    const n = (t.data.results || []).length;
    if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && n && t.filter === 'all') {
      ev.preventDefault(); t.sel = Math.max(0, Math.min(n - 1, t.sel + (ev.key === 'ArrowDown' ? 1 : -1)));
      document.querySelectorAll('.sr').forEach((el) => el.classList.toggle('sel', +el.dataset.i === t.sel));
      document.querySelector('.sr.sel')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else if (ev.key === 'Enter' && n && t.filter === 'all' && !ev.metaKey) { ev.preventDefault(); const r = t.data.results[t.sel]; if (r) openWeb(t, r.url); }
    else if (ev.key === 'Enter' && ev.metaKey && n) { ev.preventDefault(); const r = t.data.results[t.sel]; if (r) { newTab(r.url, { background: true }); toast('In neuem Tab geöffnet'); } }
    else if (ev.key === '/') { ev.preventDefault(); url.focus(); url.select(); }
  }
  if (ev.key === 'Enter' && ev.target.id === 'keyIn') { ev.preventDefault(); saveKey(); } if (ev.key === 'Escape') { closeSettings(); closeMenu(); if (S.findOpen && ev.target.id !== 'findIn') closeFind(); } });

/* ---------- Startbildschirm ---------- */
const splash = $('#splash');
let splashT0 = performance.now(), lastStatus = '';
function splashStep(label, frac) {
  const s = $('#spStatus'), bar = $('#spBar');
  if (bar) bar.style.width = Math.round(frac * 100) + '%';
  if (s && label !== lastStatus) { lastStatus = label; s.classList.remove('sw'); void s.offsetWidth; s.textContent = label; s.classList.add('sw'); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitLoaded(t, maxMs) {     // die aktive Seite lädt schon im Hintergrund; kurz warten, damit sie beim Öffnen fertig ist
  const end = performance.now() + maxMs;
  while (t && t.mode === 'web' && t.loading && performance.now() < end) await wait(80);
}
async function dismissSplash() {
  if (!splashing) return;
  const rest = Math.max(0, 1900 - (performance.now() - splashT0));   // Animation soll ausspielen können
  if (rest) await wait(rest);
  splashing = false; nativeShow(pendingShow);
  splash.classList.add('out');
  setTimeout(() => splash.classList.add('gone'), 760);
  if (cur()?.mode === 'start') setTimeout(() => $('#url').focus(), 50);
}

/* ---------- Start ---------- */
setTimeout(() => { if (splashing) dismissSplash(); }, 9000);   // Sicherung: nie hängen bleiben
(async function init() {
  applyTheme(themeMode());
  // Jeder Schritt zeigt seine Meldung mindestens 320 ms, damit man das Hochfahren sieht – die echte Arbeit läuft währenddessen.
  const step = (label, frac, work) => { splashStep(label, frac); return Promise.all([work ? work() : null, wait(320)]).then((r) => r[0]); };
  try {
    S.hasKey = await step('Einstellungen laden …', 0.14, () => api.keyStatus());
    [S.bookmarks, S.downloads] = await step('Lesezeichen & Verlauf …', 0.36, () => Promise.all([api.bookmarks(), api.downloads()]));
    S.downloads = (S.downloads || []).map((d, i) => ({ id: -i - 1, name: d.name, path: d.path, state: 'done', received: 0, total: 0 }));
    S.bookmarks = S.bookmarks || [];
    renderBar();
    // Spotify-Overlay deckt das Fenster ab: native Seiten dafür kurz ausblenden.
    setHooks({ open() { nativeShow(-1); }, close() { const t = cur(); if (t && t.native && t.mode === 'web') nativeShow(t.id); } });
    await step('Spotify verbinden …', 0.58, () => initSpotify());
    await step('Tabs wiederherstellen …', 0.8, async () => { await restoreSession(); updateFrame(); });
    await step('Seite wird geladen …', 0.94, () => waitLoaded(cur(), 2600));
    splashStep('Bereit', 1);
  } catch (e) { console.error(e); }
  await dismissSplash();
})();
