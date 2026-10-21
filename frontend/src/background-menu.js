import { personal, savePersonal, youtubeID } from './personalization.js';
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
    <section id="bg-media" role="tabpanel" aria-labelledby="bg-tab-media" hidden><label class="bg-import personal-file">＋ Foto oder Video importieren<input type="file" data-personal-media accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"></label><p class="muted" data-media-summary>${esc(p.fileName || 'PNG, JPG, WebP · MP4, WebM')}</p><p class="muted">Fotos bis 20 MB · Videos bis 100 MB</p><label class="personal-motion" data-media-motion ${p.background === 'video' ? '' : 'hidden'}><input type="checkbox" data-personal-motion ${p.motion ? 'checked' : ''}> Video abspielen</label></section>
    <section id="bg-youtube" role="tabpanel" aria-labelledby="bg-tab-youtube" hidden><form class="bg-link"><input type="url" name="youtube" aria-label="YouTube-Link" placeholder="YouTube-Link einfügen" value="${esc(p.youtube)}" required><button type="submit" aria-label="Video übernehmen" disabled><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></button></form><div class="bg-preview" hidden></div><p class="muted">Vorschau über YouTube · ohne Ton</p><p role="status" data-youtube-status></p></section>
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
  let timer, previewID;
  function suspend() {
    clearTimeout(timer);
    preview.replaceChildren();
    preview.hidden = true;
    previewID = null;
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
    root.querySelector('[data-youtube-status]').textContent = '';
    if (id === previewID) return;
    suspend();
    if (!id) return;
    timer = setTimeout(() => {
      previewID = id;
      const frame = document.createElement('iframe');
      frame.src = `https://luna-browser.com/youtube-background.html?v=${encodeURIComponent(id)}`;
      frame.title = 'YouTube-Vorschau';
      frame.allow = 'autoplay; encrypted-media';
      preview.append(frame);
      preview.hidden = false;
    }, 300);
  });
  root.querySelector('.bg-link').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!youtubeID(input.value.trim())) return;
    suspend();
    savePersonal({ background: 'youtube', youtube: input.value.trim() });
    root.querySelector('[data-youtube-status]').textContent = 'Hintergrund übernommen.';
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
    root.querySelector('[data-media-summary]').textContent = p.fileName
      ? `${p.background === 'video' ? 'Video' : p.background === 'image' ? 'Foto' : 'Datei'} · ${p.fileName}`
      : 'PNG, JPG, WebP · MP4, WebM';
  }
  const p = personal();
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
    if (event.data?.type === 'luna-youtube-error') {
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
      suspend();
      window.removeEventListener('luna-personalization', sync);
      window.removeEventListener('message', onMessage);
    },
  };
}
