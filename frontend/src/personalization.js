import { trackBackgroundContrast } from './background-contrast.js';
import { esc } from './ui.js';
import { WindowSetTitle } from '../wailsjs/runtime/runtime.js';
import './styles/personalization.css';

const KEY = 'luna-personalization';
const DEFAULT = {
  name: 'Luna Browser',
  background: 'waves',
  youtube: '',
  motion: true,
  contrast: 48,
  textContrast: 'auto',
  menuBlur: 18,
};
export function personal() {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULT };
  }
}
export function savePersonal(patch) {
  const next = { ...personal(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  document.querySelectorAll('[data-personal-contrast]').forEach((input) => {
    input.value = next.contrast;
    input.nextElementSibling.textContent = next.contrast + '%';
  });
  document
    .querySelectorAll('[data-personal-text]')
    .forEach((input) => (input.value = next.textContrast));
  window.dispatchEvent(new CustomEvent('luna-personalization', { detail: patch }));
  return next;
}
export function browserName() {
  return personal().name || DEFAULT.name;
}
export function applyBrowserName() {
  document.title = browserName();
  if (window.runtime) WindowSetTitle(browserName());
}
export function youtubeID(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:') return '';
    let id = '';
    if (u.hostname === 'youtu.be') id = u.pathname.slice(1);
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(u.hostname)) {
      id =
        u.pathname === '/watch'
          ? u.searchParams.get('v')
          : /^\/(?:shorts|embed|live)\/([^/]+)$/.exec(u.pathname)?.[1];
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(id || '') ? id : '';
  } catch {
    return '';
  }
}
function database() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('luna-personal-media', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function mediaFile(file) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('files', file === undefined ? 'readonly' : 'readwrite');
      const r =
        file === undefined
          ? tx.objectStore('files').get('background')
          : tx.objectStore('files').put(file, 'background');
      tx.oncomplete = () => resolve(r.result);
      tx.onabort = tx.onerror = () =>
        reject(tx.error || Error('Datei konnte nicht gespeichert werden.'));
    });
  } finally {
    db.close();
  }
}
export function personalSettingsHTML() {
  const p = personal();
  return `<div class="personal-settings"><h3>Dein Browser</h3>
    <form data-personal-name class="personal-row"><label>Name<input name="browserName" value="${esc(p.name)}" maxlength="60" required></label><button class="btn" type="submit">Namen speichern</button></form>
    <p class="muted">Dein Name erscheint auf der Startseite und im Fenstertitel.</p>
    <div class="personal-row"><label class="btn personal-file">Foto als App-Icon<input type="file" data-personal-icon accept="image/png,image/jpeg,image/webp"></label><button class="btn" type="button" data-personal-reset-icon>Standard-Icon</button></div>
    <p class="muted">Das Foto wird mittig quadratisch zugeschnitten.</p>
    ${backgroundSettingsHTML()}
    <h3>Schnelleinstellungen</h3><label class="personal-contrast">Unschärfe<input aria-label="Unschärfe im Theme-Menü" type="range" min="0" max="32" step="1" data-personal-blur value="${p.menuBlur}"><output>${p.menuBlur} px</output></label><p class="muted">Unschärfe hinter dem transparenten Theme-Menü. 0 schaltet sie aus.</p></div>`;
}
export function backgroundSettingsHTML() {
  const p = personal();
  return `<div class="personal-background-controls"><div class="personal-options" role="group" aria-label="Hintergrund">
    ${[
      ['waves', 'Luna-Wellen'],
      ['image', 'Eigenes Foto'],
      ['video', 'Eigenes Video'],
      ['youtube', 'YouTube'],
    ]
      .map(
        ([id, label]) =>
          `<button type="button" class="btn ${p.background === id ? 'pri' : ''}" data-personal-background="${id}" aria-pressed="${p.background === id}">${label}</button>`,
      )
      .join('')}</div>
    <div class="personal-row"><label class="btn personal-file">Foto oder Video auswählen<input type="file" data-personal-media accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"></label><span class="muted">${esc(p.fileName || 'Foto bis 20 MB · Video bis 100 MB')}</span></div>
    <form data-personal-youtube class="personal-row"><label>YouTube-Link<input type="url" name="youtube" value="${esc(p.youtube)}" placeholder="https://www.youtube.com/watch?v=…" required></label><button class="btn" type="submit">Video verwenden</button></form>
    <p class="muted">YouTube verbindet sich mit Google. Nur Videos mit erlaubter Einbettung funktionieren. Videos starten ohne Ton und laufen auf Luna-Seiten weiter.</p>
    <label class="personal-motion"><input type="checkbox" data-personal-motion ${p.motion ? 'checked' : ''}> Hintergrund bewegen / Video abspielen</label>
    <label class="personal-contrast">Kontrast<input type="range" min="0" max="85" step="1" data-personal-contrast value="${p.contrast}"><output>${p.contrast}%</output></label>
    <label class="personal-text">Schrift<select data-personal-text aria-label="Schriftkontrast">${[
      ['auto', 'Automatisch'],
      ['dark', 'Hell'],
      ['light', 'Dunkel'],
    ]
      .map(
        ([v, l]) => `<option value="${v}" ${p.textContrast === v ? 'selected' : ''}>${l}</option>`,
      )
      .join('')}</select></label>
    <p class="personal-feedback" data-personal-feedback role="status"></p></div>`;
}
export function wirePersonalSettings({ refresh, setIcon, resetIcon, toast }) {
  const feedback = (text) => {
    const el =
      document.querySelector('#themeDrop [data-personal-feedback]') ||
      document.querySelector('[data-personal-feedback]');
    if (el) el.textContent = text;
    else toast(text);
  };
  const run = async (fn) => {
    try {
      await fn();
    } catch (e) {
      feedback(e.message || String(e));
    }
  };
  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!form.matches('[data-personal-name],[data-personal-youtube]')) return;
    event.preventDefault();
    run(async () => {
      if (form.matches('[data-personal-name]')) {
        const name = form.elements.browserName.value.trim();
        if (!name || name.length > 60 || /[\u0000-\u001f]/.test(name))
          throw Error('Bitte gib einen Namen mit 1–60 Zeichen ein.');
        savePersonal({ name });
        applyBrowserName();
      } else {
        const youtube = form.elements.youtube.value.trim();
        if (!youtubeID(youtube)) throw Error('Bitte füge einen gültigen YouTube-Videolink ein.');
        savePersonal({ youtube, background: 'youtube' });
      }
      refresh();
      feedback('Gespeichert. Öffne einen neuen Tab für deinen Hintergrund.');
    });
  });
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-personal-background],[data-personal-reset-icon]');
    if (!button) return;
    run(async () => {
      if (button.hasAttribute('data-personal-reset-icon')) await resetIcon();
      else {
        const background = button.dataset.personalBackground;
        if (background === 'youtube' && !youtubeID(personal().youtube))
          throw Error('Füge zuerst unten einen YouTube-Link ein.');
        if (['image', 'video'].includes(background)) {
          const file = await mediaFile();
          if (!file || !file.type.startsWith(background === 'image' ? 'image/' : 'video/'))
            throw Error('Wähle zuerst eine passende Datei aus.');
        }
        savePersonal({ background });
      }
      refresh();
    });
  });
  document.addEventListener('input', (event) => {
    if (event.target.matches('[data-personal-blur]')) {
      const menuBlur = Math.max(0, Math.min(32, Number(event.target.value)));
      event.target.nextElementSibling.textContent = menuBlur + ' px';
      savePersonal({ menuBlur });
      return;
    }
    if (!event.target.matches('[data-personal-contrast]')) return;
    const contrast = Math.max(0, Math.min(85, Number(event.target.value)));
    event.target.nextElementSibling.textContent = contrast + '%';
    savePersonal({ contrast });
  });
  document.addEventListener('change', (event) => {
    const input = event.target;
    if (input.matches('[data-personal-text]')) {
      savePersonal({ textContrast: input.value });
      return;
    }
    if (!input.matches('[data-personal-icon],[data-personal-media],[data-personal-motion]')) return;
    run(async () => {
      if (input.matches('[data-personal-motion]')) {
        savePersonal({ motion: input.checked });
        return;
      }
      const file = input.files?.[0];
      if (!file) return;
      input.disabled = true;
      try {
        if (input.matches('[data-personal-icon]')) await setIcon(file);
        else {
          const image = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type);
          const video = ['video/mp4', 'video/webm'].includes(file.type);
          if (!image && !video) throw Error('Bitte wähle PNG, JPG, WebP, MP4 oder WebM.');
          if (file.size > (image ? 20 : 100) * 1024 * 1024) throw Error('Diese Datei ist zu groß.');
          await mediaFile(file);
          savePersonal({
            background: image ? 'image' : 'video',
            fileName: file.name,
            mediaRevision: Date.now(),
          });
        }
        refresh();
        feedback('Gespeichert.');
      } finally {
        input.disabled = false;
        input.value = '';
      }
    });
  });
}

