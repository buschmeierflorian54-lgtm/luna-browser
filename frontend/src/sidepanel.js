// Seitenpanel-Baukasten.
//
// Jeder Bereich (Lesezeichen, Verlauf, Downloads, Notizen, später mehr) ist nur eine Registrierung:
//
//   registerPanel({
//     id: 'history', title: 'Verlauf', desc: 'Besuchte Seiten',          // desc erscheint in den Einstellungen
//     icon: '<circle …/>',                                                // SVG-Inhalt (24×24, Linienstil)
//     parent: 'library',                                                // optional: Untermenü eines registrierten Bereichs
//     order: 20,                                                          // Standardreihenfolge
//     search: { placeholder: 'Verlauf durchsuchen' },                     // optional: zeigt ein Suchfeld
//     count: () => '16 Einträge',                                         // optional: Zähler im Kopf
//     primary: () => ({ label: '+ Neu', onClick() {} }),                  // optional: EINE Hauptaktion im Kopf
//     menu: () => [{ label: 'Löschen …', danger: true, onClick() {} }],   // optional: Zweitaktionen im ⋯-Menü
//     badge: () => 3 | true | '' ,                                        // optional: Zahl oder Punkt an der Icon-Leiste
//     keep: () => false,                                                  // optional: true = Inhalt jetzt nicht neu zeichnen (z. B. beim Tippen)
//     render: async ({ q }) => '<html>',                                  // Inhalt
//   });
//
// Das Gerüst kümmert sich um beschriftete Navigation (scrollt bei vielen Bereichen), Kopf, Suche, Esc/Pfeiltasten,
// Breite per Ziehen und darum, welche Bereiche der Benutzer ein- oder ausgeblendet bzw. umsortiert hat.

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const LS = 'fm-side-cfg',
  LS_W = 'fm-side-w';
const reg = new Map();
let host = null,
  env = null,
  built = false;
let cfg = { active: 'bookmarks', hidden: [], order: [], groups: [], parents: {} };
const queries = {};
let chooserOpen = false;
let renderVersion = 0;
let actions = []; // Klick-Handler der aktuellen Kopf-Aktionen (per Index)

try {
  Object.assign(cfg, JSON.parse(localStorage.getItem(LS) || '{}'));
} catch {
  /* Standard */
}
try {
  const w = +localStorage.getItem(LS_W);
  if (w >= 260 && w <= 560) document.documentElement.style.setProperty('--sidew', w + 'px');
} catch {
  /* Standard */
}
const save = () => {
  try {
    localStorage.setItem(LS, JSON.stringify(cfg));
  } catch {
    /* nur für diese Sitzung */
  }
};

const svg = (d, s = 20) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const X =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const SEARCH =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
const GEAR =
  '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.2 1.3L10 21h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z"/>';
const MORE =
  '<circle cx="5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="19" cy="12" r="1.7" fill="currentColor"/>';

const FOLDER = '<path d="M3 7V5h6l2 2h10v13H3z"/>';
for (const g of cfg.groups || [])
  reg.set(g.id, { ...g, parent: cfg.parents?.[g.id], custom: true, icon: FOLDER });
