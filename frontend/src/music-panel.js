import * as api from './api.js';
import { lunaMusicWordmark } from './branding.js';

// Luna Music: Spotify-Fernbedienung und Suche als Seitenpanel.
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const time = (s) => {
  s = Math.max(0, Number(s) || 0);
  return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
};
const imgUrl = (u) => {
  try {
    return new URL(u).protocol === 'https:' ? u : '';
  } catch {
    return '';
  }
};
const pickImg = (list) => imgUrl((list?.length ? list[Math.min(1, list.length - 1)] : null)?.url);

// fill: true = ausgefüllte Form, sonst Linienicon
const GLYPH = {
  play: ['M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z', 1],
  pause: ['M7 5h3.5v14H7zM13.5 5H17v14h-3.5z', 1],
  prev: [
    'M6 5h2v14H6zM19 5.5v13a1 1 0 0 1-1.55.84L8.4 12.84a1 1 0 0 1 0-1.68l9.05-6.5A1 1 0 0 1 19 5.5z',
    1,
  ],
  next: [
    'M16 5h2v14h-2zM5 5.5v13a1 1 0 0 0 1.55.84l9.05-6.5a1 1 0 0 0 0-1.68L6.55 4.66A1 1 0 0 0 5 5.5z',
    1,
  ],
  shuffle: [
    'M3 7h3.5c2 0 3.2.9 4.3 2.4l2.4 3.2c1.1 1.5 2.3 2.4 4.3 2.4H21M3 17h3.5c2 0 3.2-.9 4.3-2.4M13.2 9.4C14.3 7.9 15.5 7 17.5 7H21M18 4l3 3-3 3M18 14l3 3-3 3',
    0,
  ],
  repeat: ['M4 11V9a3 3 0 0 1 3-3h13M17 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H4M7 21l-3-3 3-3', 0],
  add: ['M12 5v14M5 12h14', 0],
  queue: ['M4 6h11M4 11h11M4 16h6M17 14v6M14 17h6', 0],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.5-4.5', 0],
  x: ['M6 6l12 12M18 6 6 18', 0],
  gear: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    0,
  ],
  refresh: [
    'M20 11a8 8 0 0 0-14.5-4.2L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.5 4.2L20 15.5M20 20v-4.5h-4.5',
    0,
  ],
  vol0: ['M11 5 6 9H3v6h3l5 4zM16 9.5l5 5M21 9.5l-5 5', 0],
  vol1: ['M11 5 6 9H3v6h3l5 4zM15.5 9a4.5 4.5 0 0 1 0 6', 0],
  vol2: ['M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13', 0],
  note: ['M9 18V5.5l11-2V16M9 9.5l11-2', 0],
};
const icon = (n, s = 20) => {
  const [d, fill] = GLYPH[n];
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true"><path d="${d}"/>${n === 'note' ? '<circle cx="6" cy="18" r="3" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="17" cy="16" r="3" fill="none" stroke="currentColor" stroke-width="1.9"/>' : ''}</svg>`;
};
const cover = (url, kind = 'sq') =>
  url
    ? `<span class="lm-art ${kind}"><img src="${esc(url)}" alt="" draggable="false"></span>`
    : `<span class="lm-art ${kind} ph">${icon('note', 20)}</span>`;
const btn = (action, label, body, extra = '') =>
  `<button type="button" data-music="${action}" aria-label="${esc(label)}" title="${esc(label)}" ${extra}>${body}</button>`;

