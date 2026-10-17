// Suchansicht: Ergebnisse der eigenen Suche (Brave) als eingebaute Browser-Seite,
// im selben Design wie Startseite und Seitenleiste (kein fremdes Web-Layout, keine Kopfzeile).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const letter = (s) => esc((s || '?').trim().charAt(0).toUpperCase() || '?');
const secs = (ms) => (ms / 1000).toFixed(2).replace('.', ',');

const I = {
  tab: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M8 6V4h8v2"/></svg>',
  star: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1-4.5-4.3 6.1-.8z"/></svg>',
  starOn: '<svg width="15" height="15" viewBox="0 0 24 24" fill="#a24d84" stroke="#a24d84" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1-4.5-4.3 6.1-.8z"/></svg>',
  warn: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/></svg>',
  key: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/></svg>',
};

function fav(url, host) {
  return url ? `<img class="sr-fav" src="${esc(url)}" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.outerHTML='<span class=&quot;sr-fav fb&quot;>${letter(host)}</span>'">` : `<span class="sr-fav fb">${letter(host)}</span>`;
}
const thumb = (u, cls) => (u ? `<img class="${cls}" src="${esc(u)}" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.style.display='none'">` : '');

function result(r, i, sel, bm) {
  const on = bm(r.url);
  return `<article class="sr ${i === sel ? 'sel' : ''}" data-i="${i}" style="animation-delay:${Math.min(i, 8) * 28}ms">
    ${fav(r.favicon, r.host)}
    <div class="sr-body">
      <div class="sr-site"><b>${esc(r.host)}</b><span>${esc(r.path)}</span>${r.age ? `<em>${esc(r.age)}</em>` : ''}</div>
      <a class="sr-t" href="${esc(r.url)}" data-act="sr-open" data-url="${esc(r.url)}">${esc(r.title)}</a>
      <p class="sr-d">${r.desc || ''}</p>
      ${(r.extra || []).map((x) => `<div class="sr-x">${x}</div>`).join('')}
    </div>
    ${thumb(r.thumb, 'sr-th')}
    <div class="sr-act"><button data-act="sr-tab" data-url="${esc(r.url)}" title="In neuem Tab öffnen" aria-label="In neuem Tab öffnen">${I.tab}</button><button data-act="sr-bm" data-url="${esc(r.url)}" data-title="${esc(r.title)}" title="Lesezeichen" aria-label="Lesezeichen">${on ? I.starOn : I.star}</button></div>
  </article>`;
}

function strips(d, filter) {
  let h = '';
  const news = (d.news || []), vids = (d.videos || []);
  if (news.length && (filter === 'all' || filter === 'news')) {
    h += `<h3 class="sv-h">Nachrichten</h3><div class="${filter === 'news' ? 'sv-grid3' : 'strip'}">${news.map((n) => `<a class="nc" href="${esc(n.url)}" data-act="sr-open" data-url="${esc(n.url)}"><div class="im">${thumb(n.thumb, '')}</div><div class="cb"><div class="ct">${esc(n.title)}</div><div class="cm">${fav(n.favicon, n.host)}<span>${esc(n.host)}${n.age ? ' · ' + esc(n.age) : ''}</span></div></div></a>`).join('')}</div>`;
  }
  if (vids.length && (filter === 'all' || filter === 'video')) {
    h += `<h3 class="sv-h">Videos</h3><div class="${filter === 'video' ? 'sv-grid3' : 'strip'}">${vids.map((v) => `<a class="nc" href="${esc(v.url)}" data-act="sr-open" data-url="${esc(v.url)}"><div class="im">${thumb(v.thumb, '')}${v.duration ? `<span class="du">${esc(v.duration)}</span>` : ''}</div><div class="cb"><div class="ct">${esc(v.title)}</div><div class="cm"><span>${esc(v.host)}${v.age ? ' · ' + esc(v.age) : ''}</span></div></div></a>`).join('')}</div>`;
  }
  return h;
}

function pager(t, d) {
  const cur = t.page; let last = cur; if (d.more && cur < 9) last = cur + 1;
  const start = Math.max(0, last - 6); const out = [];
  if (cur > 0) out.push(`<button data-act="sv-page" data-p="${cur - 1}" aria-label="Zurück">←</button>`);
  for (let i = start; i <= last; i++) out.push(i === cur ? `<span class="cur">${i + 1}</span>` : `<button data-act="sv-page" data-p="${i}">${i + 1}</button>`);
  if (d.more && cur < 9) out.push(`<button data-act="sv-page" data-p="${cur + 1}" aria-label="Weiter">→</button>`);
  return out.length > 1 ? `<nav class="sv-pg" aria-label="Seiten">${out.join('')}</nav>` : '';
}

