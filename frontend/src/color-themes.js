import iconSVG from './assets/luna-icon.svg?raw';
import { setDockIcon, setErrorPalette } from './api.js';
// Farbwelten bleiben unabhängig von Hell/Dunkel ; KI und MCP wählen aus derselben Liste.
export const COLOR_THEMES = [
  ['luna', 'Luna Rosé', 325, 38],
  ['lavender', 'Lavendel', 265, 42],
  ['ocean', 'Ozean', 210, 55],
  ['mint', 'Minze', 163, 40],
  ['forest', 'Wald', 140, 30],
  ['sand', 'Sand', 38, 42],
  ['peach', 'Pfirsich', 22, 58],
  ['cherry', 'Kirschblüte', 350, 46],
  ['arctic', 'Arktis', 188, 43],
  ['graphite', 'Graphit', 220, 5],
];
const KEY = 'luna-color-theme';
export function colorTheme() {
  try {
    const id = localStorage.getItem(KEY);
    return COLOR_THEMES.some((t) => t[0] === id) ? id : 'luna';
  } catch {
    return 'luna';
  }
}
export function applyColorTheme(id = colorTheme(), persist = false) {
  const theme = COLOR_THEMES.find((t) => t[0] === id);
  if (!theme) return;
  if (persist) {
    try {
      localStorage.setItem(KEY, id);
    } catch {}
  }
  const root = document.documentElement;
  root.dataset.colorTheme = id;
  window.applyLunaBootTheme?.(id, root.dataset.theme === 'dark');
  updateThemeIcon(theme);
  let style = document.getElementById('luna-palette');
  if (!style) {
    style = document.createElement('style');
    style.id = 'luna-palette';
    document.head.append(style);
  }
  // Luna bewahrt die ursprüngliche, handabgestimmte Farbpalette.
  if (id === 'luna') {
    style.textContent = '';
    syncErrorPalette();
    return;
  }
  const [, , h, s] = theme,
    dark = root.dataset.theme === 'dark';
  const c = (l, sat = s) => `hsl(${h} ${sat}% ${l}%)`;
  const values = dark
    ? {
        desk: c(14),
        body: c(11, 22),
        panel: c(9, 20),
        input: c(14, 22),
        card: c(16, 22),
        hover: c(22, 24),
        soft: c(18, 22),
        line: c(25, 22),
        line2: c(20, 20),
        line3: c(33, 24),
        ink: c(96, 24),
        ink2: c(88, 22),
        mute2: c(74, 18),
        mute: c(67, 16),
        acc: c(73),
        link: c(80),
        'link-h': c(90),
        pri: c(94, 25),
        'pri-fg': c(12, 25),
        'pri-h': '#ffffff',
        tab: c(18, 22),
        'tab-h': c(24, 22),
        menu: c(13, 22),
      }
    : {
        desk: c(83),
        body: c(92, 30),
        panel: c(97, 25),
        input: c(97, 25),
        card: '#ffffff',
        hover: c(87, 30),
        soft: c(94, 25),
        line: c(86, 24),
        line2: c(90, 22),
        line3: c(79, 25),
        ink: c(18, 28),
        ink2: c(25, 26),
        mute2: c(37, 20),
        mute: c(44, 18),
        acc: c(38),
        link: c(32),
        'link-h': c(22),
        pri: c(20, 30),
        'pri-fg': '#ffffff',
        'pri-h': c(28, 30),
        tab: c(90, 30),
        'tab-h': c(96, 25),
        menu: c(97, 25),
      };
  style.textContent =
    `:root[data-color-theme="${id}"]{${Object.entries(values)
      .map(([k, v]) => `--${k}:${v}`)
      .join(';')}}` +
    [1, 2, 3, 4]
      .map(
        (n) =>
          `:root[data-color-theme="${id}"] .st-bg .a${n}{background:hsl(${h + (n - 1) * 12} ${s}% ${dark ? 35 : 76}%);}`,
      )
      .join('');
  syncErrorPalette();
}
function syncErrorPalette() {
  const css = getComputedStyle(document.documentElement);
  setErrorPalette(JSON.stringify(Object.fromEntries(['panel', 'ink', 'mute', 'acc', 'pri', 'pri-fg'].map(key => [key, css.getPropertyValue('--' + key).trim()]))));
}
export function colorThemesHTML() {
  const current = colorTheme();
  return `<div class="palette-heading"><h3>Deine Farbwelt</h3><p class="muted">Zehn Looks für Luna. Jeder passt sich an Hell und Dunkel an.</p></div><div class="color-themes" role="group" aria-label="Farbthemes">${COLOR_THEMES.map(([id, name, h, s]) => `<button class="color-theme" data-act="color-theme" data-color="${id}" aria-pressed="${id === current}" style="--preview-h:${h};--preview-s:${s}%"><span class="palette-preview" aria-hidden="true"><i class="palette-dots">•••</i><i class="palette-window"><i></i><i></i></i><span class="palette-check">✓</span></span><span class="palette-name">${name}</span></button>`).join('')}</div>`;
}

let currentIcon = '',
  iconGeneration = 0;
export function themeIconURL() {
  return currentIcon || 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSVG);
}
function updateThemeIcon([id, , h, s]) {
  const svg =
    id === 'luna'
      ? iconSVG
      : iconSVG.replace('#bd749d', `hsl(${h},${s}%,58%)`).replace('#79365e', `hsl(${h},${s}%,32%)`);
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  if (currentIcon === url) return;
  currentIcon = url;
  document.querySelectorAll('.st-logo').forEach((img) => {
    img.src = url;
  });
  const generation = ++iconGeneration,
    img = new Image();
  img.onload = () => {
    if (generation !== iconGeneration) return;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1024;
    canvas.getContext('2d').drawImage(img, 0, 0, 1024, 1024);
    setDockIcon(canvas.toDataURL('image/png').split(',')[1]).catch((e) => {
      console.warn('Dock-Symbol konnte nicht aktualisiert werden', e);
      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = String(e);
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 6000);
      }
    });
  };
  img.src = url;
}