export const panelGroups = () => allPanels().filter((p) => p.custom);
export function addPanelGroup(title) {
  title = title.trim().slice(0, 60);
  if (!title) return false;
  const g = {
    id:
      'group-' +
      Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => n.toString(16)).join('-'),
    title,
    order: 100 + reg.size * 10,
  };
  (cfg.groups ||= []).push(g);
  reg.set(g.id, { ...g, custom: true, icon: FOLDER });
  save();
  return true;
}
export function renamePanelGroup(id, title) {
  title = title.trim().slice(0, 60);
  if (!title || !reg.get(id)?.custom) return;
  reg.get(id).title = title;
  cfg.groups.find((g) => g.id === id).title = title;
  save();
}
export function assignPanel(id, parent) {
  const p = reg.get(id);
  if (!p || (parent && !reg.get(parent)?.custom)) return false;
  if (parent && ancestors(reg.get(parent)).some((a) => a.id === id)) return false;
  p.parent = parent || undefined;
  (cfg.parents ||= {})[id] = parent;
  save();
  return true;
}
export function removePanelGroup(id) {
  if (!reg.get(id)?.custom) return;
  const parent = reg.get(id).parent || '';
  for (const p of reg.values()) if (p.parent === id) assignPanel(p.id, parent);
  reg.delete(id);
  cfg.groups = cfg.groups.filter((g) => g.id !== id);
  delete cfg.parents[id];
  cfg.hidden = cfg.hidden.filter((x) => x !== id);
  cfg.order = cfg.order.filter((x) => x !== id);
  save();
}
/* ---------- Registry und Anpassung ---------- */
// parent: ID eines bereits registrierten Bereichs; beliebig tief verschachtelbar.
export function registerPanel(def) {
  if (!def.id || !def.title || reg.has(def.id))
    throw new Error('Bereich braucht eine eindeutige ID und einen Titel');
  if (def.parent && !reg.has(def.parent))
    throw new Error('Übergeordneten Bereich zuerst registrieren');
  reg.set(def.id, {
    order: 100 + reg.size * 10,
    ...def,
    parent: cfg.parents?.[def.id] ?? def.parent,
  });
}
function ancestors(p) {
  const list = [];
  while (p) {
    list.unshift(p);
    p = reg.get(p.parent);
  }
  return list;
}
export function allPanels() {
  const pos = (p) => {
    const i = cfg.order.indexOf(p.id);
    return i < 0 ? 1000 + p.order : i;
  };
  return [...reg.values()].sort((a, b) => pos(a) - pos(b));
}
export const isPanelHidden = (id) => cfg.hidden.includes(id);
export function visiblePanels() {
  const v = allPanels().filter((p) => !ancestors(p).some((a) => cfg.hidden.includes(a.id)));
  return v.length ? v : allPanels().slice(0, 1);
}
export function setPanelHidden(id, hide) {
  if (hide && visiblePanels().filter((p) => !p.parent).length <= 1 && !reg.get(id)?.parent)
    return false; // mindestens ein Bereich bleibt
  cfg.hidden = cfg.hidden.filter((x) => x !== id);
  if (hide) cfg.hidden.push(id);
  if (hide && ancestors(reg.get(cfg.active)).some((p) => p.id === id))
    cfg.active = visiblePanels()[0].id;
  save();
  return true;
}
export function movePanel(id, dir) {
  const ids = allPanels().map((p) => p.id),
    i = ids.indexOf(id),
    j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  cfg.order = ids;
  save();
}
export function resetPanels() {
  for (const g of panelGroups()) removePanelGroup(g.id);
  cfg.hidden = [];
  cfg.order = [];
  cfg.parents = {};
  save();
}
export const activePanel = () => cfg.active;
export function setActivePanel(id) {
  if (reg.has(id)) {
    cfg.active = id;
    chooserOpen = false;
    save();
  }
}

/* ---------- Aufbau ---------- */
export function initSidePanel(options) {
  env = options;
  host = options.host;
  host.addEventListener('click', onClick);
  host.addEventListener('input', onInput);
  host.addEventListener('keydown', onKey);
  host.addEventListener('pointerdown', onGrip);
  host.addEventListener('dblclick', (ev) => {
    if (ev.target.id === 'sideGrip') {
      document.documentElement.style.removeProperty('--sidew');
      try {
        localStorage.removeItem(LS_W);
      } catch {
        /* egal */
      }
    }
  });
}

