const images = import.meta.glob('./assets/sonos/*', {
  eager: true,
  query: '?url',
  import: 'default',
});
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function speakerImage(model) {
  const key = model
    .toLowerCase()
    .replace(/^sonos\s*/, '')
    .replace(/[^a-z0-9]/g, '');
  return images[`./assets/sonos/${key}.png`] || images[`./assets/sonos/${key}.jpg`] || '';
}
export function sonosSettingsHTML(s) {
  const devices = s.devices || [],
    selected = s.selected || [];
  return `<section id="set-sonos" class="sp-card sonos-settings"><div class="sonos-hero"><span class="sonos-wordmark">SONOS <i>× Luna</i></span><h2>Dein Sound.<br>Eine Tastatur.</h2><p>Steuere deine Räume mit den Lautstärketasten deines Computers.</p><div class="sonos-keys"><span>−</span><span>♪</span><span>+</span></div></div><div class="sonos-body"><div class="swrow"><div><b>Sonos Sync</b><span>${s.enabled ? 'Aktiv · folgt der Systemlautstärke' : 'Einschalten – Luna findet deine Lautsprecher automatisch.'}</span></div><button class="switch ${s.enabled ? 'on' : ''}" data-act="sonos-toggle" role="switch" aria-label="Sonos Sync" aria-checked="${!!s.enabled}"><i></i></button></div><p class="muted small">Solange Luna läuft, folgen ausgewählte Lautsprecher der Systemlautstärke – auch wenn Luna im Hintergrund ist. Beim Einschalten bleibt die aktuelle Lautstärke erhalten. Die nächste Änderung am Computer setzt auf allen ausgewählten Lautsprechern denselben Prozentwert.</p>${s.supported === false ? '<p class="sonos-notice">Der aktuelle Audioausgang meldet keine regelbare Lautstärke. Wähle zum Beispiel die internen Lautsprecher als Audioausgang.</p>' : ''}<div class="sonos-list-head"><div><h3>Deine Lautsprecher</h3><small>${devices.filter((d) => d.online).length} gefunden · ${selected.length} ausgewählt</small></div><span class="muted small" role="status">${s.scanning ? 'Suche läuft …' : s.enabled ? 'Automatisch · Prüfung alle 5 Sekunden' : 'Suche startet beim Einschalten'}</span></div><div class="sonos-grid">${devices
    .map((d) => {
      const img = speakerImage(d.model);
      const on = selected.includes(d.id);
      return `<button class="sonos-device ${on ? 'selected' : ''} ${d.online ? '' : 'offline'}" data-act="sonos-select" data-id="${esc(d.id)}" aria-pressed="${on}"><span class="sonos-check">${on ? '✓' : '+'}</span><div class="sonos-product">${img ? `<img src="${img}" alt="${esc(d.model)}">` : '<svg viewBox="0 0 80 100" aria-hidden="true"><rect x="16" y="5" width="48" height="90" rx="14"/><circle cx="40" cy="37" r="13"/><circle cx="40" cy="71" r="8"/></svg>'}</div><b>${esc(d.name)}</b><small>${esc(d.model)}${
        devices.filter((x) => x.name === d.name && x.model === d.model).length > 1
          ? ' · ' +
            esc(
              d.id
                .replace(/^uuid:RINCON_/, '')
                .split('_')[0]
                .slice(-6),
            )
          : ''
      }</small><span class="sonos-online">${d.online ? 'Im Netzwerk' : 'Nicht erreichbar'}</span></button>`;
    })
    .join(
      '',
    )}</div>${!devices.length ? `<div class="sonos-empty">${s.scanning ? 'Wir suchen in deinem lokalen Netzwerk …' : s.enabled ? 'Noch keine Lautsprecher entdeckt. Luna sucht automatisch weiter. Mac und Sonos müssen im selben Netzwerk sein.' : 'Schalte Sonos Sync ein, um Lautsprecher automatisch zu finden.'}</div>` : ''}<p class="sonos-notice" role="status">${esc(s.message || '')}</p></div></section>`;
}

// Gleiche Knoten bleiben erhalten: keine neue Animation, kein Fokusverlust beim Polling.
export function updateSonosSettings(host, state) {
  if (!host) return;
  const template = document.createElement('template');
  template.innerHTML = sonosSettingsHTML(state);
  function patch(current, next) {
    if (current.isEqualNode(next)) return;
    if (current.nodeType !== next.nodeType || current.nodeName !== next.nodeName) {
      current.replaceWith(next.cloneNode(true));
      return;
    }
    if (current.nodeType === Node.TEXT_NODE) {
      current.nodeValue = next.nodeValue;
      return;
    }
    if (current.nodeType !== Node.ELEMENT_NODE) return;
    for (const attr of [...current.attributes])
      if (attr.name !== 'disabled' && !next.hasAttribute(attr.name))
        current.removeAttribute(attr.name);
    for (const attr of next.attributes)
      if (current.getAttribute(attr.name) !== attr.value)
        current.setAttribute(attr.name, attr.value);
    const children = [...next.childNodes];
    children.forEach((child, i) => {
      const id = child.nodeType === Node.ELEMENT_NODE && child.getAttribute('data-id');
      if (id && current.childNodes[i]?.getAttribute?.('data-id') !== id) {
        const existing = [...current.children].find((el) => el.getAttribute('data-id') === id);
        current.insertBefore(existing || child.cloneNode(true), current.childNodes[i] || null);
      }
      if (current.childNodes[i]) patch(current.childNodes[i], child);
      else current.append(child.cloneNode(true));
    });
    while (current.childNodes.length > children.length) current.lastChild.remove();
  }
  patch(host, template.content.firstElementChild);
}
