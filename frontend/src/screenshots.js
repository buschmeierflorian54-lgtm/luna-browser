import * as api from './api.js';
import { $ } from './ui.js';

export function createScreenshots({ state: S, currentTab: cur, nativeShow, updateFrame, toast }) {
  let shotBusy = false,
    shotStatusTimer;
  function showShotStatus(text, done = false) {
    clearTimeout(shotStatusTimer);
    let status = $('#shotStatus');
    if (!status) {
      status = document.createElement('div');
      status.id = 'shotStatus';
      status.setAttribute('role', 'status');
      document.body.append(status);
    }
    status.textContent = text;
    if (done) shotStatusTimer = setTimeout(() => status.remove(), 5000);
  }
  async function takeShot() {
    if (shotBusy) return;
    shotBusy = true;
    showShotStatus('Screenshot wird erstellt …');
    const t = cur(),
      web = !!t && t.mode === 'web' && t.native;
    try {
      const b64 = await api.screenshot(web ? t.id : -1); // kopiert in die Zwischenablage und spielt den Ton (Go)
      if (!b64) throw new Error('Leere Aufnahme');
      showShotStatus('✓ Screenshot kopiert', true);
      toast('Screenshot in Zwischenablage kopiert');
      await shotAnimation('data:image/jpeg;base64,' + b64, web);
    } catch (e) {
      showShotStatus('Screenshot fehlgeschlagen', true);
      toast('Screenshot nicht möglich: ' + String(e?.message || e));
    } finally {
      shotBusy = false;
    }
  }
  // Blitz über dem Seitenbereich, dann schrumpft das Bild als Vorschau in die Ecke (wie bei macOS) und verschwindet wieder.
  async function shotAnimation(src, web) {
    const page = $('#page').getBoundingClientRect(),
      reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = cur(),
      covered = web && S.cover === 0;
    const pg = $('#pageShot');
    if (covered) {
      pg.src = src;
      pg.hidden = false;
      nativeShow(-1);
    } // native Seite verbergen, das Foto steht an ihrer Stelle
    let layer = $('#shotLayer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'shotLayer';
      document.body.appendChild(layer);
    }
    layer.innerHTML = '';
    const place = (el, r) => {
      el.style.left = r.left + 'px';
      el.style.top = r.top + 'px';
      el.style.width = r.width + 'px';
      el.style.height = r.height + 'px';
    };
    const flash = document.createElement('div');
    flash.className = 'shot-flash';
    place(flash, page);
    const img = document.createElement('img');
    img.className = 'shot-img';
    img.src = src;
    img.alt = '';
    place(img, page);
    const tw = Math.min(300, page.width * 0.34),
      th = (tw * page.height) / page.width;
    const target = {
      left: page.right - tw - 26,
      top: page.bottom - th - 52,
      width: tw,
      height: th,
    };
    const label = document.createElement('div');
    label.className = 'shot-label';
    label.textContent = 'In Zwischenablage kopiert';
    label.style.left = target.left + 'px';
    label.style.top = target.top + th + 10 + 'px';
    label.style.width = tw + 'px';
    layer.append(img, flash, label);
    if (!reduce) {
      flash.animate([{ opacity: 0.95 }, { opacity: 0 }], {
        duration: 160,
        easing: 'ease-out',
        fill: 'forwards',
      });
      await img
        .animate(
          [
            { transform: 'scale(1)' },
            { transform: 'scale(.985)', offset: 0.35 },
            { transform: 'scale(1)' },
          ],
          { duration: 100 },
        )
        .finished.catch(() => {});
      await img
        .animate(
          [
            {
              left: page.left + 'px',
              top: page.top + 'px',
              width: page.width + 'px',
              height: page.height + 'px',
              borderRadius: '12px',
              boxShadow: '0 0 0 rgba(0,0,0,0)',
            },
            {
              left: target.left + 'px',
              top: target.top + 'px',
              width: tw + 'px',
              height: th + 'px',
              borderRadius: '16px',
              boxShadow: '0 18px 44px rgba(0,0,0,.45)',
            },
          ],
          { duration: 260, easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'forwards' },
        )
        .finished.catch(() => {});
      label.animate(
        [
          { opacity: 0, transform: 'translateY(6px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 100, fill: 'forwards' },
      );
      await new Promise((r) => setTimeout(r, 500));
      await Promise.all([
        img.animate(
          [
            { opacity: 1, transform: 'none' },
            { opacity: 0, transform: 'translateX(40px) scale(.94)' },
          ],
          { duration: 180, easing: 'ease-in', fill: 'forwards' },
        ).finished,
        label.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' })
          .finished,
      ]).catch(() => {});
    } else {
      place(img, target);
      await new Promise((r) => setTimeout(r, 500));
    }
    layer.innerHTML = '';
    if (covered) {
      pg.hidden = true;
      const c = cur();
      if (c && c.native && c.mode === 'web') {
        updateFrame();
        nativeShow(c.id);
      }
    }
  }

  return { takeShot };
}