function frame() {
  host.innerHTML = `<div class="sw">
    <header class="spShell"><button class="spChoose" data-sp-choose aria-expanded="false" aria-controls="spPicker">${svg(FOLDER, 18)}<span>Bereich wechseln</span>${svg('<path d="m6 9 6 6 6-6"/>', 14)}</button><button class="ib sm" data-sp-close aria-label="Seitenpanel schließen" title="Schließen (Esc)">${X}</button></header>
    <div id="spPicker" class="spPicker" hidden><input id="spFilter" placeholder="Bereich finden …" aria-label="Bereiche durchsuchen"><nav id="spRail" aria-label="Bereiche"></nav></div>
    <div class="spc">
      <div id="spTrail" class="spTrail"></div>
      <header class="spH"><div class="spHeading"><h2 id="spT"></h2><span class="cnt" id="spCnt"></span></div><span class="grow"></span><span id="spPrim"></span>
        <button class="ib sm" id="spMore" data-sp-more aria-label="Weitere Aktionen" title="Weitere Aktionen" hidden>${svg(MORE, 18)}</button></header>
      <p class="spDescription" id="spDesc"></p>
      <div class="spSearch" id="spSearch" hidden>${SEARCH}<input id="spQ" type="text" spellcheck="false" autocomplete="off"><button class="spClr" data-sp-clear aria-label="Suche leeren" hidden>${X}</button></div>
      <div id="spChildren" class="spChildren"></div>
      <div class="spBody" id="spBody" tabindex="-1" role="region" aria-labelledby="spT"></div></div>
    <footer class="spFooter"><button data-sp-cfg>${svg(GEAR, 16)}<span>Seitenleiste anpassen</span>${svg('<path d="m9 5 7 7-7 7"/>', 14)}</button></footer></div>`;
  const grip = document.createElement('div');
  grip.id = 'sideGrip';
  grip.title = 'Breite ändern (Doppelklick: zurücksetzen)';
  host.prepend(grip);
  built = true;
}
function paintRail() {
  const rail = host.querySelector('#spRail');
  if (!rail) return;
  host.querySelector('#spPicker').hidden = !chooserOpen;
  host.querySelector('[data-sp-choose]').setAttribute('aria-expanded', String(chooserOpen));
  const query = host.querySelector('#spFilter').value.trim().toLowerCase();
  const entries = visiblePanels().filter((p) =>
    query
      ? ancestors(p)
          .map((a) => a.title)
          .join(' ')
          .toLowerCase()
          .includes(query)
      : !p.parent,
  );
  rail.innerHTML =
    entries
      .map(
        (p) =>
          `<button class="spNav ${p.id === cfg.active ? 'on' : ''}" data-sp="${esc(p.id)}">${svg(p.icon || FOLDER, 18)}<span>${esc(p.title)}${
            query && p.parent
              ? `<small>${esc(
                  ancestors(p)
                    .slice(0, -1)
                    .map((a) => a.title)
                    .join(' / '),
                )}</small>`
              : ''
          }</span><span class="spNavArrow">${p.id === cfg.active ? '✓' : '›'}</span></button>`,
      )
      .join('') || '<p class="muted">Keine Bereiche gefunden.</p>';
}

async function paintContent() {
  const p = reg.get(cfg.active),
    body = host.querySelector('#spBody');
  if (!p || !body) return;
  const version = ++renderVersion;
  const q = queries[p.id] || '';
  host.querySelector('#spDesc').textContent = p.desc || '';

  host.querySelector('#spTrail').innerHTML = p.parent
    ? `<button data-sp="${esc(p.parent)}">← ${esc(reg.get(p.parent).title)}</button>`
    : '';
  host.querySelector('#spChildren').innerHTML = visiblePanels()
    .filter((child) => child.parent === p.id)
    .map(
      (child) =>
        `<button data-sp="${esc(child.id)}">${svg(child.icon || GEAR, 17)}<span>${esc(child.title)}</span><span aria-hidden="true">›</span></button>`,
    )
    .join('');
  host.querySelector('#spT').textContent = p.title;
  host.querySelector('#spCnt').textContent = p.count ? p.count() : '';
  actions = [];
  const prim = p.primary ? p.primary() : null;
  host.querySelector('#spPrim').innerHTML = prim
    ? `<button class="spBtn pri" data-sp-act="${actions.push(prim.onClick) - 1}">${esc(prim.label)}</button>`
    : '';
  const menu = p.menu ? p.menu() : [];
  host.querySelector('#spMore').hidden = !menu.length;
  host.querySelector('#spMore')._menu = menu;
  const sb = host.querySelector('#spSearch');
  sb.hidden = !p.search;
  if (p.search) {
    const i = sb.querySelector('input');
    i.placeholder = p.search.placeholder || 'Suchen';
    i.setAttribute('aria-label', i.placeholder);
    if (i !== document.activeElement) i.value = q;
    sb.querySelector('.spClr').hidden = !q;
  }
  if (p.keep && p.keep()) return; // z. B. während getippt wird
  const top = body.dataset.panel === p.id ? body.scrollTop : 0;
  let html;
  try {
    html = p.render ? await p.render({ q: q.trim().toLowerCase(), rawQ: q }) : '';
  } catch {
    html =
      '<div class="empty2"><b>Laden nicht möglich</b><p>Öffne den Bereich erneut, um es noch einmal zu versuchen.</p></div>';
  }
  if (version !== renderVersion || cfg.active !== p.id || !env.isOpen()) return; // inzwischen woanders
  body.innerHTML = html;
  body.dataset.panel = p.id;
  body.scrollTop = top;
  if (p.rendered) p.rendered(body);
}
export async function renderSide() {
  if (!host) return;
  host.hidden = !env.isOpen();
  if (!env.isOpen()) {
    renderVersion++;
    built = false;
    return;
  }
  const vis = visiblePanels();
  if (!vis.length) return;
  if (!reg.has(cfg.active)) cfg.active = vis[0].id;
  if (!built || !host.querySelector('.sw')) frame();
  paintRail();
  await paintContent();
}
export function refreshBadges() {
  if (host && env.isOpen()) paintRail();
}

