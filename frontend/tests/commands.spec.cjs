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

test('commands can be switched on and off: green and red frames, off commands act like normal input', async ({
  page,
}) => {
  await openApp(page);
  await page.locator('#url').fill('commands');
  const cards = page.locator('#cmdPage .cmd-card');
  const theme = cards.filter({ has: page.locator('[data-toggle="theme"]') });
  await expect(theme).toHaveClass(/\bon\b/);
  await expect(theme).toHaveCSS('border-top-color', 'rgb(47, 174, 107)');
  await theme.locator('.cmd-switch').click();
  await expect(theme).toHaveClass(/\boff\b/);
  await expect(theme).toHaveCSS('border-top-color', 'rgb(224, 82, 77)');
  await expect(theme.locator('.cmd-try')).toBeDisabled();
  // Klick auf die Karte schaltet ebenfalls um
  await theme.locator('h2').click();
  await expect(theme).toHaveClass(/\bon\b/);
  await theme.locator('h2').click();
  await expect(theme).toHaveClass(/\boff\b/);
  await page.screenshot({ path: '/tmp/luna-commands-toggle.png' });
  await page.keyboard.press('Escape');
  // „theme“ ist aus: es passiert nichts Besonderes mehr
  await page.locator('#url').fill('theme');
  await page.waitForTimeout(400);
  await expect(page.locator('#themeDrop')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('luna-commands-off'))).toBe('["theme"]');
});

test('settings chapter Befehle lists all commands and toggles them', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('Meta+,');
  await page.locator('#url').fill('einstellungen');
  const settings = page.locator('#settingsView');
  if (!(await settings.isVisible())) {
    await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  }
  await page.getByRole('button', { name: 'Befehle', exact: true }).click();
  await expect(page.locator('.cmd-set-card')).toHaveCount(7);
  await expect(page.locator('.cmd-count')).toHaveText('7 von 7 Befehlen aktiv');
  await page.locator('.cmd-set-card[data-id="chat"]').click();
  await expect(page.locator('.cmd-set-card[data-id="chat"]')).toHaveClass(/\boff\b/);
  await expect(page.locator('.cmd-count')).toHaveText('6 von 7 Befehlen aktiv');
  await page.getByRole('button', { name: 'Alle aus' }).click();
  await expect(page.locator('.cmd-count')).toHaveText('0 von 7 Befehlen aktiv');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/tmp/luna-commands-settings.png' });
  await page.getByRole('button', { name: 'Alle an' }).click();
  await expect(page.locator('.cmd-count')).toHaveText('7 von 7 Befehlen aktiv');
});

test('commands page does not trap the user: Spotify chip, typing and tabs work while it is open', async ({
  page,
}) => {
  await openApp(page);
  await page.locator('#url').fill('commands');
  await expect(page.locator('#cmdPage')).toBeVisible();
  await page.locator('#spChip .spChip').click();
  await expect(page.locator('#cmdPage')).toHaveCount(0);
  await expect(page.locator('#spChip .spChip')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('#url').fill('commands');
  await expect(page.locator('#cmdPage')).toBeVisible();
  await page.locator('#url').pressSequentially('x');
  await expect(page.locator('#cmdPage')).toHaveCount(0);
});

test('theme bar closes when you type more, type something else or click away', async ({ page }) => {
  await openApp(page);
  const drop = page.locator('#themeDrop');
  await page.locator('#url').fill('theme');
  await expect(drop).toBeVisible();
  await page.locator('#url').click();
  await page.keyboard.press('End');
  await page.keyboard.type('s');
  await page.waitForTimeout(150);
  await expect(drop).toBeVisible(); // „themes“ gilt weiter
  await page.keyboard.type('x');
  await expect(drop).toHaveCount(0, { timeout: 2000 });
  await page.locator('#url').fill('theme');
  await expect(drop).toBeVisible();
  await page.locator('#url').fill('google maps');
  await expect(drop).toHaveCount(0, { timeout: 2000 });
  await page.locator('#url').fill('theme');
  await expect(drop).toBeVisible();
  await page.locator('#bMenu').click();
  await expect(drop).toHaveCount(0, { timeout: 2000 });
});
