import { chatSettingsHTML } from './chat.js';
import { gesturesHTML } from './gestures.js';
import * as api from './api.js';
import { $, esc, hueOf, initial, shownUrl } from './ui.js';
import { colorThemesHTML } from './color-themes.js';
import { settingsWordmark } from './branding.js';
import { mcpSettingsHTML } from './mcp-view.js';
import { sonosSettingsHTML, updateSonosSettings } from './sonos-view.js';
import { spotifySettingsHTML } from './spotify-view.js';
import { allPanels, panelGroups, isPanelHidden } from './sidepanel.js';

export function createSettings({
  state: S,
  currentTab: cur,
  createTab: mkTab,
  activate,
  renderAll,
  themeMode,
  toast,
  onSearchKeyChanged,
}) {
  let setMsg = { text: '', kind: '' };
  let mcpStatus = {};
  async function refreshMCPStatus() {
    try {
      mcpStatus = await api.mcpStatus();
      if (settingsSection === 'mcp' && cur()?.mode === 'settings') renderSettingsView();
    } catch (e) {
      toast(String(e));
    }
  }
  let sonosState = {};
  let sonosBusy = false;
  async function refreshSonos() {
    if (sonosBusy) return;
    sonosBusy = true;
    try {
      const next = await api.sonosStatus();
      if (JSON.stringify(next) !== JSON.stringify(sonosState)) {
        sonosState = next;
        updateSonosSettings($('#set-sonos'), sonosState);
      }
    } catch {
      /* Hintergrundabfrage: bei Fehler bleibt die bestehende Ansicht erhalten. */
    } finally {
      sonosBusy = false;
    }
  }
  setInterval(() => {
    if (cur()?.mode === 'settings' && settingsSection === 'spotify') refreshSonos();
  }, 5000);
  let spotifyAccount = {};
  let spotifyStatusBusy = false;
  async function refreshSpotifyAccount() {
    if (spotifyStatusBusy) return;
    spotifyStatusBusy = true;
    try {
      const next = await api.spotifyAPIStatus();
      if (JSON.stringify(next) !== JSON.stringify(spotifyAccount)) {
        spotifyAccount = next;
        if (settingsSection === 'spotify' && cur()?.mode === 'settings') renderSettingsView();
      }
    } catch {
      /* Verbindungsfehler werden bei Aktionen sichtbar */
    } finally {
      spotifyStatusBusy = false;
    }
  }
  setInterval(() => {
    if (cur()?.mode === 'settings' && settingsSection === 'spotify') refreshSpotifyAccount();
  }, 2000);
  let settingsSection = 'look';
  const SET_SECTIONS = [
    ['look', 'Darstellung'],
    ['bm', 'Lesezeichen'],
    ['panels', 'Seitenpanel'],
    ['start', 'Start'],
    ['gestures', 'Mausgesten'],
    ['search', 'Suche'],
    ['spotify', 'Spotify'],
    ['mcp', 'KI & MCP'],
    ['data', 'Daten'],
  ];
  function settingsPageHTML() {
    const th = themeMode();
    const html = `<div class="sp">
    <nav class="sp-nav" aria-label="Einstellungen"><h1 class="settings-heading" aria-label="Einstellungen">${settingsWordmark}</h1>${SET_SECTIONS.map(([id, l], i) => `<button class="${id === settingsSection ? 'on' : ''}" data-act="set-nav" data-s="${id}">${l}</button>`).join('')}</nav>
    <div class="sp-main">
      <section id="set-look" class="sp-card"><h2>Darstellung</h2>
        <p class="muted">Hell, Dunkel oder passend zum System. Webseiten folgen dem Erscheinungsbild.</p>
        <div class="themes">${[
          ['auto', 'Automatisch'],
          ['light', 'Hell'],
          ['dark', 'Dunkel'],
        ]
          .map(
            ([k, l]) =>
              `<button class="theme ${th === k ? 'on' : ''}" data-act="theme" data-m="${k}"><span class="tp tp-${k}"><i></i><i></i><i></i></span><b>${l}</b></button>`,
          )
          .join('')}</div>
        ${colorThemesHTML()}
        <div class="swrow"><div><b>Lesezeichenleiste anzeigen</b><span>${S.bar ? 'Die Leiste unter der Adressleiste ist sichtbar.' : 'Aus: Lesezeichen findest du weiter in der Seitenleiste und auf der Startseite.'}</span></div>
          <button class="switch ${S.bar ? 'on' : ''}" role="switch" aria-checked="${S.bar}" aria-label="Lesezeichenleiste anzeigen" data-act="pref-bar"><i></i></button></div>
      </section>
      <section id="set-bm" class="sp-card"><h2>Lesezeichen</h2>
        <div class="bmlist">${S.bookmarks.length ? S.bookmarks.map((b) => `<div class="bmrow" data-bm="${esc(b.url)}"><i class="dot" style="--h:${hueOf(b.title)}">${esc(initial(b.title))}</i><div class="t"><b>${esc(b.title)}</b><small>${esc(shownUrl(b.url))}</small></div><button class="btn sm" data-act="bm-edit" data-url="${esc(b.url)}">Bearbeiten</button><button class="btn sm" data-act="bm-del" data-url="${esc(b.url)}">Löschen</button></div>`).join('') : '<p class="muted">Noch keine Lesezeichen.</p>'}</div>
        <div class="row"><button class="btn pri" data-act="bm-add">+ Lesezeichen hinzufügen</button></div>
      </section>
      <section id="set-panels" class="sp-card"><h2>Seitenpanel</h2>
        <p class="muted">Erstelle eigene Menüs und ordne Bereiche zu. Menüs können weitere Menüs enthalten. Ausblenden entfernt nur den Navigationseintrag – Gesten und Tastenkürzel bleiben aktiv.</p>
        <form id="panelGroupForm" class="groupCreate"><input id="groupName" maxlength="60" placeholder="Zum Beispiel Arbeit oder Freizeit" aria-label="Name des neuen Menüs" required><button class="btn pri" type="submit">Menü erstellen</button></form>
        <div class="bmlist">${allPanels()
          .map(
            (
              p,
              i,
              arr,
            ) => `<div class="bmrow"><i class="pico">${'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + p.icon + '</svg>'}</i><div class="t"><b>${esc(p.title)}</b><small>${esc(p.desc || (p.custom ? 'Eigenes Menü' : ''))}</small><label class="groupAssignment">In Menü<select data-panel-parent="${esc(p.id)}" aria-label="Menü für ${esc(p.title)}"><option value="">Hauptebene</option>${panelGroups()
              .filter((g) => g.id !== p.id)
              .map(
                (g) =>
                  `<option value="${esc(g.id)}" ${p.parent === g.id ? 'selected' : ''}>${esc(g.title)}</option>`,
              )
              .join(
                '',
              )}</select></label>${p.custom ? `<div class="groupRename"><input data-group-name="${esc(p.id)}" aria-label="Menü umbenennen" maxlength="60" value="${esc(p.title)}"><button class="btn sm" data-act="group-rename" data-id="${esc(p.id)}">Speichern</button><button class="btn sm" data-act="group-delete" data-id="${esc(p.id)}">Auflösen</button></div>` : ''}</div>
          <button class="ia" data-act="spp-up" data-id="${esc(p.id)}" aria-label="Nach oben" title="Nach oben" ${i === 0 ? 'disabled' : ''}>▲</button><button class="ia" data-act="spp-down" data-id="${esc(p.id)}" aria-label="Nach unten" title="Nach unten" ${i === arr.length - 1 ? 'disabled' : ''}>▼</button>
          <button class="switch ${isPanelHidden(p.id) ? '' : 'on'}" role="switch" aria-checked="${!isPanelHidden(p.id)}" aria-label="${esc(p.title)} anzeigen" data-act="spp-toggle" data-id="${esc(p.id)}"><i></i></button></div>`,
          )
          .join('')}</div>
        <div class="row"><button class="btn" data-act="spp-reset">Zurücksetzen</button></div>
      </section>
      <section id="set-start" class="sp-card"><h2>Start</h2>
        <div class="swrow"><div><b>Zuletzt geöffnete Seiten merken</b><span>${S.restore ? 'Beim nächsten Start öffnen sich die Tabs von zuletzt.' : 'Aus: Der Browser startet immer mit der Startseite.'}</span></div>
          <button class="switch ${S.restore ? 'on' : ''}" role="switch" aria-checked="${S.restore}" aria-label="Zuletzt geöffnete Seiten merken" data-act="pref-restore"><i></i></button></div>
      </section>
      ${gesturesHTML(S.gesture)}
      <section id="set-search" class="sp-card"><h2>Luna Search</h2>
        <p class="muted">Luna Search nutzt die Brave-Search-API; die Ergebnisse erscheinen direkt im Browser. Den Schlüssel erstellst du unter <button class="link" data-act="open-brave">brave.com/search/api</button>.</p>
        <div class="state ${S.hasKey ? 'ok' : ''}">${S.hasKey ? 'Schlüssel gespeichert ✓' : 'Kein Schlüssel gespeichert'}</div>
        <input id="keyIn" type="password" placeholder="${S.hasKey ? 'Neuen Schlüssel einfügen, um ihn zu ersetzen' : 'Brave-API-Schlüssel einfügen'}" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Brave-API-Schlüssel">
        <div class="row"><button class="btn pri" data-act="key-save">Speichern</button><button class="btn" data-act="key-test" ${S.hasKey ? '' : 'disabled'}>Verbindung testen</button><button class="btn" data-act="key-clear" ${S.hasKey ? '' : 'disabled'}>Entfernen</button></div>
        <div id="keyMsg" class="kmsg ${setMsg.kind}">${esc(setMsg.text)}</div>
        <p class="muted small">Der Schlüssel liegt in einer Datei im App-Ordner, die nur dein Benutzer lesen kann (Rechte 0600). Er wird nie angezeigt und nur an Brave gesendet.</p>
      </section>
      ${spotifySettingsHTML(spotifyAccount, S.autoNextAlways)}
      ${sonosSettingsHTML(sonosState)}
      ${chatSettingsHTML()}
      ${mcpSettingsHTML(mcpStatus)}
      <section id="set-data" class="sp-card"><h2>Daten</h2>
        <div class="swrow"><div><b>Verlauf</b><span>Besuchte Seiten und Suchen auf diesem Gerät.</span></div><button class="btn" data-act="clear-history">Löschen</button></div>
        <div class="swrow"><div><b>Download-Liste</b><span>Entfernt nur die Liste, nicht die Dateien.</span></div><button class="btn" data-act="clear-dl">Leeren</button></div>
      </section>
    </div></div>`;
    // Nur das gewählte Kapitel kommt in den DOM, kein Scrollen zu anderen Kapiteln.
    return html.replace(/<section id="set-([^"]+)"[\s\S]*?<\/section>/g, (section, id) =>
      id === settingsSection ||
      (id === 'sonos' && settingsSection === 'spotify') ||
      (id === 'chat' && settingsSection === 'mcp')
        ? section
        : '',
    );
  }
  function renderSettingsView() {
    const t = cur(),
      el = $('#settingsView');
    const show = !!t && t.mode === 'settings';
    el.hidden = !show;
    if (!show) return;
    const top = el.scrollTop,
      typed = $('#keyIn')?.value || '',
      spotifyTyped = $('#spotifyClientID')?.value || '',
      chatTyped = $('#chatAPIKey')?.value || '';
    const chatFocused = document.activeElement?.id === 'chatAPIKey';
    const spotifyFocused = document.activeElement?.id === 'spotifyClientID';
    el.innerHTML = settingsPageHTML();
    el.querySelectorAll('select').forEach((select) => {
      const shell = document.createElement('span');
      shell.className = 'settings-select';
      select.before(shell);
      shell.append(select);
      shell.insertAdjacentHTML(
        'beforeend',
        '<svg class="settings-select-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg>',
      );
    });
    el.scrollTop = top;
    if ($('#spotifyClientID')) {
      $('#spotifyClientID').value = spotifyTyped;
      if (spotifyFocused) $('#spotifyClientID').focus();
    }
    if ($('#chatAPIKey')) {
      $('#chatAPIKey').value = chatTyped;
      if (chatFocused) $('#chatAPIKey').focus();
    }
    if (typed && $('#keyIn')) $('#keyIn').value = typed;
  }
  // Öffnet die Einstellungen in einem eigenen Tab (vorhandener Tab wird wiederverwendet).
  function openSettings(msg, kind) {
    if (msg !== undefined) setMsg = { text: msg, kind: kind || '' };
    let t = S.tabs.find((x) => x.mode === 'settings');
    if (!t) {
      t = mkTab(S.next++, 'settings:');
      t.mode = 'settings';
      t.title = 'Einstellungen';
      S.tabs.push(t);
    }
    if (S.active !== t.id) activate(t.id);
    else renderAll();
  }
  function keyMsg(text, kind) {
    setMsg = { text, kind: kind || '' };
    const m = $('#keyMsg');
    if (m) {
      m.textContent = text;
      m.className = 'kmsg ' + (kind || '');
    }
  }
  async function testKey() {
    keyMsg('Teste …');
    try {
      await api.keyTest();
      keyMsg('Verbindung zu Brave funktioniert ✓', 'ok');
    } catch (e) {
      keyMsg(String(e?.message || e), 'err');
    }
  }
  async function saveKey() {
    const i = $('#keyIn');
    const v = i ? i.value.trim() : '';
    if (!v) {
      keyMsg('Bitte zuerst einen Schlüssel einfügen.', 'err');
      return;
    }
    try {
      await api.keySet(v);
    } catch (e) {
      keyMsg(String(e?.message || e), 'err');
      return;
    }
    i.value = '';
    S.hasKey = true;
    setMsg = { text: 'Gespeichert. Teste …', kind: '' };
    renderSettingsView();
    await testKey();
    onSearchKeyChanged();
  }

  return {
    renderSettingsView,
    openSettings,
    keyMsg,
    testKey,
    saveKey,
    refreshMCPStatus,
    refreshSonos,
    refreshSpotifyAccount,
    get section() {
      return settingsSection;
    },
    set section(value) {
      settingsSection = value === 'chat' ? 'mcp' : value === 'input' ? 'gestures' : value;
    },
    get mcp() {
      return mcpStatus;
    },
    set mcp(value) {
      mcpStatus = value;
    },
    get sonos() {
      return sonosState;
    },
    set sonos(value) {
      sonosState = value;
    },
    set message(value) {
      setMsg = value;
    },
  };
}
