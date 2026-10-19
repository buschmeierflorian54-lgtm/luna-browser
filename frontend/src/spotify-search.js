import { commandOn } from './command-data.js';
// Spotify-Suchmodus als Chip im Eingabefeld. Ergebnisse kommen aus der Spotify-API.
const logo =
  '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><g fill="none" stroke="var(--card)" stroke-width="1.6" stroke-linecap="round"><path d="M6 9c4-1.4 8-1.1 12 1M7 12.5c3-1 6.8-.7 10 1M8 16c2.5-.7 5-.4 7.5.7"/></g></svg>';
const command = /^\s*(?:(?:open|opene|öffne)\s+)?spotify(?:\s+|$)/i;
export function spotifySearchURL(query) {
  return 'spotify-search:' + encodeURIComponent(query.trim());
}
export function spotifyCommand(input) {
  return commandOn('spotify') && command.test(input) ? input.replace(command, '').trim() : null;
}
export function bindSpotifySearch(input, navigate, onModeChange = () => {}, playSong = null) {
  if (!input || input._spotifySearch) return;
  let timer;
  const cancel = () => clearTimeout(timer);
  const originalPlaceholder = input.placeholder;
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'spotify-search-chip';
  chip.hidden = true;
  chip.innerHTML = logo + '<span>Spotify</span><span aria-hidden="true">×</span>';
  chip.setAttribute('aria-label', 'Spotify-Suchmodus beenden');
  input.before(chip);
  const setMode = (on) => {
    cancel();
    input.dataset.spotifySearch = on === true ? 'true' : '';
    input.dataset.spotifyPlay = on === 'play' ? 'true' : '';
    chip.innerHTML =
      logo +
      '<span>' +
      (on === 'play' ? 'play' : 'Spotify') +
      '</span><span aria-hidden="true">×</span>';
    chip.setAttribute(
      'aria-label',
      on === 'play' ? 'Play-Modus beenden' : 'Spotify-Suchmodus beenden',
    );
    chip.hidden = !on;
    input.parentElement.classList.toggle('spotify-search-mode', on);
    input.placeholder =
      on === 'play'
        ? 'Song eingeben · Enter zum Abspielen'
        : on
          ? 'Auf Spotify suchen …'
          : originalPlaceholder;
  };
  const consumePlay = () => {
    if (!playSong || !commandOn('play')) return false;
    if (/^\s*play(?:\s|$)/i.test(input.value)) {
      input.value = input.value.replace(/^\s*play(?:\s+|$)/i, '');
      setMode('play');
    }
    return input.dataset.spotifyPlay === 'true';
  };
  const consume = () => {
    const query = spotifyCommand(input.value);
    if (query !== null) {
      input.value = query;
      setMode(true);
      onModeChange();
      navigate(spotifySearchURL(''), { preserveInput: true });
    }
    return input.dataset.spotifySearch === 'true';
  };
  const submit = (automatic = false) => {
    cancel();
    const query = input.value.trim();
    if (query) {
      onModeChange();
      if (!automatic) input.blur();
      navigate(spotifySearchURL(query), { preserveInput: automatic });
    }
  };
  input.addEventListener(
    'input',
    (ev) => {
      if (consumePlay()) {
        onModeChange();
        ev.stopImmediatePropagation();
        return;
      }
      if (input.value.trim().toLowerCase() === 'chat') {
        setMode(false);
        return;
      }
      if (consume()) {
        ev.stopImmediatePropagation();
        onModeChange();
        cancel();
        if (!ev.isComposing)
          timer = setTimeout(() => {
            if (input.isConnected && input.dataset.spotifySearch === 'true') {
              if (input.value.trim()) submit(true);
              else navigate(spotifySearchURL(''), { preserveInput: true });
            }
          }, 1000);
      }
    },
    true,
  );
  input.addEventListener(
    'keydown',
    (ev) => {
      if (consumePlay()) {
        if (ev.key === 'Enter' && !ev.isComposing) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          onModeChange();
          const query = input.value.trim();
          playSong(query);
        } else if (ev.key === 'Escape' || (ev.key === 'Backspace' && !input.value)) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          setMode(false);
          onModeChange();
        }
        return;
      }
      if (!consume()) return;
      if (ev.key === 'Enter') {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        submit();
      } else if (ev.key === 'Escape' || (ev.key === 'Backspace' && !input.value)) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        setMode(false);
        onModeChange();
      }
    },
    true,
  );
  input.addEventListener('blur', cancel);
  input.addEventListener('compositionend', () =>
    input.dispatchEvent(new Event('input', { bubbles: true })),
  );
  chip.addEventListener('click', () => {
    setMode(false);
    input.focus();
    onModeChange();
  });
  input._spotifySearch = {
    setMode,
    submit,
    open() {
      input.value = '';
      setMode(true);
      onModeChange();
      input.focus();
      navigate(spotifySearchURL(''), { preserveInput: true });
    },
  };
}
export function syncSpotifySearch(input, pageURL) {
  if (!input?._spotifySearch || document.activeElement === input) return;
  if (pageURL?.startsWith('spotify-search:')) {
    input._spotifySearch.setMode(true);
    try {
      input.value = decodeURIComponent(pageURL.slice(15));
    } catch {
      input.value = '';
    }
    return;
  }
  try {
    const u = new URL(pageURL);
    if (u.hostname === 'open.spotify.com' && u.pathname.startsWith('/search/')) {
      input._spotifySearch.setMode(true);
      input.value = decodeURIComponent(u.pathname.slice(8));
      return;
    }
  } catch {
    /* lokale Seite */
  }
  input._spotifySearch.setMode(false);
}
