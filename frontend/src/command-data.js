import { WINDOWS, shortcut } from './platform.js';
// Befehle der Adressleiste: Beschreibung, Demo und der Schalter, mit dem jeder einzeln an- oder ausgeschaltet wird.
import { esc } from './ui.js';

export const COMMANDS = [
  {
    id: 'spotify',
    word: 'spotify',
    title: 'Spotify durchsuchen',
    text: 'Tippe spotify und danach einen Suchbegriff. Songs, Künstler und Alben erscheinen direkt in Luna.',
    demo: 'spotify daft punk',
    result: 'Top-Treffer · Songs · Künstler · Alben',
    hint: 'Enter ist nicht nötig, die Suche startet von selbst.',
    action: { fill: 'spotify ' },
  },
  {
    id: 'play',
    word: 'play',
    title: 'Song sofort abspielen',
    text: 'play und ein Songname, dann Enter. Luna sucht den besten Treffer und übergibt ihn an die Spotify-App.',
    demo: 'play bohemian rhapsody',
    result: '▶ Wiedergabe an Spotify übergeben',
    hint: 'Esc beendet den Play-Modus.',
    action: { fill: 'play ' },
  },
  {
    id: 'theme',
    word: 'theme',
    title: 'Farbwelt wählen',
    text: 'Die Eingabeleiste wächst nach unten und zeigt alle Themes. Ein Klick färbt Luna sofort um.',
    demo: 'theme',
    result: 'swatches',
    hint: 'Auch Hell, Dunkel und Auto lassen sich dort umschalten.',
    action: { run: 'theme' },
  },
  {
    id: 'chat',
    word: 'chat',
    title: 'Luna Chat öffnen',
    text: 'Sobald du chat getippt hast, öffnet sich der Chat. Auch hier ohne Enter.',
    demo: 'chat',
    result: 'Luna Chat öffnet sich …',
    hint: 'Frag Luna etwas oder lass sie den Browser bedienen.',
    action: { run: 'chat' },
  },
  {
    id: 'tab',
    word: 'tab',
    title: 'Tabs steuern',
    text: 'tab list, tab open youtube.com, tab close, tab reload, tab zoom 120 oder tab close youtube.com. Mit Enter ausführen.',
    demo: 'tab open youtube.com',
    result: 'Neuer Tab · youtube.com',
    hint: 'tab close youtube.com schließt alle Tabs dieser Seite.',
    action: { fill: 'tab ' },
  },
  {
    id: 'settings',
    word: 'einstellungen',
    title: 'Einstellungen öffnen',
    text: 'Luna fragt kurz nach, ob du die Einstellungen öffnen möchtest, statt im Web zu suchen.',
    demo: 'einstellungen',
    result: 'Einstellungen öffnen?',
    hint: `Auch mit ${shortcut('⌘ ,')} erreichbar.`,
    action: { run: 'einstellungen' },
  },
  {
    id: 'sites',
    word: 'google · youtube',
    title: 'Direkt zu einer Seite',
    text: 'Tippe google oder youtube und eine Sekunde später bist du dort. Weitertippen, etwa „google maps“, funktioniert weiter.',
    demo: 'youtube',
    result: 'youtube.com wird geöffnet',
    hint: 'Eine kurze Tipp-Pause löst den Sprung aus.',
    action: { run: 'youtube' },
  },
];

const KEY = 'luna-commands-off';
function disabledIds() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
// Ist ein Befehl ausgeschaltet, behandelt Luna das Wort wie eine normale Eingabe.
export const commandOn = (id) => !disabledIds().includes(id);
export function setCommandOn(id, on) {
  const off = new Set(disabledIds());
  if (on) off.delete(id);
  else off.add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...off]));
  } catch {
    /* ohne Speicher: gilt bis zum Neuladen nicht */
  }
  window.dispatchEvent(new CustomEvent('luna-commands-changed', { detail: { id, on } }));
}
export function setAllCommands(on) {
  try {
    localStorage.setItem(KEY, JSON.stringify(on ? [] : COMMANDS.map((c) => c.id)));
  } catch {
    /* siehe oben */
  }
  window.dispatchEvent(new CustomEvent('luna-commands-changed', { detail: { all: true, on } }));
}

// Der Schalter: grün = an, rot = aus. Der Rahmen der Karte folgt dem Zustand.
export function commandSwitchHTML(c, withAct = false) {
  const on = commandOn(c.id);
  return `<button type="button" class="cmd-switch" role="switch" aria-checked="${on}" aria-label="${esc(c.word)} ${on ? 'ausschalten' : 'einschalten'}" data-toggle="${c.id}" ${withAct ? `data-act="cmd-toggle" data-id="${c.id}"` : ''}><span class="cmd-switch-label">${on ? 'An' : 'Aus'}</span><i></i></button>`;
}
export function commandSettingsHTML() {
  const count = COMMANDS.filter((c) => commandOn(c.id)).length;
  return `<section id="set-commands" class="sp-card"><h2>Befehle</h2>
    <p class="muted">Befehle sind Wörter, die du in die Adressleiste tippst und die Luna direkt versteht. Jeder lässt sich einzeln ein- oder ausschalten: Ein ausgeschalteter Befehl wird wie eine normale Eingabe behandelt. Klicke eine Karte an, um sie umzuschalten.</p>
    <div class="cmd-set-head"><span class="cmd-count">${count} von ${COMMANDS.length} Befehlen aktiv</span><span class="cmd-set-actions"><button class="btn sm" data-act="cmd-all" data-on="1">Alle an</button><button class="btn sm" data-act="cmd-all" data-on="0">Alle aus</button><button class="btn sm pri" data-act="cmd-page">Befehle ansehen</button></span></div>
    <div class="cmd-set-grid">${COMMANDS.map(
      (c) =>
        `<div class="cmd-set-card ${commandOn(c.id) ? 'on' : 'off'}" data-act="cmd-toggle" data-id="${c.id}"><div class="cmd-set-top"><span class="cmd-word">${esc(c.word)}</span>${commandSwitchHTML(c, true)}</div><b>${esc(c.title)}</b><span class="muted small">${esc(c.text)}</span></div>`,
    ).join('')}</div>
  </section>`;
}