export function startVisible(host) {
  return (
    !document.hidden &&
    !host.hidden &&
    !host.closest('[hidden], [inert]') &&
    !document.querySelector('.setup, .slow-setup')
  );
}
export function watchStartVisibility(host, callback) {
  let previous;
  const sync = () => {
    const visible = startVisible(host);
    if (visible === previous) return;
    previous = visible;
    callback(visible);
  };
  const observer = new MutationObserver(sync);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'inert'],
  });
  document.addEventListener('visibilitychange', sync);
  sync();
  return () => {
    observer.disconnect();
    document.removeEventListener('visibilitychange', sync);
  };
}
export function mountPersonalBackground(host) {
  const p = personal();
  if (p.background === 'waves') return () => {};
  const layer = host.querySelector('.st-bg');
  layer.replaceChildren();
  layer.classList.add('personal-background');
  const status = document.createElement('p');
  status.className = 'personal-bg-status';
  status.setAttribute('role', 'status');
  host.append(status);
  let disposed = false,
    url,
    media,
    unwatch = () => {},
    stopContrast = () => {};
  const fail = () => {
    if (!disposed)
      status.textContent =
        'Hintergrund konnte nicht geladen werden. Wähle unter Darstellung eine andere Datei oder ein anderes Video.';
  };
  if (p.background === 'youtube') {
    const id = youtubeID(p.youtube);
    let frame, readyTimer;
    unwatch = watchStartVisibility(host, (visible) => {
      const play = visible && p.motion && !matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!play) {
        clearTimeout(readyTimer);
        frame?.remove();
        frame = null;
        return;
      }
      if (!frame && id) {
        frame = document.createElement('iframe');
        frame.title = 'YouTube-Hintergrund';
        frame.allow = 'autoplay; encrypted-media';
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        frame.src = `https://luna-browser.com/youtube-background.html?v=${id}`;
        layer.append(frame);
        readyTimer = setTimeout(fail, 20000);
      }
    });
    const message = (event) => {
      if (
        event.origin === 'https://luna-browser.com' &&
        event.source === frame?.contentWindow &&
        ['luna-youtube-error', 'luna-youtube-ready'].includes(event.data?.type)
      ) {
        clearTimeout(readyTimer);
        if (event.data.type === 'luna-youtube-error') fail();
        else status.textContent = '';
      }
    };
    window.addEventListener('message', message);
    const old = unwatch;
    unwatch = () => {
      old();
      clearTimeout(readyTimer);
      window.removeEventListener('message', message);
      frame?.remove();
    };
  } else {
    mediaFile()
      .then((file) => {
        if (disposed) return;
        if (!file) {
          fail();
          return;
        }
        url = URL.createObjectURL(file);
        media = document.createElement(p.background === 'video' ? 'video' : 'img');
        media.onerror = fail;
        if (p.background === 'video') {
          media.muted = true;
          media.loop = true;
          media.playsInline = true;
          media.preload = 'metadata';
        } else media.alt = '';
        media.src = url;
        layer.append(media);
        stopContrast = trackBackgroundContrast(
          media,
          host,
          () => startVisible(host) && personal().textContrast === 'auto',
        );
        if (p.background === 'video')
          unwatch = watchStartVisibility(host, (visible) => {
            if (visible && p.motion && !matchMedia('(prefers-reduced-motion: reduce)').matches)
              media.play().catch(() => {
                status.textContent =
                  'Videowiedergabe blockiert. Prüfe das Video unter Darstellung.';
              });
            else media.pause();
          });
      })
      .catch(fail);
  }
  return () => {
    disposed = true;
    stopContrast();
    unwatch();
    media?.pause?.();
    media?.removeAttribute('src');
    media?.load?.();
    if (url) URL.revokeObjectURL(url);
    status.remove();
  };
}
