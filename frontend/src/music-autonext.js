import * as api from './api.js';
import { createBrowserNotifications } from './notifications.js';

// One shared entry point for the search button and drag/drop. Provider errors
// reach the user only after both queue routes have failed.
export function initAutoNext({
  cover,
  toast,
  notifications = createBrowserNotifications({ cover }),
  onPreferenceChange = () => {},
  host = document.querySelector('#toolbar'),
}) {
  let busy = false;
  const pending = document.createElement('div');
  pending.className = 'music-next-pending';
  pending.hidden = true;
  const label = document.createElement('span');
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = '×';
  cancel.setAttribute('aria-label', 'Vorgemerkten Song abbrechen');
  pending.append(label, cancel);
  host?.append(pending);
  function update(status) {
    pending.hidden = status.status !== 'waiting';
    label.textContent = 'Vorgemerkt: ' + (status.title || 'Spotify-Song');
    pending.title =
      'Luna startet diesen Song am Titelende oder beim Überspringen: ' +
      (status.title || 'Spotify-Song');
  }
  cancel.onclick = async () => {
    cancel.disabled = true;
    try {
      await api.spotifyCancelNext();
      update({});
      toast('Vormerkung aufgehoben');
    } catch (e) {
      toast(String(e?.message || e));
    } finally {
      cancel.disabled = false;
    }
  };
  api.onSpotifyNext(async (status) => {
    // Read the current state so a late event cannot hide a newer reservation.
    try {
      update(await api.spotifyNextStatus());
    } catch {
      update(status);
    }
    if (status.status === 'started') toast('Luna hat „' + status.title + '“ übernommen');
    if (status.status === 'error') toast(status.message, 10000);
  });
  api
    .spotifyNextStatus()
    .then(update)
    .catch(() => {});

  async function ask(uri, title, reason) {
    await notifications.ask({
      kind: 'music',
      eyebrow: 'LUNA MUSIC · EIN KLEINER UMWEG',
      title: 'Soll Luna übernehmen?',
      message:
        'Irgendwie will die Warteschlange heute nicht so richtig.\nSoll Luna deinen Song automatisch starten, sobald der aktuelle zu Ende geht – oder du ihn überspringst?',
      highlight: { label: 'ALS NÄCHSTES', value: title || 'Dein Spotify-Song' },
      note: 'Über die Spotify-App auf diesem Mac · Start eine Sekunde vor Schluss\nEine bestehende Luna-Vormerkung wird ersetzt.',
      remember: {
        label: 'Luna soll das immer machen',
        description:
          'Bei Problemen automatisch übernehmen. In den Spotify-Einstellungen wieder ausschaltbar.',
      },
      details: String(reason?.message || reason),
      cancelLabel: 'Nicht jetzt',
      confirmLabel: 'Ja, Luna übernimmt',
      onConfirm: async ({ checked }) => {
        await api.spotifyScheduleNext(uri, title || 'Spotify-Song');
        update({ uri, title, status: 'waiting' });
        if (checked) {
          try {
            const prefs = await api.setPref('spotifyAutoNextAlways', true);
            if (!prefs?.spotifyAutoNextAlways)
              throw new Error('Einstellung konnte nicht gespeichert werden.');
            onPreferenceChange(true);
          } catch {
            toast(
              'Song vorgemerkt. Die dauerhafte Auswahl konnte nicht gespeichert werden.',
              10000,
            );
          }
        }
        toast('„' + (title || 'Dein Song') + '“ ist für Luna vorgemerkt');
      },
    });
    return false;
  }

  return async function enqueue(uri, title) {
    if (busy) {
      toast('Bitte schließe zuerst die laufende Warteschlangen-Anfrage ab.');
      return false;
    }
    busy = true;
    try {
      try {
        await api.spotifyQueue(uri);
      } catch (e) {
        // Read the saved choice each time, including after disabling in Settings.
        const prefs = await api.prefs().catch(() => ({}));
        if (prefs?.spotifyAutoNextAlways) {
          try {
            await api.spotifyScheduleNext(uri, title || 'Spotify-Song');
            update({ uri, title, status: 'waiting' });
          } catch (error) {
            toast(String(error?.message || error), 10000);
          }
          return false;
        }
        return await ask(uri, title, e);
      }
      toast('„' + (title || 'Dein Song') + '“ zur Warteschlange hinzugefügt');
      return true;
    } finally {
      busy = false;
    }
  };
}