export function initMusicPanel({ enqueue, registerPanel, activePanel, isOpen, toast, settings }) {
  let section = 'search',
    query = '',
    result = null,
    error = '',
    loading = false,
    version = 0;
  let state = {},
    queue = null,
    queueError = '',
    queueBusy = false,
    lastQueue = 0,
    pollBusy = false,
    timer;
  let lastArt = null,
    dragging = null;

  const root = () => document.getElementById('lunaMusicPanel');
  const q = (sel) => root()?.querySelector(sel);
  const visible = () => isOpen() && activePanel() === 'spotify' && root();

  /* ── Player ─────────────────────────────────────────────── */
  function playerHTML() {
    return `<div class="lm-bg"></div>
      <input class="lm-seek" aria-label="Songposition" data-music-range="seek" type="range" min="0" max="1" value="0" step="1">
      <div class="lm-mini">
        <div class="lm-cover"><div class="lm-cover-in"></div></div>
        <div class="lm-meta"><b class="lm-title"></b><span class="lm-artist"></span></div>
        <div class="lm-controls">
          ${btn('previous', 'Vorheriger Titel', icon('prev', 17), 'class="lm-skip"')}
          ${btn('playpause', 'Abspielen / Pause', '', 'class="lm-play"')}
          ${btn('next', 'Nächster Titel', icon('next', 17), 'class="lm-skip"')}
        </div>
      </div>`;
  }
  function player() {
    const r = root();
    if (!r) return;
    const on = ['playing', 'paused'].includes(state.status);
    const art = imgUrl(state.artwork);
    const card = q('.lm-player');
    card.classList.toggle('idle', !on);
    card.classList.toggle('is-playing', state.status === 'playing');
    if (art !== lastArt) {
      lastArt = art;
      q('.lm-bg').style.backgroundImage = art ? `url("${art}")` : '';
      q('.lm-cover-in').innerHTML = art
        ? `<img src="${esc(art)}" alt="" draggable="false">`
        : `<div class="ph">${icon('note', 18)}</div>`;
    }
    q('.lm-title').textContent = state.title || (on ? '' : 'Nichts läuft gerade');
    q('.lm-artist').textContent = on ? state.artist || '' : state.message || 'Spotify starten';
    const seek = q('[data-music-range=seek]');
    if (dragging !== 'seek') {
      seek.max = state.duration || 1;
      seek.value = state.position || 0;
      seek.disabled = !on;
      seek.style.setProperty('--p', ((state.position || 0) / (state.duration || 1)) * 100 + '%');
    }
    const pp = q('.lm-play');
    pp.dataset.music = on ? 'playpause' : 'open';
    pp.title = pp.ariaLabel = on
      ? state.status === 'playing'
        ? 'Pause'
        : 'Abspielen'
      : 'Spotify starten';
    const wantIcon = state.status === 'playing' ? 'pause' : 'play';
    if (pp.dataset.ic !== wantIcon) {
      pp.dataset.ic = wantIcon;
      pp.innerHTML = icon(wantIcon, 20);
    }
  }

  /* ── Listen ─────────────────────────────────────────────── */
  function track(t, { add = true, now = false } = {}) {
    const art = pickImg(t.album?.images || t.images);
    const sub = (t.artists || []).map((a) => a.name).join(', ') || t.show?.name || 'Spotify';
    return `<div class="lm-row${now ? ' now' : ''}" ${add ? `draggable="true" data-queue-uri="${esc(t.uri)}" data-queue-title="${esc(t.name)}"` : ''}>
      ${cover(art)}
      <div class="lm-rt"><b>${esc(t.name)}</b><small>${esc(sub)}</small></div>
      <div class="lm-ra">
        ${add ? btn('add', 'Zur Warteschlange: ' + t.name, icon('add', 17), `data-uri="${esc(t.uri)}" data-title="${esc(t.name)}"`) : ''}
        ${btn('play', 'Abspielen: ' + t.name, icon('play', 15), `class="go" data-uri="${esc(t.uri)}"`)}
      </div></div>`;
  }
  function card(it, round) {
    const sub = round ? 'Künstler' : (it.artists || []).map((a) => a.name).join(', ');
    return `<button type="button" class="lm-card${round ? ' round' : ''}" data-music="play" data-uri="${esc(it.uri)}" title="Abspielen: ${esc(it.name)}">
      ${cover(pickImg(it.images), round ? 'rd' : 'sq')}<b>${esc(it.name)}</b><small>${esc(sub)}</small></button>`;
  }
  const empty = (ic, h, p, extra = '') =>
    `<div class="lm-empty"><span class="lm-eic">${icon(ic, 26)}</span><b>${h}</b><p>${p}</p>${extra}</div>`;
  const skeleton = () =>
    `<div class="lm-skel">${'<div><i></i><span><u></u><u></u></span></div>'.repeat(5)}</div>`;

  function results() {
    const el = q('.lm-results');
    if (!el) return;
    let html;
    if (loading) html = skeleton();
    else if (error)
      html = empty(
        'x',
        'Das hat nicht geklappt',
        esc(error),
        btn('settings', 'Spotify verbinden', 'Verbindung prüfen', 'class="lm-cta"'),
      );
    else if (!result)
      html = empty(
        'search',
        'Was möchtest du hören?',
        'Suche nach Songs, Künstlern und Alben. Mit + legst du einen Song in die Warteschlange, per Ziehen geht es auch.',
      );
    else {
      const t = result.tracks?.items || [],
        a = result.artists?.items || [],
        al = result.albums?.items || [];
      html =
        (t.length ? `<h3>Songs</h3>${t.map((x) => track(x)).join('')}` : '') +
        (a.length
          ? `<h3>Künstler</h3><div class="lm-rail">${a.map((x) => card(x, true)).join('')}</div>`
          : '') +
        (al.length
          ? `<h3>Alben</h3><div class="lm-rail">${al.map((x) => card(x, false)).join('')}</div>`
          : '');
      if (!html) html = empty('search', 'Keine Treffer', 'Versuche einen anderen Suchbegriff.');
    }
    if (el.innerHTML !== html) el.innerHTML = html;
  }
  function queueView() {
    const el = q('.lm-queue-list');
    if (!el) return;
    let html;
    if (queueError)
      html = empty(
        'x',
        'Warteschlange nicht verfügbar',
        esc(queueError),
        btn('settings', 'Spotify verbinden', 'Spotify verbinden', 'class="lm-cta"'),
      );
    else if (!queue) html = skeleton();
    else {
      const n = queue.queue?.length || 0;
      html =
        (queue.currently_playing
          ? `<h3>Läuft gerade</h3>${track(queue.currently_playing, { add: false, now: true })}`
          : '') +
        `<h3>Als Nächstes <em>${n}</em></h3>` +
        (n
          ? queue.queue.map((x) => track(x, { add: false })).join('')
          : empty('queue', 'Warteschlange ist leer', 'Füge über die Suche Songs hinzu.')) +
        '<p class="lm-note">Die Reihenfolge bestimmt Spotify. Entfernen und Umsortieren bietet die Spotify-API nicht an.</p>';
    }
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  async function refreshQueue() {
    if (queueBusy) return;
    queueBusy = true;
    lastQueue = Date.now();
    try {
      queue = await api.spotifyGetQueue();
      queueError = '';
    } catch (e) {
      queueError = String(e?.message || e);
    } finally {
      queueBusy = false;
      if (visible() && section === 'queue') queueView();
    }
  }
  async function poll() {
    if (!visible() || pollBusy || document.hidden) return;
    pollBusy = true;
    try {
      state = (await api.spotifyState()) || {};
      if (visible()) player();
      if (section === 'queue' && Date.now() - lastQueue > 5000) await refreshQueue();
    } finally {
      pollBusy = false;
    }
  }
  function tabs() {
    const r = root();
    if (!r) return;
    r.dataset.section = section;
    r.querySelectorAll('[data-music-tab]').forEach((b) =>
      b.setAttribute('aria-selected', b.dataset.musicTab === section),
    );
    r.querySelector('.lm-search-area').hidden = section !== 'search';
    r.querySelector('.lm-queue-area').hidden = section !== 'queue';
    if (section === 'queue') refreshQueue();
  }
  function mount() {
    if (!visible()) return;
    q('.lm-player').innerHTML = playerHTML();
    lastArt = null;
    const inp = q('.lm-search input');
    inp.value = query;
    q('.lm-search').classList.toggle('has', !!query);
    tabs();
    player();
    results();
    queueView();
    poll().catch(() => {});
  }

  registerPanel({
    id: 'spotify',
    title: 'Luna Music',
    desc: 'Spotify steuern und durchsuchen',
    order: 50,
    icon: '<path d="M9 18V5l12-2v13M9 9l12-2"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    keep: () => !!root(),
    render: () => {
      requestAnimationFrame(mount);
      return `<div id="lunaMusicPanel" data-section="${section}">
        <header class="lm-header">${lunaMusicWordmark}${btn('settings', 'Spotify-Einstellungen', icon('gear', 17), 'class="lm-gear"')}</header>
        <nav class="lm-tabs" role="tablist" aria-label="Musik">
          <i class="lm-pill"></i>
          <button type="button" role="tab" data-music-tab="search">${icon('search', 15)}Suche</button>
          <button type="button" role="tab" data-music-tab="queue">${icon('queue', 15)}Warteschlange</button>
        </nav>
        <div class="lm-scroll">
        <div class="lm-search-area">
          <label class="lm-search">${icon('search', 16)}
            <input type="text" placeholder="Songs, Künstler, Alben …" aria-label="Spotify durchsuchen" maxlength="500" autocomplete="off" spellcheck="false">
            <button type="button" class="lm-clear" data-music="clear" aria-label="Eingabe löschen">${icon('x', 14)}</button></label>
          <div class="lm-results"></div>
        </div>
        <div class="lm-queue-area" hidden>
          <div class="lm-qbar">${btn('refresh', 'Aktualisieren', icon('refresh', 15) + 'Aktualisieren')}</div>
          <div class="lm-queue-list"></div>
        </div>
        </div>
        <section class="lm-player"></section>
      </div>`;
    },
  });

  /* ── Events ─────────────────────────────────────────────── */
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('#lunaMusicPanel [data-music-range]')) {
      t.style.setProperty('--p', (t.value / (t.max || 1)) * 100 + '%');
      return;
    }
    if (!t.matches('#lunaMusicPanel .lm-search input')) return;
    query = t.value;
    q('.lm-search').classList.toggle('has', !!query);
    const token = ++version;
    clearTimeout(timer);
    loading = !!query.trim();
    error = '';
    result = null;
    results();
    if (!loading) return;
    timer = setTimeout(async () => {
      try {
        const data = await api.spotifySearch(query.trim());
        if (token === version) result = data;
      } catch (err) {
        if (token === version) error = String(err?.message || err);
      } finally {
        if (token === version) {
          loading = false;
          results();
        }
      }
    }, 350);
  });
  document.addEventListener('pointerdown', (e) => {
    const r = e.target.closest?.('#lunaMusicPanel [data-music-range]');
    if (r) dragging = r.dataset.musicRange;
  });
  document.addEventListener('pointerup', () => {
    setTimeout(() => {
      dragging = null;
    }, 250);
  });
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('#lunaMusicPanel button');
    if (!el) return;
    if (el.dataset.musicTab) {
      section = el.dataset.musicTab;
      tabs();
      return;
    }
    const action = el.dataset.music;
    if (!action) return;
    if (action === 'settings') {
      settings();
      return;
    }
    if (action === 'refresh') {
      refreshQueue();
      return;
    }
    if (action === 'clear') {
      const i = q('.lm-search input');
      i.value = '';
      i.dispatchEvent(new Event('input', { bubbles: true }));
      i.focus();
      return;
    }
    el.disabled = true;
    try {
      if (action === 'play') await api.spotifyPlay(el.dataset.uri);
      else if (action === 'add') {
        await enqueue(el.dataset.uri, el.dataset.title);
        lastQueue = 0;
      } else await api.spotifyCommand(action, 0);
      setTimeout(poll, 400);
    } catch (err) {
      toast(String(err?.message || err), 10000);
    } finally {
      el.disabled = false;
    }
  });
  document.addEventListener('change', async (e) => {
    const action = e.target.dataset?.musicRange;
    if (!action) return;
    try {
      await api.spotifyCommand(action, Number(e.target.value));
      setTimeout(poll, 300);
    } catch (err) {
      toast(String(err?.message || err), 10000);
    }
  });
  setInterval(() => poll().catch(() => {}), 2000);
}
