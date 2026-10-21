import {
  browserName,
  personal,
  applyBrowserName,
  wirePersonalSettings,
  mountPersonalBackground,
} from './personalization.js';
import { createLoadWatchdog, showSlowSetup, slowSetupVisible } from './slow-setup.js';
import { WINDOWS, shortcut } from './platform.js';
import { createOnboarding } from './onboarding.js';
let onboarding = null;
import { createCommandUI } from './command-ui.js';
import { commandOn, setAllCommands, setCommandOn } from './command-data.js';
import { parseTabCommand, tabDomain, tabMatchesDomain } from './tab-command.js';
import { initChat, refreshChatStatus } from './chat.js';
import { startBackgroundHTML, startWaves } from './start-background.js';
import { initGestures, loadGestures, gestureState } from './gestures.js';
import { initTabGroups } from './tab-groups.js';
import { createSettings } from './settings.js';
const GEAR =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.2 1.3L10 21h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z"/></svg>';
import { createScreenshots } from './screenshots.js';
import { $, esc, isSearchUrl, hostOf, shownUrl, initial, hueOf } from './ui.js';
import { createBrowserNotifications } from './notifications.js';
import { initMusicPanel } from './music-panel.js';
import { initAutoNext } from './music-autonext.js';
import { initQueueDrop } from './spotify-queue.js';
import {
  COLOR_THEMES,
  applyColorTheme,
  colorTheme,
  themeIconURL,
  setCustomIcon,
  resetCustomIcon,
} from './color-themes.js';
import { lunaPageAction } from './page-control.js';
import { updateSonosSettings } from './sonos-view.js';
import './style.css';
import { spotifyResultsHTML } from './spotify-view.js';
import {
  bindSpotifySearch,
  syncSpotifySearch,
  spotifyCommand,
  spotifySearchURL,
} from './spotify-search.js';
import './gesture-core.js';
import * as api from './api.js';
import { IS_NATIVE } from './api.js';
import { searchHTML } from './searchview.js';
import {
  addPanelGroup,
  renamePanelGroup,
  removePanelGroup,
  assignPanel,
  registerPanel,
  initSidePanel,
  renderSide,
  setActivePanel,
  activePanel,
  allPanels,
  isPanelHidden,
  setPanelHidden,
  movePanel,
  resetPanels,
  refreshBadges,
} from './sidepanel.js';
import { lunaWordmark } from './branding.js';
import {
  initSpotify,
  setBanner,
  refresh as spRefresh,
  setHooks,
  closeOverlay,
  isOverlayOpen,
} from './spotify.js';

/* ---------- Helfer ---------- */
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
  const s = input.trim();
  if (!s) return null;
  if (isSearchUrl(s)) return { q: decodeURIComponent(s.slice(7)) };
  const u = toURL(s);
  return u ? { url: u } : { q: s };
}

const ICON = {
  reload:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/></svg>',
  stop: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  star: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1-4.5-4.3 6.1-.8z"/></svg>',
  starOn:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="#a24d84" stroke="#a24d84" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1-4.5-4.3 6.1-.8z"/></svg>',
  lock: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  search:
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  globe:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>',
  x: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
};

/* ---------- Erscheinungsbild (Hell/Dunkel/Automatisch) ---------- */
const THEME_KEY = 'fm-theme';
function themeMode() {
  try {
    return localStorage.getItem(THEME_KEY) || 'auto';
  } catch {
    return 'auto';
  }
}
const prefersDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
const isDark = () => document.documentElement.dataset.theme === 'dark';
function applyTheme(mode, persist) {
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch {
      /* ohne Speicher: gilt nur jetzt */
    }
  }
  document.documentElement.dataset.theme =
    mode === 'dark' || (mode === 'auto' && prefersDark()) ? 'dark' : 'light';
  applyColorTheme();
  api.setAppearance(mode); // nativ: Webseiten folgen über prefers-color-scheme, Systemelemente passen sich an
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (themeMode() === 'auto') applyTheme('auto');
});

/* ---------- Native Ansichten: während des Startbildschirms verborgen ---------- */
let splashing = true,
  pendingShow = -1;
function nativeShow(id) {
  if (onboarding?.active) {
    onboarding.layout();
    return;
  }
  if (slowSetupVisible() || isOverlayOpen() || S.cover > 0) id = -1;
  if (splashing) {
    pendingShow = id;
    return;
  }
  api.show(id);
}

/* ---------- Zustand ---------- */
const S = {
  hasKey: false,
  googleSearch: false,
  onboardingComplete: false,
  autoNextAlways: false,
  restore: false,
  gesture: true,
  notes: {},
  tabs: [],
  groups: {},
  active: 0,
  next: 1,
  bookmarks: [],
  downloads: [],
  side: false,
  sideTab: 'bookmarks',
  bar: true,
  cover: 0,
  sugg: [],
  suggSel: -1,
  findOpen: false,
};
const tabById = (id) => S.tabs.find((t) => t.id === id);
const cur = () => tabById(S.active);
// mode: 'start' (Startseite) | 'search' (eingebaute Suchansicht) | 'web' (nativer WKWebView)
const mkTab = (id, url) => ({
  id,
  url: url || '',
  title: '',
  icon: '',
  loading: false,
  progress: 0,
  back: false,
  fwd: false,
  native: false,
  lazy: false,
  error: false,
  zoom: 1,
  mode: 'start',
  webUrl: '',
  webTitle: '',
  q: '',
  page: 0,
  data: null,
  sErr: '',
  sLoading: false,
  sTok: 0,
  sel: 0,
  filter: 'all',
  sHist: [],
  sIdx: -1,
  under: false,
  cameFromSearch: false,
  fwdWeb: false,
  fwdSearch: false,
});

const notifications = createBrowserNotifications({
  cover: async (on) => {
    const done = cover(on);
    if (on) nativeShow(-1);
    await done;
  },
});
function toast(msg, duration = 2600) {
  notifications.toast(msg, duration);
}

/* ---------- Tabs ---------- */
function newTab(url, opts = {}) {
  const t = mkTab(S.next++, '');
  S.tabs.push(t);
  if (url) visit(t, url);
  if (!opts.background) activate(t.id);
  else {
    renderTabs();
    saveSession();
  }
  return t;
}
function adoptPopup(id) {
  // Tab, den eine Seite selbst geöffnet hat (window.open)
  const t = mkTab(id, '');
  t.native = true;
  t.mode = 'web';
  S.tabs.push(t);
  activate(id);
}
/* ---------- Navigation: Startseite · Suche · Web ---------- */
function visit(t, input, options = {}) {
  if (/^(?:commands?|befehle)$/i.test(String(input).trim())) {
    closeSugg();
    $('#url').blur();
    cmdUI.openPage();
    return;
  }
  if (commandOn('theme') && /^themes?$/i.test(String(input).trim())) {
    closeSugg();
    $('#url').blur();
    cmdUI.openDrop();
    return;
  }
  if (/^chat:?$/i.test(String(input).trim()) && (commandOn('chat') || /:$/.test(String(input)))) {
    openChatPage(t);
    return;
  }
  if (String(input).startsWith('spotify-search:')) {
    try {
      openSearch(t, decodeURIComponent(input.slice(15)), 0, { provider: 'spotify', ...options });
    } catch {
      toast('Ungültiger Suchbegriff');
    }
    return;
  }
  const spotifyQuery = spotifyCommand(String(input));
  if (spotifyQuery !== null) {
    openSearch(t, spotifyQuery, 0, { provider: 'spotify', ...options });
    return;
  }
  if (commandOn('settings') && String(input).trim().toLowerCase() === 'einstellungen') {
    askSettings(t, input);
    return;
  }
  const r = resolve(input);
  if (!r) return;
  if (r.q !== undefined) openSearch(t, r.q, 0);
  else openWeb(t, r.url);
}
function openChatPage(t) {
  clearTimeout(quickT);
  closeSugg();
  $('#url').blur();
  t.under = t.mode === 'web' && t.native;
  t.mode = 'chat';
  t.fwdWeb = false;
  t.fwdSearch = false;
  t.cameFromSearch = false;
  t.url = 'chat:';
  t.title = 'Luna Chat';
  t.icon = '';
  t.loading = false;
  t.sLoading = false;
  t.lazy = false;
  t.sTok++;
  t.error = false;
  if (t.id === S.active) {
    nativeShow(-1);
    renderAll();
  }
  saveSession();
}
function openWeb(t, url) {
  if (t.id === S.active) $('#url').blur();
  if (t.mode === 'search') {
    t.cameFromSearch = true;
    if (t.native) {
      api.close(t.id);
      t.native = false;
    }
  } // frische Verlaufskette: Zurück führt zur Suche
  else if (t.mode === 'start' || t.mode === 'settings' || t.mode === 'chat')
    t.cameFromSearch = false;
  t.sTok++;
  t.sLoading = false;
  t.mode = 'web';
  t.under = false;
  t.fwdWeb = false;
  t.fwdSearch = false;
  t.url = t.webUrl = url;
  t.title = t.webTitle = '';
  t.native = true;
  t.lazy = false;
  t.error = false;
  t.icon = '';
  api.load(t.id, url);
  if (t.id === S.active) {
    nativeShow(t.id);
    renderAll();
  }
  saveSession();
}
function openSearch(t, q, page = 0, opts = {}) {
  q = q.trim();
  if (q && opts.provider !== 'spotify' && S.googleSearch) {
    openWeb(t, 'https://www.google.com/search?q=' + encodeURIComponent(q));
    return;
  }
  if (!q && opts.provider !== 'spotify') return;
  if (t.id === S.active && !opts.preserveInput) $('#url').blur();
  if (t.mode === 'web' && t.native) t.under = true; // Webseite bleibt (verborgen) darunter, Zurück kehrt zu ihr zurück
  if (t.mode === 'start' || t.mode === 'settings' || t.mode === 'chat') t.under = false;
  if (!opts.noPush) {
    if (t.mode !== 'search') {
      t.sHist = [];
      t.sIdx = -1;
    }
    t.sHist = t.sHist.slice(0, t.sIdx + 1);
    t.sHist.push({ q, page, data: null, provider: opts.provider || 'web' });
    t.sIdx = t.sHist.length - 1;
  }
  t.mode = 'search';
  t.lazy = false;
  t.fwdWeb = false;
  t.fwdSearch = false;
  t.error = false;
  loadEntry(t, opts.force);
  if (t.id === S.active) nativeShow(-1);
  saveSession();
}
// zeigt den Eintrag sHist[sIdx]; Ergebnisse werden pro Eintrag gemerkt (Zurück/Vor kostet keine Anfrage)
async function loadEntry(t, force) {
  const e = t.sHist[t.sIdx];
  if (!e) return;
  t.provider = e.provider || 'web';
  t.q = e.q;
  t.page = e.page;
  t.url = (t.provider === 'spotify' ? 'spotify-search:' : 'search:') + encodeURIComponent(e.q);
  t.title =
    !e.q && t.provider === 'spotify'
      ? 'Luna Music'
      : e.q + (t.provider === 'spotify' ? ' – Spotify' : ' – Luna Search');
  t.sel = 0;
  t.sErr = '';
  const tok = ++t.sTok;
  if (e.data && !force) {
    t.data = e.data;
    t.sLoading = false;
    t.loading = false;
    if (t.id === S.active) renderAll();
    return;
  }
  t.data = null;
  if (t.provider === 'spotify' && !e.q) {
    t.sLoading = false;
    t.loading = false;
    if (t.id === S.active) renderAll();
    return;
  }
  if (t.provider !== 'spotify' && !S.hasKey) {
    t.sErr = 'NOKEY';
    t.sLoading = false;
    t.loading = false;
    if (t.id === S.active) renderAll();
    return;
  }
  t.sLoading = true;
  t.loading = true;
  t.progress = 0.45;
  if (t.id === S.active) renderAll();
  try {
    const d =
      t.provider === 'spotify' ? await api.spotifySearch(e.q) : await api.search(e.q, e.page);
    if (tok !== t.sTok) return;
    e.data = t.data = d;
    if (e.page === 0 && t.provider !== 'spotify') api.historyAdd(t.url, t.title);
  } catch (err) {
    if (tok !== t.sTok) return;
    t.sErr = String(err?.message || err);
  }
  t.sLoading = false;
  t.loading = false;
  if (t.id === S.active) {
    renderAll();
    $('#searchView').scrollTop = 0;
  }
}
const canBack = (t) =>
  t.mode === 'web' ? t.back || t.cameFromSearch : t.mode === 'search' || t.mode === 'chat'; // start/settings: nichts davor
const canFwd = (t) =>
  t.mode === 'web'
    ? t.fwd || t.fwdSearch
    : t.mode === 'search'
      ? t.sIdx < t.sHist.length - 1 || t.fwdWeb
      : t.fwdSearch;
