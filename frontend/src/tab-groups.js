import { $, esc } from './ui.js';

export function initTabGroups({
  state: S,
  requireTab,
  renderTabs,
  saveSession,
  cover,
  showCtx,
  tabById,
  closeTab,
}) {
  function normalizeTabOrder() {
    const seen = new Set();
    S.tabs = S.tabs.flatMap((t) => {
      if (!t.group) return [t];
      if (seen.has(t.group)) return [];
      seen.add(t.group);
      return S.tabs.filter((x) => x.group === t.group);
    });
  }
  function createTabGroup(title, tabID) {
    title = String(title || '')
      .trim()
      .slice(0, 40);
    if (!title) throw Error('Gruppenname fehlt.');
    const t = requireTab(tabID),
      id = 'tg-' + crypto.randomUUID();
    S.groups[id] = { title, collapsed: false };
    t.group = id;
    normalizeTabOrder();
    renderTabs();
    saveSession();
    return id;
  }
  function removeTabGroup(id) {
    for (const t of S.tabs) if (t.group === id) t.group = '';
    delete S.groups[id];
    renderTabs();
    saveSession();
  }
  function toggleTabGroup(id) {
    const g = S.groups[id];
    if (!g) return;
    g.collapsed = !g.collapsed;
    renderTabs();
    saveSession();
  }
  function moveTab(id, beforeID, group) {
    if (group && !S.groups[group]) throw Error('Gruppe nicht gefunden.');
    const t = requireTab(id);
    if (beforeID === id) return;
    if (beforeID !== null) requireTab(beforeID);
    const old = t.group;
    t.group = group || '';
    S.tabs = S.tabs.filter((x) => x.id !== id);
    let index = beforeID === null ? S.tabs.length : S.tabs.findIndex((x) => x.id === beforeID);
    if (beforeID === null && group) {
      const last = S.tabs.map((x) => x.group).lastIndexOf(group);
      if (last >= 0) index = last + 1;
    }
    S.tabs.splice(index, 0, t);
    if (old && !S.tabs.some((x) => x.group === old)) delete S.groups[old];
    normalizeTabOrder();
    renderTabs();
    saveSession();
  }
  function askTabGroup(initial = '') {
    return new Promise((resolve) => {
      const dialog = document.createElement('dialog');
      dialog.className = 'tab-group-dialog';
      dialog.innerHTML = `<form method="dialog"><h2>${initial ? 'Gruppe umbenennen' : 'Neue Tab-Gruppe'}</h2><label>Gruppenname<input name="title" maxlength="40" value="${esc(initial)}" placeholder="Zum Beispiel Musik oder Arbeit" required autofocus></label><div><button class="btn" value="cancel" formnovalidate>Abbrechen</button><button class="btn pri" value="save">Speichern</button></div></form>`;
      document.body.append(dialog);
      cover(true);
      dialog.addEventListener(
        'close',
        () => {
          const value =
            dialog.returnValue === 'save' ? dialog.querySelector('input').value.trim() : null;
          dialog.remove();
          cover(false);
          resolve(value);
        },
        { once: true },
      );
      dialog.showModal();
    });
  }
  $('#tabs').addEventListener('contextmenu', (ev) => {
    const tab = ev.target.closest('[data-tab-id]'),
      group = ev.target.closest('[data-tab-group]');
    if (!tab && !group) return;
    ev.preventDefault();
    ev.stopPropagation();
    const t = tab ? tabById(+tab.dataset.tabId) : null,
      gid = t?.group || group?.dataset.tabGroup;
    const items = [];
    if (t) {
      items.push({
        label: 'Neue Gruppe …',
        act: async () => {
          const title = await askTabGroup();
          if (title) createTabGroup(title, t.id);
        },
      });
      for (const [id, g] of Object.entries(S.groups))
        if (id !== t.group)
          items.push({
            label: 'In „' + g.title + '“ verschieben',
            act: () => moveTab(t.id, null, id),
          });
      if (t.group) items.push({ label: 'Aus Gruppe lösen', act: () => moveTab(t.id, null, '') });
      const i = S.tabs.indexOf(t);
      if (i > 0)
        items.push({
          label: 'Nach links verschieben',
          act: () => {
            const target = S.tabs[i - 1];
            moveTab(t.id, target.id, target.group || '');
          },
        });
      if (i < S.tabs.length - 1)
        items.push({
          label: 'Nach rechts verschieben',
          act: () => {
            const next = S.tabs[i + 1],
              after = S.tabs[i + 2];
            moveTab(t.id, after?.id ?? null, next.group || '');
          },
        });
    }
    if (gid && S.groups[gid])
      items.push(
        '-',
        {
          label: 'Gruppe umbenennen …',
          act: async () => {
            const title = await askTabGroup(S.groups[gid].title);
            if (title) {
              S.groups[gid].title = title;
              renderTabs();
              saveSession();
            }
          },
        },
        {
          label: S.groups[gid].collapsed ? 'Gruppe ausklappen' : 'Gruppe einklappen',
          act: () => toggleTabGroup(gid),
        },
        { label: 'Gruppe auflösen', act: () => removeTabGroup(gid) },
      );
    if (t) items.push('-', { label: 'Tab schließen', act: () => closeTab(t.id) });
    showCtx(items, ev.clientX, ev.clientY);
  });
  let draggedTab = null;
  $('#tabs').addEventListener('dragstart', (ev) => {
    const tab = ev.target.closest('[data-tab-id]');
    if (!tab) return;
    draggedTab = +tab.dataset.tabId;
    ev.dataTransfer.setData('text/plain', 'luna-tab:' + draggedTab);
    ev.dataTransfer.effectAllowed = 'move';
    tab.classList.add('dragging');
  });
  $('#tabs').addEventListener('dragover', (ev) => {
    if (draggedTab === null) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    $('#tabs')
      .querySelectorAll('.drop-before')
      .forEach((x) => x.classList.remove('drop-before'));
    ev.target.closest('[data-tab-id],.tab-group-label')?.classList.add('drop-before');
  });
  $('#tabs').addEventListener('drop', (ev) => {
    if (draggedTab === null) return;
    ev.preventDefault();
    const tab = ev.target.closest('[data-tab-id]'),
      group = ev.target.closest('[data-tab-group]');
    const id = draggedTab;
    draggedTab = null;
    if (tab) {
      const target = tabById(+tab.dataset.tabId);
      moveTab(id, target.id, target.group || '');
    } else moveTab(id, null, group?.dataset.tabGroup || '');
    renderTabs();
  });
  $('#tabs').addEventListener('dragend', () => {
    draggedTab = null;
    renderTabs();
  });
  $('#tabs').addEventListener(
    'wheel',
    (ev) => {
      if ($('#tabs').scrollWidth > $('#tabs').clientWidth) {
        ev.preventDefault();
        $('#tabs').scrollLeft += ev.deltaX || ev.deltaY;
      }
    },
    { passive: false },
  );

  return { normalizeTabOrder, createTabGroup, removeTabGroup, toggleTabGroup, moveTab };
}
