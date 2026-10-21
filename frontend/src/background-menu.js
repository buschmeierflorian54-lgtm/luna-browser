import {
  personal,
  savePersonal,
  youtubeID,
  mediaFile,
  watchStartVisibility,
} from './personalization.js';
import { esc } from './ui.js';

export function backgroundMenuHTML() {
  const p = personal();
  return `<nav class="bg-tabs" role="tablist" aria-label="Hintergrundquelle">${[
    ['motifs', 'Luna-Motive'],
    ['media', 'Foto & Video'],
    ['youtube', 'YouTube'],
  ]
    .map(
      ([id, label]) =>
        `<button type="button" role="tab" id="bg-tab-${id}" aria-controls="bg-${id}" data-bg-tab="${id}" aria-selected="${id === 'motifs'}" tabindex="${id === 'motifs' ? 0 : -1}">${label}</button>`,
    )
    .join('')}</nav>
  <div class="bg-island">
    <section id="bg-motifs" role="tabpanel" aria-labelledby="bg-tab-motifs">
      <div class="bg-motifs">${[
        ['waves', 'Luna-Wellen'],
        ['aurora', 'Nordlicht'],
        ['stars', 'Sternenstaub'],
      ]
        .map(
          ([id, label]) =>
            `<button type="button" data-motif="${id}" aria-pressed="${p.background === 'waves' && (p.motif || 'waves') === id}"><i class="motif-${id}"></i>${label}</button>`,
        )
        .join('')}</div>
      <label class="personal-contrast">Tempo<input data-motif-speed type="range" min="20" max="180" value="${p.motifSpeed || 100}"><output>${p.motifSpeed || 100}%</output></label>
      <label class="personal-motion"><input type="checkbox" data-personal-motion ${p.motion ? 'checked' : ''}> Bewegung</label>
    </section>
    <section id="bg-media" role="tabpanel" aria-labelledby="bg-tab-media" hidden>
      <div class="bg-media-card">
        <div class="bg-media-art" aria-hidden="true"></div>
        <label class="bg-import personal-file"><span class="bg-upload-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 5 5 3-3 4 4"/></svg></span><strong>Dein Moment. Dein Hintergrund.</strong><span class="bg-import-hint">Foto oder Video wählen</span><input type="file" aria-label="Foto oder Video wählen" data-personal-media accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"></label>
        <div class="bg-media-bar" hidden><span class="bg-type"></span><span data-media-summary></span><span class="bg-file-size"></span><button type="button" data-media-replace>Ersetzen</button><button type="button" data-media-remove aria-label="Eigenen Hintergrund entfernen">×</button></div>
      </div>
      <div class="bg-media-foot"><span>Hierher ziehen oder auswählen</span><span>Foto bis 20 MB · Video bis 100 MB</span></div>
      <label class="personal-motion" data-media-motion hidden><input type="checkbox" data-personal-motion ${p.motion ? 'checked' : ''}> Video abspielen</label>
    </section>
    <section id="bg-youtube" role="tabpanel" aria-labelledby="bg-tab-youtube" hidden>
      <form class="bg-link"><svg class="bg-link-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m10 13 4-4m-6 6-2 2a4 4 0 0 1-6-6l4-4m12 2 2-2a4 4 0 0 1 6 6l-4 4" transform="translate(2 0) scale(.85)"/></svg><input type="url" name="youtube" aria-label="YouTube-Link" placeholder="YouTube-Link einfügen" value="${esc(p.youtube)}" required><button type="submit" aria-label="Video übernehmen" disabled><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></button></form>
      <div class="bg-preview" hidden><div class="bg-preview-card"><div class="bg-preview-screen"></div><div class="bg-preview-loading"><span></span>Vorschau wird geladen</div><div class="bg-preview-caption"><span>Vorschau</span><span>Ohne Ton · YouTube</span></div></div></div>
      <p class="bg-youtube-status" role="status" data-youtube-status>Dein Video als Hintergrund. Mit dem Pfeil übernehmen.</p>
    </section>
    <details class="bg-options"><summary>Kontrast & Schrift</summary><label class="personal-contrast">Kontrast<input type="range" min="0" max="85" data-personal-contrast value="${p.contrast}"><output>${p.contrast}%</output></label><label class="personal-text">Schrift<select data-personal-text aria-label="Schriftkontrast">${[
      ['auto', 'Automatisch'],
      ['dark', 'Hell'],
      ['light', 'Dunkel'],
    ]
      .map(
        ([v, l]) => `<option value="${v}" ${p.textContrast === v ? 'selected' : ''}>${l}</option>`,
      )
      .join(
        '',
      )}</select></label></details><p data-personal-feedback role="status" class="personal-feedback"></p>
  </div>`;
}

