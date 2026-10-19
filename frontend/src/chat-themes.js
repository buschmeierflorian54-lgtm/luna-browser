import { colorThemesHTML } from './color-themes.js';

// Assistant text may request the picker; user text and unlinked tool output cannot.
export const requestsThemeWidget = (text) => /\btheme[\s-]+widget\b/i.test(text || '');
export function themeCardAnchors(messages) {
  const anchors = new Set();
  for (let start = 0; start < messages.length;) {
    let end = start + 1;
    while (end < messages.length && messages[end].role !== 'user') end++;
    const turn = messages.slice(start, end);
    const calls = new Set(
      turn
        .flatMap((m) => m.tool_calls || [])
        .filter((c) => c.function?.name === 'browser_customize')
        .map((c) => c.id),
    );
    const show = turn.some((m) => {
      if (m.role === 'assistant' && requestsThemeWidget(m.content)) return true;
      if (m.role !== 'tool' || !calls.has(m.tool_call_id)) return false;
      try {
        const result = JSON.parse(m.content);
        return (
          !result.isError &&
          result.content?.some((c) => {
            if (c.type !== 'text') return false;
            try {
              return JSON.parse(c.text).show_color_picker === true;
            } catch {
              return false;
            }
          })
        );
      } catch {
        return false;
      }
    });
    let anchor = -1;
    for (let i = start; i < end; i++) if (messages[i].role === 'assistant') anchor = i;
    if (show && anchor >= 0) anchors.add(anchor);
    start = end;
  }
  return anchors;
}
export function renderThemeCards(list, messages) {
  const anchors = themeCardAnchors(messages);
  [...list.children].forEach((article, index) => {
    const existing = article.querySelector('.chat-theme-card');
    if (!anchors.has(index)) {
      existing?.remove();
      return;
    }
    if (existing) return;
    const box = document.createElement('section');
    box.className = 'chat-theme-card';
    box.setAttribute('aria-label', 'Theme selbst auswählen');
    box.innerHTML = `<span class="chat-eyebrow">DEINE WAHL</span>${colorThemesHTML()}<p class="chat-theme-status" role="status">Wähle deinen Look – ein Klick übernimmt ihn für den Browser.</p>`;
    box.addEventListener('click', (e) => {
      const button = e.target.closest('[data-act="color-theme"]');
      if (!button) return;
      // The existing global settings handler applies and saves the theme.
      queueMicrotask(() => {
        box
          .querySelectorAll('[data-color]')
          .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
        box.querySelector('.chat-theme-status').textContent =
          `${button.querySelector('.palette-name').textContent} ausgewählt.`;
      });
    });
    article.append(box);
  });
}