function skeleton() {
  return Array.from({ length: 6 }, () => '<div class="sk"><i class="a"></i><div><i class="b"></i><i class="c"></i><i class="d"></i></div></div>').join('');
}

function problem(t) {
  const e = t.sErr;
  const key = e === 'NOKEY' || /Schlüssel/.test(e);
  return `<div class="sv-msg">${key ? I.key : I.warn}<h2>${e === 'NOKEY' ? 'Eigene Suche einrichten' : key ? 'Schlüssel wird abgelehnt' : 'Suche nicht möglich'}</h2>
    <p>${e === 'NOKEY' ? 'Hinterlege deinen Brave-API-Schlüssel, dann sucht dieser Browser direkt über Brave – ohne Umweg über eine fremde Webseite.' : esc(e)}</p>
    <div class="row">${key ? '<button class="btn pri" data-act="settings">Einstellungen öffnen</button><button class="btn" data-act="open-brave">Schlüssel bei Brave holen</button>' : '<button class="btn pri" data-act="sv-retry">Erneut versuchen</button>'}</div></div>`;
}

// t: Tab mit q, page, data, sErr, sLoading, sel, filter; bm(url) sagt, ob ein Lesezeichen existiert.
export function searchHTML(t, bm) {
  const d = t.data;
  const head = `<div class="sv-top"><div class="sv-title"><h1>${esc(t.q)}</h1><span class="sv-meta">${t.sLoading ? 'Suche läuft …' : d ? `Seite ${t.page + 1} · ${secs(d.millis)} s · Brave` : ''}</span></div>${d && !t.sErr ? `<div class="stabs sv-filter" role="tablist">
    <button class="${t.filter === 'all' ? 'on' : ''}" data-act="sv-filter" data-k="all">Alle</button>
    <button class="${t.filter === 'news' ? 'on' : ''}" data-act="sv-filter" data-k="news">Nachrichten${d.news?.length ? ' · ' + d.news.length : ''}</button>
    <button class="${t.filter === 'video' ? 'on' : ''}" data-act="sv-filter" data-k="video">Videos${d.videos?.length ? ' · ' + d.videos.length : ''}</button></div>` : ''}</div>`;
  if (t.sErr) return `<div class="sv">${head}${problem(t)}</div>`;
  if (t.sLoading || !d) return `<div class="sv">${head}<div class="sv-grid"><div class="sv-main">${skeleton()}</div></div></div>`;
  const alt = d.altered ? `<div class="sv-alt">Ergebnisse für <b>${esc(d.altered)}</b>. <button class="link" data-act="sv-alt" data-q="${esc(d.altered)}">Stattdessen „${esc(t.q)}“ suchen</button></div>` : '';
  let main = '';
  if (t.filter === 'all') {
    const res = d.results || [];
    const first = res.slice(0, 3).map((r, i) => result(r, i, t.sel, bm)).join('');
    const rest = res.slice(3).map((r, i) => result(r, i + 3, t.sel, bm)).join('');
    const faq = (d.faq || []).length ? `<h3 class="sv-h">Häufige Fragen</h3><div class="sv-faq">${d.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>` : '';
    main = (res.length ? first + strips(d, 'all') + faq + rest : `<div class="sv-msg"><h2>Keine Treffer</h2><p>Zu „${esc(t.q)}“ hat Brave nichts gefunden.</p></div>`);
  } else {
    main = strips(d, t.filter) || `<div class="sv-msg"><h2>Nichts gefunden</h2><p>Für diese Suche gibt es hier keine ${t.filter === 'news' ? 'Nachrichten' : 'Videos'}.</p></div>`;
  }
  const info = d.info && t.filter === 'all' && t.page === 0 ? `<aside class="sv-side"><div class="info">${thumb(d.info.thumb, 'in-im')}<div class="ib"><h2>${esc(d.info.title)}</h2>${d.info.desc ? `<p>${d.info.desc}</p>` : ''}${(d.info.attrs || []).length ? `<dl>${d.info.attrs.map((a) => `<dt>${esc(a[0])}</dt><dd>${esc(a[1])}</dd>`).join('')}</dl>` : ''}${d.info.url ? `<a class="go" href="${esc(d.info.url)}" data-act="sr-open" data-url="${esc(d.info.url)}">${esc(d.info.host)} ↗</a>` : ''}</div></div></aside>` : '';
  return `<div class="sv">${head}${alt}<div class="sv-grid ${info ? 'two' : ''}"><div class="sv-main">${main}${t.filter === 'all' ? pager(t, d) : ''}</div>${info}</div></div>`;
}