function showWeb(t) {
  t.mode = 'web';
  t.url = t.webUrl;
  t.title = t.webTitle;
  t.sTok++;
  t.sLoading = false;
  t.loading = false;
  if (t.id === S.active) {
    nativeShow(t.id);
    renderAll();
  }
}
function showSearchMode(t) {
  t.mode = 'search';
  if (t.id === S.active) nativeShow(-1);
  loadEntry(t);
}
function goBack(t) {
  if (t.mode === 'chat') {
    if (t.under) showWeb(t);
    else {
      t.mode = 'start';
      t.url = '';
      t.title = '';
      renderAll();
    }
    saveSession();
    return;
  }
  if (t.mode === 'web') {
    if (t.back) api.back(t.id);
    else if (t.cameFromSearch) {
      t.fwdWeb = true;
      showSearchMode(t);
    }
  } else if (t.mode === 'search') {
    if (t.sIdx > 0) {
      t.sIdx--;
      loadEntry(t);
    } else if (t.under) {
      t.fwdSearch = true;
      showWeb(t);
    } else {
      t.fwdSearch = true;
      t.mode = 'start';
      t.url = '';
      t.title = '';
      t.q = '';
      t.data = null;
      t.sTok++;
      t.sLoading = false;
      t.loading = false;
      renderAll();
    }
  }
}
function goForward(t) {
  if (t.mode === 'search') {
    if (t.sIdx < t.sHist.length - 1) {
      t.sIdx++;
      loadEntry(t);
    } else if (t.fwdWeb) {
      t.fwdWeb = false;
      showWeb(t);
    }
  } else if (t.mode === 'web') {
    if (t.fwd) api.forward(t.id);
    else if (t.fwdSearch) {
      t.fwdSearch = false;
      showSearchMode(t);
    }
  } else if (t.fwdSearch) {
    t.fwdSearch = false;
    showSearchMode(t);
  }
}
function activate(id) {
  closeOverlays();
  $('#url').blur();
  S.active = id;
  const t = cur();
  if (t.group && S.groups[t.group]) S.groups[t.group].collapsed = false;
  if (t.lazy) {
    t.lazy = false;
    visit(t, t.url);
  }
  nativeShow(t.mode === 'web' && t.native ? t.id : -1);
  if (t.native) api.zoom(t.id, t.zoom);
  renderAll();
  if (t.mode === 'start') setTimeout(() => $('#url').focus(), 0);
  saveSession();
}
const closingTabs = new Map();
function closeTab(id) {
  if (closingTabs.has(id)) return closingTabs.get(id);
  const task = (async () => {
    // Start in a microtask so the lock exists even when reduced motion skips animation.
    await Promise.resolve();
    const el = $(`#tabs [data-tab-id="${id}"]`);
    if (el && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const width = el.getBoundingClientRect().width;
      await el
        .animate(
          [
            {
              opacity: 1,
              maxWidth: width + 'px',
              minWidth: width + 'px',
              transform: 'translateY(0)',
            },
            {
              opacity: 0,
              maxWidth: '0px',
              minWidth: '0px',
              paddingLeft: '0px',
              paddingRight: '0px',
              marginRight: '-4px',
              transform: 'translateY(8px) scale(.94)',
            },
          ],
          { duration: 190, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' },
        )
        .finished.catch(() => {});
    }
    closingTabs.delete(id);
    closeTabNow(id);
  })();
  closingTabs.set(id, task);
  return task;
}
function closeTabNow(id) {
  const i = S.tabs.findIndex((t) => t.id === id);
  if (i < 0) return;
  const t = S.tabs[i];
  if (t.native) api.close(id);
  S.tabs.splice(i, 1);
  if (t.group && !S.tabs.some((x) => x.group === t.group)) delete S.groups[t.group];
  if (!S.tabs.length) {
    newTab();
    return;
  }
  if (S.active === id) activate(S.tabs[Math.min(i, S.tabs.length - 1)].id);
  else {
    renderTabs();
    saveSession();
  }
}
function stepTab(d) {
  const i = S.tabs.findIndex((t) => t.id === S.active);
  activate(S.tabs[(i + d + S.tabs.length) % S.tabs.length].id);
}

/* ---------- Sitzung ---------- */
let sessT;
function saveSession() {
  clearTimeout(sessT);
  if (!S.restore) {
    api.sessionSave('');
    return;
  } // Merken ist aus: nichts behalten
  sessT = setTimeout(() => {
    const tabs = S.tabs
      .filter((t) => !t.error && t.mode !== 'settings')
      .map((t) => ({
        url: t.mode === 'web' ? t.webUrl || t.url : t.url,
        title: t.title,
        group: t.group || '',
      }));
    const act = Math.max(
      0,
      S.tabs.filter((t) => !t.error && t.mode !== 'settings').findIndex((t) => t.id === S.active),
    );
    api.sessionSave(JSON.stringify({ tabs, active: act, groups: S.groups }));
  }, 700);
}
async function restoreSession() {
  if (!S.restore) {
    newTab();
    return;
  } // Standard: Der Browser startet mit der Startseite
  try {
    const s = JSON.parse((await api.sessionLoad()) || 'null');
    if (s && s.tabs && s.tabs.length) {
      S.groups = Object.fromEntries(
        Object.entries(s.groups || {})
          .filter(([id, g]) => /^tg-[a-z0-9-]+$/.test(id) && g && typeof g.title === 'string')
          .map(([id, g]) => [id, { title: g.title.slice(0, 40), collapsed: !!g.collapsed }]),
      );
      s.tabs.forEach((x, i) => {
        const t = mkTab(S.next++, x.url);
        t.title = x.title || hostOf(x.url);
        t.lazy = !!x.url;
        t.group = S.groups[x.group] ? x.group : '';
        S.tabs.push(t);
        if (i === s.active) S.active = t.id;
      });
      if (!S.active) S.active = S.tabs[0].id;
      activate(S.active);
      return;
    }
  } catch {
    /* leere/alte Sitzung */
  }
  newTab();
}

/* ---------- Ereignisse aus den nativen Tabs ---------- */
api.onWeb((e) => {
  if (onboarding?.handleWeb(e)) return;
  const t = tabById(e.tab);
  switch (e.t) {
    case 'command':
      runCmd(e.name);
      break;
    case 'state':
      if (!t) return;
      t.back = e.back;
      t.fwd = e.fwd;
      if (e.url && !(t.error && e.url === t.webUrl)) t.webUrl = e.url;
      if (e.title) t.webTitle = e.title;
      if (t.mode !== 'web') return; // verborgene Webseite unter der Suche: nur merken
      t.loading = e.loading;
      t.progress = e.progress;
      t.url = t.webUrl;
      t.title = t.webTitle;
      renderTabs();
      if (t.id === S.active) {
        renderToolbar();
        saveSession();
      }
      break;
    case 'loaded':
      if (!t) return;
      t.error = !!e.error;
      if (!e.error && e.url && t.mode === 'web') {
        api.historyAdd(e.url, e.title || '');
      }
      break;
    case 'favicon':
      if (t && t.mode === 'web') {
        t.icon = e.icon;
        renderTabs();
      }
      break;
    case 'error':
      if (t && t.mode === 'web') {
        t.error = true;
        t.url = t.webUrl = e.url || t.url;
        renderToolbar();
      }
      break;
    case 'popup':
      adoptPopup(e.tab);
      break;
    case 'newtab':
      newTab(e.url, { background: true });
      break;
    case 'close':
      closeTab(e.tab);
      break;
    case 'find':
      $('#findStat').textContent = e.found ? '' : 'Nicht gefunden';
      break;
    case 'dl':
      onDownload(e);
      break;
    case 'gesture':
      if (!IS_NATIVE || !t || t.id !== S.active || !S.gesture || t.mode !== 'web') break; // nur das App-Fenster reagiert (nicht der Entwicklungs-Browserzugang)
      gestures.run(e.kind === 'letter' ? e.letter : e.kind === 's' ? 'S' : 'O');
      break;
  }
});

/* ---------- Rendern ---------- */
function renderTabs() {
  if (closingTabs.size) return;
  const htmlTab = (t) => {
    const label = t.title || (t.url ? hostOf(t.url) : 'Neuer Tab');
    const ico = t.loading
      ? '<span class="spin"></span>'
      : t.mode === 'search'
        ? `<span class="fav">${ICON.search}</span>`
        : t.mode === 'settings'
          ? `<span class="fav">${GEAR}</span>`
          : t.icon
            ? `<img class="fav" src="${esc(t.icon)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'fav',innerHTML:window.__globe}))">`
            : `<span class="fav">${ICON.globe}</span>`;
    return `<div class="tab ${t.id === S.active ? 'act' : ''} ${t.group ? 'grouped' : ''}" draggable="true" data-tab-id="${t.id}" title="${esc(label)}">${ico}<button class="tlab" role="tab" aria-selected="${t.id === S.active}" data-act="tab" data-id="${t.id}">${esc(label)}</button>${S.tabs.length > 1 ? `<button class="tx" data-act="close" data-id="${t.id}" aria-label="Tab schließen">${ICON.x}</button>` : ''}</div>`;
  };
  const seen = new Set();
  $('#tabs').innerHTML =
    S.tabs
      .map((t) => {
        if (!t.group || !S.groups[t.group]) return htmlTab(t);
        if (seen.has(t.group)) return '';
        seen.add(t.group);
        const g = S.groups[t.group],
          members = S.tabs.filter((x) => x.group === t.group);
        return `<div class="tab-group ${g.collapsed ? 'collapsed' : ''}" data-tab-group="${esc(t.group)}"><button class="tab-group-label" data-act="tab-group-toggle" data-group="${esc(t.group)}" aria-expanded="${!g.collapsed}" title="${esc(g.title)} · Rechtsklick zum Bearbeiten"><i></i><span>${esc(g.title)}</span><small>${members.length}</small></button>${g.collapsed ? '' : members.map(htmlTab).join('')}</div>`;
      })
      .join('') +
    `<button class="ib" id="newtab" data-act="new-tab" aria-label="Neuer Tab">${ICON.plus}</button>`;
  $('#body').style.borderRadius = '0';
}
window.__globe = ICON.globe;
function isBookmarked(url) {
  return S.bookmarks.some((b) => b.url === url);
}
function renderToolbar() {
  const t = cur();
  if (!t) return;
  $('#bBack').classList.toggle('off', !canBack(t));
  $('#bFwd').classList.toggle('off', !canFwd(t));
  $('#bReload').innerHTML = t.loading ? ICON.stop : ICON.reload;
  $('#bReload').classList.toggle(
    'off',
    t.mode === 'start' || t.mode === 'settings' || t.mode === 'chat',
  );
  const input = $('#url');
  if (document.activeElement !== input)
    input.value =
      t.mode === 'settings'
        ? 'Einstellungen'
        : t.mode === 'chat'
          ? 'chat'
          : shownUrl(t.mode === 'start' ? '' : t.url);
  bindSpotifySearch(
    input,
    (target, options) => visit(cur(), target, options),
    () => {
      clearTimeout(quickT);
      closeSugg();
    },
    playFirstSpotifyResult,
  );
  syncSpotifySearch(input, t.url);
  $('#lock').innerHTML =
    t.mode === 'settings'
      ? GEAR
      : t.mode === 'search'
        ? ICON.search
        : t.url.startsWith('https://')
          ? ICON.lock
          : '';
  const bm = !!t.url && isBookmarked(t.url);
  $('#bStar').innerHTML = bm ? ICON.starOn : ICON.star;
  $('#bStar').classList.toggle(
    'off',
    t.mode === 'start' || t.mode === 'settings' || t.mode === 'chat',
  );
  $('#bSide').classList.toggle('on', S.side);
  const p = $('#progress div');
  p.style.opacity = t.loading ? 1 : 0;
  p.style.width = (t.loading ? Math.max(8, t.progress * 100) : 100) + '%';
}
function renderBar() {
  const bar = $('#bmbar');
  bar.hidden = !S.bar;
  bar.innerHTML =
    (S.bookmarks.length
      ? S.bookmarks
          .slice(0, 16)
          .map(
            (b) =>
              `<button class="chip" data-act="open-url" data-url="${esc(b.url)}" data-bm="${esc(b.url)}" title="${esc(b.title)} – Rechtsklick: bearbeiten oder löschen"><i class="dot">${esc(initial(b.title))}</i><span>${esc(b.title)}</span></button>`,
          )
          .join('')
      : '<span class="bmhint">Noch keine Lesezeichen</span>') +
    `<button class="chip add" data-act="bm-add" title="Lesezeichen hinzufügen" aria-label="Lesezeichen hinzufügen">${ICON.plus}<span>Hinzufügen</span></button>`;
  updateFrame();
}
/* ---------- Startseite ---------- */
const GREET = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend';
};
const QUICK = [
  [
    'show-bookmarks',
    'Lesezeichen',
    '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1-4.5-4.3 6.1-.8z"/>',
  ],
  ['show-history', 'Verlauf', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
  ['show-downloads', 'Downloads', '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'],
  [
    'toggle-theme',
    'Erscheinungsbild',
    '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  ],
  [
    'settings',
    'Einstellungen',
    '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.2 1.3L10 21h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z"/>',
  ],
];
function startHTML() {
  const bms = S.bookmarks.slice(0, 10);
  const d = new Date();
  const date = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const delay = (i) => `style="--d:${120 + i * 55}ms"`;
  return `${startBackgroundHTML}
  <div class="st-scroll"><div class="st-wrap">
    <header class="st-hero">
      <div class="st-logo-w"><img class="st-logo" src="${themeIconURL()}" alt="" draggable="false"><span class="st-halo"></span></div>
      <div class="st-brand-widget" role="group" aria-label="Uhrzeit und ${esc(browserName())}">
        <div class="st-clock" id="stClock" aria-label="Uhrzeit"></div>
        <span class="st-brand-divider" aria-hidden="true"></span>
        ${browserName() === 'Luna Browser' ? lunaWordmark : `<span class="st-custom-name">${esc(browserName())}</span>`}
      </div>
      <h1 class="st-greet">${GREET()}</h1>
      <p class="st-date">${esc(date)}</p>
    </header>
    <form id="startForm" class="st-search" autocomplete="off">
      <svg class="st-si" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input id="startQ" type="text" placeholder="Mit ${S.googleSearch ? 'Google' : 'Luna Search'} suchen oder Adresse eingeben" spellcheck="false" autocomplete="off" aria-label="Suchen">
      <kbd>${shortcut('⌘L')}</kbd><span class="st-glow"></span>
    </form>
    <div class="st-status">${S.googleSearch ? '<span class="pill ok"><i></i>Google · bereit</span>' : S.hasKey ? '<span class="pill ok"><i></i>Luna Search · bereit</span>' : '<button class="pill warn" data-act="settings"><i></i>Luna Search einrichten</button>'}</div>
    <div class="st-quick">${QUICK.map((q, i) => `<button class="qa" data-act="cmd" data-cmd="${q[0]}" ${delay(i + 3)}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${q[2]}</svg>${q[1]}</button>`).join('')}</div>
    <section id="widget-banner" hidden></section>
    <section class="st-sec"><h3>Lesezeichen</h3><div class="st-tiles">${bms.map((b, i) => `<button class="st-card tile" data-act="open-url" data-url="${esc(b.url)}" data-bm="${esc(b.url)}" title="${esc(b.title)} – Rechtsklick: bearbeiten oder löschen" ${delay(i + 6)}><span class="st-glare"></span><span class="tdel" role="button" aria-label="Lesezeichen löschen" data-act="bm-del" data-url="${esc(b.url)}">${ICON.x}</span><div class="big" style="--h:${hueOf(b.title)}">${esc(initial(b.title))}</div><span class="tt">${esc(b.title)}</span><span class="th">${esc(hostOf(b.url))}</span></button>`).join('')}<button class="st-card tile addtile" data-act="bm-add" ${delay(bms.length + 6)}><span class="st-glare"></span><div class="big plus">${ICON.plus}</div><span class="tt">Hinzufügen</span><span class="th">&nbsp;</span></button></div></section>
    <section class="st-sec" id="recent"><h3>Zuletzt besucht</h3><div class="st-recent"><div class="hint">Lade …</div></div></section>
  </div></div>`;
}

/* Bewegung: Parallax (Maus), 3D-Neigung des Logos, Lichtreflex auf Karten, laufende Uhr, tippender Platzhalter */
let startTimers = [];
let startStop = []; // Aufräumfunktionen (Animationsframes, Beobachter)
function stopStartMotion() {
  startTimers.forEach(clearInterval);
  startTimers = [];
  startStop.forEach((f) => f());
  startStop = [];
}

// Wabernde Wellen: mehrere übereinanderliegende Sinus-Bänder, die langsam fließen und auf die Maus reagieren.
function startMotion(el) {
  stopStartMotion();
  const reduce = !personal().motion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  startStop.push(mountPersonalBackground(el));
  const cv = el.querySelector('.st-waves');
  if (cv) startStop.push(startWaves(cv, cv.parentElement, reduce));
  const clock = $('#stClock');
  const tick = () => {
    const n = new Date(),
      sep = n.getSeconds() % 2 ? ' ' : ':';
    if (clock)
      clock.innerHTML = `${String(n.getHours()).padStart(2, '0')}<b>${sep}</b>${String(n.getMinutes()).padStart(2, '0')}`;
  };
  tick();
  startTimers.push(setInterval(tick, 1000));
  if (reduce) return;
  // Parallax + Neigung
  const wrap = el.querySelector('.st-wrap');
  let raf = 0,
    mx = 0,
    my = 0;
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    my = ((e.clientY - r.top) / r.height - 0.5) * 2;
    if (!raf)
      raf = requestAnimationFrame(() => {
        raf = 0;
        el.style.setProperty('--mx', mx.toFixed(3));
        el.style.setProperty('--my', my.toFixed(3));
      });
    const c = e.target.closest?.('.st-card');
    if (c) {
      const cr = c.getBoundingClientRect(),
        x = e.clientX - cr.left,
        y = e.clientY - cr.top;
      c.style.setProperty('--px', x + 'px');
      c.style.setProperty('--py', y + 'px');
      c.style.setProperty('--ry', ((x / cr.width - 0.5) * 10).toFixed(2) + 'deg');
      c.style.setProperty('--rx', ((0.5 - y / cr.height) * 10).toFixed(2) + 'deg');
    }
  });
  el.addEventListener('pointerleave', () => {
    el.style.setProperty('--mx', 0);
    el.style.setProperty('--my', 0);
  });
  el.addEventListener('pointerout', (e) => {
    const c = e.target.closest?.('.st-card');
    if (c && !c.contains(e.relatedTarget)) {
      c.style.setProperty('--rx', '0deg');
      c.style.setProperty('--ry', '0deg');
    }
  });
}
let startSig = '';
async function renderStart() {
  const t = cur(),
    el = $('#start');
  const show = t && t.mode === 'start' && !t.lazy;
  const wasHidden = el.hidden;
  el.hidden = !show;
  if (!show) {
    setBanner(null);
    startSig = '';
    stopStartMotion();
    return;
  }
  const sig = [
    JSON.stringify(personal()),
    themeIconURL(),
    S.hasKey,
    S.googleSearch,
    S.bookmarks.map((b) => b.url + '\u0001' + b.title).join('|'),
  ].join('#');
  if (!wasHidden && sig === startSig) return; // nichts geändert: Einblend-Animation nicht neu starten
  startSig = sig;
  el.innerHTML = startHTML();
  bindSpotifySearch(
    $('#startQ'),
    (target, options) => visit(cur(), target, options),
    () => clearTimeout(quickT),
    playFirstSpotifyResult,
  );
  el.style.setProperty('--mx', 0);
  el.style.setProperty('--my', 0);
  startMotion(el);
  setBanner('start', 'Spotify');
  spRefresh();
  const history = await api.history('', 0);
  const seen = new Set();
  const h = history
    .filter((v) => {
      // Eine Website nur einmal; Unterseiten und www-Varianten zusammenfassen.
      let site;
      try {
        const u = new URL(v.url);
        if (!['http:', 'https:'].includes(u.protocol)) return false;
        site = u.hostname.replace(/^www\./, '');
      } catch {
        return false;
      }
      if (seen.has(site)) return false;
      seen.add(site);
      return true;
    })
    .slice(0, 3);
  const box = $('#recent .st-recent');
  if (!box) return;
  box.innerHTML = h.length
    ? h
        .map(
          (v, i) =>
            `<button class="st-card rc" data-act="open-url" data-url="${esc(v.url)}" style="--d:${420 + i * 50}ms"><span class="st-glare"></span><span class="rl" style="--h:${hueOf(hostOf(v.url))}">${esc(initial(v.title || hostOf(v.url)))}</span><span class="rt"><b>${esc(v.title || hostOf(v.url))}</b><i>${esc(hostOf(v.url))}</i></span></button>`,
        )
        .join('')
    : '<div class="hint">Noch nichts besucht – leg einfach los.</div>';
}
let stopSearchBackground;
function renderSearchView() {
  stopSearchBackground?.();
  stopSearchBackground = null;
  const t = cur(),
    el = $('#searchView');
  const show = !!t && t.mode === 'search';
  el.hidden = !show;
  if (!show) return;
  const top = el.scrollTop;
  el.classList.toggle('spotify-results-page', t.provider === 'spotify');
  const content = t.provider === 'spotify' ? spotifyResultsHTML(t) : searchHTML(t, isBookmarked);
  el.innerHTML = `<div class="search-scene"><div class="search-backdrop">${startBackgroundHTML}</div><div class="search-content">${content}</div></div>`;
  const resizeBackground = () =>
    el.style.setProperty('--search-viewport-height', el.clientHeight + 'px');
  resizeBackground();
  const observer = new ResizeObserver(resizeBackground);
  observer.observe(el);
  const stopPersonal = mountPersonalBackground(el);
  const waves = el.querySelector('.st-waves');
  const stopWaves = waves
    ? startWaves(
        waves,
        waves.parentElement,
        !personal().motion || matchMedia('(prefers-reduced-motion: reduce)').matches,
      )
    : () => {};
  stopSearchBackground = () => {
    observer.disconnect();
    stopPersonal();
    stopWaves();
  };
  el.scrollTop = t.sLoading ? 0 : top;
}
function renderAll() {
  renderTabs();
  renderToolbar();
  renderBar();
  renderStart();
  renderSearchView();
  renderSettingsView();
  chatUI.show(cur()?.mode === 'chat');
  renderSide();
  updateFrame();
}

