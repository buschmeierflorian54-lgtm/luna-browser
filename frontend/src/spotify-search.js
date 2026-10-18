// Spotify-Suchmodus als Chip im Eingabefeld. Ergebnisse kommen aus der Spotify-API.
const logo =
  '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><g fill="none" stroke="var(--card)" stroke-width="1.6" stroke-linecap="round"><path d="M6 9c4-1.4 8-1.1 12 1M7 12.5c3-1 6.8-.7 10 1M8 16c2.5-.7 5-.4 7.5.7"/></g></svg>';
const command = /^\s*(?:(?:open|opene|öffne)\s+)?spotify\s+/i;
export function spotifySearchURL(query) {
  return 'spotify-search:' + encodeURIComponent(query.trim());
}
export function spotifyCommand(input) {
  return command.test(input) ? input.replace(command, '').trim() : null;
}
export function bindSpotifySearch(input, navigate, onModeChange = () => {}) {
  if (!input || input._spotifySearch) return;
  const originalPlaceholder = input.placeholder;
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'spotify-search-chip';
  chip.hidden = true;
  chip.innerHTML = logo + '<span>Spotify</span><span aria-hidden="true">×</span>';
  chip.setAttribute('aria-label', 'Spotify-Suchmodus beenden');
  input.before(chip);
  const setMode = (on) => {
    input.dataset.spotifySearch = on ? 'true' : '';
    chip.hidden = !on;
    input.parentElement.classList.toggle('spotify-search-mode', on);
    input.placeholder = on ? 'Auf Spotify suchen …' : originalPlaceholder;
  };
  const consume = () => {
    const query = spotifyCommand(input.value);
    if (query !== null) {
      input.value = query;
      setMode(true);
      onModeChange();
    }
    return input.dataset.spotifySearch === 'true';
  };
  const submit = () => {
    const query = input.value.trim();
    if (query) {
      onModeChange();
      input.blur();
      navigate(spotifySearchURL(query));
    }
  };
  input.addEventListener(
    'input',
    (ev) => {
      if (consume()) {
        ev.stopImmediatePropagation();
        onModeChange();
      }
    },
    true,
  );
  input.addEventListener(
    'keydown',
    (ev) => {
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
  chip.addEventListener('click', () => {
    setMode(false);
    input.focus();
    onModeChange();
  });
  input._spotifySearch = { setMode, submit };
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
