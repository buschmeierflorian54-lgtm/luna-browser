// Befehls-Seite („commands“) und Theme-Leiste („theme“) für die Adressleiste.
// Beide erscheinen sofort beim Tippen, ohne Enter, und übernehmen die Farben des gewählten Themes über CSS-Variablen.
import { COLOR_THEMES, colorTheme, colorThemesHTML } from './color-themes.js';
import { esc } from './ui.js';

const COMMANDS = [
  {
    word: 'spotify',
    title: 'Spotify durchsuchen',
    text: 'Tippe spotify und danach einen Suchbegriff. Songs, Künstler und Alben erscheinen direkt in Luna.',
    demo: 'spotify daft punk',
    result: 'Top-Treffer · Songs · Künstler · Alben',
    hint: 'Enter ist nicht nötig, die Suche startet von selbst.',
    action: { fill: 'spotify ' },
  },
  {
    word: 'play',
    title: 'Song sofort abspielen',
    text: 'play und ein Songname, dann Enter. Luna sucht den besten Treffer und übergibt ihn an die Spotify-App.',
    demo: 'play bohemian rhapsody',
    result: '▶ Wiedergabe an Spotify übergeben',
    hint: 'Esc beendet den Play-Modus.',
    action: { fill: 'play ' },
  },
  {
    word: 'theme',
    title: 'Farbwelt wählen',
    text: 'Die Eingabeleiste wächst nach unten und zeigt alle Themes. Ein Klick färbt Luna sofort um.',
    demo: 'theme',
    result: 'swatches',
    hint: 'Auch Hell, Dunkel und Auto lassen sich dort umschalten.',
    action: { run: 'theme' },
  },
  {
    word: 'chat',
    title: 'Luna Chat öffnen',
    text: 'Sobald du chat getippt hast, öffnet sich der Chat. Auch hier ohne Enter.',
    demo: 'chat',
    result: 'Luna Chat öffnet sich …',
    hint: 'Frag Luna etwas oder lass sie den Browser bedienen.',
    action: { run: 'chat' },
  },
  {
    word: 'tab',
    title: 'Tabs steuern',
    text: 'tab list, tab open youtube.com, tab close, tab reload, tab zoom 120 oder tab close youtube.com. Mit Enter ausführen.',
    demo: 'tab open youtube.com',
    result: 'Neuer Tab · youtube.com',
    hint: 'tab close youtube.com schließt alle Tabs dieser Seite.',
    action: { fill: 'tab ' },
  },
  {
    word: 'einstellungen',
    title: 'Einstellungen öffnen',
    text: 'Luna fragt kurz nach, ob du die Einstellungen öffnen möchtest, statt im Web zu suchen.',
    demo: 'einstellungen',
    result: 'Einstellungen öffnen?',
    hint: 'Auch mit ⌘ , erreichbar.',
    action: { run: 'einstellungen' },
  },
  {
    word: 'google · youtube',
    title: 'Direkt zu einer Seite',
    text: 'Tippe google oder youtube und eine Sekunde später bist du dort. Weitertippen, etwa „google maps“, funktioniert weiter.',
    demo: 'youtube',
    result: 'youtube.com wird geöffnet',
    hint: 'Eine kurze Tipp-Pause löst den Sprung aus.',
    action: { run: 'youtube' },
  },
];

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createCommandUI({ urlbox, page, cover, getMode, pickColor, pickMode, fill, run }) {
  let pageEl = null,
    pageObserver = null,
    pageKey = null,
    dropEl = null,
    dropKey = null,
    dropClosing = false,
    demoTimers = [];

  /* ---------- Befehls-Seite ---------- */
  function stopDemos() {
    demoTimers.forEach(clearTimeout);
    demoTimers = [];
  }
  function playDemo(card, delay = 0) {
    const typed = card.querySelector('.cmd-typed'),
      result = card.querySelector('.cmd-result'),
      text = card.dataset.demo;
    result.classList.remove('show');
    typed.textContent = '';
    if (reduced()) {
      typed.textContent = text;
      result.classList.add('show');
      return;
    }
    const later = (fn, ms) => demoTimers.push(setTimeout(fn, ms));
    let i = 0;
    const step = () => {
      typed.textContent = text.slice(0, ++i);
      if (i < text.length) later(step, 55 + Math.random() * 45);
      else later(() => result.classList.add('show'), 320);
    };
    later(step, delay);
  }
  function swatches() {
    return COLOR_THEMES.map(
      ([, name, h, s]) =>
        `<i class="cmd-dot" title="${esc(name)}" style="background:hsl(${h} ${s}% 62%)"></i>`,
    ).join('');
  }
  function cardHTML(c, i) {
    return `<article class="cmd-card" style="--i:${i}" data-demo="${esc(c.demo)}" data-i="${i}">
      <div class="cmd-word">${esc(c.word)}</div>
      <h2>${esc(c.title)}</h2>
      <p>${esc(c.text)}</p>
      <button type="button" class="cmd-bar" data-replay aria-label="Demo erneut abspielen"><span class="cmd-prompt">›</span><span class="cmd-typed"></span><i class="cmd-caret"></i></button>
      <div class="cmd-result">${c.result === 'swatches' ? swatches() : esc(c.result)}</div>
      <small>${esc(c.hint)}</small>
      <button type="button" class="cmd-try" data-try="${i}">Ausprobieren →</button>
    </article>`;
  }
  function placePage() {
    if (!pageEl) return;
    const r = page.getBoundingClientRect();
    Object.assign(pageEl.style, {
      left: r.left + 'px',
      top: r.top + 'px',
      width: r.width + 'px',
      height: r.height + 'px',
    });
  }
  function openPage() {
    if (pageEl) return;
    closeDrop(true);
    pageEl = document.createElement('div');
    pageEl.id = 'cmdPage';
    pageEl.setAttribute('role', 'dialog');
    pageEl.setAttribute('aria-label', 'Befehle');
    pageEl.innerHTML = `<div class="cmd-inner"><button type="button" class="cmd-close" data-close aria-label="Schließen"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button><header><span class="cmd-eyebrow">LUNA · BEFEHLE</span><h1>Tippen statt klicken.</h1><p>Gib einen Befehl oben in die Adressleiste ein. Viele starten sofort, ganz ohne Enter. Klicke eine Leiste an, um die Demo erneut zu sehen.</p></header><div class="cmd-grid">${COMMANDS.map(cardHTML).join('')}</div></div>`;
    document.body.append(pageEl);
    placePage();
    pageObserver = new ResizeObserver(placePage);
    pageObserver.observe(page);
    pageEl.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-close]')) return closePage();
      const replay = ev.target.closest('[data-replay]');
      if (replay) {
        stopDemos();
        playDemo(replay.closest('.cmd-card'));
        return;
      }
      const tryBtn = ev.target.closest('[data-try]');
      if (tryBtn) {
        const { action } = COMMANDS[Number(tryBtn.dataset.try)];
        closePage();
        if (action.fill) fill(action.fill);
        else if (action.run === 'theme') openDrop();
        else run(action.run);
      }
    });
    pageKey = (ev) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        closePage();
      }
    };
    document.addEventListener('keydown', pageKey);
    cover(true);
    if (!reduced())
      pageEl.animate(
        [
          { opacity: 0, transform: 'translateY(14px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 320, easing: 'cubic-bezier(.2,.9,.25,1)' },
      );
    pageEl.querySelectorAll('.cmd-card').forEach((card, i) => playDemo(card, 450 + i * 650));
    pageEl.querySelector('.cmd-close').focus({ preventScroll: true });
  }
  function closePage() {
    if (!pageEl) return;
    stopDemos();
    pageObserver?.disconnect();
    document.removeEventListener('keydown', pageKey);
    pageEl.remove();
    pageEl = pageObserver = null;
    cover(false);
  }

  /* ---------- Theme-Leiste: wächst langsam aus der Adressleiste nach unten ---------- */
  function placeDrop() {
    if (!dropEl) return;
    const r = urlbox.getBoundingClientRect(),
      width = Math.min(Math.max(r.width, 560), window.innerWidth - r.left - 12);
    Object.assign(dropEl.style, {
      left: r.left + 'px',
      top: r.bottom - 1 + 'px',
      width: width + 'px',
    });
  }
  function dropHTML() {
    const mode = getMode();
    const themes = colorThemesHTML().replace(/data-act="color-theme" data-color=/g, 'data-pick=');
    return `<div class="td-head"><b>Deine Farbwelt</b><span class="td-modes" role="group" aria-label="Darstellung">${[
      ['light', 'Hell'],
      ['dark', 'Dunkel'],
      ['auto', 'Auto'],
    ]
      .map(
        ([id, label]) =>
          `<button type="button" data-mode="${id}" aria-pressed="${id === mode}">${label}</button>`,
      )
      .join(
        '',
      )}</span><button type="button" class="td-close" data-close aria-label="Schließen"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>${themes}`;
  }
  function openDrop() {
    if (dropEl && !dropClosing) return;
    closePage();
    dropEl?.remove();
    dropClosing = false;
    dropEl = document.createElement('div');
    dropEl.id = 'themeDrop';
    dropEl.setAttribute('role', 'dialog');
    dropEl.setAttribute('aria-label', 'Farbwelt wählen');
    dropEl.innerHTML = dropHTML();
    document.body.append(dropEl);
    urlbox.classList.add('drop-open');
    placeDrop();
    cover(true);
    const full = dropEl.offsetHeight;
    if (reduced()) dropEl.style.height = '';
    else {
      dropEl.style.overflow = 'hidden';
      dropEl
        .animate([{ height: '0px' }, { height: full + 'px' }], {
          duration: 1200,
          easing: 'cubic-bezier(.22,.7,.2,1)',
        })
        .finished.then(() => {
          if (dropEl && !dropClosing) dropEl.style.overflow = '';
        })
        .catch(() => {});
      dropEl.querySelectorAll('.td-head, .color-theme').forEach((el, i) =>
        el.animate(
          [
            { opacity: 0, transform: 'translateY(-10px) scale(.96)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 420, delay: 250 + i * 80, easing: 'ease-out', fill: 'backwards' },
        ),
      );
    }
    dropEl.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-close]')) return closeDrop();
      const pick = ev.target.closest('[data-pick]');
      if (pick) {
        pickColor(pick.dataset.pick);
        dropEl.querySelectorAll('[data-pick]').forEach((b) => {
          b.setAttribute('aria-pressed', String(b === pick));
        });
        return;
      }
      const mode = ev.target.closest('[data-mode]');
      if (mode) {
        pickMode(mode.dataset.mode);
        dropEl.querySelectorAll('[data-mode]').forEach((b) => {
          b.setAttribute('aria-pressed', String(b === mode));
        });
      }
    });
    dropKey = (ev) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        closeDrop();
      } else if (ev.type === 'pointerdown' && !ev.target.closest('#themeDrop, #urlbox'))
        closeDrop();
    };
    document.addEventListener('keydown', dropKey);
    document.addEventListener('pointerdown', dropKey, true);
    window.addEventListener('resize', placeDrop);
  }
  function closeDrop(immediate = false) {
    if (!dropEl || dropClosing) return;
    const el = dropEl;
    dropClosing = true;
    document.removeEventListener('keydown', dropKey);
    document.removeEventListener('pointerdown', dropKey, true);
    window.removeEventListener('resize', placeDrop);
    const done = () => {
      el.remove();
      if (dropEl === el) dropEl = null;
      dropClosing = false;
      urlbox.classList.remove('drop-open');
      cover(false);
    };
    if (immediate || reduced()) return done();
    el.style.overflow = 'hidden';
    el.animate([{ height: el.offsetHeight + 'px' }, { height: '0px' }], {
      duration: 420,
      easing: 'cubic-bezier(.5,0,.75,0)',
      fill: 'forwards',
    }).finished.then(done, done);
  }

  return {
    openPage,
    closePage,
    openDrop,
    closeDrop,
    closeAll() {
      closePage();
      closeDrop(true);
    },
    get active() {
      return !!pageEl || !!dropEl;
    },
    currentColor: colorTheme,
  };
}
