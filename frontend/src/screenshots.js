import * as api from './api.js';
import { $ } from './ui.js';
import { playPolaroid } from './polaroid.js';

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
  async function shotAnimation(src, web) {
    const page = $('#page').getBoundingClientRect();
    const covered = web && S.cover === 0;
    const pg = $('#pageShot');
    if (covered) {
      pg.src = src;
      pg.hidden = false;
      nativeShow(-1);
    } // native Seite verbergen, das Foto steht an ihrer Stelle
    await playPolaroid(src, page);
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
