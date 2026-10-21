const { test, expect } = require('@playwright/test');
const path = require('path');
async function setup(page) {
  await page.route('**/src/api.js*', (r) =>
    r.fulfill({
      contentType: 'application/javascript',
      body: 'export const setDockIcon=async d=>{window.savedIcon=d};export const setErrorPalette=async()=>{};',
    }),
  );
  await page.route('https://luna-browser.com/youtube-background.html*', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<p>Player</p>' }),
  );
  await page.route('**/__personal_test', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><head><link rel="stylesheet" href="/src/styles/foundation.css"></head><body><section id="settings"></section><main id="start" style="position:relative;width:800px;height:500px"></main><script type="module">
import * as P from '/src/personalization.js';import {setCustomIcon,resetCustomIcon,applyColorTheme,themeIconURL} from '/src/color-themes.js';import {startBackgroundHTML} from '/src/start-background.js';window.P=P;window.themeIconURL=themeIconURL;window.applyColorTheme=applyColorTheme;window.refresh=()=>document.querySelector('#settings').innerHTML=P.personalSettingsHTML();refresh();P.wirePersonalSettings({refresh,setIcon:setCustomIcon,resetIcon:resetCustomIcon,toast:console.log});window.mount=()=>{window.dispose?.();document.querySelector('#start').innerHTML=startBackgroundHTML;window.dispose=P.mountPersonalBackground(document.querySelector('#start'));};</script></body></html>`,
    }),
  );
  await page.goto('http://127.0.0.1:5174/__personal_test');
  await expect(page.locator('[data-personal-name]')).toBeVisible();
}
test('name and photo persist; changing colors preserves the custom icon', async ({ page }) => {
  await setup(page);
  await page.locator('[name=browserName]').fill('Mein <Browser>');
  await page.getByRole('button', { name: 'Namen speichern' }).click();
  await expect(page).toHaveTitle('Mein <Browser>');
  await page.reload();
  await expect(page.locator('[name=browserName]')).toHaveValue('Mein <Browser>');
  await page
    .locator('[data-personal-icon]')
    .setInputFiles(path.resolve(__dirname, '../../build/appicon.png'));
  await expect.poll(() => page.evaluate(() => !!window.savedIcon)).toBe(true);
  const icon = await page.evaluate(() => themeIconURL());
  expect(icon).toMatch(/^data:image\/png;base64,/);
  await page.evaluate(() => applyColorTheme('ocean', true));
  expect(await page.evaluate(() => themeIconURL())).toBe(icon);
  await page.getByRole('button', { name: 'Standard-Icon', exact: true }).click();
  await expect.poll(() => page.evaluate(() => themeIconURL())).not.toBe(icon);
});
test('YouTube links are validated and the player unloads behind other views', async ({ page }) => {
  await setup(page);
  expect(
    await page.evaluate(() =>
      [
        'https://youtu.be/M7lc1UVf-VE',
        'https://www.youtube.com/watch?v=M7lc1UVf-VE',
        'https://youtube.com.evil.test/watch?v=M7lc1UVf-VE',
        'javascript:alert(1)',
      ].map(P.youtubeID),
    ),
  ).toEqual(['M7lc1UVf-VE', 'M7lc1UVf-VE', '', '']);
  await page.locator('[name=youtube]').fill('https://youtu.be/M7lc1UVf-VE');
  await page.getByRole('button', { name: 'Video verwenden' }).click();
  await page.evaluate(() => mount());
  await expect(page.locator('#start iframe')).toHaveCount(1);
  await page.evaluate(() => (document.querySelector('#start').hidden = true));
  await expect(page.locator('#start iframe')).toHaveCount(0);
  await page.evaluate(() => (document.querySelector('#start').hidden = false));
  await expect(page.locator('#start iframe')).toHaveCount(1);
  await page.evaluate(() => {
    const e = document.createElement('div');
    e.className = 'setup';
    document.body.append(e);
  });
  await expect(page.locator('#start iframe')).toHaveCount(0);
  await page.evaluate(() => document.querySelector('.setup').remove());
  await expect(page.locator('#start iframe')).toHaveCount(1);
  await page.locator('[data-personal-motion]').uncheck();
  await page.evaluate(() => mount());
  await expect(page.locator('#start iframe')).toHaveCount(0);
});
test('local video survives reload and pauses while hidden', async ({ page }) => {
  await setup(page);
  const bytes = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 180;
    const stream = c.captureStream(10),
      chunks = [],
      r = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const done = new Promise((resolve) => {
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = async () =>
        resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())));
    });
    r.start();
    c.getContext('2d').fillRect(0, 0, 320, 180);
    await new Promise((r) => setTimeout(r, 350));
    r.stop();
    stream.getTracks().forEach((t) => t.stop());
    return done;
  });
  await page
    .locator('[data-personal-media]')
    .setInputFiles({ name: 'background.webm', mimeType: 'video/webm', buffer: Buffer.from(bytes) });
  await expect(page.locator('[data-personal-feedback]')).toHaveText('Gespeichert.');
  await page.reload();
  await page.evaluate(() => mount());
  await expect
    .poll(() => page.locator('#start video').evaluate((v) => !v.paused && v.muted))
    .toBe(true);
  await expect(page.locator('#start')).toHaveAttribute('data-background-tone', 'dark');
  await page.evaluate(() => (document.querySelector('#start').hidden = true));
  await expect.poll(() => page.locator('#start video').evaluate((v) => v.paused)).toBe(true);
  await page.evaluate(() => (document.querySelector('#start').hidden = false));
  await expect.poll(() => page.locator('#start video').evaluate((v) => v.paused)).toBe(false);
  await page.evaluate(() => dispose());
  await expect(page.locator('#start video')).not.toHaveAttribute('src', /^blob:/);
});

test('personalization is usable in the real settings page and updates the start page', async ({
  page,
}, testInfo) => {
  const fs = require('fs');
  const names = [
    ...fs
      .readFileSync(path.join(__dirname, '../src/api.js'), 'utf8')
      .matchAll(/export const (\w+)/g),
  ].map((x) => x[1]);
  const mocks = {
    IS_NATIVE: 'false',
    prefs: 'async()=>({onboardingComplete:true})',
    keyStatus: 'async()=>true',
    search:
      'async()=>({millis:10,results:[{title: "Luna Hintergrund",url:"https://example.com",host:"example.com",desc:"Ergebnis vor dem eigenen Bild"}]})',
    bookmarks: 'async()=>[]',
    downloads: 'async()=>[]',
    notes: 'async()=>[]',
    history: 'async()=>[]',
    spotifyState: 'async()=>({status:"off"})',
    spotifyAPIStatus: 'async()=>({})',
    chatStatus: 'async()=>({providers:{}})',
    mcpStatus: 'async()=>({enabled:false})',
    onMCP: 'cb=>window.mcpCommand=cb',
  };
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/src/api.js*', (r) =>
    r.fulfill({
      contentType: 'application/javascript',
      body: names.map((n) => `export const ${n}=${mocks[n] || 'async()=>null'};`).join('\n'),
    }),
  );
  await page.goto('http://127.0.0.1:5174');
  await expect(page.locator('#splash')).toHaveClass(/gone/);
  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  await expect(page.locator('[data-personal-name]')).toBeVisible();
  await page.locator('[name=browserName]').fill('Florins Browser');
  await page.getByRole('button', { name: 'Namen speichern' }).click();
  await expect(page).toHaveTitle('Florins Browser');
  await page.locator('.personal-settings').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('personalization-settings.png') });
  await page
    .locator('[data-personal-media]')
    .setInputFiles(path.resolve(__dirname, '../../build/appicon.png'));
  await expect(page.locator('[data-personal-background="image"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.locator('#newtab').click();
  await expect(page.locator('.st-custom-name')).toHaveText('Florins Browser');
  await expect(page.locator('#sharedBackground .personal-background img')).toBeVisible();
  await page.locator('#url').fill('luna hintergrund');
  await page.locator('#url').press('Enter');
  await expect(page.locator('#searchView .sr-t')).toHaveText('Luna Hintergrund');
  const backdrop = page.locator('#sharedBackground .personal-background img');
  await expect(backdrop).toBeVisible();
  await expect
    .poll(() => backdrop.evaluate((img) => img.complete && img.naturalWidth > 0))
    .toBe(true);
  await expect(page.locator('#searchView .st-waves')).toHaveCount(0);
  await expect(page.locator('#searchView .sr')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: testInfo.outputPath('search-personal-background.png') });
  await page.locator('#newtab').click();
  await expect(page.locator('#searchView')).toBeHidden();
  await expect(page.locator('#sharedBackground .personal-background img')).toBeVisible();
  let playerLoads = 0;
  await page.route('https://luna-browser.com/youtube-background.html*', (route) => {
    playerLoads++;
    return route.fulfill({ contentType: 'text/html', body: '<p>Persistent player</p>' });
  });
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('luna-personalization'));
    localStorage.setItem(
      'luna-personalization',
      JSON.stringify({ ...p, background: 'youtube', youtube: 'https://youtu.be/M7lc1UVf-VE' }),
    );
    window.dispatchEvent(new Event('luna-personalization'));
  });
  const player = page.locator('#sharedBackground iframe');
  await expect(player).toBeVisible();
  await expect.poll(() => playerLoads).toBe(1);
  await page.evaluate(
    () => (window.originalPlayer = document.querySelector('#sharedBackground iframe')),
  );
  for (const query of ['luna hintergrund', 'spotify-search:', 'luna neues ergebnis']) {
    if (query === 'luna neues ergebnis')
      await page.getByRole('button', { name: 'Spotify-Suchmodus beenden' }).click();
    await page.locator('#url').fill(query);
    await page.locator('#url').press('Enter');
    await expect(page.locator('#searchView')).toBeVisible();
    if (query === 'spotify-search:') await expect(page.locator('.music-welcome')).toBeVisible();
    else await expect(page.locator('#searchView .sr-t')).toHaveText('Luna Hintergrund');
    await expect
      .poll(() =>
        page.evaluate(() => originalPlayer === document.querySelector('#sharedBackground iframe')),
      )
      .toBe(true);
    await expect(player).toBeVisible();
  }
  await page.locator('#newtab').click();
  await expect(page.locator('#start')).toBeVisible();
  expect(
    await page.evaluate(
      () => originalPlayer === document.querySelector('#sharedBackground iframe'),
    ),
  ).toBe(true);
  expect(playerLoads).toBe(1);
  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  await expect(page.locator('#settingsView')).toBeVisible();
  await expect(page.locator('#settingsView')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('.sp-nav [aria-current="page"]')).toHaveText('Darstellung›');
  await expect(player).toBeVisible();
  expect(playerLoads).toBe(1);
  await page.locator('#url').fill('theme');
  await expect(page.locator('#themeDrop')).toBeVisible();
  await page.locator('#themeDrop summary').click();
  const quick = page.locator('#themeDrop');
  await quick.locator('[data-personal-contrast]').evaluate((el) => {
    el.value = '70';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#page')).toHaveCSS('--background-overlay', '70%');
  await quick.locator('[data-personal-text]').selectOption('dark');
  await expect(page.locator('#page')).toHaveAttribute('data-background-tone', 'dark');
  expect(playerLoads).toBe(1);
  await page.locator('#themeDrop').evaluate(async (el) => {
    await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {})));
  });
  await quick.locator('[data-personal-contrast]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('quick-background.png') });
  await quick.locator('[name=youtube]').fill('https://youtu.be/aqz-KE-bpKQ');
  await quick.getByRole('button', { name: 'Video verwenden' }).click();
  await expect(player).toHaveAttribute('src', /aqz-KE-bpKQ/);
  await quick.getByRole('button', { name: 'Schließen', exact: true }).click();
  await expect(quick).toHaveCount(0);
  await page.locator('#settingsView [data-personal-background="image"]').click();
  await expect(page.locator('#sharedBackground img')).toBeVisible();
  await page.locator('#settingsView [data-personal-text]').selectOption('auto');
  await page.locator('#settingsView').evaluate((el) => (el.scrollTop = 0));
  await expect(page.locator('#settingsView .sp-card')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: testInfo.outputPath('settings-background.png') });
  expect(errors).toEqual([]);
});

test('background visibility callbacks do not repeat on ordinary UI updates', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    window.visibilityCalls = [];
    window.stopWatching = P.watchStartVisibility(document.querySelector('#start'), (value) =>
      visibilityCalls.push(value),
    );
    const status = document.createElement('p');
    status.textContent = 'Playing';
    document.body.append(status);
    status.textContent = 'Still playing';
  });
  await expect.poll(() => page.evaluate(() => visibilityCalls)).toEqual([true]);
  await page.evaluate(() => (document.querySelector('#start').hidden = true));
  await expect.poll(() => page.evaluate(() => visibilityCalls)).toEqual([true, false]);
  await page.evaluate(() => stopWatching());
});

test('background contrast follows bright and dark images and ignores transparent pixels', async ({
  page,
}) => {
  await setup(page);
  for (const [color, tone] of [
    ['#fff', 'light'],
    ['#000', 'dark'],
  ]) {
    await page.evaluate(async (color) => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 32, 32);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve));
      await P.mediaFile(blob);
      P.savePersonal({ background: 'image' });
      mount();
    }, color);
    await expect(page.locator('#start')).toHaveAttribute('data-background-tone', tone);
  }
  expect(
    await page.evaluate(async () => {
      const { contrastTone } = await import('/src/background-contrast.js');
      return contrastTone(new Uint8ClampedArray([255, 255, 255, 0]), 'dark');
    }),
  ).toBe('dark');
});

test('video contrast follows changing frames without restarting playback', async ({ page }) => {
  await setup(page);
  await page.evaluate(async () => {
    const { trackBackgroundContrast } = await import('/src/background-contrast.js');
    window.sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 160;
    sampleCanvas.height = 90;
    window.paint = (color) => {
      const ctx = sampleCanvas.getContext('2d');
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 160, 90);
    };
    paint('#000');
    window.sampleVideo = document.createElement('video');
    sampleVideo.muted = true;
    sampleVideo.playsInline = true;
    sampleVideo.srcObject = sampleCanvas.captureStream(10);
    document.querySelector('#start').append(sampleVideo);
    await sampleVideo.play();
    window.stopSample = trackBackgroundContrast(
      sampleVideo,
      document.querySelector('#start'),
      () => !document.hidden,
    );
  });
  await expect(page.locator('#start')).toHaveAttribute('data-background-tone', 'dark');
  await page.evaluate(() => {
    window.paintTimer = setInterval(() => {
      paint('#fff');
      sampleVideo.srcObject.getVideoTracks()[0].requestFrame();
    }, 100);
  });
  await expect(page.locator('#start')).toHaveAttribute('data-background-tone', 'light');
  expect(await page.evaluate(() => sampleVideo.paused)).toBe(false);
  await page.evaluate(() => {
    clearInterval(paintTimer);
    stopSample();
    sampleVideo.srcObject.getTracks().forEach((t) => t.stop());
  });
  await expect(page.locator('#start')).not.toHaveAttribute('data-background-tone');
});
