import './style.css';
import './gesture-core.js';
import * as api from './api.js';
import { searchHTML } from './searchview.js';
import logoUrl from './assets/logo.png';
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
  hasKey: false, restore: false, gesture: true, notes: {}, tabs: [], active: 0, next: 1, bookmarks: [], downloads: [],
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
  else if (t.mode === 'start' || t.mode === 'settings') t.cameFromSearch = false;
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
  if (t.mode === 'start' || t.mode === 'settings') t.under = false;
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
const canBack = (t) => (t.mode === 'web' ? (t.back || t.cameFromSearch) : t.mode === 'search');   // start/settings: nichts davor
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
  if (!S.restore) { api.sessionSave(''); return; }          // Merken ist aus: nichts behalten
  sessT = setTimeout(() => {
    const tabs = S.tabs.filter((t) => t.url && !t.error && t.mode !== 'settings').map((t) => ({ url: t.mode === 'web' ? t.webUrl || t.url : t.url, title: t.title }));
    const act = Math.max(0, S.tabs.filter((t) => t.url && !t.error && t.mode !== 'settings').findIndex((t) => t.id === S.active));
    api.sessionSave(JSON.stringify({ tabs, active: act }));
  }, 700);
}
async function restoreSession() {
  if (!S.restore) { newTab(); return; }                      // Standard: Der Browser startet mit der Startseite
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
    case 'gesture': if (t && t.id === S.active && S.gesture && t.mode === 'web') toggleNotes(); break;
  }
});