export function wireBackgroundMenu(root) {
  const preview = root.querySelector('.bg-preview');
  const input = root.querySelector('[name=youtube]');
  const submit = root.querySelector('.bg-link button');
  const screen = root.querySelector('.bg-preview-screen');
  const status = root.querySelector('[data-youtube-status]');
  const arrow = submit.innerHTML;
  const mediaCard = root.querySelector('.bg-media-card');
  const mediaArt = root.querySelector('.bg-media-art');
  let timer,
    loadTimer,
    previewID,
    mediaURL,
    mediaRevision,
    mediaGeneration = 0,
    disposed = false,
    stopMediaVisibility;
  function animateSize(before) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const after = root.offsetHeight;
    if (before === after) return;
    root.getAnimations().forEach((a) => a.cancel());
    root.animate([{ height: before + 'px' }, { height: after + 'px' }], {
      duration: 240,
      easing: 'cubic-bezier(.2,.8,.2,1)',
    });
  }
  function clearMedia() {
    stopMediaVisibility?.();
    stopMediaVisibility = null;
    mediaArt.querySelector('video')?.pause();
    mediaArt.replaceChildren();
    if (mediaURL) URL.revokeObjectURL(mediaURL);
    mediaURL = null;
  }
  async function showMedia() {
    const generation = ++mediaGeneration;
    try {
      const file = await mediaFile();
      if (disposed || generation !== mediaGeneration) return;
      clearMedia();
      const valid = file instanceof Blob;
      mediaCard.classList.toggle('has-media', valid);
      root.querySelector('.bg-media-bar').hidden = !valid;
      root.querySelector('[data-media-motion]').hidden = !valid || !file.type.startsWith('video/');
      if (!valid) return;
      const video = file.type.startsWith('video/');
      const el = document.createElement(video ? 'video' : 'img');
      mediaURL = URL.createObjectURL(file);
      el.src = mediaURL;
      if (video) {
        el.muted = true;
        el.loop = true;
        el.playsInline = true;
        el.preload = 'metadata';
      } else el.alt = 'Vorschau deines Hintergrunds';
      mediaArt.append(el);
      if (video)
        stopMediaVisibility = watchStartVisibility(root.querySelector('#bg-media'), (active) => {
          if (
            active &&
            personal().motion &&
            !matchMedia('(prefers-reduced-motion: reduce)').matches
          )
            el.play().catch(() => {});
          else el.pause();
        });
      root.querySelector('.bg-type').textContent = video ? 'Video' : 'Foto';
      root.querySelector('[data-media-summary]').textContent =
        `${video ? 'Video' : 'Foto'} · ${personal().fileName || file.name || 'Hintergrund'}`;
      root.querySelector('.bg-file-size').textContent =
        (file.size / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' MB';
    } catch {
      if (!disposed)
        root.querySelector('[data-personal-feedback]').textContent =
          'Die Vorschau konnte nicht geladen werden.';
    }
  }
  function suspend() {
    clearTimeout(timer);
    clearTimeout(loadTimer);
    screen.replaceChildren();
    mediaArt.querySelector('video')?.pause();
    preview.hidden = true;
    previewID = null;
    preview.classList.remove('is-ready', 'is-error');
  }
  function select(id, focus = false) {
    suspend();
    root.querySelectorAll('[data-bg-tab]').forEach((b) => {
      const on = b.dataset.bgTab === id;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      root.querySelector('#bg-' + b.dataset.bgTab).hidden = !on;
      if (on && focus) b.focus();
    });
  }
  root.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-bg-tab]');
    if (tab) select(tab.dataset.bgTab);
    const motif = e.target.closest('[data-motif]');
    if (motif) savePersonal({ background: 'waves', motif: motif.dataset.motif });
  });
  root.addEventListener('keydown', (e) => {
    const tab = e.target.closest('[data-bg-tab]');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const ids = ['motifs', 'media', 'youtube'],
      i = ids.indexOf(tab.dataset.bgTab);
    select(
      ids[e.key === 'Home' ? 0 : e.key === 'End' ? 2 : (i + (e.key === 'ArrowRight' ? 1 : 2)) % 3],
      true,
    );
  });
  root.querySelector('[data-motif-speed]').addEventListener('input', (e) => {
    e.target.nextElementSibling.textContent = e.target.value + '%';
    savePersonal({ motifSpeed: Number(e.target.value) });
  });
  input.addEventListener('input', () => {
    const id = youtubeID(input.value.trim());
    submit.disabled = !id;
    submit.innerHTML = arrow;
    submit.classList.remove('is-applied');
    status.textContent = id
      ? 'Vorschau · Erst der Pfeil übernimmt deinen Hintergrund.'
      : input.value.trim()
        ? 'Bitte einen gültigen YouTube-Link einfügen.'
        : 'Dein Video als Hintergrund. Mit dem Pfeil übernehmen.';
    if (id === previewID) return;
    suspend();
    if (!id) return;
    timer = setTimeout(() => {
      previewID = id;
      root.querySelector('.bg-preview-loading').innerHTML = '<span></span>Vorschau wird geladen';
      const frame = document.createElement('iframe');
      frame.src = `https://luna-browser.com/youtube-background.html?v=${encodeURIComponent(id)}`;
      frame.title = 'YouTube-Vorschau';
      frame.allow = 'autoplay; encrypted-media';
      const before = root.offsetHeight;
      screen.append(frame);
      preview.hidden = false;
      animateSize(before);
      loadTimer = setTimeout(() => {
        status.textContent =
          'Die Vorschau braucht länger. Prüfe deine Verbindung oder einen anderen Link.';
      }, 15000);
    }, 300);
  });
  root.querySelector('.bg-link').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!youtubeID(input.value.trim())) return;
    const before = root.offsetHeight;
    suspend();
    animateSize(before);
    savePersonal({ background: 'youtube', youtube: input.value.trim() });
    status.textContent = 'Übernommen · youtu.be/' + youtubeID(input.value);
    submit.classList.add('is-applied');
    submit.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 4 4L19 6"/></svg>';
  });
  function sync() {
    const p = personal();
    root
      .querySelectorAll('[data-motif]')
      .forEach((b) =>
        b.setAttribute(
          'aria-pressed',
          String(p.background === 'waves' && b.dataset.motif === (p.motif || 'waves')),
        ),
      );
    root.querySelectorAll('[data-personal-motion]').forEach((el) => (el.checked = p.motion));
    const video = mediaArt.querySelector('video');
    if (video) {
      if (
        p.motion &&
        !root.hidden &&
        !root.querySelector('#bg-media').hidden &&
        !matchMedia('(prefers-reduced-motion: reduce)').matches
      )
        video.play().catch(() => {});
      else video.pause();
    }
    if (mediaRevision !== p.mediaRevision) {
      mediaRevision = p.mediaRevision;
      showMedia();
    }
  }
  const picker = root.querySelector('[data-personal-media]');
  root.querySelector('[data-media-replace]').addEventListener('click', () => picker.click());
  root.querySelector('[data-media-remove]').addEventListener('click', async () => {
    try {
      await mediaFile(null);
      savePersonal({ background: 'waves', fileName: '', mediaRevision: Date.now() });
    } catch {
      root.querySelector('[data-personal-feedback]').textContent =
        'Die Datei konnte nicht entfernt werden.';
    }
  });
  mediaCard.addEventListener('dragover', (e) => {
    e.preventDefault();
    mediaCard.classList.add('drag-over');
  });
  mediaCard.addEventListener('dragleave', (e) => {
    if (!mediaCard.contains(e.relatedTarget)) mediaCard.classList.remove('drag-over');
  });
  mediaCard.addEventListener('drop', (e) => {
    e.preventDefault();
    mediaCard.classList.remove('drag-over');
    if (!e.dataTransfer.files.length) return;
    picker.files = e.dataTransfer.files;
    picker.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const p = personal();
  mediaRevision = p.mediaRevision;
  showMedia();
  select(
    p.background === 'youtube'
      ? 'youtube'
      : ['image', 'video'].includes(p.background)
        ? 'media'
        : 'motifs',
  );
  submit.disabled = !youtubeID(input.value);
  function onMessage(event) {
    if (
      event.origin !== 'https://luna-browser.com' ||
      event.source !== preview.querySelector('iframe')?.contentWindow
    )
      return;
    if (event.data?.type === 'luna-youtube-ready') {
      clearTimeout(loadTimer);
      preview.classList.add('is-ready');
      status.textContent = 'Gefällt dir der Hintergrund? Mit dem Pfeil übernehmen.';
    }
    if (event.data?.type === 'luna-youtube-error') {
      clearTimeout(loadTimer);
      preview.classList.add('is-error');
      root.querySelector('.bg-preview-loading').textContent = 'Keine Vorschau verfügbar';
      root.querySelector('[data-youtube-status]').textContent =
        'Dieses Video erlaubt keine Vorschau. Bitte wähle einen anderen Link.';
      submit.disabled = true;
    }
  }
  window.addEventListener('message', onMessage);
  window.addEventListener('luna-personalization', sync);
  return {
    suspend,
    dispose() {
      disposed = true;
      mediaGeneration++;
      suspend();
      clearMedia();
      window.removeEventListener('luna-personalization', sync);
      window.removeEventListener('message', onMessage);
    },
  };
}
