import * as api from './api.js';
import { esc } from './ui.js';
export let config = {
  configured: false,
  providers: {},
  favorites: [],
  selected: 0,
  max_tokens: 30000,
};
let provider = 'openrouter',
  models = [],
  query = '',
  creator = '',
  loading = false,
  message = '',
  request = 0;
const providerName = (p) =>
  p === 'apple' ? 'Lokal auf deinem Mac' : p === 'groq' ? 'Groq' : 'OpenRouter';
export const selectedModel = () =>
  config.selected === 2 ? config.local_model : config.favorites?.[config.selected];
export async function refreshChatStatus() {
  config = (await api.chatStatus()) || config;
  return config;
}
export function modelName() {
  return selectedModel()?.name || config.model || 'Modell wählen';
}
export function pickerHTML() {
  const m = selectedModel();
  return `<button id="chatModelPicker" type="button" class="model-trigger" aria-haspopup="menu" aria-expanded="false" aria-controls="chatModelMenu"><span class="model-orb" aria-hidden="true">✦</span><span class="model-trigger-name">${esc(modelName())}</span><span class="model-provider">${m ? providerName(m.provider) : 'KI'}</span><svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m6 12 4-4 4 4"/></svg></button><div id="chatModelMenu" class="model-menu" role="menu" aria-label="Chat-Modell wählen" hidden><div class="model-menu-heading">DEINE MODELLE <span>Für die nächste Nachricht</span></div>${(config.favorites || []).map((item, i) => `<button type="button" role="menuitemradio" aria-checked="${i === config.selected}" class="model-choice ${i === config.selected ? 'selected' : ''}" data-model-pick="${i}" ${!config.providers?.[item.provider] ? 'disabled' : ''}><span class="model-orb">${item.provider === 'groq' ? 'G' : 'O'}</span><span><b>${esc(item.name)}</b><small>${providerName(item.provider)} · ${!config.providers?.[item.provider] ? 'Schlüssel fehlt' : Number(item.max_tokens || 30000).toLocaleString('de-DE') + ' Tokens'}</small></span><span class="model-check">${i === config.selected ? '✓' : ''}</span></button>`).join('')}${config.local_model ? `<button type="button" role="menuitemradio" aria-checked="${config.selected === 2}" class="model-choice ${config.selected === 2 ? 'selected' : ''}" data-model-pick="2" ${!config.apple?.available ? 'disabled' : ''}><span class="model-orb">✦</span><span><b>Apple Intelligence</b><small>${config.apple?.available ? 'Auf diesem Mac · ohne API-Schlüssel' : esc(config.apple?.reason || 'Nicht verfügbar')}</small></span><span class="model-check">${config.selected === 2 ? '✓' : ''}</span></button>` : ''}<button type="button" class="model-manage" role="menuitem" data-chat="settings">＋ Modelle verwalten <span>↗</span></button></div>`;
}
function listHTML() {
  if (loading) return '<p class="muted" role="status">Modelle werden geladen …</p>';
  const found = models.filter(
    (m) =>
      (!creator || m.creator === creator) &&
      `${m.name} ${m.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    `<p class="muted small">${found.length} von ${models.length} Modellen</p>` +
    found
      .map(
        (m) =>
          `<div class="chat-model-row"><div><b>${esc(m.name)}</b><small>${esc(m.creator)} · ${esc(m.id)}</small><small>${!m.chat ? 'Kein Textchat' : m.tools ? (m.provider === 'groq' ? 'Browser-Werkzeuge: modellabhängig' : 'Browser-Werkzeuge verfügbar') : 'Textchat ohne Browser-Werkzeuge'} · bis ${Number(m.max_tokens).toLocaleString('de-DE')} Tokens</small></div><div class="chat-model-actions">${[0, 1].map((i) => `<button class="btn sm" data-model-add="${esc(m.id)}" data-slot="${i}" ${!m.chat || i > (config.favorites?.length || 0) ? 'disabled' : ''}>${config.favorites?.[i] ? 'Platz ' + (i + 1) + ' ersetzen' : '+ Platz ' + (i + 1)}</button>`).join('')}</div></div>`,
      )
      .join('') +
    (models.length && !found.length ? '<p class="muted">Keine passenden Modelle.</p>' : '')
  );
}
export function chatSettingsHTML() {
  const connected = !!config.providers?.[provider];
  return `<section id="set-chat" class="sp-card"><div class="chat-settings-heading"><span class="chat-brand">Luna Chat</span><span class="chat-model">Deine Modelle</span></div><h2>Deine Modelle. Cloud und lokal.</h2><p class="muted">Verbinde Groq oder OpenRouter und füge bis zu zwei Modelle hinzu. Du kannst beide Anbieter kombinieren und im Chat wechseln. Der dritte Platz ist für Apple Intelligence auf unterstützten Macs reserviert.</p><div class="chat-favorite-grid">${[
    0, 1,
  ]
    .map((i) => {
      const m = config.favorites?.[i];
      return `<div class="chat-favorite"><small>MODELLPLATZ ${i + 1}${i === config.selected && m ? ' · AKTIV' : ''}</small><b>${m ? esc(m.name) : 'Noch frei'}</b><span>${m ? providerName(m.provider) : 'Wähle ein Modell aus der Liste.'}</span>${m ? `<button class="btn sm" data-model-remove="${i}">Entfernen</button>` : ''}</div>`;
    })
    .join(
      '',
    )}${config.local_model ? `<div class="chat-favorite chat-apple-favorite"><small>MODELLPLATZ 3 · LOKAL${config.selected === 2 ? ' · AKTIV' : ''}</small><b>Apple Intelligence</b><span>${esc(config.apple?.reason || 'Verfügbarkeit wird geprüft.')}</span><span>Ohne API-Schlüssel · kleineres Kontextfenster · bis 1.024 Ausgabetokens</span><button class="btn sm" data-model-pick="2" ${!config.apple?.available ? 'disabled' : ''}>Im Chat verwenden</button><button class="btn sm" data-apple-refresh>Erneut prüfen</button></div>` : ''}</div><div class="row chat-provider-tabs">${['openrouter', 'groq'].map((p) => `<button class="btn ${p === provider ? 'pri' : ''}" data-chat-provider="${p}" aria-pressed="${p === provider}">${providerName(p)}${config.providers?.[p] ? ' · verbunden' : ''}</button>`).join('')}</div><label class="fld"><span>${providerName(provider)} API-Schlüssel</span><input id="chatAPIKey" type="password" autocomplete="off" spellcheck="false" aria-label="${providerName(provider)} API-Schlüssel" placeholder="${connected ? 'Schlüssel ersetzen' : 'API-Schlüssel eingeben'}"></label><div class="row"><button class="btn pri" data-model-key="save">Speichern & Modelle laden</button><button class="btn" data-model-key="remove" ${!connected ? 'disabled' : ''}>Schlüssel entfernen</button><button class="btn" data-model-load ${!connected || loading ? 'disabled' : ''}>Modelle aktualisieren</button></div><p id="chatConfigMessage" role="status" class="kmsg">${esc(message)}</p>${
    connected
      ? `<div class="chat-model-filters"><input id="chatModelSearch" type="search" placeholder="Modellname suchen …" aria-label="Modellname suchen" value="${esc(query)}"><select id="chatModelCreator" aria-label="Nach Ersteller filtern"><option value="">Alle Ersteller</option>${[
          ...new Set(models.map((m) => m.creator)),
        ]
          .sort()
          .map(
            (c) =>
              `<option ${c === creator ? 'selected' : ''} value="${esc(c)}">${esc(c)}</option>`,
          )
          .join(
            '',
          )}</select></div><div id="chatModelResults" class="chat-model-results">${listHTML()}</div>`
      : '<p class="muted">Die Modellliste erscheint erst nach dem Speichern deines API-Schlüssels.</p>'
  }<p class="muted small">Maximal 30.000 Ausgabetokens, bei kleineren Modellgrenzen entsprechend weniger. Nachrichten, Chatverlauf und angeforderte Browserinhalte gehen an den gewählten Anbieter. Schlüssel bleiben im lokalen Backend. Modelle ohne Textchat werden angezeigt, sind aber nicht auswählbar. Die Nutzung kann Kosten beim Anbieter verursachen.</p></section>`;
}
export function initModelSettings({ renderSettings, changed, toast }) {
  const update = () => {
    renderSettings();
    changed();
  };
  async function load() {
    const seq = ++request,
      p = provider;
    models = [];
    loading = true;
    message = '';
    update();
    try {
      const result = await api.chatModels(p);
      if (seq !== request) return;
      models = result || [];
      message = models.length
        ? 'Modelle geladen. Wähle deinen Modellplatz.'
        : 'Der Anbieter hat keine Modelle zurückgegeben.';
    } catch (e) {
      if (seq !== request) return;
      message = String(e?.message || e);
    } finally {
      if (seq === request) {
        loading = false;
        update();
      }
    }
  }
  document.addEventListener('input', (e) => {
    if (e.target.id === 'chatModelSearch') {
      query = e.target.value;
      document.querySelector('#chatModelResults').innerHTML = listHTML();
    }
  });
  document.addEventListener('change', async (e) => {
    if (e.target.id === 'chatModelCreator') {
      creator = e.target.value;
      document.querySelector('#chatModelResults').innerHTML = listHTML();
    }
  });
  function closePicker(focus = false) {
    const trigger = document.querySelector('#chatModelPicker'),
      menu = document.querySelector('#chatModelMenu');
    if (menu) menu.hidden = true;
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      if (focus) trigger.focus();
    }
  }
  document.addEventListener('keydown', (e) => {
    const menu = document.querySelector('#chatModelMenu'),
      trigger = document.querySelector('#chatModelPicker');
    if (!menu || !trigger) return;
    if (e.key === 'Escape' && !menu.hidden) {
      e.preventDefault();
      closePicker(true);
    }
    if (e.target === trigger && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      trigger.click();
    } else if (menu.contains(e.target) && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      const options = [...menu.querySelectorAll('button:not(:disabled)')];
      let i = options.indexOf(document.activeElement);
      i =
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? options.length - 1
            : (i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[i]?.focus();
    }
  });
  document.addEventListener('focusin', (e) => {
    if (!e.target.closest('.chat-picker')) closePicker();
  });
  document.addEventListener('click', async (e) => {
    const trigger = e.target.closest('#chatModelPicker');
    if (trigger) {
      const menu = document.querySelector('#chatModelMenu');
      menu.hidden = !menu.hidden;
      trigger.setAttribute('aria-expanded', String(!menu.hidden));
      if (!menu.hidden)
        menu
          .querySelector('button[aria-checked="true"]:not(:disabled),button:not(:disabled)')
          ?.focus();
      return;
    }
    if (e.target.closest('[data-apple-refresh]')) {
      try {
        await refreshChatStatus();
        update();
      } catch (err) {
        toast(String(err));
      }
      return;
    }
    const choice = e.target.closest('[data-model-pick]');
    if (choice) {
      choice.disabled = true;
      try {
        config = await api.chatSelectModel(Number(choice.dataset.modelPick));
        update();
        closePicker(true);
      } catch (err) {
        toast(String(err));
        choice.disabled = false;
      }
      return;
    }
    if (!e.target.closest('.chat-picker') || e.target.closest('[data-chat="settings"]'))
      closePicker();
  });
  document.addEventListener('click', async (e) => {
    const button = e.target.closest(
      '[data-chat-provider],[data-model-key],[data-model-load],[data-model-add],[data-model-remove]',
    );
    if (!button) return;
    button.disabled = true;
    try {
      if (button.dataset.chatProvider) {
        provider = button.dataset.chatProvider;
        request++;
        loading = false;
        models = [];
        query = '';
        creator = '';
        message = '';
        const key = document.querySelector('#chatAPIKey');
        if (key) key.value = '';
        update();
        if (config.providers?.[provider]) await load();
        return;
      }
      if (button.hasAttribute('data-model-load')) {
        await load();
        return;
      }
      if (button.dataset.modelKey) {
        const p = provider;
        const seq = ++request;
        if (button.dataset.modelKey === 'save') {
          const input = document.querySelector('#chatAPIKey');
          const key = input.value;
          config = await api.chatProviderKey(p, key);
          if (seq !== request) return;
          input.value = '';
          await load();
        } else {
          config = await api.chatRemoveProviderKey(p);
          if (seq !== request) return;
          models = [];
          loading = false;
          message = 'Schlüssel entfernt.';
          update();
        }
        return;
      }
      if (button.dataset.modelAdd !== undefined) {
        config = await api.chatSaveModel(
          Number(button.dataset.slot),
          provider,
          button.dataset.modelAdd,
        );
        message = 'Modell gespeichert.';
        update();
      }
      if (button.dataset.modelRemove !== undefined) {
        config = await api.chatSaveModel(Number(button.dataset.modelRemove), '', '');
        message = 'Modellplatz entfernt.';
        update();
      }
    } catch (err) {
      message = String(err?.message || err);
      update();
    } finally {
      button.disabled = false;
    }
  });
}