/* ---------- Rendern ---------- */
function renderTabs() {
  $('#tabs').innerHTML = S.tabs.map((t) => {
    const label = t.title || (t.url ? hostOf(t.url) : 'Neuer Tab');
    const ico = t.loading ? '<span class="spin"></span>' : t.mode === 'search' ? `<span class="fav">${ICON.search}</span>` : t.mode === 'settings' ? `<span class="fav">${GEAR}</span>` : t.icon ? `<img class="fav" src="${esc(t.icon)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'fav',innerHTML:window.__globe}))">` : `<span class="fav">${ICON.globe}</span>`;
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
  $('#bReload').classList.toggle('off', t.mode === 'start' || t.mode === 'settings');
  const input = $('#url');
  if (document.activeElement !== input) input.value = t.mode === 'settings' ? 'Einstellungen' : shownUrl(t.mode === 'start' ? '' : t.url);
  $('#lock').innerHTML = t.mode === 'settings' ? GEAR : t.mode === 'search' ? ICON.search : t.url.startsWith('https://') ? ICON.lock : '';
  const bm = !!t.url && isBookmarked(t.url);
  $('#bStar').innerHTML = bm ? ICON.starOn : ICON.star;
  $('#bStar').classList.toggle('off', t.mode === 'start' || t.mode === 'settings');
  $('#bSide').classList.toggle('on', S.side);
  const p = $('#progress div');
  p.style.opacity = t.loading ? 1 : 0; p.style.width = (t.loading ? Math.max(8, t.progress * 100) : 100) + '%';
}
function renderBar() {
  const bar = $('#bmbar');
  bar.hidden = !S.bar;
  bar.innerHTML = (S.bookmarks.length ? S.bookmarks.slice(0, 16).map((b) => `<button class="chip" data-act="open-url" data-url="${esc(b.url)}" data-bm="${esc(b.url)}" title="${esc(b.title)} – Rechtsklick: bearbeiten oder löschen"><i class="dot">${esc(initial(b.title))}</i><span>${esc(b.title)}</span></button>`).join('') : '<span class="bmhint">Noch keine Lesezeichen</span>')
    + `<button class="chip add" data-act="bm-add" title="Lesezeichen hinzufügen" aria-label="Lesezeichen hinzufügen">${ICON.plus}<span>Hinzufügen</span></button>`;
  updateFrame();
}
/* ---------- Startseite ---------- */
const GREET = () => { const h = new Date().getHours(); return h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend'; };
const QUICK = [
  ['show-bookmarks', 'Lesezeichen', '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1-4.5-4.3 6.1-.8z"/>'],
  ['show-history', 'Verlauf', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
  ['show-downloads', 'Downloads', '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'],
  ['toggle-theme', 'Erscheinungsbild', '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'],
  ['settings', 'Einstellungen', '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.2 1.3L10 21h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z"/>'],
];
function startHTML() {
  const bms = S.bookmarks.slice(0, 10);
  const d = new Date();
  const date = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const delay = (i) => `style="--d:${120 + i * 55}ms"`;
  return `<div class="st-bg"><i class="a1"></i><i class="a2"></i><i class="a3"></i><i class="a4"></i><canvas class="st-waves" aria-hidden="true"></canvas></div>
  <div class="st-scroll"><div class="st-wrap">
    <header class="st-hero">
      <div class="st-logo-w"><img class="st-logo" src="${logoUrl}" alt="" draggable="false"><span class="st-halo"></span></div>
      <div class="st-clock" id="stClock" aria-label="Uhrzeit"></div>
      <h1 class="st-greet">${GREET()}</h1>
      <p class="st-date">${esc(date)}</p>
    </header>
    <form id="startForm" class="st-search" autocomplete="off">
      <svg class="st-si" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input id="startQ" type="text" placeholder="Im Web suchen oder Adresse eingeben" spellcheck="false" autocomplete="off" aria-label="Suchen">
      <kbd>⌘L</kbd><span class="st-glow"></span>
    </form>
    <div class="st-status">${S.hasKey ? '<span class="pill ok"><i></i>Suche bereit · Brave</span>' : '<button class="pill warn" data-act="settings"><i></i>Eigene Suche einrichten – Brave-Schlüssel hinterlegen</button>'}</div>
    <div class="st-quick">${QUICK.map((q, i) => `<button class="qa" data-act="cmd" data-cmd="${q[0]}" ${delay(i + 3)}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${q[2]}</svg>${q[1]}</button>`).join('')}</div>
    <section id="widget-banner" hidden></section>
    <section class="st-sec"><h3>Lesezeichen</h3><div class="st-tiles">${bms.map((b, i) => `<button class="st-card tile" data-act="open-url" data-url="${esc(b.url)}" data-bm="${esc(b.url)}" title="${esc(b.title)} – Rechtsklick: bearbeiten oder löschen" ${delay(i + 6)}><span class="st-glare"></span><span class="tdel" role="button" aria-label="Lesezeichen löschen" data-act="bm-del" data-url="${esc(b.url)}">${ICON.x}</span><div class="big" style="--h:${hueOf(b.title)}">${esc(initial(b.title))}</div><span class="tt">${esc(b.title)}</span><span class="th">${esc(hostOf(b.url))}</span></button>`).join('')}<button class="st-card tile addtile" data-act="bm-add" ${delay(bms.length + 6)}><span class="st-glare"></span><div class="big plus">${ICON.plus}</div><span class="tt">Hinzufügen</span><span class="th">&nbsp;</span></button></div></section>
    <section class="st-sec" id="recent"><h3>Zuletzt besucht</h3><div class="st-recent"><div class="hint">Lade …</div></div></section>
  </div></div>`;
}
const hueOf = (s) => { let h = 0; for (const c of s || '') h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

/* Bewegung: Parallax (Maus), 3D-Neigung des Logos, Lichtreflex auf Karten, laufende Uhr, tippender Platzhalter */
let startTimers = [];
let startStop = [];      // Aufräumfunktionen (Animationsframes, Beobachter)
function stopStartMotion() { startTimers.forEach(clearInterval); startTimers = []; startStop.forEach((f) => f()); startStop = []; }

// Wabernde Wellen: mehrere übereinanderliegende Sinus-Bänder, die langsam fließen und auf die Maus reagieren.
function startWaves(canvas, host, still) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, raf = 0, mx = 0, my = 0, tx = 0, ty = 0;
  const L = [
    { b: .58, a: 38, k: 1.0, s: .16, p: 0.0, l: ['255,159,207', .34], d: ['196,72,152', .30] },
    { b: .67, a: 46, k: 0.7, s: -.12, p: 2.1, l: ['183,156,242', .34], d: ['96,76,214', .32] },
    { b: .76, a: 34, k: 1.3, s: .20, p: 4.0, l: ['255,208,166', .38], d: ['160,70,104', .30] },
    { b: .85, a: 28, k: 0.9, s: -.18, p: 1.2, l: ['159,216,255', .32], d: ['54,116,190', .30] },
    { b: .93, a: 22, k: 1.6, s: .24, p: 3.1, l: ['255,176,214', .34], d: ['140,60,130', .30] },
  ];
  const resize = () => {
    const r = host.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (still) draw(0);
  };
  const draw = (t) => {
    const dark = document.documentElement.dataset.theme === 'dark';
    mx += (tx - mx) * 0.04; my += (ty - my) * 0.04;          // weiches Nachziehen der Mausposition
    ctx.clearRect(0, 0, w, h);
    L.forEach((ly, i) => {
      const [rgb, al] = dark ? ly.d : ly.l;
      const base = h * ly.b + my * 22 * (i + 1) * 0.5;
      const ph = ly.p + t * ly.s * 6.283 + mx * 1.4 * (i % 2 ? -1 : 1);
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w + 8; x += 8) {
        const u = x / w * 6.283;
        const y = base + Math.sin(u * ly.k * 1.3 + ph) * ly.a + Math.sin(u * ly.k * 2.7 - t * 0.55 + i * 1.7) * ly.a * 0.38 + Math.sin(u * 0.6 + t * 0.2 + i) * ly.a * 0.5;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h); ctx.closePath();
      const g = ctx.createLinearGradient(0, base - ly.a, 0, h);
      g.addColorStop(0, `rgba(${rgb},${al})`); g.addColorStop(1, `rgba(${rgb},${al * 0.15})`);
      ctx.fillStyle = g; ctx.fill();
    });
  };
  const t0 = performance.now();
  const loop = (now) => { draw((now - t0) / 1000); raf = requestAnimationFrame(loop); };
  const ro = new ResizeObserver(resize); ro.observe(host); resize();
  const onMove = (e) => { const r = host.getBoundingClientRect(); tx = ((e.clientX - r.left) / r.width - 0.5) * 2; ty = ((e.clientY - r.top) / r.height - 0.5) * 2; };
  host.parentElement.addEventListener('pointermove', onMove);
  if (!still) raf = requestAnimationFrame(loop);
  startStop.push(() => { cancelAnimationFrame(raf); ro.disconnect(); host.parentElement?.removeEventListener('pointermove', onMove); });
}
function startMotion(el) {
  stopStartMotion();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = el.querySelector('.st-waves'); if (cv) startWaves(cv, cv.parentElement, reduce);
  const clock = $('#stClock');
  const tick = () => { const n = new Date(), sep = n.getSeconds() % 2 ? ' ' : ':'; if (clock) clock.innerHTML = `${String(n.getHours()).padStart(2, '0')}<b>${sep}</b>${String(n.getMinutes()).padStart(2, '0')}`; };
  tick(); startTimers.push(setInterval(tick, 1000));
  if (reduce) return;
  // Parallax + Neigung
  const wrap = el.querySelector('.st-wrap'); let raf = 0, mx = 0, my = 0;
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect(); mx = ((e.clientX - r.left) / r.width - 0.5) * 2; my = ((e.clientY - r.top) / r.height - 0.5) * 2;
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; el.style.setProperty('--mx', mx.toFixed(3)); el.style.setProperty('--my', my.toFixed(3)); });
    const c = e.target.closest?.('.st-card');
    if (c) { const cr = c.getBoundingClientRect(), x = e.clientX - cr.left, y = e.clientY - cr.top; c.style.setProperty('--px', x + 'px'); c.style.setProperty('--py', y + 'px'); c.style.setProperty('--ry', ((x / cr.width - 0.5) * 10).toFixed(2) + 'deg'); c.style.setProperty('--rx', ((0.5 - y / cr.height) * 10).toFixed(2) + 'deg'); }
  });
  el.addEventListener('pointerleave', () => { el.style.setProperty('--mx', 0); el.style.setProperty('--my', 0); });
  el.addEventListener('pointerout', (e) => { const c = e.target.closest?.('.st-card'); if (c && !c.contains(e.relatedTarget)) { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); } });
}
let startSig = '';
async function renderStart() {
  const t = cur(), el = $('#start');
  const show = t && t.mode === 'start' && !t.lazy;
  const wasHidden = el.hidden;
  el.hidden = !show;
  if (!show) { setBanner(null); startSig = ''; stopStartMotion(); return; }
  const sig = [S.hasKey, S.bookmarks.map((b) => b.url + '\u0001' + b.title).join('|')].join('#');
  if (!wasHidden && sig === startSig) return;      // nichts geändert: Einblend-Animation nicht neu starten
  startSig = sig;
  el.innerHTML = startHTML();
  el.style.setProperty('--mx', 0); el.style.setProperty('--my', 0);
  startMotion(el);
  setBanner('start', 'Spotify'); spRefresh();
  const h = await api.history('', 8);
  const box = $('#recent .st-recent'); if (!box) return;
  box.innerHTML = h.length ? h.map((v, i) => `<button class="st-card rc" data-act="open-url" data-url="${esc(v.url)}" style="--d:${420 + i * 50}ms"><span class="st-glare"></span><span class="rl" style="--h:${hueOf(hostOf(v.url))}">${esc(initial(v.title || hostOf(v.url)))}</span><span class="rt"><b>${esc(v.title || hostOf(v.url))}</b><i>${esc(hostOf(v.url))}</i></span></button>`).join('') : '<div class="hint">Noch nichts besucht – leg einfach los.</div>';
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
function renderAll() { renderTabs(); renderToolbar(); renderBar(); renderStart(); renderSearchView(); renderSettingsView(); renderSide(); updateFrame(); }

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
window.addEventListener('focus', updateFrame);   // Selbstheilung: stimmt die Position der Seite nicht, wird sie beim Zurückkehren ins Fenster korrigiert
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateFrame(); });

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
    const t = cur(); if (t && t.native && t.mode === 'web') { updateFrame(); nativeShow(t.id); }   // Maße vor dem Einblenden erneut senden
  }
}
function closeOverlays() { closeMenu(); closeSugg(); closeOverlay(); }

