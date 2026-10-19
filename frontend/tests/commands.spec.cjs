const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
async function openApp(page) {
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
  };
  await page.addInitScript(() => localStorage.setItem('luna-onboarding-done', '1'));
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

test('commands opens a themed page without Enter and closes with the button and Esc', async ({
  page,
}) => {
  await openApp(page);
  await page.locator('#url').fill('commands');
  const cmd = page.locator('#cmdPage');
  await expect(cmd).toBeVisible();
  await expect(cmd.locator('.cmd-card')).toHaveCount(7);
  await expect(cmd.locator('.cmd-card').first().locator('.cmd-typed')).toHaveText(/spotify/, {
    timeout: 6000,
  });
  await page.screenshot({ path: '/tmp/luna-commands.png' });
  await cmd.getByRole('button', { name: 'Schließen' }).click();
  await expect(cmd).toHaveCount(0);
  await page.locator('#url').fill('commands');
  await expect(cmd).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(cmd).toHaveCount(0);
});

test('Ausprobieren fills the address bar with the command', async ({ page }) => {
  await openApp(page);
  await page.locator('#url').fill('commands');
  await page.locator('.cmd-try').nth(1).click();
  await expect(page.locator('#cmdPage')).toHaveCount(0);
  await expect(page.locator('#url')).toBeFocused();
});

test('theme grows the address bar downward, applies themes live and closes', async ({ page }) => {
  await openApp(page);
  await page.locator('#url').fill('theme');
  const drop = page.locator('#themeDrop');
  await expect(drop).toBeVisible();
  await expect(page.locator('#urlbox')).toHaveClass(/drop-open/);
  const early = (await drop.boundingBox()).height;
  await page.waitForTimeout(1400);
  const full = (await drop.boundingBox()).height;
  expect(full).toBeGreaterThan(early);
  await expect(drop.locator('.color-theme')).toHaveCount(10);
  await page.screenshot({ path: '/tmp/luna-theme-drop.png' });
  await drop.locator('[data-pick="ocean"]').click();
  expect(await page.evaluate(() => document.documentElement.dataset.colorTheme)).toBe('ocean');
  await expect(drop.locator('[data-pick="ocean"]')).toHaveAttribute('aria-pressed', 'true');
  await drop.getByRole('button', { name: 'Schließen' }).click();
  await expect(drop).toHaveCount(0, { timeout: 2000 });
  await expect(page.locator('#urlbox')).not.toHaveClass(/drop-open/);
});
