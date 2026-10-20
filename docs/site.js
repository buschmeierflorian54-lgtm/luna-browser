/* Luna Browser – Webseite
   Farbwelten wie im Browser (gleiche Formeln wie color-themes.js), Hell/Dunkel,
   kleine Live-Demos und ein Installationsdialog. */
(() => {
  'use strict';
  const { t, language } = window.lunaI18n;
  const locale = language === 'de' ? 'de-DE' : 'en-US';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  /* ---------- Farbwelten ---------- */
  const THEMES = [
    ['luna', 'Luna Rosé', 325, 38], ['lavender', t('Lavendel'), 265, 42], ['ocean', t('Ozean'), 210, 55],
    ['mint', t('Minze'), 163, 40], ['forest', t('Wald'), 140, 30], ['sand', 'Sand', 38, 42],
    ['peach', t('Pfirsich'), 22, 58], ['cherry', t('Kirschblüte'), 350, 46], ['arctic', t('Arktis'), 188, 43],
    ['graphite', t('Graphit'), 220, 5],
  ];
  // handabgestimmte Originalpalette von Luna Rosé
  const LUNA = {
    light: { desk: '#efb6d5', body: '#f3e1ec', panel: '#fbf2f7', card: '#ffffff', hover: '#ead0df', soft: '#f7e9f1', line: '#ecd3e2', line3: '#e2c6d6', ink: '#3a2433', ink2: '#4a3042', mute2: '#6f5264', mute: '#8a6c7e', acc: '#a24d84', 'acc-l': '#d889b8', pri: '#3a2433', 'pri-fg': '#fbeef6', tab: 'rgba(251,238,246,.55)' },
    dark: { desk: '#2b1626', body: '#251621', panel: '#1c1119', card: '#2d1b28', hover: '#3a2434', soft: '#2f1e29', line: '#43293a', line3: '#563548', ink: '#fbeef6', ink2: '#e6d2de', mute2: '#b99dae', mute: '#a98d9e', acc: '#d889b8', 'acc-l': '#f4a9d4', pri: '#fbeef6', 'pri-fg': '#2a1621', tab: 'rgba(255,255,255,.06)' },
  };
  function palette(id, dark) {
    const t = THEMES.find((x) => x[0] === id) || THEMES[0];
    const [, , h, s] = t;
    const c = (l, sat = s) => `hsl(${h} ${sat}% ${l}%)`;
    let v;
    if (id === 'luna') v = { ...LUNA[dark ? 'dark' : 'light'] };
    else if (dark) v = { desk: c(14), body: c(11, 22), panel: c(9, 20), card: c(16, 22), hover: c(22, 24), soft: c(18, 22), line: c(25, 22), line3: c(33, 24), ink: c(96, 24), ink2: c(88, 22), mute2: c(74, 18), mute: c(67, 16), acc: c(73), 'acc-l': c(80), pri: c(94, 25), 'pri-fg': c(12, 25), tab: c(18, 22) };
    else v = { desk: c(83), body: c(92, 30), panel: c(97, 25), card: '#ffffff', hover: c(87, 30), soft: c(94, 25), line: c(86, 24), line3: c(79, 25), ink: c(18, 28), ink2: c(25, 26), mute2: c(37, 20), mute: c(44, 18), acc: c(38), 'acc-l': c(62), pri: c(20, 30), 'pri-fg': '#ffffff', tab: c(90, 30) };
    v.tile = c(dark ? 50 : 40, Math.max(s, 8));
    const l = dark ? 35 : 76;
    v.a1 = `hsl(${h} ${s}% ${l}%)`; v.a2 = `hsl(${h + 12} ${s}% ${l}%)`; v.a3 = `hsl(${h + 24} ${s}% ${l}%)`;
    return { v, h, s };
  }
  const root = document.documentElement;
  const sysDark = matchMedia('(prefers-color-scheme: dark)');
  let themeId = store.get('luna-site-theme');
  if (!THEMES.some((t) => t[0] === themeId)) themeId = 'luna';
  let mode = store.get('luna-site-mode') || (sysDark.matches ? 'dark' : 'light');
  let trailColor = '#a24d84';

  function apply(persist) {
    const dark = mode === 'dark';
    const { v, h, s } = palette(themeId, dark);
    root.dataset.mode = mode;
    root.style.colorScheme = dark ? 'dark' : 'light';
    root.style.setProperty('--h', h); root.style.setProperty('--s', s);
    for (const [k, val] of Object.entries(v)) root.style.setProperty(`--${k}`, val);
    trailColor = v.acc;
    const meta = $('meta[name=theme-color]'); if (meta) meta.content = v.body;
    $$('[data-theme-id]').forEach((b) => b.setAttribute('aria-checked', b.dataset.themeId === themeId));
    if (persist) { store.set('luna-site-theme', themeId); store.set('luna-site-mode', mode); }
  }
  function setTheme(id) { themeId = id; apply(true); }

  // Punkte im Hero + Karten im Feature-Bereich
  const dots = $('#dots'), grid = $('#themeGrid');
  THEMES.forEach(([id, name, h, s]) => {
    const d = document.createElement('button');
    d.dataset.themeId = id; d.setAttribute('role', 'radio'); d.title = name; d.setAttribute('aria-label', name);
    d.style.setProperty('--c', `hsl(${h} ${Math.max(s, 18)}% 68%)`);
    d.onclick = () => setTheme(id);
    dots.append(d);
    const c = document.createElement('button');
    c.className = 'tc'; c.dataset.themeId = id; c.setAttribute('role', 'radio');
    c.style.setProperty('--c1', `hsl(${h} ${s}% 70%)`); c.style.setProperty('--c2', `hsl(${h} ${s}% 86%)`);
    c.innerHTML = `<div class="pv" style="background:hsl(${h} ${s}% 80%)"><i style="left:8px"></i><i style="left:17px"></i><i style="left:26px"></i><u></u></div><b>${name}</b><span class="ck"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>`;
    c.onclick = () => setTheme(id);
    grid.append(c);
  });
  $('#mode').onclick = () => { mode = mode === 'dark' ? 'light' : 'dark'; apply(true); };
  sysDark.addEventListener?.('change', (e) => { if (!store.get('luna-site-mode')) { mode = e.matches ? 'dark' : 'light'; apply(false); } });
  apply(false);

  /* ---------- Uhr & Begrüßung im Hero ---------- */
  function tickClock() {
    const d = new Date(), hr = d.getHours();
    $('#clock').textContent = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    $('#greet').textContent = hr < 5 ? t('Gute Nacht') : hr < 11 ? t('Guten Morgen') : hr < 17 ? t('Guten Tag') : hr < 22 ? t('Guten Abend') : t('Gute Nacht');
    $('#date').textContent = d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  }
  tickClock(); setInterval(tickClock, 15000);

  // Adressleiste tippt sich selbst
  (async function typeAddr() {
    const el = $('#addrTyped');
    const words = [t('Suchen oder Adresse eingeben'), 'theme', 'play bohemian rhapsody', 'spotify daft punk', 'tab open youtube.com'];
    if (reduce) return;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let i = 0;
    for (;;) {
      const w = words[i++ % words.length];
      el.style.color = w === words[0] ? 'var(--mute)' : 'var(--ink)';
      el.style.fontFamily = w === words[0] ? '' : 'ui-monospace,SFMono-Regular,Menlo,monospace';
      for (let k = 0; k <= w.length; k++) { el.textContent = w.slice(0, k) || ' '; await wait(70); }
      await wait(1900);
      for (let k = w.length; k >= 0; k--) { el.textContent = w.slice(0, k) || ' '; await wait(28); }
      await wait(350);
    }
  })();

  /* ---------- Einblenden beim Scrollen ---------- */
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach((el) => io.observe(el));

  /* Demos laufen nur, wenn sie sichtbar sind */
  const visible = new WeakMap();
  const vio = new IntersectionObserver((es) => es.forEach((e) => visible.set(e.target, e.isIntersecting)));
  const isVis = (el) => visible.get(el) !== false && !document.hidden;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function until(el) { while (!isVis(el)) await sleep(400); }

  /* ---------- Befehle-Demo ---------- */
  const cmdCard = $('.c-cmd');
  vio.observe(cmdCard);
  const CMDS = [
    ['theme', () => `<div class="row">${THEMES.slice(0, 6).map((t) => `<i class="sw" style="--c:hsl(${t[2]} ${Math.max(t[3], 18)}% 68%)"></i>`).join('')}<span>Farbwelt wählen</span></div>`],
    ['play bohemian rhapsody', () => '<div class="row"><i class="cov"></i><span>Bohemian Rhapsody · Queen<br><small>Wiedergabe an Spotify übergeben</small></span></div>'],
    ['spotify daft punk', () => '<div class="row"><i class="cov"></i><span>One More Time</span></div><div class="row"><i class="cov"></i><span>Get Lucky</span></div><div class="row"><i class="cov"></i><span>Around the World</span></div>'],
    ['tab open youtube.com', () => '<div class="row">⊕ <span>Neuer Tab · youtube.com</span></div>'],
    ['chat', () => '<div class="row">✧ <span>Luna Chat geöffnet</span></div>'],
  ];
  (async function cmdLoop() {
    const t = $('#cmdText'), out = $('#cmdOut');
    if (reduce) { t.textContent = CMDS[0][0]; out.innerHTML = CMDS[0][1](); return; }
    for (let i = 0; ; i++) {
      const [c, html] = CMDS[i % CMDS.length];
      await until(cmdCard);
      out.innerHTML = '';
      for (let k = 0; k <= c.length; k++) { t.textContent = c.slice(0, k); await sleep(75); }
      await sleep(250); out.innerHTML = html();
      await sleep(2600);
      for (let k = c.length; k >= 0; k--) { t.textContent = c.slice(0, k); await sleep(20); }
    }
  })();

  /* ---------- KI-Chat-Demo ---------- */
  const chatCard = $('.c-ai');
  vio.observe(chatCard);
  (async function chatLoop() {
    const u = $('#msgU'), a = $('#msgA'), at = $('#msgAt');
    const Q = t('Fasse diese Seite kurz zusammen');
    const A = t('Das ist Lunas Startseite: Uhr, Suche und deine Musik, alles ruhig an einem Ort. Ich laufe lokal auf deinem Mac, ganz ohne Konto.');
    if (reduce) { u.textContent = Q; at.textContent = A; return; }
    for (;;) {
      await until(chatCard);
      u.textContent = ''; at.textContent = ''; a.style.opacity = 0; u.classList.add('typing');
      for (let k = 1; k <= Q.length; k++) { u.textContent = Q.slice(0, k); await sleep(38); }
      u.classList.remove('typing'); await sleep(500); a.style.opacity = 1; a.classList.add('typing');
      for (let k = 1; k <= A.length; k++) { at.textContent = A.slice(0, k); await sleep(22); }
      a.classList.remove('typing'); await sleep(4200);
    }
  })();

  /* ---------- Gesten: selbst zeichnen ---------- */
  const gest = $('#gest'), cv = $('#trail'), ctx = cv.getContext('2d');
  vio.observe(gest);
  let pts = [], down = false, W = 0, H = 0;
  function fit() {
    const r = gest.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  new ResizeObserver(fit).observe(gest); fit();
  const pos = (e) => { const r = gest.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }; };
  gest.addEventListener('pointerdown', (e) => { down = true; gest.setPointerCapture(e.pointerId); pts.push({ ...pos(e), brk: true }); $('#gHint').style.opacity = 0; e.preventDefault(); });
  gest.addEventListener('pointermove', (e) => { if (down) pts.push(pos(e)); });
  const up = () => { down = false; };
  gest.addEventListener('pointerup', up); gest.addEventListener('pointercancel', up);
  (function draw() {
    ctx.clearRect(0, 0, W, H);
    const now = performance.now();
    pts = pts.filter((p) => now - p.t < 1400);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i], q = pts[i - 1]; if (p.brk) continue;
      const life = 1 - (now - p.t) / 1400;
      ctx.globalAlpha = Math.max(0, life);
      ctx.strokeStyle = trailColor; ctx.lineWidth = 3 + 7 * life; ctx.lineCap = 'round';
      ctx.shadowColor = trailColor; ctx.shadowBlur = 14 * life;
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    requestAnimationFrame(draw);
  })();

  /* ---------- Musik: Zeit läuft mit ---------- */
  (function music() {
    const el = $('#tNow'); let s = 72;
    setInterval(() => { if (document.hidden) return; s = s >= 319 ? 72 : s + 1; el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }, 1000);
  })();

  /* ---------- Trailer ---------- */
  const vid = $('#vid'), box = $('#video');
  const playToggle = () => (vid.paused ? vid.play() : vid.pause());
  $('#vplay').onclick = () => vid.play();
  vid.addEventListener('click', playToggle);
  vid.addEventListener('play', () => { box.classList.add('playing'); vid.controls = true; });
  vid.addEventListener('pause', () => { if (vid.ended || vid.currentTime === 0) box.classList.remove('playing'); });
  vid.addEventListener('ended', () => { box.classList.remove('playing'); vid.controls = false; });
  $$('.vlang button').forEach((b) => b.addEventListener('click', () => {
    const was = !vid.paused; $$('.vlang button').forEach((x) => x.classList.toggle('on', x === b));
    vid.src = b.dataset.src; vid.load(); if (was) vid.play();
  }));

  /* ---------- Installationsdialog ---------- */
  const modal = $('#downloadDialog');
  const command = `( installer=$(mktemp) && trap 'rm -f "$installer"' EXIT && curl --fail --location --proto '=https' --proto-redir '=https' https://raw.githubusercontent.com/fcore247/luna-browser/main/docs/install.sh -o "$installer" && /bin/bash "$installer" )`;
  $('#installCommand').textContent = command;
  $$('.download').forEach((b) => b.addEventListener('click', () => modal.showModal()));
  $('.close').addEventListener('click', () => modal.close());
  modal.addEventListener('click', (e) => { if (e.target === modal) { const r = modal.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) modal.close(); } });
  $('#copy').addEventListener('click', async () => {
    const status = $('#copyStatus');
    try { await navigator.clipboard.writeText(command); status.textContent = t('Kopiert. Jetzt im Terminal einfügen und Enter drücken.'); }
    catch { const sel = getSelection(), range = document.createRange(); range.selectNodeContents($('#installCommand')); sel.removeAllRanges(); sel.addRange(range); status.textContent = t('Bitte den markierten Befehl mit ⌘ C kopieren.'); }
  });
})();