/* ---------- Menü ---------- */
let menuOpen = false;
function closeMenu() { if (!menuOpen) return; menuOpen = false; const m = $('#menu'); m.style.display = 'none'; m.onclick = null; cover(false); }
function openMenu() {
  if (menuOpen) { closeMenu(); return; }
  const t = cur(), z = Math.round((t?.zoom || 1) * 100);
  const items = [
    ['Neuer Tab', '⌘T', 'new-tab'], ['Auf der Seite suchen', '⌘F', 'find'], '-',
    ['Vergrößern', '⌘+', 'zoom-in'], ['Verkleinern', '⌘−', 'zoom-out'], ['Tatsächliche Größe (' + z + ' %)', '⌘0', 'zoom-reset'], '-',
    ['Einstellungen …', '⌘,', 'settings'], [isDark() ? 'Heller Modus' : 'Dunkelmodus', '⇧⌘D', 'toggle-theme'], '-',
    ['Notizzettel', '⌥⌘N', 'toggle-notes'], ['Lesezeichen', '⌘⌥B', 'show-bookmarks'], ['Verlauf', '⌘Y', 'show-history'], ['Downloads', '⌘⌥L', 'show-downloads'], '-',
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
// Direkt-Seiten: Wer genau "google" oder "youtube" tippt, landet nach einer kurzen Tipp-Pause sofort dort – ohne Enter.
// (Kurze Pause, damit "google maps" weiter getippt werden kann; nur beim Tippen/Einfügen, nicht beim Löschen.)
const QUICK_SITES = { google: 'https://www.google.com', youtube: 'https://www.youtube.com' };
let quickT = 0;
function armQuickSite(input, ev) {
  clearTimeout(quickT);
  if (ev && ev.inputType && !ev.inputType.startsWith('insert')) return;
  const key = input.value.trim().toLowerCase();
  const target = QUICK_SITES[key];
  if (!target) return;
  quickT = setTimeout(() => {
    if (input.value.trim().toLowerCase() !== key) return;
    closeSugg(); input.blur(); visit(cur(), target);
  }, 350);
}
url.addEventListener('input', (ev) => { openSugg(url.value); armQuickSite(url, ev); });
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
  const hasNote = !!S.notes[noteKeyOf(cur()) || ''];
  const tabs = [['bookmarks', 'Lesezeichen'], ['history', 'Verlauf'], ['downloads', 'Downloads'], ['notes', 'Notizen' + (hasNote ? ' •' : '')]];
  let body = '';
  if (S.sideTab === 'notes') {
    const key = noteKeyOf(cur());
    // Wer gerade tippt und noch auf derselben Seite ist, wird nicht unterbrochen
    if (document.activeElement?.id === 'noteText' && S.noteShown === key) return;
    S.noteShown = key;
    body = notesPanelHTML();
  } else if (S.sideTab === 'bookmarks') {
    body = `<div class="shead"><span class="hint" style="padding:0">${S.bookmarks.length} ${S.bookmarks.length === 1 ? 'Eintrag' : 'Einträge'}</span><button class="link" data-act="bm-add">+ Hinzufügen</button></div><div class="slist">${S.bookmarks.length ? S.bookmarks.map((b) => `<div class="sitem" data-bm="${esc(b.url)}"><button class="go" data-act="open-url" data-url="${esc(b.url)}"><div class="t"><b>${esc(b.title)}</b><small>${esc(shownUrl(b.url))}</small></div></button><button class="rm" data-act="bm-edit" data-url="${esc(b.url)}" aria-label="Bearbeiten" title="Bearbeiten"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></button><button class="rm" data-act="rm-bm" data-url="${esc(b.url)}" aria-label="Entfernen" title="Löschen">${ICON.x}</button></div>`).join('') : '<div class="hint">Mit dem Stern in der Adressleiste (⌘D) oder „Hinzufügen“ merkst du dir Seiten.</div>'}</div>`;
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

/* ---------- Notizzettel (seitenbasiert) + Mausgeste ---------- */
// Schlüssel: Adresse der Seite ohne #Anker; Suchen: "search:<Begriff>". Startseite/Einstellungen haben keinen Zettel.
function noteKeyOf(t) {
  if (!t) return null;
  if (t.mode === 'web' && t.webUrl) return t.webUrl.split('#')[0];
  if (t.mode === 'search' && t.q) return 'search:' + encodeURIComponent(t.q);
  return null;
}
const noteTitleOf = (t) => (t.mode === 'search' ? t.q + ' – Suche' : (t.webTitle || hostOf(t.webUrl) || ''));
function notesPanelHTML() {
  const t = cur(), key = noteKeyOf(t), note = key ? S.notes[key] : null;
  const all = Object.values(S.notes).sort((a, b) => b.updated - a.updated);
  return `<div class="notes">
    <div class="npage">${key ? `<b>${esc(noteTitleOf(t) || hostOf(key))}</b><small>${esc(shownUrl(key))}</small>` : '<b>Keine Seite offen</b><small>Öffne eine Webseite oder Suche – dann erscheint hier der Notizzettel dieser Seite.</small>'}</div>
    ${key ? `<div class="paper"><textarea id="noteText" placeholder="Notiz zu dieser Seite …" spellcheck="true">${esc(note ? note.text : '')}</textarea><i class="fold"></i></div>
    <div class="nmeta"><span id="noteStat">${note ? 'Gespeichert · ' + esc(fmtTime(note.updated)) : 'Wird automatisch gespeichert'}</span><button class="link" data-act="note-del" ${note ? '' : 'disabled'}>Löschen</button></div>` : ''}
    <h4 class="nh">Alle Notizen · ${all.length}</h4><div class="nlist" id="noteList">${noteListHTML(all)}</div></div>`;
}
function noteListHTML(all) {
  return all.length ? all.map((n) => `<button class="nitem" data-act="open-url" data-url="${esc(n.key)}"><b>${esc(n.title || hostOf(n.key))}</b><span>${esc(n.text.replace(/\s+/g, ' ').slice(0, 90))}</span><small>${esc(fmtTime(n.updated))}</small></button>`).join('') : '<div class="hint">Noch keine Notizen. Zeichne mit gedrückter linker Maustaste einen Kreis – oder öffne den Zettel über das Menü.</div>';
}
function refreshNotesUI() {
  const all = Object.values(S.notes).sort((a, b) => b.updated - a.updated);
  const l = $('#noteList'); if (l) l.innerHTML = noteListHTML(all);
  const h = document.querySelector('.nh'); if (h) h.textContent = 'Alle Notizen · ' + all.length;
  const key = noteKeyOf(cur()), n = key ? S.notes[key] : null;
  const st = $('#noteStat'); if (st) st.textContent = n ? 'Gespeichert · ' + fmtTime(n.updated) : 'Leer';
  const del = document.querySelector('[data-act=note-del]'); if (del) del.disabled = !n;
  const tabBtn = document.querySelector('.stabs [data-k=notes]'); if (tabBtn) tabBtn.textContent = 'Notizen' + (n ? ' •' : '');
}
let noteT = 0;
async function saveNote(text) {
  const t = cur(), key = noteKeyOf(t); if (!key) return;
  const list = await api.setNote(key, noteTitleOf(t), text);
  S.notes = Object.fromEntries(list.map((n) => [n.key, n])); refreshNotesUI();
}
document.addEventListener('input', (ev) => {
  if (ev.target.id !== 'noteText') return;
  const st = $('#noteStat'); if (st) st.textContent = 'Speichert …';
  const v = ev.target.value; clearTimeout(noteT); noteT = setTimeout(() => saveNote(v), 450);
});
function toggleNotes() {
  if (S.side && S.sideTab === 'notes') { S.side = false; renderToolbar(); renderSide(); return; }
  openSide('notes'); setTimeout(() => $('#noteText')?.focus(), 120);
}
// Die Geste für Seiten ohne native Ansicht (Startseite, Suche, Einstellungen); Webseiten melden sie über ein eingeschleustes Skript.
window.__fmCircle({ target: $('#page'), enabled: () => S.gesture, onCircle: () => { if (cur()?.mode !== 'web') toggleNotes(); } });

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

/* ---------- Einstellungen: eigene Seite in eigenem Tab ---------- */
let setMsg = { text: '', kind: '' };
const GEAR = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.2 1.3L10 21h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z"/></svg>';
const SET_SECTIONS = [['look', 'Darstellung'], ['bm', 'Lesezeichen'], ['start', 'Start'], ['input', 'Bedienung'], ['search', 'Suche'], ['data', 'Daten']];
function settingsPageHTML() {
  const th = themeMode();
  return `<div class="sp">
    <nav class="sp-nav" aria-label="Einstellungen"><h1>Einstellungen</h1>${SET_SECTIONS.map(([id, l], i) => `<button class="${i === 0 ? 'on' : ''}" data-act="set-nav" data-s="${id}">${l}</button>`).join('')}</nav>
    <div class="sp-main">
      <section id="set-look" class="sp-card"><h2>Darstellung</h2>
        <p class="muted">Hell, Dunkel oder passend zum System. Webseiten folgen dem Erscheinungsbild.</p>
        <div class="themes">${[['auto', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([k, l]) => `<button class="theme ${th === k ? 'on' : ''}" data-act="theme" data-m="${k}"><span class="tp tp-${k}"><i></i><i></i><i></i></span><b>${l}</b></button>`).join('')}</div>
        <div class="swrow"><div><b>Lesezeichenleiste anzeigen</b><span>${S.bar ? 'Die Leiste unter der Adressleiste ist sichtbar.' : 'Aus: Lesezeichen findest du weiter in der Seitenleiste und auf der Startseite.'}</span></div>
          <button class="switch ${S.bar ? 'on' : ''}" role="switch" aria-checked="${S.bar}" aria-label="Lesezeichenleiste anzeigen" data-act="pref-bar"><i></i></button></div>
      </section>
      <section id="set-bm" class="sp-card"><h2>Lesezeichen</h2>
        <div class="bmlist">${S.bookmarks.length ? S.bookmarks.map((b) => `<div class="bmrow" data-bm="${esc(b.url)}"><i class="dot" style="--h:${hueOf(b.title)}">${esc(initial(b.title))}</i><div class="t"><b>${esc(b.title)}</b><small>${esc(shownUrl(b.url))}</small></div><button class="btn sm" data-act="bm-edit" data-url="${esc(b.url)}">Bearbeiten</button><button class="btn sm" data-act="bm-del" data-url="${esc(b.url)}">Löschen</button></div>`).join('') : '<p class="muted">Noch keine Lesezeichen.</p>'}</div>
        <div class="row"><button class="btn pri" data-act="bm-add">+ Lesezeichen hinzufügen</button></div>
      </section>
      <section id="set-start" class="sp-card"><h2>Start</h2>
        <div class="swrow"><div><b>Zuletzt geöffnete Seiten merken</b><span>${S.restore ? 'Beim nächsten Start öffnen sich die Tabs von zuletzt.' : 'Aus: Der Browser startet immer mit der Startseite.'}</span></div>
          <button class="switch ${S.restore ? 'on' : ''}" role="switch" aria-checked="${S.restore}" aria-label="Zuletzt geöffnete Seiten merken" data-act="pref-restore"><i></i></button></div>
      </section>
      <section id="set-input" class="sp-card"><h2>Bedienung</h2>
        <div class="swrow"><div><b>Mausgeste: Kreis öffnet den Notizzettel</b><span>${S.gesture ? 'Halte die linke Maustaste gedrückt und zeichne einen Kreis – auf jeder Seite.' : 'Aus: Der Notizzettel öffnet sich nur über das Menü (⌥⌘N).'}</span></div>
          <button class="switch ${S.gesture ? 'on' : ''}" role="switch" aria-checked="${S.gesture}" aria-label="Mausgeste Kreis" data-act="pref-gesture"><i></i></button></div>
      </section>
      <section id="set-search" class="sp-card"><h2>Suche · Brave API</h2>
        <p class="muted">Die Adressleiste sucht über die Brave-Search-API; die Ergebnisse erscheinen direkt im Browser. Den Schlüssel erstellst du unter <button class="link" data-act="open-brave">brave.com/search/api</button>.</p>
        <div class="state ${S.hasKey ? 'ok' : ''}">${S.hasKey ? 'Schlüssel gespeichert ✓' : 'Kein Schlüssel gespeichert'}</div>
        <input id="keyIn" type="password" placeholder="${S.hasKey ? 'Neuen Schlüssel einfügen, um ihn zu ersetzen' : 'Brave-API-Schlüssel einfügen'}" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Brave-API-Schlüssel">
        <div class="row"><button class="btn pri" data-act="key-save">Speichern</button><button class="btn" data-act="key-test" ${S.hasKey ? '' : 'disabled'}>Verbindung testen</button><button class="btn" data-act="key-clear" ${S.hasKey ? '' : 'disabled'}>Entfernen</button></div>
        <div id="keyMsg" class="kmsg ${setMsg.kind}">${esc(setMsg.text)}</div>
        <p class="muted small">Der Schlüssel liegt in einer Datei im App-Ordner, die nur dein Benutzer lesen kann (Rechte 0600). Er wird nie angezeigt und nur an Brave gesendet.</p>
      </section>
      <section id="set-data" class="sp-card"><h2>Daten</h2>
        <div class="swrow"><div><b>Verlauf</b><span>Besuchte Seiten und Suchen auf diesem Gerät.</span></div><button class="btn" data-act="clear-history">Löschen</button></div>
        <div class="swrow"><div><b>Download-Liste</b><span>Entfernt nur die Liste, nicht die Dateien.</span></div><button class="btn" data-act="clear-dl">Leeren</button></div>
      </section>
    </div></div>`;
}
function renderSettingsView() {
  const t = cur(), el = $('#settingsView');
  const show = !!t && t.mode === 'settings';
  el.hidden = !show;
  if (!show) return;
  const top = el.scrollTop, typed = $('#keyIn')?.value || '';
  el.innerHTML = settingsPageHTML();
  el.scrollTop = top; if (typed) $('#keyIn').value = typed;
}
// Öffnet die Einstellungen in einem eigenen Tab (vorhandener Tab wird wiederverwendet).
function openSettings(msg, kind) {
  if (msg !== undefined) setMsg = { text: msg, kind: kind || '' };
  let t = S.tabs.find((x) => x.mode === 'settings');
  if (!t) {
    t = mkTab(S.next++, 'settings:'); t.mode = 'settings'; t.title = 'Einstellungen'; S.tabs.push(t);
  }
  if (S.active !== t.id) activate(t.id); else renderAll();
}
function keyMsg(text, kind) { setMsg = { text, kind: kind || '' }; const m = $('#keyMsg'); if (m) { m.textContent = text; m.className = 'kmsg ' + (kind || ''); } }
async function testKey() {
  keyMsg('Teste …');
  try { await api.keyTest(); keyMsg('Verbindung zu Brave funktioniert ✓', 'ok'); } catch (e) { keyMsg(String(e?.message || e), 'err'); }
}
async function saveKey() {
  const i = $('#keyIn'); const v = i ? i.value.trim() : ''; if (!v) { keyMsg('Bitte zuerst einen Schlüssel einfügen.', 'err'); return; }
  try { await api.keySet(v); } catch (e) { keyMsg(String(e?.message || e), 'err'); return; }
  i.value = ''; S.hasKey = true; setMsg = { text: 'Gespeichert. Teste …', kind: '' }; renderSettingsView(); await testKey(); startSig = ''; renderStart();
  for (const x of S.tabs) if (x.mode === 'search' && x.sErr) loadEntry(x, true);
}

/* ---------- Lesezeichen: Dialog (hinzufügen/bearbeiten), Kontextmenü, Verwaltung ---------- */
let bmDlg = null;       // { oldUrl } beim Bearbeiten
function refreshBookmarks() { renderToolbar(); renderBar(); renderSide(); renderSettingsView(); startSig = ''; renderStart(); }
function closeBmDialog() {
  if (!bmDlg) return;
  bmDlg = null; const ov = $('#bm-ov'); ov.hidden = true; ov.innerHTML = '';
  const t = cur(); if (t && t.native && t.mode === 'web') nativeShow(t.id);
}
function openBmDialog(o = {}) {
  closeMenu(); closeSugg(); closeOverlay();
  const editing = !!o.oldUrl;
  bmDlg = { oldUrl: o.oldUrl || '' }; nativeShow(-1);
  const ov = $('#bm-ov'); ov.hidden = false;
  ov.innerHTML = `<div class="card bmcard" role="document"><header><b>${editing ? 'Lesezeichen bearbeiten' : 'Lesezeichen hinzufügen'}</b><button class="ib sm" data-act="bm-close" aria-label="Schließen">${ICON.x}</button></header>
    <div class="cbody"><label class="fld"><span>Name</span><input id="bmTitle" type="text" value="${esc(o.title || '')}" placeholder="z. B. Wikipedia" spellcheck="false" autocomplete="off"></label>
    <label class="fld"><span>Adresse</span><input id="bmUrl" type="text" value="${esc(o.url || '')}" placeholder="https://…" spellcheck="false" autocomplete="off" autocapitalize="off"></label>
    <div id="bmErr" class="kmsg err"></div>
    <div class="row"><button class="btn pri" data-act="bm-save">Speichern</button><button class="btn" data-act="bm-close">Abbrechen</button>${editing ? '<button class="btn danger" data-act="bm-del-dlg">Löschen</button>' : ''}</div></div></div>`;
  setTimeout(() => { const i = $(o.url ? '#bmTitle' : '#bmUrl'); i?.focus(); i?.select(); }, 0);
}
function bmFromPage() {      // Vorbelegung: die Seite, die gerade offen ist
  const t = cur();
  if (t && (t.mode === 'web' || t.mode === 'search') && t.url) return { url: t.url, title: t.mode === 'search' ? t.q + ' – Suche' : (t.title || hostOf(t.url)) };
  return {};
}
async function saveBm() {
  const err = (x) => { const e = $('#bmErr'); if (e) e.textContent = x; };
  const raw = $('#bmUrl').value.trim(); let title = $('#bmTitle').value.trim();
  if (!raw) return err('Bitte eine Adresse eingeben.');
  const u = isSearchUrl(raw) ? raw : toURL(raw);
  if (!u) return err('Das sieht nicht nach einer Adresse aus (z. B. beispiel.de oder https://beispiel.de).');
  if (!title) title = hostOf(u) || u;
  const old = bmDlg?.oldUrl;
  try { S.bookmarks = old ? await api.editBookmark(old, u, title) : await api.editBookmark('', u, title); } catch (e) { return err(String(e?.message || e)); }
  closeBmDialog(); refreshBookmarks(); toast(old ? 'Lesezeichen gespeichert' : 'Lesezeichen hinzugefügt');
}
async function deleteBm(u) {
  S.bookmarks = await api.setBookmark(u, '', false); refreshBookmarks(); toast('Lesezeichen gelöscht');
}
const bmByUrl = (u) => S.bookmarks.find((b) => b.url === u);
function editBm(u) { const b = bmByUrl(u); if (b) openBmDialog({ oldUrl: b.url, url: b.url, title: b.title }); }

// Kontextmenü (Rechtsklick auf Lesezeichen) – nutzt dasselbe Menü-Element wie ⋯
function showCtx(items, x, y) {
  const m = $('#menu');
  if (menuOpen) { m.style.display = 'none'; } else { menuOpen = true; cover(true); }
  m.innerHTML = items.map((it, i) => it === '-' ? '<div class="msep"></div>' : `<button class="mi" data-ci="${i}"><span>${esc(it.label)}</span></button>`).join('');
  m.style.display = 'block';
  m.style.left = Math.max(6, Math.min(x, innerWidth - m.offsetWidth - 6)) + 'px'; m.style.top = Math.max(6, Math.min(y, innerHeight - m.offsetHeight - 6)) + 'px';
  m.onclick = (ev) => { const b = ev.target.closest('[data-ci]'); if (!b) return; closeMenu(); items[+b.dataset.ci].act(); };
}
document.addEventListener('contextmenu', (ev) => {
  const el = ev.target.closest('[data-bm]'); if (!el) return;
  ev.preventDefault();
  const u = el.dataset.bm;
  showCtx([
    { label: 'Öffnen', act: () => visit(cur(), u) },
    { label: 'In neuem Tab öffnen', act: () => newTab(u, { background: true }) },
    '-',
    { label: 'Bearbeiten …', act: () => editBm(u) },
    { label: 'Löschen', act: () => deleteBm(u) },
  ], ev.clientX, ev.clientY);
});
$('#bm-ov').addEventListener('mousedown', (ev) => { if (ev.target.id === 'bm-ov') closeBmDialog(); });

/* ---------- Befehle (Menü, Tasten, Klicks) ---------- */
function setZoom(f) { const t = cur(); if (!t?.native || t.mode !== 'web') return; t.zoom = Math.min(3, Math.max(0.3, Math.round(f * 100) / 100)); api.zoom(t.id, t.zoom); toast('Zoom ' + Math.round(t.zoom * 100) + ' %'); }
async function toggleBookmark() {
  const t = cur(); if (!t || t.mode === 'start' || t.mode === 'settings' || !t.url) return;
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
    case 'toggle-bar': S.bar = !S.bar; api.setPref('showBookmarkBar', S.bar).catch(() => {}); renderBar(); renderSettingsView(); break;
    case 'show-history': openSide('history'); break;
    case 'show-bookmarks': openSide('bookmarks'); break;
    case 'show-downloads': openSide('downloads'); break;
    case 'bookmark': toggleBookmark(); break;
    case 'toggle-notes': toggleNotes(); break;
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
    case 'rm-bm': await deleteBm(d.url); break;
    case 'bm-add': openBmDialog(bmFromPage()); break;
    case 'note-del': { clearTimeout(noteT); const ta = $('#noteText'); if (ta) ta.value = ''; await saveNote(''); break; }
    case 'pref-gesture': {
      S.gesture = !S.gesture;
      try { await api.setPref('circleGesture', S.gesture); api.setGesture(S.gesture); } catch { S.gesture = !S.gesture; toast('Konnte nicht gespeichert werden'); }
      renderSettingsView(); break;
    }
    case 'bm-edit': editBm(d.url); break;
    case 'bm-del': ev.stopPropagation(); await deleteBm(d.url); break;
    case 'bm-del-dlg': { const o = bmDlg?.oldUrl; closeBmDialog(); if (o) await deleteBm(o); break; }
    case 'bm-save': saveBm(); break;
    case 'bm-close': closeBmDialog(); break;
    case 'pref-bar': {
      S.bar = !S.bar;
      try { await api.setPref('showBookmarkBar', S.bar); } catch { S.bar = !S.bar; toast('Konnte nicht gespeichert werden'); }
      renderBar(); renderSettingsView(); break;
    }
    case 'rm-hist': await api.historyRemove(d.url); renderSide(); break;
    case 'clear-history': await api.historyClear(); renderSide(); startSig = ''; renderStart(); toast('Verlauf gelöscht'); break;
    case 'clear-dl': S.downloads = []; await api.downloadsClear(); renderSide(); toast('Download-Liste geleert'); break;
    case 'dl-open': api.openFile(d.path, false); break;
    case 'dl-reveal': api.openFile(d.path, true); break;
    case 'find-next': doFind(true); break;
    case 'find-prev': doFind(false); break;
    case 'find-close': closeFind(); break;
    case 'cmd': runCmd(d.cmd); break;
    case 'pref-restore': {
      S.restore = !S.restore;
      try { await api.setPref('restoreSession', S.restore); } catch (e) { S.restore = !S.restore; toast('Konnte nicht gespeichert werden'); }
      if (S.restore) { saveSession(); } else { clearTimeout(sessT); api.sessionSave(''); }
      renderSettingsView(); break;
    }
    case 'theme': applyTheme(d.m, true); renderSettingsView(); renderTabs(); break;
    case 'settings': openSettings(); break;
    case 'set-nav': { document.getElementById('set-' + d.s)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); document.querySelectorAll('.sp-nav button').forEach((b) => b.classList.toggle('on', b === a)); break; }
    case 'open-brave': newTab('https://brave.com/search/api/'); break;
    case 'key-save': saveKey(); break;
    case 'key-test': testKey(); break;
    case 'key-clear': await api.keyClear(); S.hasKey = false; setMsg = { text: 'Schlüssel entfernt.', kind: '' }; renderSettingsView(); startSig = ''; renderStart(); break;
  }
});
document.addEventListener('submit', (ev) => {
  if (ev.target.id !== 'startForm') return;
  ev.preventDefault(); const q = $('#startQ').value; if (q.trim()) visit(cur(), q);
});
document.addEventListener('input', (ev) => { if (ev.target.id === 'startQ') armQuickSite(ev.target, ev); });
document.addEventListener('mousedown', (ev) => { if (menuOpen && !ev.target.closest('#menu, #bMenu')) closeMenu(); });
document.addEventListener('keydown', (ev) => {
  if (bmDlg) { if (ev.key === 'Escape') { ev.preventDefault(); closeBmDialog(); return; } if (ev.key === 'Enter' && ['bmTitle', 'bmUrl'].includes(ev.target.id)) { ev.preventDefault(); saveBm(); return; } }
  const t = cur();
  if (t?.mode === 'search' && t.data && !['INPUT', 'TEXTAREA'].includes(ev.target.tagName) && !ev.altKey) {
    const n = (t.data.results || []).length;
    if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && n && t.filter === 'all') {
      ev.preventDefault(); t.sel = Math.max(0, Math.min(n - 1, t.sel + (ev.key === 'ArrowDown' ? 1 : -1)));
      document.querySelectorAll('.sr').forEach((el) => el.classList.toggle('sel', +el.dataset.i === t.sel));
      document.querySelector('.sr.sel')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else if (ev.key === 'Enter' && n && t.filter === 'all' && !ev.metaKey) { ev.preventDefault(); const r = t.data.results[t.sel]; if (r) openWeb(t, r.url); }
    else if (ev.key === 'Enter' && ev.metaKey && n) { ev.preventDefault(); const r = t.data.results[t.sel]; if (r) { newTab(r.url, { background: true }); toast('In neuem Tab geöffnet'); } }
    else if (ev.key === '/') { ev.preventDefault(); url.focus(); url.select(); }
  }
  if (ev.key === 'Enter' && ev.target.id === 'keyIn') { ev.preventDefault(); saveKey(); } if (ev.key === 'Escape') { closeMenu(); if (S.findOpen && ev.target.id !== 'findIn') closeFind(); } });

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
    [S.hasKey, S.restore, S.bar, S.gesture] = await step('Einstellungen laden …', 0.14, async () => { const p = await api.prefs(); return [await api.keyStatus(), !!p.restoreSession, p.showBookmarkBar !== false, p.circleGesture !== false]; });
    let noteList;
    [S.bookmarks, S.downloads, noteList] = await step('Lesezeichen & Verlauf …', 0.36, () => Promise.all([api.bookmarks(), api.downloads(), api.notes()]));
    S.notes = Object.fromEntries((noteList || []).map((n) => [n.key, n]));
    S.downloads = (S.downloads || []).map((d, i) => ({ id: -i - 1, name: d.name, path: d.path, state: 'done', received: 0, total: 0 }));
    S.bookmarks = S.bookmarks || [];
    renderBar();
    // Spotify-Overlay deckt das Fenster ab: native Seiten dafür kurz ausblenden.
    setHooks({ popOpen: () => cover(true), popClose: () => cover(false), open() { nativeShow(-1); }, close() { const t = cur(); if (t && t.native && t.mode === 'web') nativeShow(t.id); } });
    await step('Spotify verbinden …', 0.58, () => initSpotify());
    await step(S.restore ? 'Tabs wiederherstellen …' : 'Startseite vorbereiten …', 0.8, async () => { await restoreSession(); updateFrame(); });
    await step('Seite wird geladen …', 0.94, () => waitLoaded(cur(), 2600));
    splashStep('Bereit', 1);
  } catch (e) { console.error(e); }
  await dismissSplash();
})();
