import { lunaMusicWordmark } from './branding.js';
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const imageURL = (s) => {
  try {
    const u = new URL(s);
    return u.protocol === 'https:' ? esc(u.href) : '';
  } catch {
    return '';
  }
};
const art = (images, cls = '') => {
  const src = imageURL(images?.[0]?.url);
  return `<span class="music-art ${cls}">${src ? `<img src="${src}" alt="" draggable="false" loading="lazy">` : '<span aria-hidden="true">♪</span>'}</span>`;
};
const names = (a) => (a || []).map((x) => x.name).join(', ');
const play = (uri, label = 'Abspielen') =>
  `<button class="music-play" data-act="music-play" data-uri="${esc(uri)}" aria-label="${esc(label)}" title="In Spotify abspielen"><svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg></button>`;
export function spotifyResultsHTML(t) {
  const d = t.data,
    tracks = d?.tracks?.items || [],
    artists = d?.artists?.items || [],
    albums = d?.albums?.items || [];
  const head = `<header class="music-head"><div><div class="music-service">${lunaMusicWordmark}<div class="music-partner"><span>works with Spotify</span><button class="music-spotify-launch" data-act="spotify-open" aria-label="Spotify-App öffnen" title="Spotify-App öffnen">${spotifyMark}</button></div></div><span class="music-eyebrow">SUCHERGEBNISSE</span><h1>${esc(t.q)}</h1><p>Songs, Künstler und Alben für dich.</p></div><button class="btn music-account-button" data-act="spotify-settings"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/></svg> Konto & Verbindung</button></header>`;
  if (t.sLoading)
    return `<div class="music-view">${head}<div class="music-loading" role="status">Spotify durchsuchen …<div></div><div></div><div></div></div></div>`;
  if (t.sErr)
    return `<div class="music-view">${head}<div class="music-empty"><h2>Spotify ist noch nicht bereit</h2><p>${esc(t.sErr)}</p><button class="btn pri" data-act="spotify-settings">Spotify einrichten</button> <button class="btn" data-act="sv-retry">Erneut versuchen</button></div></div>`;
  if (!tracks.length && !artists.length && !albums.length)
    return `<div class="music-view">${head}<div class="music-empty"><h2>Keine Treffer</h2><p>Versuche einen anderen Titel oder Künstlernamen.</p></div></div>`;
  const top = tracks[0];
  return `<div class="music-view">${head}<div class="music-top">${top ? `<section class="music-feature" draggable="true" data-queue-uri="${esc(top.uri)}" data-queue-title="${esc(top.name)}">${art(top.album.images)}<div><span class="music-eyebrow">DEIN TOP-TREFFER</span><h2>${esc(top.name)}</h2><p>${esc(names(top.artists))}</p><small>${esc(top.album.name)}</small></div>${play(top.uri, 'Abspielen: ' + top.name)}</section>` : ''}</div>
 ${tracks.length ? `<section class="music-section"><h2>Songs <span>${tracks.length}${d.tracks.next ? ' · erste Treffer' : ''}</span></h2><div class="music-track-labels" aria-hidden="true"><span>#</span><span>Titel</span><span>Album</span><span>Dauer</span></div><div class="music-tracks">${tracks.map((x, i) => `<div class="music-track" draggable="true" data-queue-uri="${esc(x.uri)}" data-queue-title="${esc(x.name)}"><span class="music-number">${i + 1}</span>${art(x.album.images)}<div class="music-title"><b>${esc(x.name)}</b><small>${x.explicit ? '<i class="music-explicit">E</i> ' : ''}${esc(names(x.artists))}</small></div><span class="music-album">${esc(x.album.name)}</span><span class="music-time">${Math.floor(x.duration_ms / 60000)}:${String(Math.floor(x.duration_ms / 1000) % 60).padStart(2, '0')}</span>${play(x.uri, 'Abspielen: ' + x.name)}</div>`).join('')}</div></section>` : ''}
 ${artists.length ? `<section class="music-section"><h2>Künstler</h2><div class="music-grid">${artists.map((x) => `<article class="music-card artist">${art(x.images)}<b>${esc(x.name)}</b><small>Künstler</small>${play(x.uri, 'Künstler abspielen: ' + x.name)}</article>`).join('')}</div></section>` : ''}
 ${albums.length ? `<section class="music-section"><h2>Alben</h2><div class="music-grid">${albums.map((x) => `<article class="music-card">${art(x.images)}<b>${esc(x.name)}</b><small>${esc(x.release_date?.slice(0, 4))} · ${esc(names(x.artists))}</small>${play(x.uri, 'Album abspielen: ' + x.name)}</article>`).join('')}</div></section>` : ''}<footer class="music-credit">Ergebnisse von Spotify · Wiedergabe in der Spotify-App</footer></div>`;
}
const spotifyMark =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><g fill="none" stroke="#121212" stroke-width="1.6" stroke-linecap="round"><path d="M6 9c4-1.4 8-1.1 12 1M7 12.5c3-1 6.8-.7 10 1M8 16c2.5-.7 5-.4 7.5.7"/></g></svg>';
export function spotifySettingsHTML(s, autoNextAlways = false) {
  const connected = !!s.connected,
    pending = !!s.pending;
  return `<section id="set-spotify" class="sp-card spotify-settings">
 <header class="spot-settings-hero"><div class="spot-brand">${spotifyMark}<span>Spotify</span><span class="spot-integration">IN LUNA</span></div><h2>Deine Musik.<br><span>Dein Browser.</span></h2><p>Finde deinen nächsten Lieblingssong.<br>Und spiel ihn direkt auf deinem Mac.</p><div class="spot-hero-lines" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div></header>
 <div class="spot-settings-body">
 <div class="spot-section-label">DEIN KONTO <span class="spot-status ${connected ? 'connected' : ''}"><i></i>${connected ? 'Verbunden' : pending ? 'Anmeldung läuft' : 'Nicht verbunden'}</span></div>
 <div class="spot-account-card"><div class="spot-avatar">${connected ? esc((s.name || 'S').trim().slice(0, 1).toUpperCase()) : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>'}</div><div class="spot-account-copy"><b>${connected ? esc(s.name || 'Spotify-Konto') : pending ? 'Fast geschafft' : 'Mach es zu deiner Musik'}</b><p>${connected ? 'Alles bereit. Suche nach Songs, Künstlern und Alben.' : pending ? 'Bestätige die Freigabe im geöffneten Anmeldefenster.' : s.configured ? 'Verknüpfe dein Konto und entdecke Spotify in Luna.' : 'Richte unten den API-Zugang ein. Danach verbindest du dein Konto.'}</p></div></div>
 <div class="spot-account-actions"><button class="btn pri" data-act="spotify-connect" ${!s.configured ? 'disabled' : ''}>${pending ? 'Anmeldung neu starten' : connected ? 'Konto erneut verbinden' : 'Mit Spotify verbinden'} <span aria-hidden="true">↗</span></button>${connected || pending ? '<button class="spot-disconnect" data-act="spotify-disconnect">Verbindung trennen</button>' : ''}</div>
 <p class="kmsg" role="status" id="spotifyAccountMessage">${esc(s.message || '')}</p>
 <div class="spot-auto-next swrow"><div><b>Luna automatisch übernehmen lassen</b><span>Wenn Spotify- und Sonos-Warteschlange scheitern, merkt Luna den Song ohne Rückfrage vor und startet ihn per AppleScript am Titelende oder beim Überspringen.</span></div><button type="button" class="switch ${autoNextAlways ? 'on' : ''}" role="switch" aria-checked="${autoNextAlways}" aria-label="Luna automatisch übernehmen lassen" data-act="pref-spotify-autonext"><i></i></button></div>
 <details class="spot-api" ${!s.configured ? 'open' : ''}><summary><span><b>API-Zugang</b><small>${s.configured ? 'Client ID gespeichert' : 'Einmal einrichten, dann Musik entdecken'}</small></span><span class="spot-api-chevron" aria-hidden="true">⌄</span></summary><div class="spot-api-body">
 <label class="fld"><span>Spotify Client ID</span><input id="spotifyClientID" type="password" autocomplete="off" spellcheck="false" placeholder="${s.configured ? 'Neue Client ID zum Ersetzen eingeben' : 'Client ID deiner Spotify-App einfügen'}"></label><button class="btn spot-save" data-act="spotify-save">Client ID speichern</button>
 <div class="spot-redirect"><span>Redirect URI</span><code>${esc(s.redirect || 'http://127.0.0.1:8888/callback')}</code><small>Diese Adresse exakt in deiner Spotify-App hinterlegen.</small></div>
 <details class="spotify-help"><summary>Wo finde ich meine Client ID?</summary><ol><li>Öffne das <button class="link" data-act="spotify-dashboard">Spotify Developer Dashboard</button> und wähle deine App oder erstelle eine neue.</li><li>Speichere die Redirect URI von oben in den App-Einstellungen.</li><li>Kopiere die Client ID hierher, speichere sie und verbinde dein Konto.</li></ol><p>PKCE-Anmeldung: kein Client Secret nötig. Spotify kann für Development-Apps Premium und einen freigeschalteten Nutzer verlangen.</p><p>Die Verknüpfung wird lokal gespeichert (Dateirechte 0600). Dein Spotify-Passwort bleibt bei Spotify.</p></details>
 </div></details>
 <footer class="spot-playback"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4m-2-13 5 3-5 3z"/></svg><div><b>Musik läuft in deiner Spotify-App</b><span>Play-Buttons steuern Spotify auf diesem Mac über AppleScript. Die App muss installiert und angemeldet sein.</span></div></footer>
 </div></section>`;
}
