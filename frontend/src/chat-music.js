import { esc } from './ui.js';

// Build cards only from successful tool responses, never from assistant prose.
export function musicCards(messages) {
  const cards = new Map();
  for (let start = 0; start < messages.length;) {
    let end = start + 1;
    while (end < messages.length && messages[end].role !== 'user') end++;
    const turn = messages.slice(start, end);
    const calls = new Set(
      turn
        .flatMap((m) => m.tool_calls || [])
        .filter((c) => c.function?.name === 'browser_play_song')
        .map((c) => c.id),
    );
    let anchor = -1;
    for (let i = start; i < end; i++) if (messages[i].role === 'assistant') anchor = i;
    const songs = [];
    for (const m of turn) {
      if (m.role !== 'tool' || !calls.has(m.tool_call_id)) continue;
      try {
        const result = JSON.parse(m.content);
        if (result.isError) continue;
        for (const content of result.content || []) {
          if (content.type !== 'text') continue;
          const value = JSON.parse(content.text),
            track = value.track;
          if (!value.playback_requested || !/^spotify:track:[a-zA-Z0-9]{22}$/.test(track?.uri))
            continue;
          songs.push(track);
        }
      } catch {
        /* Malformed tool output is not a music card. */
      }
    }
    if (anchor >= 0 && songs.length) cards.set(anchor, songs);
    start = end;
  }
  return cards;
}
function coverURL(track) {
  try {
    const url = new URL(track.album?.images?.[0]?.url);
    return url.protocol === 'https:' && url.hostname === 'i.scdn.co' ? url.href : '';
  } catch {
    return '';
  }
}
export function renderMusicCards(list, messages) {
  const cards = musicCards(messages);
  [...list.children].forEach((article, index) => {
    const tracks = cards.get(index) || [],
      key = JSON.stringify(tracks);
    if (article._musicKey === key) return;
    article._musicKey = key;
    article.querySelector('.chat-music-cards')?.remove();
    if (!tracks.length) return;
    const box = document.createElement('div');
    box.className = 'chat-music-cards';
    box.innerHTML = tracks
      .map((track) => {
        const cover = coverURL(track),
          artists = (track.artists || []).map((a) => a.name).join(', ');
        const seconds = Math.floor((Number(track.duration_ms) || 0) / 1000);
        return `<section class="chat-song" aria-label="Song: ${esc(track.name)}"><div class="chat-song-art">${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span aria-hidden="true">♫</span>'}</div><div class="chat-song-info"><div class="chat-song-eyebrow">LUNA MUSIC <span>via Spotify</span></div><b>${esc(track.name)}</b><p>${esc(artists)}</p><small>${esc(track.album?.name || '')}${seconds ? ` · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : ''}</small><span class="chat-song-status">An Spotify übergeben</span></div><button type="button" class="chat-song-play" data-chat="play-song" data-uri="${esc(track.uri)}" aria-label="${esc(track.name)} erneut abspielen" title="Erneut abspielen"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg></button></section>`;
      })
      .join('');
    box.querySelectorAll('img').forEach((img) =>
      img.addEventListener(
        'error',
        () => {
          const fallback = document.createElement('span');
          fallback.textContent = '♫';
          img.replaceWith(fallback);
        },
        { once: true },
      ),
    );
    article.append(box);
  });
}