/* ---------- Seitenbereich ↔ native Ansicht ---------- */
let frameT;
function updateFrame() {
  clearTimeout(frameT);
  frameT = setTimeout(() => {
    if (onboarding?.active) {
      onboarding.layout();
      return;
    }
    const r = $('#page').getBoundingClientRect();
    api.setFrame(Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height));
  }, 0);
}
new ResizeObserver(updateFrame).observe($('#page'));
window.addEventListener('resize', updateFrame);
window.addEventListener('focus', updateFrame); // Selbstheilung: stimmt die Position der Seite nicht, wird sie beim Zurückkehren ins Fenster korrigiert
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateFrame();
});

// Overlays (Menü, Vorschläge) müssen über der Seite liegen, native Ansichten liegen aber über der Oberfläche.
// Lösung: kurz ein Foto der Seite zeigen und die native Ansicht verbergen.
async function cover(on) {
  if (onboarding?.active) {
    onboarding.suspend(on);
    return;
  }
  if (on) {
    S.cover++;
    if (S.cover !== 1) return;
    const t = cur();
    if (!t || !t.native || t.mode !== 'web') return;
    let shot = '';
    try {
      shot = await api.snapshot(t.id);
    } catch {
      /* ohne Foto: Seite wird leer */
    }
    if (S.cover < 1) return;
    const img = $('#pageShot');
    if (shot) {
      img.src = shot;
      img.hidden = false;
    }
    nativeShow(-1);
  } else {
    S.cover = Math.max(0, S.cover - 1);
    if (S.cover) return;
    $('#pageShot').hidden = true;
    const t = cur();
    if (t && t.native && t.mode === 'web') {
      updateFrame();
      nativeShow(t.id);
    } // Maße vor dem Einblenden erneut senden
  }
}
/* ---------- Leiser Update-Hinweis: Punkt am Menü und Eintrag im Menü, ohne Fenster ---------- */
S.update = { version: '', ready: false };
async function pollUpdate() {
  let status = null;
  try {
    status = await api.updateStatus();
  } catch {
    return;
  }
  const version = status?.pendingVersion || '';
  S.update = {
    version,
    ready: !!status?.installReady,
  };
  $('#bMenu')?.classList.toggle('has-update', !!version);
  if (!version) return;
  let announced = '';
  try {
    announced = localStorage.getItem('luna-update-announced') || '';
  } catch {
    /* ohne Speicher: Hinweis erscheint nach jedem Start erneut */
  }
  if (announced !== version) {
    try {
      localStorage.setItem('luna-update-announced', version);
    } catch {
      /* egal */
    }
    toast(
      S.update.ready
        ? `Luna ${version} ist bereit. Im Menü findest du „Update installieren“.`
        : `Luna ${version} ist verfügbar und wird geladen.`,
    );
  }
}
setTimeout(pollUpdate, 5000);
setInterval(pollUpdate, 10 * 60 * 1000);
window.addEventListener('focus', () => setTimeout(pollUpdate, 500));
let cmdUI = null;
function closeOverlays() {
  cmdUI?.closeAll();
  closeMenu();
  closeSugg();
  closeOverlay();
}

/* ---------- Menü ---------- */
let menuOpen = false;
function closeMenu() {
  if (!menuOpen) return;
  menuOpen = false;
  const m = $('#menu');
  m.style.display = 'none';
  m.onclick = null;
  cover(false);
}
function openMenu() {
  if (menuOpen) {
    closeMenu();
    return;
  }
  const t = cur(),
    z = Math.round((t?.zoom || 1) * 100);
  const items = [
    ...(S.update.version
      ? [
          [
            S.update.ready
              ? `Update ${S.update.version} installieren`
              : `Update ${S.update.version} ansehen`,
            S.update.ready ? 'Neustart' : '',
            'install-update',
          ],
          '-',
        ]
      : []),
    ['Neuer Tab', shortcut('⌘T'), 'new-tab'],
    ['Auf der Seite suchen', shortcut('⌘F'), 'find'],
    '-',
    ['Vergrößern', shortcut('⌘+'), 'zoom-in'],
    ['Verkleinern', shortcut('⌘−'), 'zoom-out'],
    ['Tatsächliche Größe (' + z + ' %)', shortcut('⌘0'), 'zoom-reset'],
    '-',
    ['Einstellungen …', shortcut('⌘,'), 'settings'],
    [isDark() ? 'Heller Modus' : 'Dunkelmodus', shortcut('⇧⌘D'), 'toggle-theme'],
    '-',
    ['Notizzettel', shortcut('⌥⌘N'), 'toggle-notes'],
    ['Screenshot kopieren', shortcut('⌥⌘S'), 'screenshot'],
    ['Lesezeichen', shortcut('⌘⌥B'), 'show-bookmarks'],
    ['Verlauf', shortcut('⌘Y'), 'show-history'],
    ['Downloads', shortcut('⌘⌥L'), 'show-downloads'],
    '-',
    [
      S.bar ? 'Lesezeichenleiste ausblenden' : 'Lesezeichenleiste einblenden',
      shortcut('⇧⌘B'),
      'toggle-bar',
    ],
  ];
  const m = $('#menu'),
    r = $('#bMenu').getBoundingClientRect();
  m.innerHTML = items
    .map((it) =>
      it === '-'
        ? '<div class="msep"></div>'
        : `<button class="mi" data-cmd="${it[2]}"><span>${it[0]}</span><small>${it[1]}</small></button>`,
    )
    .join('');
  m.querySelector('[data-cmd="install-update"]')?.classList.add('update');
  m.style.display = 'block';
  m.style.top = r.bottom + 6 + 'px';
  m.style.left = Math.max(8, r.right - m.offsetWidth) + 'px';
  menuOpen = true;
  cover(true);
}
$('#menu').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-cmd]');
  if (b) {
    closeMenu();
    runCmd(b.dataset.cmd);
  }
});

