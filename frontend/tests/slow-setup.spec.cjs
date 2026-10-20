const { test, expect } = require('@playwright/test');
test('startup threshold, one warning, removal failure remains recoverable', async ({ page }) => {
  await page.route('**/src/api.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `export const removeLuna=async()=>{window.removalCalls=(window.removalCalls||0)+1;throw Error('Testfehler')};`,
    }),
  );
  await page.route('**/__slow_test', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<html><body><script type="module">import {createLoadWatchdog,showSlowSetup} from '/src/slow-setup.js';window.arm=()=>{window.watch=createLoadWatchdog(10000,()=>showSlowSetup());window.watch.start()};window.ready=true;</script></body></html>`,
    }),
  );
  await page.goto('http://127.0.0.1:5174/__slow_test');
  await page.waitForFunction(() => window.ready);
  await page.clock.install({ time: new Date(0) });
  await page.clock.pauseAt(new Date(1000));
  await page.evaluate(() => window.arm());
  await page.clock.runFor(9999);
  await expect(page.locator('.slow-setup')).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(page.locator('.slow-setup')).toBeVisible();
  await page.getByRole('button', { name: 'Luna entfernen', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Testfehler');
  expect(await page.evaluate(() => window.removalCalls)).toBe(1);
  await page.getByRole('button', { name: 'Ich will es trotzdem probieren' }).click();
  await page.evaluate(() => window.arm());
  await page.clock.runFor(10000);
  await expect(page.locator('.slow-setup')).toHaveCount(0);
});
