// Befehls-Seite („commands“) und Theme-Leiste („theme“) für die Adressleiste.
// Beide erscheinen sofort beim Tippen, ohne Enter, und übernehmen die Farben des gewählten Themes über CSS-Variablen.
import { COLOR_THEMES, colorTheme, colorThemesHTML } from './color-themes.js';
import { backgroundSettingsHTML, personal } from './personalization.js';
import { esc } from './ui.js';
import { COMMANDS, commandOn, commandSwitchHTML, setCommandOn } from './command-data.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createCommandUI({
  input,
  urlbox,
  page,
  cover,
  getMode,
  pickColor,
  pickMode,
  fill,
  run,
}) {
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
    return `<article class="cmd-card ${commandOn(c.id) ? 'on' : 'off'}" style="--i:${i}" data-id="${c.id}" data-demo="${esc(c.demo)}" data-i="${i}">
      <div class="cmd-card-top"><div class="cmd-word">${esc(c.word)}</div>${commandSwitchHTML(c)}</div>
      <h2>${esc(c.title)}</h2>
      <p>${esc(c.text)}</p>
      <button type="button" class="cmd-bar" data-replay aria-label="Demo erneut abspielen"><span class="cmd-prompt">›</span><span class="cmd-typed"></span><i class="cmd-caret"></i></button>
      <div class="cmd-result">${c.result === 'swatches' ? swatches() : esc(c.result)}</div>
      <small>${esc(c.hint)}</small>
      <button type="button" class="cmd-try" data-try="${i}" ${commandOn(c.id) ? '' : 'disabled'}>Ausprobieren →</button>
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
      const card = ev.target.closest('.cmd-card');
      if (card && !ev.target.closest('[data-replay], [data-try], [data-close]')) {
        const id = card.dataset.id;
        setCommandOn(id, !commandOn(id));
        const on = commandOn(id);
        card.classList.toggle('on', on);
        card.classList.toggle('off', !on);
        const sw = card.querySelector('.cmd-switch');
        sw.setAttribute('aria-checked', String(on));
        sw.querySelector('.cmd-switch-label').textContent = on ? 'An' : 'Aus';
        card.querySelector('[data-try]').disabled = !on;
        return;
      }
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
    return `<div class="td-head"><b>Dein Design</b><button type="button" class="td-close" data-close aria-label="Schließen"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="td-tabs" role="tablist" aria-label="Designbereiche">
      <button role="tab" id="td-colors-tab" aria-controls="td-colors" aria-selected="true" data-design-tab="colors">Farben</button>
      <button role="tab" id="td-background-tab" aria-controls="td-background" aria-selected="false" tabindex="-1" data-design-tab="background">Hintergrund</button>
    </div>
    <section id="td-colors" role="tabpanel" aria-labelledby="td-colors-tab">
      <div class="td-modes" role="group" aria-label="Darstellung">${[
        ['light', 'Hell'],
        ['dark', 'Dunkel'],
        ['auto', 'Auto'],
      ]
        .map(
          ([id, label]) =>
            `<button type="button" data-mode="${id}" aria-pressed="${id === mode}">${label}</button>`,
        )
        .join('')}</div>${themes}
    </section>
    <section id="td-background" role="tabpanel" aria-labelledby="td-background-tab" hidden>${backgroundSettingsHTML()}</section>`;
  }
  function applyDropBlur() {
    if (dropEl)
      dropEl.style.setProperty(
        '--theme-menu-blur',
        Math.max(0, Math.min(32, Number(personal().menuBlur) || 0)) + 'px',
      );
  }
  function selectDesignTab(name, focus = false) {
    dropEl.getAnimations({ subtree: true }).forEach((animation) => animation.finish());
    dropEl.style.overflow = '';
    dropEl.querySelectorAll('[data-design-tab]').forEach((button) => {
      const active = button.dataset.designTab === name;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      if (active && focus) button.focus();
    });
    dropEl.querySelector('#td-colors').hidden = name !== 'colors';
    dropEl.querySelector('#td-background').hidden = name !== 'background';
    dropEl.scrollTop = 0;
  }

  window.addEventListener('luna-personalization', (event) => {
    applyDropBlur();
    if (
      !dropEl ||
      !event.detail ||
      !['background', 'youtube', 'motion', 'mediaRevision'].some((key) => key in event.detail)
    )
      return;
    const controls = dropEl.querySelector('.personal-background-controls');
    if (controls) controls.outerHTML = backgroundSettingsHTML();
  });
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
    applyDropBlur();
    dropEl.addEventListener('keydown', (event) => {
      const tab = event.target.closest('[data-design-tab]');
      if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      selectDesignTab(
        event.key === 'Home'
          ? 'colors'
          : event.key === 'End'
            ? 'background'
            : tab.dataset.designTab === 'colors'
              ? 'background'
              : 'colors',
        true,
      );
    });
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
      const designTab = ev.target.closest('[data-design-tab]');
      if (designTab) {
        selectDesignTab(designTab.dataset.designTab);
        return;
      }
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

  // Beides gilt nur solange das Wort in der Adressleiste steht: tippt man weiter oder etwas anderes, schließt es sich.
  input.addEventListener('input', () => {
    const word = input.value.trim().toLowerCase();
    if (dropEl && !/^themes?$/.test(word)) closeDrop();
    if (pageEl && !/^(?:commands?|befehle)$/.test(word)) closePage();
  });
  // Jede Bedienung außerhalb (Spotify-Chip, Tabs, Menü, Seitenleiste …) schließt die Befehlsseite zuerst und läuft dann normal weiter.
  document.addEventListener(
    'pointerdown',
    (ev) => {
      if (pageEl && !ev.target.closest('#cmdPage, #urlbox')) closePage();
    },
    true,
  );
  document.addEventListener('focusin', (ev) => {
    if (dropEl && !ev.target.closest('#themeDrop, #urlbox')) closeDrop();
  });

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