/* ---------- Adressleiste & Vorschläge ---------- */
const url = $('#url');
cmdUI = createCommandUI({
  input: url,
  urlbox: $('#urlbox'),
  page: $('#page'),
  cover,
  getMode: themeMode,
  pickColor: (id) => {
    localStorage.removeItem(MCP_COLORS);
    clearLegacyMCPColors();
    applyColorTheme(id, true);
    if (cur()?.mode === 'settings') renderSettingsView();
  },
  pickMode: (mode) => {
    applyTheme(mode, true);
    renderTabs();
    if (cur()?.mode === 'settings') renderSettingsView();
  },
  fill: (text) => {
    url.focus();
    url.value = text;
    url.dispatchEvent(new Event('input', { bubbles: true }));
  },
  run: (name) => {
    if (name === 'chat') visit(cur(), 'chat:');
    else if (name === 'einstellungen') askSettings(cur(), 'einstellungen');
    else visit(cur(), QUICK_SITES[name]);
  },
});
let suggOpen = false,
  suggToken = 0;
function closeSugg() {
  suggToken++;
  if (!suggOpen) return;
  suggOpen = false;
  $('#sugg').hidden = true;
  S.sugg = [];
  S.suggSel = -1;
  cover(false);
}
async function openSugg(q) {
  const token = ++suggToken;
  const text = q.trim();
  if (!text) {
    closeSugg();
    return;
  }
  const [hist] = await Promise.all([api.history(text, 6)]);
  if (token !== suggToken) return;
  const items = [
    {
      kind: 'go',
      label: text,
      sub:
        /^[^\s]+\.[a-z]{2,}/i.test(text) || /:\/\//.test(text)
          ? 'Öffnen'
          : S.googleSearch
            ? 'Mit Google suchen'
            : 'Mit Luna Search suchen',
      url: text,
    },
  ];
  const seen = new Set();
  for (const b of S.bookmarks)
    if ((b.title + b.url).toLowerCase().includes(text.toLowerCase()) && !seen.has(b.url)) {
      seen.add(b.url);
      items.push({ kind: 'bm', label: b.title, sub: shownUrl(b.url), url: b.url });
    }
  for (const v of hist)
    if (!seen.has(v.url)) {
      seen.add(v.url);
      items.push({ kind: 'h', label: v.title || hostOf(v.url), sub: shownUrl(v.url), url: v.url });
    }
  S.sugg = items.slice(0, 7);
  S.suggSel = 0;
  const box = $('#sugg'),
    r = $('#urlbox').getBoundingClientRect();
  box.style.left = r.left + 'px';
  box.style.top = r.bottom + 6 + 'px';
  box.style.width = r.width + 'px';
  paintSugg();
  box.hidden = false;
  if (!suggOpen) {
    suggOpen = true;
    cover(true);
  }
}
function paintSugg() {
  $('#sugg').innerHTML = S.sugg
    .map(
      (s, i) =>
        `<button class="sg ${i === S.suggSel ? 'sel' : ''}" data-i="${i}"><span>${esc(s.label)}</span><i>${esc(s.sub)}</i></button>`,
    )
    .join('');
}
$('#sugg').addEventListener('mousedown', (ev) => {
  ev.preventDefault();
  const b = ev.target.closest('.sg');
  if (b) commitAddress(S.sugg[+b.dataset.i].url);
});
let playCommandBusy = false;
async function playFirstSpotifyResult(query) {
  if (!query) {
    toast('Gib nach play einen Song oder Künstler ein.');
    return;
  }
  if (playCommandBusy) return;
  playCommandBusy = true;
  try {
    const results = await api.spotifySearch(query);
    const track = results?.tracks?.items?.[0];
    if (!track?.uri) {
      toast('Kein Song bei Spotify gefunden.');
      return;
    }
    await api.spotifyPlay(track.uri);
    toast('Wiedergabe an Spotify übergeben: ' + track.name);
  } catch (error) {
    toast('Spotify: ' + String(error?.message || error));
  } finally {
    playCommandBusy = false;
  }
}
function commitAddress(text) {
  closeSugg();
  url.blur();
  visit(cur(), text);
}
url.addEventListener('focus', () => url.select());
// Direkt-Seiten: Wer genau "google" oder "youtube" tippt, landet nach einer kurzen Tipp-Pause sofort dort – ohne Enter.
// (Kurze Pause, damit "google maps" weiter getippt werden kann; nur beim Tippen/Einfügen, nicht beim Löschen.)
const QUICK_SITES = { google: 'https://www.google.com', youtube: 'https://www.youtube.com' };
let quickT = 0;
function armQuickSite(input, ev) {
  clearTimeout(quickT);
  if (ev && ev.inputType && !ev.inputType.startsWith('insert')) return;
  const key = input.value.trim().toLowerCase();
  if (key === 'chat' && commandOn('chat') && !ev?.isComposing) {
    closeSugg();
    input.blur();
    visit(cur(), 'chat:');
    return;
  }
  if (/^(?:commands?|befehle)$/.test(key) && !ev?.isComposing) {
    closeSugg();
    input.blur();
    cmdUI.openPage();
    return;
  }
  if (/^themes?$/.test(key) && commandOn('theme') && !ev?.isComposing) {
    closeSugg();
    cmdUI.openDrop(); // Fokus bleibt in der Leiste: Weitertippen schließt die Theme-Leiste wieder
    return;
  }
  const target = commandOn('sites') ? QUICK_SITES[key] : undefined;
  if (!target && !(key === 'einstellungen' && commandOn('settings'))) return;
  quickT = setTimeout(() => {
    if (input.value.trim().toLowerCase() !== key) return;
    if (key === 'einstellungen') {
      askSettings(cur(), input.value);
      return;
    }
    closeSugg();
    input.blur();
    visit(cur(), target);
  }, 350);
}
// Capture before the music search handlers so explicit tab commands work in every mode.
document.addEventListener(
  'input',
  (ev) => {
    if (ev.target !== url || !commandOn('tab') || !/^\s*tab(?:\s|$)/i.test(url.value)) return;
    url._spotifySearch?.setMode(false);
    clearTimeout(quickT);
    closeSugg();
    ev.stopImmediatePropagation();
  },
  true,
);
document.addEventListener(
  'keydown',
  async (ev) => {
    if (
      ev.target !== url ||
      ev.key !== 'Enter' ||
      ev.isComposing ||
      !commandOn('tab') ||
      !/^\s*tab(?:\s|$)/i.test(url.value)
    )
      return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    clearTimeout(quickT);
    closeSugg();
    try {
      const command = parseTabCommand(url.value);
      url._spotifySearch?.setMode(false);
      url.blur();
      const result = await runMCPCommand(command.name, command.args);
      if (command.name === 'browser_state') {
        toast(result.tabs.map((tab) => `${tab.id}: ${tab.title || 'Neuer Tab'}`).join(' · '));
      }
      if (result.closed_domain)
        toast(`${result.closed_tabs} Tabs von ${result.closed_domain} geschlossen.`);
      renderToolbar();
    } catch (error) {
      toast(String(error?.message || error));
    }
  },
  true,
);
url.addEventListener('input', (ev) => {
  openSugg(url.value);
  armQuickSite(url, ev);
});
url.addEventListener('blur', () => {
  setTimeout(() => {
    closeSugg();
    renderToolbar();
  }, 120);
});
url.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') {
    ev.preventDefault();
    commitAddress(S.sugg[S.suggSel]?.url ?? url.value);
  } else if (ev.key === 'Escape') {
    closeSugg();
    url.value = shownUrl(cur()?.mode === 'start' ? '' : cur()?.url);
    url.blur();
  } else if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && S.sugg.length) {
    ev.preventDefault();
    S.suggSel = (S.suggSel + (ev.key === 'ArrowDown' ? 1 : -1) + S.sugg.length) % S.sugg.length;
    paintSugg();
  }
});

/* Lokale Einstellungen als bewusste Auswahl statt unbemerkter Navigation. */
let settingsPromptRequest = false;
async function askSettings(tab, query) {
  clearTimeout(quickT);
  if (settingsPromptRequest) return;
  settingsPromptRequest = true;
  closeOverlays();
  try {
    const choice = await notifications.ask({
      kind: 'settings',
      title: 'Einstellungen öffnen?',
      eyebrow: 'LUNA BROWSER · GANZ NACH DEINEM GESCHMACK',
      message: 'Möchtest du die Einstellungen von Luna Browser öffnen?',
      note: 'Farben, Startseite, Musik und mehr – mach Luna zu deinem Browser.',
      confirmLabel: 'Einstellungen öffnen',
      alternativeLabel: 'Stattdessen im Web suchen',
    });
    if (choice === 'confirm') openSettings();
    else if (choice === 'alternative' && S.tabs.includes(tab)) openSearch(tab, query);
  } finally {
    settingsPromptRequest = false;
  }
}
function confirmClearHistory() {
  return notifications
    .ask({
      kind: 'history',
      title: 'Verlauf löschen?',
      message: 'Möchtest du deinen gesamten Browserverlauf löschen?',
      note: 'Diese Einträge können danach nicht wiederhergestellt werden.',
      confirmLabel: 'Verlauf löschen',
    })
    .then((choice) => choice === 'confirm');
}

/* ---------- Suche auf der Seite ---------- */
const findIn = $('#findIn');
function openFind() {
  if (cur()?.mode !== 'web') {
    url.focus();
    url.select();
    toast('Neue Suche: einfach in die Adressleiste tippen');
    return;
  }
  S.findOpen = true;
  $('#findbar').hidden = false;
  updateFrame();
  findIn.focus();
  findIn.select();
}
function closeFind() {
  S.findOpen = false;
  $('#findbar').hidden = true;
  $('#findStat').textContent = '';
  const t = cur();
  if (t?.native) api.find(t.id, '', true);
  updateFrame();
}
function doFind(fwd) {
  const t = cur();
  if (t?.native && findIn.value) api.find(t.id, findIn.value, fwd);
}
findIn.addEventListener('input', () => {
  $('#findStat').textContent = '';
  doFind(true);
});
findIn.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') {
    ev.preventDefault();
    doFind(!ev.shiftKey);
  }
  if (ev.key === 'Escape') closeFind();
});

/* ---------- Seitenleiste ---------- */
function fmtTime(ms) {
  const d = new Date(ms),
    n = new Date(),
    day = (x) => new Date(x).setHours(0, 0, 0, 0);
  const diff = Math.round((day(n) - day(d)) / 864e5),
    hm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return diff === 0
    ? hm
    : diff === 1
      ? 'Gestern, ' + hm
      : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ', ' + hm;
}
const fmtSize = (b) =>
  b < 1e6
    ? Math.round(b / 1e3) + ' KB'
    : b < 1e9
      ? (b / 1e6).toFixed(1).replace('.', ',') + ' MB'
      : (b / 1e9).toFixed(1).replace('.', ',') + ' GB';
/* ---------- Seitenpanel: Bereiche als Registrierungen (Gerüst: sidepanel.js) ---------- */
const emptyState = (icon, title, text, btn) =>
  `<div class="empty2">${icon}<b>${esc(title)}</b><p>${text}</p>${btn || ''}</div>`;
