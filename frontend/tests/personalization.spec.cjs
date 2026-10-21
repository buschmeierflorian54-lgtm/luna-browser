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
  await expect(page.locator('#start .personal-background img')).toBeVisible();
  await page.locator('#url').fill('luna hintergrund');
  await page.locator('#url').press('Enter');
  await expect(page.locator('#searchView .sr-t')).toHaveText('Luna Hintergrund');
  const backdrop = page.locator('#searchView .personal-background img');
  await expect(backdrop).toBeVisible();
  await expect
    .poll(() => backdrop.evaluate((img) => img.complete && img.naturalWidth > 0))
    .toBe(true);
  await expect(page.locator('#searchView .st-waves')).toHaveCount(0);
  await expect(page.locator('#searchView .sr')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: testInfo.outputPath('search-personal-background.png') });
  await page.locator('#newtab').click();
  await expect(page.locator('#searchView')).toBeHidden();
  await expect(page.locator('#start .personal-background img')).toBeVisible();
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
