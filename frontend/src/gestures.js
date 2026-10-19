import * as api from './api.js';
import { esc } from './ui.js';

export const gestureActions = {
  none: 'Keine Aktion',
  notes: 'Notizen öffnen / schließen',
  screenshot: 'Screenshot kopieren',
  music: 'Luna Music öffnen',
  settings: 'Einstellungen öffnen',
  new_tab: 'Neuer Tab',
  close_tab: 'Aktuellen Tab schließen',
  back: 'Zurück',
  forward: 'Vorwärts',
  reload: 'Seite neu laden',
  bookmarks: 'Lesezeichen öffnen',
  history: 'Verlauf öffnen',
  downloads: 'Downloads öffnen',
  open_url: 'Website öffnen',
};
let bindings = { O: { action: 'notes' }, S: { action: 'screenshot' } };
export function gestureState() {
  return { bindings, actions: gestureActions, alphabet: 'CDHIJLOPQSVWZ' };
}
export async function loadGestures() {
  const saved = await api.gestureBindings();
  if (saved) bindings = saved;
}
export function gesturesHTML(enabled = true) {
  return `<section id="set-gestures" class="sp-card"><h2>Buchstaben-Gesten</h2>
  <p class="muted">Linke Maustaste halten, einen großen Druckbuchstaben in einem Zug zeichnen und loslassen. Beginne am Punkt und folge der Vorlage; bei Querstrichen fährst du ein Stück zurück. O funktioniert auch als Kreis. Eingabefelder bleiben ausgenommen.</p>
  <div class="row"><button class="switch ${enabled ? 'on' : ''}" role="switch" aria-checked="${enabled}" aria-label="Mausgesten aktivieren" data-act="pref-gesture"><i></i></button><span>${enabled ? 'Mausgesten eingeschaltet' : 'Mausgesten ausgeschaltet'}</span><button class="btn" data-gesture-reset>Standardbelegung wiederherstellen</button></div>
  <p class="muted">Eine Aktion wird erst beim Loslassen ausgeführt. Unklare Formen lösen nichts aus. Die Belegung wird lokal gespeichert und kann auch per MCP geändert werden.</p>
  <div class="gesture-grid">${[...'CDHIJLOPQSVWZ']
    .map((letter) => {
      const b = bindings[letter] || { action: 'none' };
      const points = window.__lunaLetterPaths?.[letter];
      const preview = points
        ? `<polyline pathLength="1" points="${points.map((p) => `${10 + p[0] * 44},${8 + p[1] * 48}`).join(' ')}"/><circle cx="${10 + points[0][0] * 44}" cy="${8 + points[0][1] * 48}" r="3"/>`
        : '<path pathLength="1" d="M52 14 C10 -8 0 32 32 32 C64 32 54 76 12 50"/><circle cx="52" cy="14" r="3"/>';
      return `<form class="gesture-card" data-gesture-letter="${letter}"><header><b>${letter}</b><svg data-gesture-preview viewBox="0 0 64 64" aria-label="Zeichenvorlage ${letter}">${preview}</svg></header><label>Aktion für ${letter}<select name="action">${Object.entries(
        gestureActions,
      )
        .map(
          ([key, label]) =>
            `<option value="${key}" ${b.action === key ? 'selected' : ''}>${label}</option>`,
        )
        .join(
          '',
        )}</select></label><input name="url" type="url" placeholder="https://…" aria-label="Website für ${letter}" value="${esc(b.value || '')}" ${b.action === 'open_url' ? '' : 'hidden'}><button class="btn" type="submit">Speichern</button><span class="muted small" role="status"></span></form>`;
    })
    .join('')}</div></section>`;
}
export function initGestures({ actions, toast, render }) {
  const configure = async ({ action = 'list', letter, binding, value = '' }) => {
    if (action === 'set') bindings = await api.setGestureBinding(letter, binding, value);
    else if (action === 'reset') bindings = await api.resetGestureBindings();
    else if (action !== 'list') throw Error('Unbekannte Gestenaktion.');
    if (action !== 'list') render();
    return gestureState();
  };
  document.addEventListener('change', (e) => {
    const form = e.target.closest('[data-gesture-letter]');
    if (form && e.target.name === 'action')
      form.elements.url.hidden = e.target.value !== 'open_url';
  });
  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('[data-gesture-letter]');
    if (!form) return;
    e.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      await configure({
        action: 'set',
        letter: form.dataset.gestureLetter,
        binding: form.elements.action.value,
        value: form.elements.url.value,
      });
      toast('Geste gespeichert');
    } catch (err) {
      form.querySelector('[role=status]').textContent = String(err?.message || err);
    } finally {
      button.disabled = false;
    }
  });
  document.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-gesture-reset]')) return;
    try {
      await configure({ action: 'reset' });
      toast('O: Notizen · S: Screenshot');
    } catch (err) {
      toast(String(err));
    }
  });
  return {
    configure,
    async run(letter) {
      if (!'CDHIJLOPQSVWZ'.includes(letter) || letter?.length !== 1) return;
      const binding = bindings[letter];
      if (!binding || binding.action === 'none') return;
      try {
        await actions[binding.action]?.(binding.value);
      } catch (err) {
        toast('Geste fehlgeschlagen: ' + String(err?.message || err));
      }
    },
  };
}