const EMPTY_ICON = (d) =>
  `<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const NO_HIT = EMPTY_ICON('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>');
const plural2 = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function dayLabel(ms) {
  const d = new Date(ms),
    n = new Date(),
    day = (x) => new Date(x).setHours(0, 0, 0, 0);
  const diff = Math.round((day(n) - day(d)) / 864e5);
  if (diff <= 0) return 'Heute';
  if (diff === 1) return 'Gestern';
  if (diff < 7) return d.toLocaleDateString('de-DE', { weekday: 'long' });
  return d.toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() === n.getFullYear() ? undefined : 'numeric',
  });
}
const hmOf = (ms) =>
  new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const EXT_COL = {
  pdf: '#c63f57',
  zip: '#8a5a2b',
  dmg: '#3a2433',
  png: '#3f7fd0',
  jpg: '#3f7fd0',
  jpeg: '#3f7fd0',
  gif: '#3f7fd0',
  mp4: '#cf5a2a',
  mov: '#cf5a2a',
  mp3: '#23866a',
  txt: '#7d6474',
  doc: '#2f62c4',
  docx: '#2f62c4',
  xls: '#23866a',
  xlsx: '#23866a',
  ppt: '#c4632f',
  pptx: '#c4632f',
};
function openSettingsAt(section) {
  if (section === 'chat') section = 'mcp';
  settings.section = section;
  openSettings();
  if (section === 'mcp')
    refreshChatStatus()
      .then(renderSettingsView)
      .catch((e) => toast(String(e)));
  if (section === 'spotify') refreshSpotifyAccount();
  if (section === 'spotify') refreshSonos();
  if (section === 'mcp') refreshMCPStatus();
}

registerPanel({
  id: 'bookmarks',
  title: 'Lesezeichen',
  desc: 'Deine gemerkten Seiten',
  order: 10,
  icon: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1-4.5-4.3 6.1-.8z"/>',
  search: { placeholder: 'Lesezeichen durchsuchen' },
  count: () => plural2(S.bookmarks.length, 'Lesezeichen', 'Lesezeichen'),
  primary: () => ({ label: '+ Neu', onClick: () => openBmDialog(bmFromPage()) }),
  menu: () => [
    {
      label: S.bar ? 'Lesezeichenleiste ausblenden' : 'Lesezeichenleiste einblenden',
      onClick: () => runCmd('toggle-bar'),
    },
    { label: 'Alle verwalten …', onClick: () => openSettingsAt('bm') },
  ],
  render: ({ q, rawQ }) => {
    const list = S.bookmarks.filter((b) => !q || (b.title + ' ' + b.url).toLowerCase().includes(q));
    if (list.length)
      return list
        .map(
          (b) =>
            `<div class="si" data-bm="${esc(b.url)}"><button class="go" data-nav data-act="open-url" data-url="${esc(b.url)}" title="${esc(b.title)} – ${shortcut('⌘')}-Klick: neuer Tab"><span class="av" style="--h:${hueOf(b.title)}">${esc(initial(b.title))}</span><span class="stx"><b>${esc(b.title)}</b><small>${esc(hostOf(b.url) || shownUrl(b.url))}</small></span></button><span class="acts"><button class="ia" data-act="bm-edit" data-url="${esc(b.url)}" aria-label="Bearbeiten" title="Bearbeiten"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></button><button class="ia" data-act="rm-bm" data-url="${esc(b.url)}" aria-label="Löschen" title="Löschen">${ICON.x}</button></span></div>`,
        )
        .join('');
    return q
      ? emptyState(NO_HIT, 'Keine Treffer', `Für „${esc(rawQ)}“ gibt es kein Lesezeichen.`)
      : emptyState(
          EMPTY_ICON(
            '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1-4.5-4.3 6.1-.8z"/>',
          ),
          'Noch keine Lesezeichen',
          shortcut('Merke dir Seiten mit dem Stern in der Adressleiste (⌘D).'),
          '<button class="btn pri" data-act="bm-add">+ Lesezeichen hinzufügen</button>',
        );
  },
});

registerPanel({
  id: 'history',
  title: 'Verlauf',
  desc: 'Besuchte Seiten und Suchen, nach Tagen geordnet',
  order: 20,
  icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  search: { placeholder: 'Verlauf durchsuchen' },
  count: () => (S.histN == null ? '' : plural2(S.histN, 'Eintrag', 'Einträge')),
  menu: () => [
    {
      label: 'Gesamten Verlauf löschen …',
      onClick: async () => {
        if (await confirmClearHistory()) runCmd('clear-history-now');
      },
    },
  ],
  render: async ({ q, rawQ }) => {
    const h = await api.history(rawQ || '', 300);
    S.histN = h.length;
    const c = document.getElementById('spCnt');
    if (c && activePanel() === 'history') c.textContent = plural2(h.length, 'Eintrag', 'Einträge');
    if (!h.length)
      return q
        ? emptyState(NO_HIT, 'Keine Treffer', `Im Verlauf steht nichts zu „${esc(rawQ)}“.`)
        : emptyState(
            EMPTY_ICON('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
            'Noch kein Verlauf',
            'Besuchte Seiten und Suchen erscheinen hier, nach Tagen geordnet.',
          );
    let last = '';
    return h
      .map((v) => {
        const g = dayLabel(v.last),
          head = g !== last ? `<div class="sgh">${esc(g)}</div>` : '';
        last = g;
        return `${head}<div class="si"><button class="go" data-nav data-act="open-url" data-url="${esc(v.url)}" title="${esc(shownUrl(v.url))} – ${shortcut('⌘')}-Klick: neuer Tab"><span class="av" style="--h:${hueOf(hostOf(v.url))}">${esc(initial(v.title || hostOf(v.url)))}</span><span class="stx"><b>${esc(v.title || hostOf(v.url))}</b><small>${esc(hmOf(v.last))} · ${esc(hostOf(v.url))}</small></span></button><span class="acts"><button class="ia" data-act="rm-hist" data-url="${esc(v.url)}" aria-label="Eintrag entfernen" title="Entfernen">${ICON.x}</button></span></div>`;
      })
      .join('');
  },
});

registerPanel({
  id: 'downloads',
  title: 'Downloads',
  desc: 'Geladene Dateien',
  order: 30,
  icon: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  search: { placeholder: 'Downloads durchsuchen' },
  count: () => plural2(S.downloads.length, 'Download', 'Downloads'),
  badge: () => {
    const n = S.downloads.filter((d) => d.state === 'progress').length;
    return n ? String(n) : '';
  },
  menu: () =>
    S.downloads.length ? [{ label: 'Liste leeren', onClick: () => runCmd('clear-dl-now') }] : [],
  render: ({ q, rawQ }) => {
    const L = S.downloads
      .slice()
      .reverse()
      .filter((d) => !q || d.name.toLowerCase().includes(q));
    if (!L.length)
      return q
        ? emptyState(NO_HIT, 'Keine Treffer', `Kein Download passt zu „${esc(rawQ)}“.`)
        : emptyState(
            EMPTY_ICON('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
            'Keine Downloads',
            'Geladene Dateien landen in „Downloads“ und erscheinen hier.',
          );
    return L.map((d) => {
      const ext = (d.name.split('.').pop() || '').toLowerCase().slice(0, 4),
        col = EXT_COL[ext] || '#7d6474';
      const pct = d.total > 0 ? Math.min(100, Math.round((d.received / d.total) * 100)) : 0,
        run = d.state === 'progress' || d.state === 'start';
      return `<div class="si dl"><span class="fx" style="background:${col}">${esc(ext || 'Datei')}</span><div class="stx"><b title="${esc(d.name)}">${esc(d.name)}</b>${run ? `<div class="sbar"><div style="width:${d.total ? pct : 35}%"></div></div><small>${fmtSize(d.received || 0)}${d.total > 0 ? ' von ' + fmtSize(d.total) + ' · ' + pct + ' %' : ''}</small>` : d.state === 'failed' ? '<small class="bad">Fehlgeschlagen</small>' : `<small>${esc(d.path.replace(/^\/Users\/[^/]+/, '~'))}</small>`}</div>${d.state === 'done' ? `<span class="acts on"><button class="ia" data-act="dl-open" data-path="${esc(d.path)}" aria-label="Öffnen" title="Öffnen"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 13v6H5V6h6"/></svg></button><button class="ia" data-act="dl-reveal" data-path="${esc(d.path)}" aria-label="Im Finder zeigen" title="Im Finder zeigen"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></button></span>` : ''}</div>`;
    }).join('');
  },
});

registerPanel({
  id: 'notes',
  title: 'Notizen',
  desc: 'Notizzettel zur aktuellen Seite (auch per Kreis-Geste)',
  order: 40,
  icon: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  count: () => plural2(Object.keys(S.notes).length, 'Notiz', 'Notizen'),
  badge: () => {
    const k = noteKeyOf(cur());
    return k && S.notes[k] ? true : '';
  },
  keep: () => document.activeElement?.id === 'noteText' && S.noteShown === noteKeyOf(cur()), // wer tippt, wird nicht unterbrochen
  render: () => {
    S.noteShown = noteKeyOf(cur());
    return notesPanelHTML();
  },
});

function updateSideBadges() {
  refreshBadges();
}
function openSide(tab) {
  S.side = true;
  if (tab) setActivePanel(tab);
  renderToolbar();
  renderSide();
}
function closeSide() {
  if (!S.side) return;
  S.side = false;
  renderToolbar();
  renderSide();
}
initSidePanel({
  host: $('#side'),
  isOpen: () => S.side,
  close: closeSide,
  showMenu: (items, x, y) => showCtx(items, x, y),
  openPanelSettings: () => openSettingsAt('panels'),
});

/* ---------- Notizzettel (seitenbasiert) + Mausgeste ---------- */
// Schlüssel: Adresse der Seite ohne #Anker; Suchen: "search:<Begriff>". Startseite/Einstellungen haben keinen Zettel.
function noteKeyOf(t) {
  if (!t) return null;
  if (t.mode === 'web' && t.webUrl) return t.webUrl.split('#')[0];
  if (t.mode === 'search' && t.q) return 'search:' + encodeURIComponent(t.q);
  return null;
}
const noteTitleOf = (t) =>
  t.mode === 'search' ? t.q + ' – Suche' : t.webTitle || hostOf(t.webUrl) || '';
function notesPanelHTML() {
  const t = cur(),
    key = noteKeyOf(t),
    note = key ? S.notes[key] : null;
  const all = Object.values(S.notes).sort((a, b) => b.updated - a.updated);
  return `<div class="notes">
    <div class="npage">${key ? `<b>${esc(noteTitleOf(t) || hostOf(key))}</b><small>${esc(shownUrl(key))}</small>` : '<b>Keine Seite offen</b><small>Öffne eine Webseite oder Suche – dann erscheint hier der Notizzettel dieser Seite.</small>'}</div>
    ${
      key
        ? `<div class="paper"><textarea id="noteText" placeholder="Notiz zu dieser Seite …" spellcheck="true">${esc(note ? note.text : '')}</textarea><i class="fold"></i></div>
    <div class="nmeta"><span id="noteStat">${note ? 'Gespeichert · ' + esc(fmtTime(note.updated)) : 'Wird automatisch gespeichert'}</span><button class="link" data-act="note-del" ${note ? '' : 'disabled'}>Löschen</button></div>`
        : ''
    }
    <h4 class="nh">Alle Notizen · ${all.length}</h4><div class="nlist" id="noteList">${noteListHTML(all)}</div></div>`;
}
function noteListHTML(all) {
  return all.length
    ? all
        .map(
          (n) =>
            `<button class="nitem" data-act="open-url" data-url="${esc(n.key)}"><b>${esc(n.title || hostOf(n.key))}</b><span>${esc(n.text.replace(/\s+/g, ' ').slice(0, 90))}</span><small>${esc(fmtTime(n.updated))}</small></button>`,
        )
        .join('')
    : '<div class="hint">Noch keine Notizen. Zeichne mit gedrückter linker Maustaste einen Kreis – oder öffne den Zettel über das Menü.</div>';
}
function refreshNotesUI() {
  const all = Object.values(S.notes).sort((a, b) => b.updated - a.updated);
  const l = $('#noteList');
  if (l) l.innerHTML = noteListHTML(all);
  const h = document.querySelector('.nh');
  if (h) h.textContent = 'Alle Notizen · ' + all.length;
  const key = noteKeyOf(cur()),
    n = key ? S.notes[key] : null;
  const st = $('#noteStat');
  if (st) st.textContent = n ? 'Gespeichert · ' + fmtTime(n.updated) : 'Leer';
  const del = document.querySelector('[data-act=note-del]');
  if (del) del.disabled = !n;
  updateSideBadges();
}
let noteT = 0;
async function saveNote(text) {
  const t = cur(),
    key = noteKeyOf(t);
  if (!key) return;
  const list = await api.setNote(key, noteTitleOf(t), text);
  S.notes = Object.fromEntries(list.map((n) => [n.key, n]));
  refreshNotesUI();
}
document.addEventListener('input', (ev) => {
  if (ev.target.id !== 'noteText') return;
  const st = $('#noteStat');
  if (st) st.textContent = 'Speichert …';
  const v = ev.target.value;
  clearTimeout(noteT);
  noteT = setTimeout(() => saveNote(v), 450);
});
function toggleNotes() {
  if (S.side && activePanel() === 'notes') {
    S.side = false;
    renderToolbar();
    renderSide();
    return;
  }
  openSide('notes');
  setTimeout(() => $('#noteText')?.focus(), 120);
}
// Die Gesten für Seiten ohne native Ansicht (Startseite, Suche, Einstellungen); Webseiten melden sie über ein eingeschleustes Skript.
window.__fmCircle({
  target: $('#page'),
  enabled: () => S.gesture,
  onDraw: (on) => api.gestureWriteSound(on),
  onLetter: (letter) => {
    if (cur()?.mode !== 'web') gestures.run(letter);
  },
});

/* ---------- Screenshot (S-Geste): Zwischenablage + Kamera-Sound + Animation ---------- */
const { takeShot } = createScreenshots({
  state: S,
  currentTab: cur,
  nativeShow,
  updateFrame,
  toast,
});

/* ---------- Downloads ---------- */
function onDownload(e) {
  let d = S.downloads.find((x) => x.id === e.id);
  if (e.state === 'start') {
    S.downloads.push({
      id: e.id,
      name: e.name,
      path: e.path,
      total: e.total,
      received: 0,
      state: 'progress',
    });
    openSide('downloads');
    toast('Download: ' + e.name);
  } else if (d) {
    if (e.state === 'progress') {
      d.received = e.received;
      d.total = e.total || d.total;
    }
    if (e.state === 'done') {
      d.state = 'done';
      api.downloadAdd(d.name, d.path);
      toast('Geladen: ' + d.name);
    }
    if (e.state === 'failed') {
      d.state = 'failed';
    }
  }
  if (S.side && activePanel() === 'downloads') renderSide();
  else refreshBadges();
}

/* ---------- Einstellungen: eigene Seite in eigenem Tab ---------- */
const settings = createSettings({
  state: S,
  currentTab: cur,
  createTab: mkTab,
  activate,
  renderAll,
  themeMode,
  toast,
  onSearchKeyChanged: () => {
    startSig = '';
    renderStart();
    for (const x of S.tabs) if (x.mode === 'search' && x.sErr) loadEntry(x, true);
  },
});
const {
  renderSettingsView,
  openSettings,
  keyMsg,
  testKey,
  saveKey,
  refreshMCPStatus,
  refreshSonos,
  refreshSpotifyAccount,
} = settings;

/* ---------- Lesezeichen: Dialog (hinzufügen/bearbeiten), Kontextmenü, Verwaltung ---------- */
let bmDlg = null; // { oldUrl } beim Bearbeiten
function refreshBookmarks() {
  renderToolbar();
  renderBar();
  renderSide();
  renderSettingsView();
  startSig = '';
  renderStart();
}
function closeBmDialog() {
  if (!bmDlg) return;
  bmDlg = null;
  const ov = $('#bm-ov');
  ov.hidden = true;
  ov.innerHTML = '';
  const t = cur();
  if (t && t.native && t.mode === 'web') nativeShow(t.id);
}
function openBmDialog(o = {}) {
  closeMenu();
  closeSugg();
  closeOverlay();
  const editing = !!o.oldUrl;
  bmDlg = { oldUrl: o.oldUrl || '' };
  nativeShow(-1);
  const ov = $('#bm-ov');
  ov.hidden = false;
  ov.innerHTML = `<div class="card bmcard" role="document"><header><b>${editing ? 'Lesezeichen bearbeiten' : 'Lesezeichen hinzufügen'}</b><button class="ib sm" data-act="bm-close" aria-label="Schließen">${ICON.x}</button></header>
    <div class="cbody"><label class="fld"><span>Name</span><input id="bmTitle" type="text" value="${esc(o.title || '')}" placeholder="z. B. Wikipedia" spellcheck="false" autocomplete="off"></label>
    <label class="fld"><span>Adresse</span><input id="bmUrl" type="text" value="${esc(o.url || '')}" placeholder="https://…" spellcheck="false" autocomplete="off" autocapitalize="off"></label>
    <div id="bmErr" class="kmsg err"></div>
    <div class="row"><button class="btn pri" data-act="bm-save">Speichern</button><button class="btn" data-act="bm-close">Abbrechen</button>${editing ? '<button class="btn danger" data-act="bm-del-dlg">Löschen</button>' : ''}</div></div></div>`;
  setTimeout(() => {
    const i = $(o.url ? '#bmTitle' : '#bmUrl');
    i?.focus();
    i?.select();
  }, 0);
}
function bmFromPage() {
  // Vorbelegung: die Seite, die gerade offen ist
  const t = cur();
  if (t && (t.mode === 'web' || t.mode === 'search') && t.url)
    return { url: t.url, title: t.mode === 'search' ? t.q + ' – Suche' : t.title || hostOf(t.url) };
  return {};
}
async function saveBm() {
  const err = (x) => {
    const e = $('#bmErr');
    if (e) e.textContent = x;
  };
  const raw = $('#bmUrl').value.trim();
  let title = $('#bmTitle').value.trim();
  if (!raw) return err('Bitte eine Adresse eingeben.');
  const u = isSearchUrl(raw) ? raw : toURL(raw);
  if (!u)
    return err(
      'Das sieht nicht nach einer Adresse aus (z. B. beispiel.de oder https://beispiel.de).',
    );
  if (!title) title = hostOf(u) || u;
  const old = bmDlg?.oldUrl;
  try {
    S.bookmarks = old
      ? await api.editBookmark(old, u, title)
      : await api.editBookmark('', u, title);
  } catch (e) {
    return err(String(e?.message || e));
  }
  closeBmDialog();
  refreshBookmarks();
  toast(old ? 'Lesezeichen gespeichert' : 'Lesezeichen hinzugefügt');
}
async function deleteBm(u) {
  S.bookmarks = await api.setBookmark(u, '', false);
  refreshBookmarks();
  toast('Lesezeichen gelöscht');
}
const bmByUrl = (u) => S.bookmarks.find((b) => b.url === u);
function editBm(u) {
  const b = bmByUrl(u);
  if (b) openBmDialog({ oldUrl: b.url, url: b.url, title: b.title });
}

// Kontextmenü (Rechtsklick auf Lesezeichen) – nutzt dasselbe Menü-Element wie ⋯
function showCtx(items, x, y) {
  const m = $('#menu');
  if (menuOpen) {
    m.style.display = 'none';
  } else {
    menuOpen = true;
    cover(true);
  }
  m.innerHTML = items
    .map((it, i) =>
      it === '-'
        ? '<div class="msep"></div>'
        : `<button class="mi" data-ci="${i}"><span>${esc(it.label)}</span></button>`,
    )
    .join('');
  m.style.display = 'block';
  m.style.left = Math.max(6, Math.min(x, innerWidth - m.offsetWidth - 6)) + 'px';
  m.style.top = Math.max(6, Math.min(y, innerHeight - m.offsetHeight - 6)) + 'px';
  m.onclick = (ev) => {
    const b = ev.target.closest('[data-ci]');
    if (!b) return;
    closeMenu();
    items[+b.dataset.ci].act();
  };
}
document.addEventListener('contextmenu', (ev) => {
  const el = ev.target.closest('[data-bm]');
  if (!el) return;
  ev.preventDefault();
  const u = el.dataset.bm;
  showCtx(
    [
      { label: 'Öffnen', act: () => visit(cur(), u) },
      { label: 'In neuem Tab öffnen', act: () => newTab(u, { background: true }) },
      '-',
      { label: 'Bearbeiten …', act: () => editBm(u) },
      { label: 'Löschen', act: () => deleteBm(u) },
    ],
    ev.clientX,
    ev.clientY,
  );
});
$('#bm-ov').addEventListener('mousedown', (ev) => {
  if (ev.target.id === 'bm-ov') closeBmDialog();
});

/* ---------- Befehle (Menü, Tasten, Klicks) ---------- */
function setZoom(f) {
  const t = cur();
  if (!t?.native || t.mode !== 'web') return;
  t.zoom = Math.min(3, Math.max(0.3, Math.round(f * 100) / 100));
  api.zoom(t.id, t.zoom);
  toast('Zoom ' + Math.round(t.zoom * 100) + ' %');
}
async function toggleBookmark() {
  const t = cur();
  if (!t || t.mode === 'start' || t.mode === 'settings' || t.mode === 'chat' || !t.url) return;
  const on = !isBookmarked(t.url);
  S.bookmarks = await api.setBookmark(
    t.url,
    t.mode === 'search' ? t.q + ' – Suche' : t.title || hostOf(t.url),
    on,
  );
  toast(on ? 'Lesezeichen hinzugefügt' : 'Lesezeichen entfernt');
  renderToolbar();
  renderBar();
  renderSide();
}
async function runCmd(c) {
  if (onboarding?.active) return;
  const t = cur();
  switch (c) {
    case 'new-tab':
      newTab();
      break;
    case 'close-tab':
      closeTab(S.active);
      break;
    case 'focus-url':
      await api.focusUI();
      url.focus();
      url.select();
      break;
    case 'find':
      await api.focusUI();
      openFind();
      break;
    case 'reload':
      if (t?.mode === 'web' && t.native) (t.loading ? api.stop : api.reload)(t.id);
      else if (t?.mode === 'search') {
        if (t.loading) {
          t.sTok++;
          t.loading = false;
          t.sLoading = false;
          renderAll();
        } else loadEntry(t, true);
      }
      break;
    case 'stop':
      if (t?.mode === 'web' && t.native) api.stop(t.id);
      break;
    case 'back':
      if (t) goBack(t);
      break;
    case 'forward':
      if (t) goForward(t);
      break;
    case 'zoom-in':
      setZoom((t?.zoom || 1) + 0.1);
      break;
    case 'zoom-out':
      setZoom((t?.zoom || 1) - 0.1);
      break;
    case 'zoom-reset':
      setZoom(1);
      break;
    case 'toggle-side':
      S.side = !S.side;
      renderToolbar();
      renderSide();
      break;
    case 'toggle-bar':
      S.bar = !S.bar;
      api.setPref('showBookmarkBar', S.bar).catch(() => {});
      renderBar();
      renderSettingsView();
      break;
    case 'show-history':
      openSide('history');
      break;
    case 'show-bookmarks':
      openSide('bookmarks');
      break;
    case 'install-update':
      toast('Luna startet mit dem Update neu …');
      await api.installUpdate();
      break;
    case 'show-downloads':
      openSide('downloads');
      break;
    case 'bookmark':
      toggleBookmark();
      break;
    case 'toggle-notes':
      toggleNotes();
      break;
    case 'clear-history-now':
      await api.historyClear();
      S.histN = null;
      renderSide();
      startSig = '';
      renderStart();
      toast('Verlauf gelöscht');
      break;
    case 'clear-dl-now':
      S.downloads = [];
      await api.downloadsClear();
      renderSide();
      toast('Download-Liste geleert');
      break;
    case 'screenshot':
      takeShot();
      break;
    case 'settings':
      openSettings();
      break;
    case 'toggle-theme':
      applyTheme(isDark() ? 'light' : 'dark', true);
      break;
    case 'next-tab':
      stepTab(1);
      break;
    case 'prev-tab':
      stepTab(-1);
      break;
    default:
      if (/^tab-\d$/.test(c)) {
        const n = +c.slice(4);
        const x = n === 9 ? S.tabs[S.tabs.length - 1] : S.tabs[n - 1];
        if (x) activate(x.id);
      }
  }
}
api.onCmd(runCmd);

document.addEventListener('click', async (ev) => {
  const a = ev.target.closest('[data-act]');
  if (!a) return;
  const t = cur(),
    d = a.dataset;
  switch (d.act) {
    case 'tab':
      activate(+d.id);
      break;
    case 'close':
      closeTab(+d.id);
      break;
    case 'new-tab':
      newTab();
      break;
    case 'back':
      runCmd('back');
      break;
    case 'forward':
      runCmd('forward');
      break;
    case 'reload':
      runCmd('reload');
      break;
    case 'star':
      toggleBookmark();
      break;
    case 'menu':
      openMenu();
      break;
    case 'toggle-side':
      runCmd('toggle-side');
      break;
    case 'open-url':
      ev.metaKey || ev.ctrlKey ? newTab(d.url, { background: true }) : visit(t, d.url);
      break;
    case 'sr-open':
      ev.preventDefault();
      if (ev.metaKey || ev.ctrlKey) {
        newTab(d.url, { background: true });
        toast('In neuem Tab geöffnet');
      } else openWeb(t, d.url);
      break;
    case 'sr-tab':
      newTab(d.url, { background: true });
      toast('In neuem Tab geöffnet');
      break;
    case 'sr-bm': {
      const on = !isBookmarked(d.url);
      S.bookmarks = await api.setBookmark(d.url, d.title, on);
      toast(on ? 'Lesezeichen hinzugefügt' : 'Lesezeichen entfernt');
      renderBar();
      renderSearchView();
      renderSide();
      break;
    }
    case 'sv-page':
      openSearch(t, t.q, +d.p);
      break;
    case 'sv-filter':
      t.filter = d.k;
      renderSearchView();
      break;
    case 'sv-alt':
      openSearch(t, d.q, 0);
      break;
    case 'sv-retry':
      loadEntry(t, true);
      break;
    case 'rm-bm':
      await deleteBm(d.url);
      break;
    case 'bm-add':
      openBmDialog(bmFromPage());
      break;
    case 'note-del': {
      clearTimeout(noteT);
      const ta = $('#noteText');
      if (ta) ta.value = '';
      await saveNote('');
      break;
    }
    case 'pref-gesture': {
      S.gesture = !S.gesture;
      try {
        await api.setPref('circleGesture', S.gesture);
        api.setGesture(S.gesture);
      } catch {
        S.gesture = !S.gesture;
        toast('Konnte nicht gespeichert werden');
      }
      renderSettingsView();
      break;
    }
    case 'bm-edit':
      editBm(d.url);
      break;
    case 'bm-del':
      ev.stopPropagation();
      await deleteBm(d.url);
      break;
    case 'bm-del-dlg': {
      const o = bmDlg?.oldUrl;
      closeBmDialog();
      if (o) await deleteBm(o);
      break;
    }
    case 'bm-save':
      saveBm();
      break;
    case 'bm-close':
      closeBmDialog();
      break;
    case 'pref-bar': {
      S.bar = !S.bar;
      try {
        await api.setPref('showBookmarkBar', S.bar);
      } catch {
        S.bar = !S.bar;
        toast('Konnte nicht gespeichert werden');
      }
      renderBar();
      renderSettingsView();
      break;
    }
    case 'rm-hist':
      await api.historyRemove(d.url);
      renderSide();
      break;
    case 'reset-browser': {
      const choice = await notifications.ask({
        kind: 'history',
        title: 'Luna auf Standard zurücksetzen?',
        message:
          'Farben, Seitenleiste, Mausgesten und Browser-Einstellungen werden zurückgesetzt. Danach lädt Luna die Oberfläche neu und zeigt die Ersteinrichtung.',
        note: 'Lesezeichen, Verlauf, Notizen, Chats, API-Schlüssel, Dienstverbindungen und Website-Anmeldungen bleiben erhalten. Dies ist keine vollständige Datenlöschung.',
        confirmLabel: 'Jetzt zurücksetzen',
      });
      if (choice !== 'confirm') break;
      a.disabled = true;
      try {
        await api.resetBrowserSettings();
        for (const key of [
          'fm-theme',
          'luna-color-theme',
          'luna-personalization',
          'luna-custom-icon',
          'luna-mcp-colors',
          'fm-side-cfg',
          'fm-side-w',
          'fm-sp-collapsed',
          'luna-chat-collapsed',
          'luna-onboarding-step',
        ])
          localStorage.removeItem(key);
        clearTimeout(sessT);
        location.reload();
      } catch (error) {
        a.disabled = false;
        toast('Zurücksetzen nicht abgeschlossen: ' + String(error));
      }
      break;
    }
    case 'clear-history':
      if (!(await confirmClearHistory())) break;
      await api.historyClear();
      S.histN = null;
      renderSide();
      startSig = '';
      renderStart();
      toast('Verlauf gelöscht');
      break;
    case 'spp-toggle': {
      const hide = !isPanelHidden(d.id);
      if (!setPanelHidden(d.id, hide)) toast('Mindestens ein Bereich muss sichtbar bleiben');
      renderSettingsView();
      renderSide();
      break;
    }
    case 'spp-up':
      movePanel(d.id, -1);
      renderSettingsView();
      renderSide();
      break;
    case 'spp-down':
      movePanel(d.id, 1);
      renderSettingsView();
      renderSide();
      break;
    case 'group-rename':
      renamePanelGroup(d.id, document.querySelector('[data-group-name="' + d.id + '"]').value);
      renderSettingsView();
      renderSide();
      break;
    case 'group-delete':
      removePanelGroup(d.id);
      renderSettingsView();
      renderSide();
      break;
    case 'spp-reset':
      resetPanels();
      renderSettingsView();
      renderSide();
      break;
    case 'clear-dl':
      S.downloads = [];
      await api.downloadsClear();
      renderSide();
      toast('Download-Liste geleert');
      break;
    case 'dl-open':
      api.openFile(d.path, false);
      break;
    case 'dl-reveal':
      api.openFile(d.path, true);
      break;
    case 'find-next':
      doFind(true);
      break;
    case 'find-prev':
      doFind(false);
      break;
    case 'find-close':
      closeFind();
      break;
    case 'cmd':
      runCmd(d.cmd);
      break;
    case 'pref-restore': {
      S.restore = !S.restore;
      try {
        await api.setPref('restoreSession', S.restore);
      } catch (e) {
        S.restore = !S.restore;
        toast('Konnte nicht gespeichert werden');
      }
      if (S.restore) {
        saveSession();
      } else {
        clearTimeout(sessT);
        api.sessionSave('');
      }
      renderSettingsView();
      break;
    }
    case 'cmd-toggle': {
      setCommandOn(d.id, !commandOn(d.id));
      // direkt am Element umschalten, damit die Seite nicht neu einblendet
      const on = commandOn(d.id),
        card = document.querySelector(`.cmd-set-card[data-id="${d.id}"]`);
      if (!card) {
        renderSettingsView();
        break;
      }
      card.classList.toggle('on', on);
      card.classList.toggle('off', !on);
      const sw = card.querySelector('.cmd-switch');
      sw.setAttribute('aria-checked', String(on));
      sw.querySelector('.cmd-switch-label').textContent = on ? 'An' : 'Aus';
      const total = document.querySelectorAll('.cmd-set-card').length;
      $('.cmd-count').textContent =
        `${document.querySelectorAll('.cmd-set-card.on').length} von ${total} Befehlen aktiv`;
      break;
    }
    case 'cmd-all':
      setAllCommands(d.on === '1');
      renderSettingsView();
      break;
    case 'cmd-page':
      cmdUI.openPage();
      break;
    case 'color-theme':
      localStorage.removeItem(MCP_COLORS);
      clearLegacyMCPColors();
      applyColorTheme(d.color, true);
      renderSettingsView();
      break;
    case 'theme':
      applyTheme(d.m, true);
      renderSettingsView();
      renderTabs();
      break;
    case 'settings':
      openSettings();
      break;
    case 'mcp-toggle': {
      a.disabled = true;
      try {
        settings.mcp = await api.mcpConfigure(!settings.mcp.running);
        renderSettingsView();
      } catch (e) {
        toast(String(e));
        await refreshMCPStatus();
      } finally {
        a.disabled = false;
      }
      break;
    }
    case 'mcp-copy':
      try {
        await api.mcpCopySetup();
        toast('Einrichtungsprompt kopiert');
      } catch (e) {
        toast(String(e));
      }
      break;
    case 'mcp-reset-colors':
      clearLegacyMCPColors();
      applyColorTheme('luna', true);
      renderSettingsView();
      toast('Luna-Farben wiederhergestellt');
      break;
    case 'tab-group-toggle':
      toggleTabGroup(d.group);
      break;
    case 'sonos-toggle':
    case 'sonos-select': {
      const ids = [...(settings.sonos.selected || [])];
      if (d.act === 'sonos-select') {
        const i = ids.indexOf(d.id);
        if (i >= 0) ids.splice(i, 1);
        else ids.push(d.id);
      }
      a.disabled = true;
      try {
        settings.sonos = await api.sonosConfigure(
          d.act === 'sonos-toggle' ? !settings.sonos.enabled : !!settings.sonos.enabled,
          ids,
        );
        updateSonosSettings($('#set-sonos'), settings.sonos);
      } catch (e) {
        toast(String(e));
      } finally {
        a.disabled = false;
      }
      break;
    }
    case 'pref-spotify-autonext': {
      a.disabled = true;
      try {
        const prefs = await api.setPref('spotifyAutoNextAlways', !S.autoNextAlways);
        S.autoNextAlways = !!prefs.spotifyAutoNextAlways;
      } catch {
        toast('Die Einstellung konnte nicht gespeichert werden.');
      } finally {
        a.disabled = false;
      }
      renderSettingsView();
      break;
    }
    case 'music-search-open':
      $('#url')._spotifySearch.open();
      break;
    case 'spotify-settings':
      openSettingsAt('spotify');
      break;
    case 'spotify-dashboard':
      newTab('https://developer.spotify.com/dashboard');
      break;
    case 'spotify-save':
    case 'spotify-connect':
    case 'spotify-disconnect': {
      a.disabled = true;
      try {
        if (d.act === 'spotify-save') {
          await api.spotifyAPIConfigure($('#spotifyClientID').value);
          $('#spotifyClientID').value = '';
        } else if (d.act === 'spotify-connect') await api.spotifyAPIConnect();
        else await api.spotifyAPIDisconnect();
        await refreshSpotifyAccount();
      } catch (e) {
        const msg = $('#spotifyAccountMessage');
        if (msg) msg.textContent = String(e?.message || e);
      } finally {
        a.disabled = false;
      }
      break;
    }
    case 'spotify-open': {
      a.disabled = true;
      try {
        await api.spotifyCommand('open', 0);
      } catch (e) {
        toast('Spotify konnte nicht geöffnet werden: ' + String(e?.message || e));
      } finally {
        a.disabled = false;
      }
      break;
    }
    case 'music-play': {
      a.disabled = true;
      try {
        await api.spotifyPlay(d.uri);
        toast('Wiedergabe an Spotify übergeben');
      } catch (e) {
        toast(String(e?.message || e));
      } finally {
        a.disabled = false;
      }
      break;
    }
    case 'set-nav':
      settings.section = d.s;
      renderSettingsView();
      $('#settingsView').scrollTop = 0;
      if (d.s === 'mcp')
        refreshChatStatus()
          .then(renderSettingsView)
          .catch((e) => toast(String(e)));
      if (d.s === 'spotify') {
        refreshSonos();
        refreshSpotifyAccount();
      }
      if (d.s === 'mcp') refreshMCPStatus();
      break;
    case 'setup':
      onboarding.start().catch((e) => toast(String(e)));
      break;
    case 'search-provider':
      await api.setPref('googleSearch', d.provider === 'google');
      S.googleSearch = d.provider === 'google';
      renderAll();
      break;
    case 'open-brave':
      newTab('https://brave.com/search/api/');
      break;
    case 'key-save':
      saveKey();
      break;
    case 'key-test':
      testKey();
      break;
    case 'key-clear':
      await api.keyClear();
      S.hasKey = false;
      settings.message = { text: 'Schlüssel entfernt.', kind: '' };
      renderSettingsView();
      startSig = '';
      renderStart();
      break;
  }
});
document.addEventListener('submit', (ev) => {
  if (ev.target.id === 'panelGroupForm') {
    ev.preventDefault();
    if (addPanelGroup($('#groupName').value)) {
      renderSettingsView();
      renderSide();
    }
    return;
  }
  if (ev.target.id !== 'startForm') return;
  ev.preventDefault();
  if ($('#startQ').dataset.spotifySearch === 'true') {
    $('#startQ')._spotifySearch.submit();
    return;
  }
  const q = $('#startQ').value;
  if (q.trim()) visit(cur(), q);
});
document.addEventListener('input', (ev) => {
  if (ev.target.id === 'startQ') armQuickSite(ev.target, ev);
});
document.addEventListener('mousedown', (ev) => {
  if (menuOpen && !ev.target.closest('#menu, #bMenu')) closeMenu();
});
document.addEventListener('keydown', (ev) => {
  if (onboarding?.active) return;
  if (bmDlg) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      closeBmDialog();
      return;
    }
    if (ev.key === 'Enter' && ['bmTitle', 'bmUrl'].includes(ev.target.id)) {
      ev.preventDefault();
      saveBm();
      return;
    }
  }
  const t = cur();
  if (
    t?.mode === 'search' &&
    t.provider !== 'spotify' &&
    t.data &&
    !['INPUT', 'TEXTAREA'].includes(ev.target.tagName) &&
    !ev.altKey
  ) {
    const n = (t.data.results || []).length;
    if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && n && t.filter === 'all') {
      ev.preventDefault();
      t.sel = Math.max(0, Math.min(n - 1, t.sel + (ev.key === 'ArrowDown' ? 1 : -1)));
      document
        .querySelectorAll('.sr')
        .forEach((el) => el.classList.toggle('sel', +el.dataset.i === t.sel));
      document.querySelector('.sr.sel')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else if (ev.key === 'Enter' && n && t.filter === 'all' && !(ev.metaKey || ev.ctrlKey)) {
      ev.preventDefault();
      const r = t.data.results[t.sel];
      if (r) openWeb(t, r.url);
    } else if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey) && n) {
      ev.preventDefault();
      const r = t.data.results[t.sel];
      if (r) {
        newTab(r.url, { background: true });
        toast('In neuem Tab geöffnet');
      }
    } else if (ev.key === '/') {
      ev.preventDefault();
      url.focus();
      url.select();
    }
  }
  if (ev.key === 'Enter' && ev.target.id === 'keyIn') {
    ev.preventDefault();
    saveKey();
  }
  if (ev.key === 'Escape') {
    closeMenu();
    if (S.findOpen && ev.target.id !== 'findIn') closeFind();
  }
});

/* ---------- Startbildschirm ---------- */
const splash = $('#splash');
const splashT0 = window.__browserSplashStarted ?? performance.now();
let splashDismissal = null;
const startupWatchdog = createLoadWatchdog(
  Math.max(0, 10000 - (performance.now() - splashT0)),
  () => {
    if (!splashing || S.onboardingComplete) return;
    showSlowSetup({
      hideNative() {
        api.show(-1);
        onboarding?.suspend(true);
      },
      resume() {
        onboarding?.suspend(false);
        if (!splashing) nativeShow(pendingShow);
      },
    });
  },
);
if (IS_NATIVE) startupWatchdog.start();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitLoaded(t) {
  // die aktive Seite lädt schon im Hintergrund; kurz warten, damit sie beim Öffnen fertig ist
  while (t && t.mode === 'web' && t.loading) await wait(80);
}
function dismissSplash() {
  if (splashDismissal) return splashDismissal;
  splashDismissal = (async () => {
    await wait(Math.max(0, 3000 - (performance.now() - splashT0)));
    startupWatchdog.stop();
    splashing = false;
    nativeShow(pendingShow);
    splash.setAttribute('aria-busy', 'false');
    splash.classList.add('out');
    setTimeout(() => splash.classList.add('gone'), 340);
    if (cur()?.mode === 'start') setTimeout(() => $('#url').focus(), 50);
  })();
  return splashDismissal;
}

onboarding = createOnboarding({
  async refreshSearch() {
    S.hasKey = await api.keyStatus();
    S.googleSearch = !!(await api.prefs()).googleSearch;
  },
  onFinish() {
    refreshChatStatus();
    const t = cur();
    if (t?.native && t.mode === 'web') nativeShow(t.id);
    else nativeShow(-1);
    renderAll();
  },
});

/* ---------- Start ---------- */
(async function init() {
  applyTheme(themeMode());
  // Die Icon-Sequenz läuft unabhängig; geschlossen wird erst nach dem tatsächlichen Start.
  const step = (label, frac, work) => (work ? work() : Promise.resolve());
  try {
    [S.hasKey, S.restore, S.bar, S.gesture] = await step(
      'Einstellungen laden …',
      0.14,
      async () => {
        await loadGestures();
        const p = await api.prefs();
        S.autoNextAlways = !!p.spotifyAutoNextAlways;
        S.googleSearch = !!p.googleSearch;
        S.onboardingComplete = !!p.onboardingComplete;
        if (S.onboardingComplete) startupWatchdog.stop();
        return [
          await api.keyStatus(),
          !!p.restoreSession,
          p.showBookmarkBar !== false,
          p.circleGesture !== false,
        ];
      },
    );
    let noteList;
    [S.bookmarks, S.downloads, noteList] = await step('Lesezeichen & Verlauf …', 0.36, () =>
      Promise.all([api.bookmarks(), api.downloads(), api.notes()]),
    );
    S.notes = Object.fromEntries((noteList || []).map((n) => [n.key, n]));
    S.downloads = (S.downloads || []).map((d, i) => ({
      id: -i - 1,
      name: d.name,
      path: d.path,
      state: 'done',
      received: 0,
      total: 0,
    }));
    S.bookmarks = S.bookmarks || [];
    renderBar();
    // Spotify-Overlay deckt das Fenster ab: native Seiten dafür kurz ausblenden.
    setHooks({
      popOpen: () => cover(true),
      popClose: () => cover(false),
      open() {
        nativeShow(-1);
      },
      close() {
        const t = cur();
        if (t && t.native && t.mode === 'web') nativeShow(t.id);
      },
    });
    // Optional Windows media-session discovery must never gate first-run setup.
    if (WINDOWS)
      initSpotify().catch((error) => console.warn('Spotify ist noch nicht bereit:', error));
    else await step('Spotify verbinden …', 0.58, () => initSpotify());
    await step(
      S.restore ? 'Tabs wiederherstellen …' : 'Startseite vorbereiten …',
      0.8,
      async () => {
        await restoreSession();
        updateFrame();
      },
    );
    if (S.onboardingComplete) await step('Seite wird geladen …', 0.94, () => waitLoaded(cur()));
  } catch (e) {
    console.error(e);
  }
  await dismissSplash();
  if (IS_NATIVE && !S.onboardingComplete) onboarding.start().catch((e) => toast(String(e)));
})();

document.addEventListener('change', (ev) => {
  if (!ev.target.matches('[data-panel-parent]')) return;
  if (!assignPanel(ev.target.dataset.panelParent, ev.target.value))
    toast('Ein Menü kann nicht in sich selbst liegen.');
  renderSettingsView();
  renderSide();
});

/* ---------- MCP: explizite Browseraktionen, keine Ausführung fremden Codes ---------- */
function mcpState() {
  return {
    ready: !splashing,
    gestures: gestureState(),
    active_tab: S.active,
    tabs: S.tabs.map((t) => ({
      id: t.id,
      title: t.title,
      url: t.url,
      mode: t.mode,
      loading: !!t.loading,
      group: t.group || '',
    })),
    groups: S.groups,
    theme: themeMode(),
    color_theme: colorTheme(),
    color_themes: COLOR_THEMES.map(([id, name]) => ({ id, name })),
    preferences: { showBookmarkBar: S.bar, restoreSession: S.restore, circleGesture: S.gesture },
    sidebar: {
      open: S.side,
      active: activePanel(),
      panels: allPanels().map((p) => ({
        id: p.id,
        title: p.title,
        parent: p.parent || '',
        custom: !!p.custom,
        hidden: isPanelHidden(p.id),
      })),
    },
  };
}
function mcpTab(id) {
  const t = id === undefined ? cur() : S.tabs.find((t) => t.id === id);
  if (!t) throw Error('Tab nicht gefunden.');
  return t;
}
function mcpURL(url) {
  if (typeof url !== 'string' || !url.trim()) throw Error('URL ist erforderlich.');
  if (!/^(https?:\/\/|about:blank$|chat:$|search:|spotify-search:)/i.test(url))
    throw Error('Nur HTTP(S), about:blank oder interne Suchadressen sind erlaubt.');
  return url;
}
const MCP_COLORS = 'luna-mcp-colors';
function clearLegacyMCPColors() {
  localStorage.removeItem(MCP_COLORS);
  for (const name of [
    '--acc',
    '--link',
    '--desk',
    '--body',
    '--panel',
    '--card',
    '--input',
    '--ink',
    '--ink2',
  ])
    document.documentElement.style.removeProperty(name);
}
clearLegacyMCPColors();
async function runMCPCommand(name, a) {
  if (name === 'browser_state') return mcpState();
  if (splashing) throw Error('Luna startet noch. Bitte kurz warten.');
  switch (name) {
    case 'browser_tab': {
      if (a.domain !== undefined) {
        if (a.action !== 'close' || a.tab_id !== undefined)
          throw Error('Domain nur zum Schließen ohne Tab-ID angeben.');
        const domain = tabDomain(a.domain);
        const targets = S.tabs.filter((t) => tabMatchesDomain(t.url, domain)).map((t) => t.id);
        for (const id of targets) {
          if (S.tabs.some((t) => t.id === id)) await closeTab(id);
        }
        return { ...mcpState(), closed_tabs: targets.length, closed_domain: domain };
      }
      if (a.action === 'open') {
        newTab(a.url ? mcpURL(a.url) : '', { background: !!a.background });
        return mcpState();
      }
      const t = mcpTab(a.tab_id);
      switch (a.action) {
        case 'navigate':
          activate(t.id);
          visit(t, mcpURL(a.url));
          break;
        case 'activate':
          activate(t.id);
          break;
        case 'close':
          await closeTab(t.id);
          break;
        case 'back':
          activate(t.id);
          goBack(t);
          break;
        case 'forward':
          activate(t.id);
          goForward(t);
          break;
        case 'reload':
          if (t.mode === 'web') await api.reload(t.id);
          else if (t.mode === 'search') await loadEntry(t, true);
          break;
        case 'stop':
          if (t.native) await api.stop(t.id);
          break;
        case 'zoom':
          if (!Number.isFinite(a.zoom)) throw Error('zoom ist erforderlich.');
          t.zoom = Math.max(0.5, Math.min(3, a.zoom));
          if (t.native) await api.zoom(t.id, t.zoom);
          break;
        default:
          throw Error('Unbekannte Tab-Aktion.');
      }
      return mcpState();
    }
    case 'browser_tab_group': {
      if (a.action === 'create') {
        const id = createTabGroup(a.title, mcpTab(a.tab_id).id);
        return { group_id: id, ...mcpState() };
      }
      if (!S.groups[a.group_id]) throw Error('Gruppe nicht gefunden.');
      if (a.action === 'rename') {
        if (!a.title?.trim()) throw Error('Titel fehlt.');
        S.groups[a.group_id].title = a.title.trim().slice(0, 40);
      } else if (a.action === 'remove') removeTabGroup(a.group_id);
      else if (a.action === 'assign') moveTab(mcpTab(a.tab_id).id, null, a.group_id);
      else if (a.action === 'toggle') toggleTabGroup(a.group_id);
      renderTabs();
      saveSession();
      return mcpState();
    }
    case 'browser_tab_move': {
      moveTab(mcpTab(a.tab_id).id, a.before_tab_id ?? null, a.group_id ?? '');
      return mcpState();
    }
    case 'browser_page': {
      const t = mcpTab(a.tab_id);
      if (S.active !== t.id) activate(t.id);
      if (a.action === 'wait_ready') {
        const end = Date.now() + 15000;
        while (t.loading && Date.now() < end) await new Promise((r) => setTimeout(r, 100));
        if (t.loading) throw Error('Seite lädt noch.');
        return mcpState();
      }
      if (a.action === 'find') {
        if (!t.native) throw Error('Textsuche ist für Webseiten verfügbar.');
        await api.find(t.id, String(a.text || ''), true);
        return { ok: true };
      }
      if (t.mode === 'web' && t.native) return api.mcpPage(t.id, a);
      return lunaPageAction(a, $('#page'));
    }
    case 'capture_target': {
      const t = mcpTab(a.tab_id);
      if (S.active !== t.id) activate(t.id);
      return { id: t.native && t.mode === 'web' ? t.id : -1 };
    }
    case 'browser_settings':
      openSettingsAt(a.section);
      return mcpState();
    case 'browser_gestures':
      return gestures.configure(a);
    case 'browser_customize': {
      if ('colors' in a)
        throw Error(
          'Freie Farben sind nicht erlaubt. Bitte color_theme aus den eingebauten Farbthemen wählen.',
        );
      if (a.color_theme !== undefined && !COLOR_THEMES.some(([id]) => id === a.color_theme))
        throw Error('Unbekanntes Farbthema. Bitte eine eingebaute Farbwelt wählen.');
      if (a.theme) applyTheme(a.theme, true);
      if (a.color_theme !== undefined || a.reset_colors) {
        clearLegacyMCPColors();
        applyColorTheme(a.color_theme ?? 'luna', true);
      }
      if (a.sidebar_width) {
        document.documentElement.style.setProperty('--sidew', a.sidebar_width + 'px');
        localStorage.setItem('fm-side-w', String(a.sidebar_width));
      }
      if (a.preferences) {
        for (const [key, value] of Object.entries(a.preferences)) {
          await api.setPref(key, value);
          if (key === 'showBookmarkBar') S.bar = value;
          if (key === 'restoreSession') S.restore = value;
          if (key === 'circleGesture') {
            S.gesture = value;
            await api.setGesture(value);
          }
        }
        saveSession();
      }
      if (a.panel_action) {
        const p = allPanels().find((p) => p.id === a.id);
        if (!['create_group', 'reset', 'close'].includes(a.panel_action) && !p)
          throw Error('Menü-ID nicht gefunden.');
        switch (a.panel_action) {
          case 'create_group':
            if (!addPanelGroup(String(a.title || ''))) throw Error('Menütitel ist erforderlich.');
            break;
          case 'rename_group':
            if (!p.custom || !a.title?.trim()) throw Error('Eigenes Menü und Titel erforderlich.');
            renamePanelGroup(a.id, a.title);
            break;
          case 'delete_group':
            if (!p.custom) throw Error('Nur eigene Menüs können gelöscht werden.');
            removePanelGroup(a.id);
            break;
          case 'assign':
            if (!assignPanel(a.id, a.parent || '')) throw Error('Ungültige Menüzuordnung.');
            break;
          case 'hide':
            if (!setPanelHidden(a.id, true))
              throw Error('Mindestens ein Menü muss sichtbar bleiben.');
            break;
          case 'show':
            setPanelHidden(a.id, false);
            break;
          case 'move':
            if (![-1, 1].includes(a.direction)) throw Error('direction muss -1 oder 1 sein.');
            movePanel(a.id, a.direction);
            break;
          case 'open':
            openSide(a.id);
            break;
          case 'close':
            closeSide();
            break;
          case 'reset':
            resetPanels();
            break;
        }
      }
      renderAll();
      return mcpState();
    }
    case 'browser_bookmarks': {
      if (a.action === 'list') return api.bookmarks();
      const url = mcpURL(a.url);
      if (a.action === 'edit')
        S.bookmarks = await api.editBookmark(mcpURL(a.old_url), url, String(a.title || ''));
      else S.bookmarks = await api.setBookmark(url, String(a.title || url), a.action === 'add');
      refreshBookmarks();
      return S.bookmarks;
    }
    case 'browser_notes': {
      if (a.action === 'list') return api.notes();
      if (!a.key || typeof a.text !== 'string') throw Error('key und text sind erforderlich.');
      const notes = await api.setNote(a.key, String(a.title || a.key), a.text);
      S.notes = Object.fromEntries(notes.map((n) => [n.key, n]));
      renderSide();
      return notes;
    }
    case 'browser_history':
      if (a.action === 'clear') await api.historyClear();
      else if (a.action === 'remove') {
        if (!a.url) throw Error('url ist erforderlich.');
        await api.historyRemove(a.url);
      }
      startSig = '';
      renderStart();
      if (S.side) renderSide();
      return api.history(a.query || '', a.limit || 50);
    case 'browser_downloads':
      if (a.action === 'clear') {
        await api.downloadsClear();
        S.downloads = [];
        renderSide();
      }
      return api.downloads();
    case 'browser_search': {
      if (!a.query?.trim()) throw Error('Suchbegriff fehlt.');
      if (a.open_results) {
        newTab(
          (a.provider === 'spotify' ? 'spotify-search:' : 'search:') + encodeURIComponent(a.query),
        );
        return mcpState();
      }
      return a.provider === 'spotify' ? api.spotifySearch(a.query) : api.search(a.query, 0);
    }
    default:
      throw Error('Unbekanntes MCP-Werkzeug.');
  }
}
let mcpCommandQueue = Promise.resolve();
api.onMCP((command) => {
  mcpCommandQueue = mcpCommandQueue
    .catch(() => {})
    .then(async () => {
      try {
        if (!(await api.mcpCommandActive(command.id))) return;
        const result = await runMCPCommand(command.name, command.args || {});
        await api.mcpReply(command.id, result, '');
      } catch (e) {
        await api.mcpReply(command.id, null, String(e?.message || e));
      }
    });
});

/* ---------- Tab-Gruppen und Drag & Drop ---------- */
const { normalizeTabOrder, createTabGroup, removeTabGroup, toggleTabGroup, moveTab } =
  initTabGroups({
    state: S,
    requireTab: mcpTab,
    renderTabs,
    saveSession,
    cover,
    showCtx,
    tabById,
    closeTab,
  });

const enqueueMusic = initAutoNext({
  cover,
  toast,
  notifications,
  onPreferenceChange: (value) => {
    S.autoNextAlways = value;
    if (cur()?.mode === 'settings') renderSettingsView();
  },
});
initQueueDrop({ enqueue: enqueueMusic, toast });

initMusicPanel({
  enqueue: enqueueMusic,
  registerPanel,
  activePanel,
  isOpen: () => S.side,
  toast,
  settings: () => openSettingsAt('spotify'),
});

const gestures = initGestures({
  toast,
  render: renderSettingsView,
  actions: {
    notes: toggleNotes,
    screenshot: takeShot,
    music: () => $('#url')._spotifySearch.open(),
    settings: () => openSettingsAt('gestures'),
    new_tab: () => newTab(),
    close_tab: () => cur() && closeTab(cur().id),
    back: () => cur() && goBack(cur()),
    forward: () => cur() && goForward(cur()),
    reload: () => $('#bReload').click(),
    bookmarks: () => openSide('bookmarks'),
    history: () => openSide('history'),
    downloads: () => openSide('downloads'),
    open_url: (value) => newTab(value),
  },
});

const chatUI = initChat({
  openSettings: () => openSettingsAt('mcp'),
  renderSettings: renderSettingsView,
  toast,
  notifications,
  openURL: (url) => newTab(url),
});

wirePersonalSettings({
  refresh: renderSettingsView,
  setIcon: setCustomIcon,
  resetIcon: resetCustomIcon,
  toast,
});
applyBrowserName();
window.addEventListener('luna-personalization', () => {
  applyBrowserName();
  renderStart();
  renderSearchView();
});