/* ---------- Ereignisse ---------- */
function onClick(ev) {
  const t = ev.target;
  if (t.closest('[data-sp-choose]')) {
    chooserOpen = !chooserOpen;
    paintRail();
    if (chooserOpen) host.querySelector('#spFilter').focus();
    return;
  }
  const rb = t.closest('[data-sp]');
  if (rb) {
    setActivePanel(rb.dataset.sp);
    renderSide();
    const p = reg.get(cfg.active);
    if (p?.search) setTimeout(() => host.querySelector('#spQ')?.focus(), 30);
    return;
  }
  if (t.closest('[data-sp-close]')) {
    env.close();
    return;
  }
  if (t.closest('[data-sp-cfg]')) {
    env.openPanelSettings();
    return;
  }
  if (t.closest('[data-sp-clear]')) {
    queries[cfg.active] = '';
    const i = host.querySelector('#spQ');
    i.value = '';
    i.focus();
    paintContent();
    return;
  }
  const more = t.closest('[data-sp-more]');
  if (more) {
    const r = more.getBoundingClientRect();
    env.showMenu(
      more._menu.map((m) => ({ label: m.label, act: m.onClick })),
      r.left - 160,
      r.bottom + 6,
    );
    return;
  }
  const act = t.closest('[data-sp-act]');
  if (act) {
    const f = actions[+act.dataset.spAct];
    if (f) f();
  }
}
function onInput(ev) {
  if (ev.target.id === 'spFilter') {
    paintRail();
    return;
  }
  if (ev.target.id !== 'spQ') return;
  queries[cfg.active] = ev.target.value;
  host.querySelector('.spClr').hidden = !ev.target.value;
  paintContent();
}
function onKey(ev) {
  if (ev.key === 'Escape') {
    ev.preventDefault();
    if (chooserOpen) {
      chooserOpen = false;
      paintRail();
      host.querySelector('[data-sp-choose]').focus();
      return;
    }
    if (ev.target.id === 'spQ' && ev.target.value) {
      queries[cfg.active] = '';
      ev.target.value = '';
      host.querySelector('.spClr').hidden = true;
      paintContent();
    } else env.close();
    return;
  }
  if (
    ev.target.closest('#spPicker') &&
    ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)
  ) {
    const items = [...host.querySelectorAll('#spRail button')],
      i = items.indexOf(ev.target.closest('button'));
    const delta = ['ArrowDown', 'ArrowRight'].includes(ev.key) ? 1 : -1;
    const n =
      ev.key === 'Home'
        ? 0
        : ev.key === 'End'
          ? items.length - 1
          : (i + delta + items.length) % items.length;
    ev.preventDefault();
    items[n]?.focus();
    return;
  }
  if (ev.key === 'Enter' && ev.target.id === 'spFilter') {
    host.querySelector('#spRail button')?.click();
    return;
  }
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    const items = [...host.querySelectorAll('#spBody [data-nav]')];
    if (!items.length || ev.target.tagName === 'TEXTAREA') return;
    const i = items.indexOf(document.activeElement);
    ev.preventDefault();
    const n = ev.key === 'ArrowDown' ? Math.min(items.length - 1, i + 1) : i <= 0 ? -1 : i - 1;
    if (n < 0) host.querySelector('#spQ')?.focus();
    else items[n].focus();
  }
}
function onGrip(ev) {
  if (ev.target.id !== 'sideGrip') return;
  ev.preventDefault();
  const grip = ev.target;
  grip.setPointerCapture(ev.pointerId);
  document.body.classList.add('resizing');
  const mv = (e) =>
    document.documentElement.style.setProperty(
      '--sidew',
      Math.max(260, Math.min(560, innerWidth - e.clientX - 10)) + 'px',
    );
  const up = () => {
    grip.removeEventListener('pointermove', mv);
    grip.removeEventListener('pointerup', up);
    grip.removeEventListener('pointercancel', up);
    document.body.classList.remove('resizing');
    try {
      localStorage.setItem(LS_W, String(Math.round(host.getBoundingClientRect().width)));
    } catch {
      /* egal */
    }
  };
  grip.addEventListener('pointermove', mv);
  grip.addEventListener('pointerup', up);
  grip.addEventListener('pointercancel', up);
}
