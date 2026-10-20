const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

async function openApp(page, status) {
  const names = [
    ...fs
      .readFileSync(path.join(__dirname, '../src/api.js'), 'utf8')
      .matchAll(/export const (\w+)/g),
  ].map((x) => x[1]);
  const mocks = {
    IS_NATIVE: 'false',
    prefs: 'async()=>({})',
    mcpStatus: 'async()=>({enabled:false,running:false})',
    keyStatus: 'async()=>false',
    bookmarks: 'async()=>[]',
    history: 'async()=>[]',
    downloads: 'async()=>[]',
    notes: 'async()=>[]',
    spotifyState: 'async()=>({status:"stopped"})',
    updateStatus: 'async()=>structuredClone(window.updateStatus)',
    installUpdate: 'async()=>{window.installed=(window.installed||0)+1}',
  };
  await page.addInitScript((s) => {
    window.updateStatus = s;
    localStorage.removeItem('luna-update-announced');
  }, status);
  await page.route('**/src/api.js*', (r) =>
    r.fulfill({
      contentType: 'text/javascript',
      body: names.map((n) => `export const ${n}=${mocks[n] || 'async()=>null'};`).join('\n'),
    }),
  );
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.goto('http://127.0.0.1:5174');
  await page.locator('#splash.gone').waitFor({ state: 'attached' });
}

test('a ready update shows a quiet dot, a toast and a menu entry that restarts Luna', async ({
  page,
}) => {
  await openApp(page, { pendingVersion: '1.9.9', installReady: true, phase: 'ready' });
  await expect(page.locator('#bMenu')).toHaveClass(/has-update/, { timeout: 12000 });
  await expect(page.locator('#toast')).toContainText('Luna 1.9.9 ist bereit');
  await page.locator('#bMenu').click();
  const entry = page.locator('#menu [data-cmd="install-update"]');
  await expect(entry).toContainText('Update 1.9.9 installieren');
  await page.screenshot({ path: '/tmp/luna-update-menu.png' });
  await entry.click();
  await expect.poll(() => page.evaluate(() => window.installed)).toBe(1);
});

test('without an update there is no dot and no menu entry', async ({ page }) => {
  await openApp(page, { pendingVersion: '', installReady: false, phase: 'current' });
  await page.waitForTimeout(6500);
  await expect(page.locator('#bMenu')).not.toHaveClass(/has-update/);
  await page.locator('#bMenu').click();
  await expect(page.locator('#menu [data-cmd="install-update"]')).toHaveCount(0);
});
