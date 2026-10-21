import { WINDOWS } from './platform.js';
import {
  WindowMinimise,
  WindowToggleMaximise,
  WindowIsMaximised,
  Quit,
} from '../wailsjs/runtime/runtime.js';

// These controls belong to the trusted shell, never to a browsed website.
export function initWindowChrome() {
  if (!WINDOWS) return;
  const bar = document.querySelector('#titlebar');
  if (!bar || bar.querySelector('.window-controls')) return;
  document.documentElement.classList.add('windows-chrome');
  const controls = document.createElement('div');
  controls.className = 'window-controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Fenster');
  const icon = (path) =>
    `<svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="${path}"/></svg>`;
  const maximize = icon('M1.5 1.5h9v9h-9Z');
  const restore = icon('M3.5 1.5h7v7M1.5 3.5h7v7h-7Z');
  controls.innerHTML = `<button type="button" data-window="minimize" aria-label="Fenster minimieren" title="Minimieren">${icon('M1 6.5h10')}</button><button type="button" data-window="maximize" aria-label="Fenster maximieren" title="Maximieren">${maximize}</button><button type="button" data-window="close" aria-label="Fenster schließen" title="Schließen">${icon('m1.5 1.5 9 9m0-9-9 9')}</button>`;
  bar.append(controls);
  const maxButton = controls.querySelector('[data-window=maximize]');
  async function sync() {
    if (!window.runtime) return;
    try {
      const on = await WindowIsMaximised();
      maxButton.innerHTML = on ? restore : maximize;
      maxButton.setAttribute('aria-label', on ? 'Fenster wiederherstellen' : 'Fenster maximieren');
      maxButton.title = on ? 'Wiederherstellen' : 'Maximieren';
    } catch {
      /* Runtime may still be starting. A resize/focus retries. */
    }
  }
  controls.addEventListener('click', (e) => {
    if (!window.runtime) return;
    const action = e.target.closest('[data-window]')?.dataset.window;
    if (action === 'minimize') WindowMinimise();
    if (action === 'maximize') {
      WindowToggleMaximise();
      sync();
    }
    if (action === 'close') Quit();
  });
  window.addEventListener('resize', sync);
  window.addEventListener('focus', sync);
  sync();
}
