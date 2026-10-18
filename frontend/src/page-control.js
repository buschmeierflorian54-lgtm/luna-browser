// Shared, bounded DOM operations for MCP; no arbitrary JavaScript evaluation.
export function lunaPageAction(a, root = document) {
  const visible = (el) =>
    !!(el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  if (a.action === 'read') {
    const elements = [...root.querySelectorAll('a,button,input,textarea,select,[role="button"]')]
      .filter(visible)
      .slice(0, 200)
      .map((el, i) => {
        el.setAttribute('data-luna-mcp-node', String(i));
        return {
          selector: `[data-luna-mcp-node="${i}"]`,
          tag: el.tagName.toLowerCase(),
          type: el.type || '',
          label: (
            el.getAttribute('aria-label') ||
            el.getAttribute('placeholder') ||
            el.innerText ||
            ''
          ).slice(0, 240),
          href: el.tagName === 'A' ? el.href : undefined,
        };
      });
    return {
      title: document.title,
      url: location.href,
      text: (root.body || root).innerText?.slice(0, 30000) || '',
      elements,
    };
  }
  if (a.action === 'scroll') {
    (root === document ? window : root).scrollBy(Number(a.x) || 0, Number(a.y) || 0);
    return { ok: true };
  }
  if (!a.selector || a.selector.length > 2000)
    throw Error('Ein gültiger CSS-Selektor ist erforderlich.');
  const matches = [...root.querySelectorAll(a.selector)].filter(visible);
  if (matches.length !== 1)
    throw Error(`Selektor muss genau ein sichtbares Element treffen (${matches.length} gefunden).`);
  const el = matches[0];
  if (a.action === 'click') {
    el.scrollIntoView({ block: 'center' });
    el.click();
    return { ok: true };
  }
  if (a.action === 'fill') {
    if (
      !el.matches('input,textarea') ||
      ['password', 'file', 'hidden', 'checkbox', 'radio', 'button', 'submit'].includes(el.type)
    )
      throw Error('Dieses Eingabefeld kann nicht ausgefüllt werden.');
    if (el.disabled || el.readOnly) throw Error('Feld ist nicht bearbeitbar.');
    const proto =
      el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(a.value ?? ''));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true };
  }
  if (a.action === 'select') {
    if (!el.matches('select') || el.disabled || ![...el.options].some((o) => o.value === a.value))
      throw Error('Ungültige Auswahl.');
    el.value = a.value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true };
  }
  throw Error('Unbekannte Seitenaktion.');
}
