import { renderThemeCards } from './chat-themes.js';
import { renderMusicCards } from './chat-music.js';
import * as api from './api.js';
import { $, esc } from './ui.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

import {
  config,
  refreshChatStatus,
  chatSettingsHTML,
  pickerHTML,
  modelName,
  initModelSettings,
} from './chat-models.js';
export { refreshChatStatus, chatSettingsHTML };
const icon = (path) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const icons = {
  side: icon('<rect x="3" y="4" width="18" height="16" rx="4"/><path d="M9 4v16"/>'),
  plus: icon('<path d="M12 5v14M5 12h14"/>'),
  send: icon('<path d="m6 11 6-6 6 6M12 5v14"/>'),
  stop: icon('<rect x="6" y="6" width="12" height="12" rx="3"/>'),
  trash: icon('<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7"/>'),
  copy: icon('<rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V4H4v12h4"/>'),
};
export function chatMarkdown(text) {
  return DOMPurify.sanitize(marked.parse(text || '', { breaks: true, gfm: true }), {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'del',
      'h1',
      'h2',
      'h3',
      'h4',
      'ul',
      'ol',
      'li',
      'blockquote',
      'pre',
      'code',
      'a',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'hr',
    ],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false,
  });
}
export function initChat({ openSettings, renderSettings, toast, notifications, openURL }) {
  const root = $('#chatView');
  let mounted = false,
    visible = false,
    active = localStorage.getItem('luna-chat-active') || '',
    summaries = [],
    cache = new Map(),
    drafts = new Map(),
    sending = false,
    loadID = 0,
    pollBusy = false;
  let collapsed = localStorage.getItem('luna-chat-collapsed') === 'true';
  const current = () => cache.get(active);
  const q = (s) => root.querySelector(s);
  function sidebar() {
    if (!mounted) return;
    root.classList.toggle('chat-history-collapsed', collapsed);
    q('[data-chat="toggle"]').setAttribute('aria-expanded', String(!collapsed));
    q('[data-chat="toggle"]').setAttribute(
      'aria-label',
      collapsed ? 'Chatverlauf ausklappen' : 'Chatverlauf einklappen',
    );
    q('#chatHistory').hidden = collapsed;
    q('#chatHistoryList').innerHTML = summaries.length
      ? summaries
          .map(
            (c) =>
              `<div class="chat-history-item ${c.id === active ? 'selected' : ''}"><button data-chat="select" data-id="${esc(c.id)}" title="${esc(c.title)}"><span>${esc(c.title)}</span><small>${c.status === 'streaming' ? 'Antwort läuft …' : new Date(c.updated).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</small></button><button class="chat-delete" data-chat="delete" data-id="${esc(c.id)}" aria-label="Chat löschen: ${esc(c.title)}" ${c.status === 'streaming' ? 'disabled' : ''}>${icons.trash}</button></div>`,
          )
          .join('')
      : '<p class="chat-history-empty">Deine Gespräche erscheinen hier, sobald du loslegst.</p>';
  }
  function composer() {
    if (!mounted) return;
    const streaming = current()?.status === 'streaming';
    const picker = q('.chat-picker');
    const signature = JSON.stringify([
      config.favorites,
      config.providers,
      config.selected,
      sending,
      streaming,
    ]);
    if (picker && picker.dataset.signature !== signature) {
      picker.innerHTML = pickerHTML();
      picker.dataset.signature = signature;
    }
    const select = q('#chatModelPicker');
    if (select) select.disabled = sending || streaming;
    const caption = q('#chatModelCaption');
    if (caption)
      caption.textContent =
        modelName() +
        ' · bis ' +
        Number(config.max_tokens || 30000).toLocaleString('de-DE') +
        ' Tokens';
    q('#chatPrompt').disabled = sending;
    q('#chatSend').disabled = sending || streaming || !q('#chatPrompt').value.trim();
    q('#chatStop').hidden = !streaming;
    q('#chatSend').hidden = streaming;
    q('#chatNotice').textContent = !config.configured
      ? 'Zum Loslegen: Anbieter verbinden und ein Modell unter KI & MCP hinzufügen.'
      : config.selected === 2
        ? 'Apple Intelligence antwortet lokal auf diesem Mac. Browser-Werkzeuge können angeforderte Onlinedienste nutzen.'
        : 'Antworten können Fehler enthalten. Beim Modellwechsel wird der Chatverlauf an den gewählten Anbieter gesendet.';
  }
  function messages(reset = false) {
    if (!mounted) return;
    const c = current(),
      list = q('#chatMessages'),
      scroller = q('#chatScroll');
    const follow = reset || scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 90;
    const items = c?.messages || [];
    q('#chatWelcome').hidden = items.length > 0;
    q('#chatTitle').textContent = c?.title || 'Neuer Chat';
    if (reset || list.children.length > items.length) list.innerHTML = '';
    items.forEach((m, i) => {
      let item = list.children[i];
      if (!item) {
        item = document.createElement('article');
        item.className = 'chat-message ' + m.role;
        item.innerHTML = `<div class="chat-message-meta"><b>${m.role === 'user' ? 'Du' : m.provider === 'apple' ? 'Sira' : 'Luna'}${m.role === 'assistant' && m.provider === 'apple' ? '<span class="chat-origin">Apple Intelligence · lokal</span>' : ''}</b><button class="chat-icon" data-chat="copy" data-index="${i}" aria-label="Nachricht kopieren">${icons.copy}</button></div><div class="chat-message-text"></div>`;
        list.append(item);
      }
      item.hidden = m.role === 'tool';
      let activity = item.querySelector('.chat-tool-activity');
      if (m.tool_calls?.length) {
        if (!activity) {
          activity = document.createElement('div');
          activity.className = 'chat-tool-activity';
          item.append(activity);
        }
        activity.textContent = m.tool_calls
          .map((call) => {
            const result = items.find((x) => x.role === 'tool' && x.tool_call_id === call.id);
            let status = c?.status === 'streaming' ? 'Wird ausgeführt …' : 'Unterbrochen';
            if (result) {
              try {
                status = JSON.parse(result.content).isError ? 'Fehlgeschlagen' : 'Abgeschlossen';
              } catch {
                status = 'Abgeschlossen';
              }
            }
            return call.function.name + ' · ' + status;
          })
          .join('\n');
      }
      if (m.provider === 'apple' && m.tool_calls?.length) {
        let details = item.querySelector('.sira-tool-details');
        if (!details) {
          details = document.createElement('details');
          details.className = 'sira-tool-details';
          details.innerHTML = '<summary>Werkzeugdetails · Anfrage & Antwort</summary><pre></pre>';
          item.append(details);
        }
        const trace = m.tool_calls
          .map((call) => {
            const result = items.find((x) => x.role === 'tool' && x.tool_call_id === call.id);
            const pretty = (text) => {
              try {
                return JSON.stringify(JSON.parse(text), null, 2);
              } catch {
                return text;
              }
            };
            return (
              (call.trace?.length ? 'PARAMETERDIALOG\n' + call.trace.join('\n\n') + '\n\n' : '') +
              'ANFRAGE · ' +
              call.function.name +
              '\n' +
              pretty(call.function.arguments) +
              '\n\nANTWORT\n' +
              (result ? pretty(result.content) : 'Wird ausgeführt …')
            );
          })
          .join('\n\n');
        details.querySelector('pre').textContent = trace;
      }
      if (item._text !== m.content) {
        const body = item.querySelector('.chat-message-text');
        if (m.role === 'user') body.textContent = m.content;
        else body.innerHTML = chatMarkdown(m.content);
        item._text = m.content;
      }
    });
    renderMusicCards(list, items);
    renderThemeCards(list, items);
    q('#chatBusy').hidden = c?.status !== 'streaming';
    q('#chatBusy span').textContent =
      c?.activity || (items.at(-1)?.provider === 'apple' ? 'Sira antwortet …' : 'Luna antwortet …');
    const error =
      c?.error ||
      (c?.finish === 'length'
        ? 'Die Antwort hat das aktuelle Ausgabelimit erreicht.'
        : c?.status === 'stopped'
          ? 'Antwort gestoppt.'
          : '');
    q('#chatContextNotice').textContent = c?.context_notice || '';
    q('#chatContextNotice').hidden = !c?.context_notice;
    q('#chatError').textContent = error;
    q('#chatError').hidden = !error;
    if (follow) scroller.scrollTop = scroller.scrollHeight;
    composer();
  }
  function accept(c) {
    if (!c?.id) return;
    const previous = cache.get(c.id);
    if (previous && previous.revision > c.revision) return;
    cache.set(c.id, c);
    const summary = { id: c.id, title: c.title, updated: c.updated, status: c.status };
    const old = summaries.find((x) => x.id === c.id);
    if (!old || JSON.stringify(old) !== JSON.stringify(summary)) {
      summaries = [summary, ...summaries.filter((x) => x.id !== c.id)].sort(
        (a, b) => b.updated - a.updated,
      );
      sidebar();
    }
    if (c.id === active) messages();
  }
  async function select(id) {
    if (sending) return;
    const token = ++loadID;
    drafts.set(active, q('#chatPrompt')?.value || '');
    active = id;
    localStorage.setItem('luna-chat-active', id);
    q('#chatPrompt').value = drafts.get(id) || '';
    sidebar();
    messages(true);
    if (id) {
      try {
        const c = await api.chatGet(id);
        if (token === loadID) {
          accept(c);
          messages(true);
        }
      } catch (e) {
        if (token === loadID) {
          active = '';
          messages(true);
          toast(String(e));
        }
      }
    }
    q('#chatPrompt').focus();
  }
  function mount() {
    if (mounted) return;
    mounted = true;
    root.innerHTML = `<div class="chat-shell"><aside id="chatHistory" class="chat-history" aria-label="Letzte Chats"><div class="chat-history-top"><span>Deine Gespräche</span><button class="chat-icon" data-chat="new" aria-label="Neuer Chat">${icons.plus}</button></div><div id="chatHistoryList"></div><button class="chat-config-link" data-chat="settings">Modelle & Einstellungen ↗</button></aside><main class="chat-main"><header class="chat-topbar"><button class="chat-icon" data-chat="toggle" aria-controls="chatHistory" aria-expanded="true">${icons.side}</button><div><span class="chat-brand">Luna Chat</span><small id="chatTitle">Neuer Chat</small></div><button class="chat-icon" data-chat="new" aria-label="Neues Gespräch">${icons.plus}</button></header><div id="chatScroll" class="chat-scroll"><div id="chatWelcome" class="chat-welcome"><span class="chat-spark" aria-hidden="true">✳</span><span class="chat-eyebrow">RAUM FÜR DEINE GEDANKEN</span><h1>Was beschäftigt dich?</h1><p>Eine Frage, eine Idee oder der nächste große Plan.<br>Lass uns zusammen weiterdenken.</p><div class="chat-starters"><button data-chat="starter" data-text="Hilf mir, eine Idee weiterzuentwickeln.">Eine Idee entwickeln <span>↗</span></button><button data-chat="starter" data-text="Erkläre mir ein Thema verständlich.">Etwas verstehen <span>↗</span></button><button data-chat="starter" data-text="Hilf mir, einen Text zu schreiben.">Einen Text schreiben <span>↗</span></button></div></div><div id="chatMessages" class="chat-messages" aria-label="Nachrichten"></div><div id="chatBusy" class="chat-busy" role="status" hidden><i></i><i></i><i></i><span>Luna antwortet …</span></div><p id="chatContextNotice" class="chat-context-notice" role="status" hidden></p><p id="chatError" class="chat-error" role="status" hidden></p></div><footer class="chat-composer-wrap"><form id="chatForm" class="chat-composer"><textarea id="chatPrompt" rows="2" maxlength="100000" aria-label="Nachricht an Luna" placeholder="Schreib Luna eine Nachricht …"></textarea><div class="chat-composer-bottom"><div class="chat-picker">${pickerHTML()}</div><button id="chatSend" type="submit" aria-label="Nachricht senden">${icons.send}</button><button id="chatStop" type="button" data-chat="stop" aria-label="Antwort stoppen" hidden>${icons.stop}</button></div></form><p id="chatNotice"></p></footer></main></div>`;
    q('#chatPrompt').addEventListener('input', () => {
      drafts.set(active, q('#chatPrompt').value);
      composer();
    });
    q('#chatPrompt').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        if (!q('#chatSend').disabled && !q('#chatSend').hidden) q('#chatForm').requestSubmit();
      }
    });
    q('#chatForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (sending || current()?.status === 'streaming') return;
      const input = q('#chatPrompt'),
        text = input.value.trim();
      if (!text) return;
      if (!config.configured) {
        openSettings();
        return;
      }
      sending = true;
      composer();
      try {
        if (!active) {
          const c = await api.chatCreate();
          active = c.id;
          drafts.set(active, text);
          drafts.delete('');
          localStorage.setItem('luna-chat-active', active);
          accept(c);
        }
        const c = await api.chatSend(active, text);
        accept(c);
        input.value = '';
        drafts.set(active, '');
        q('#chatScroll').scrollTop = q('#chatScroll').scrollHeight;
      } catch (err) {
        toast(String(err?.message || err));
      } finally {
        sending = false;
        composer();
        input.focus();
      }
    });
    sidebar();
    messages(true);
  }
  root.addEventListener('click', async (e) => {
    const link = e.target.closest('.chat-message-text a');
    if (link) {
      e.preventDefault();
      try {
        const u = new URL(link.getAttribute('href'));
        if (['http:', 'https:'].includes(u.protocol)) openURL(u.href);
      } catch {}
      return;
    }
    const button = e.target.closest('[data-chat]');
    if (!button) return;
    const action = button.dataset.chat;
    try {
      if (action === 'toggle') {
        collapsed = !collapsed;
        localStorage.setItem('luna-chat-collapsed', String(collapsed));
        sidebar();
      }
      if (action === 'settings') openSettings();
      if (action === 'new') await select('');
      if (action === 'select') await select(button.dataset.id);
      if (action === 'starter') {
        q('#chatPrompt').value = button.dataset.text;
        q('#chatPrompt').focus();
        composer();
      }
      if (action === 'play-song') {
        button.disabled = true;
        try {
          await api.spotifyPlay(button.dataset.uri);
          toast('Song an Spotify übergeben');
        } finally {
          button.disabled = false;
        }
      }
      if (action === 'stop') await api.chatCancel(active);
      if (action === 'copy') {
        await navigator.clipboard.writeText(
          current()?.messages[+button.dataset.index]?.content || '',
        );
        toast('Nachricht kopiert');
      }
      if (action === 'delete') {
        const id = button.dataset.id;
        await notifications.ask({
          kind: 'history',
          title: 'Diesen Chat löschen?',
          message: 'Die Unterhaltung wird von diesem Mac entfernt.',
          confirmLabel: 'Chat löschen',
          onConfirm: async () => {
            await api.chatDelete(id);
            summaries = summaries.filter((c) => c.id !== id);
            cache.delete(id);
            drafts.delete(id);
            if (active === id) await select('');
            sidebar();
          },
        });
      }
    } catch (err) {
      toast(String(err?.message || err));
    }
  });
  initModelSettings({
    renderSettings,
    toast,
    changed: () => {
      if (mounted) composer();
    },
  });
  api.onChat(accept);
  // Full snapshots recover a missed UI event without repeating an API request.
  setInterval(async () => {
    if (!visible || pollBusy || !active || current()?.status !== 'streaming') return;
    pollBusy = true;
    try {
      accept(await api.chatGet(active));
    } catch {
    } finally {
      pollBusy = false;
    }
  }, 1500);
  return {
    show(on) {
      root.hidden = !on;
      if (!on) {
        visible = false;
        return;
      }
      mount();
      if (visible) return;
      visible = true;
      Promise.all([api.chatList(), refreshChatStatus()])
        .then(async ([list]) => {
          summaries = list || [];
          if (active && !summaries.some((c) => c.id === active)) active = '';
          sidebar();
          composer();
          if (active) accept(await api.chatGet(active));
          else messages(true);
        })
        .catch((err) => toast(String(err)));
      q('#chatPrompt').focus();
    },
  };
}
