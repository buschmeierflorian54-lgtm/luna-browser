const { test, expect } = require('@playwright/test');
for (const windows of [true, false])
  test(`shared caption row: ${windows ? 'Windows' : 'macOS unchanged'}`, async ({
    browser,
  }, testInfo) => {
    const page = await browser.newPage({
      viewport: { width: 1024, height: 768 },
      userAgent: windows
        ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    });
    await page.route('**/__chrome_test', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<link rel="stylesheet" href="/src/style.css"><div id="app"><div id="titlebar"><div id="tabs"><div class="tab act"><button class="tlab">Luna Search</button></div><button id="newtab">+</button></div></div></div><script type="module">
 import {initWindowChrome} from '/src/window-chrome.js';
 window.calls=[];window.max=false;window.runtime={WindowMinimise(){calls.push('min')},WindowToggleMaximise(){max=!max;calls.push('max')},WindowIsMaximised:async()=>max,Quit(){calls.push('close')}};
 initWindowChrome();window.ready=true;
 </script>`,
      }),
    );
    await page.goto('http://127.0.0.1:5174/__chrome_test');
    await page.waitForFunction(() => window.ready);
    const controls = page.locator('.window-controls');
    if (!windows) {
      await expect(controls).toHaveCount(0);
      await page.close();
      return;
    }
    await expect(controls).toBeVisible();
    const tab = await page.locator('.tab').boundingBox(),
      buttons = await controls.boundingBox();
    expect(buttons.y).toBe(tab.y);
    expect(buttons.height).toBe(tab.height);
    expect(buttons.x + buttons.width).toBeLessThanOrEqual(1024);
    await page.getByRole('button', { name: 'Fenster minimieren' }).click();
    await page.getByRole('button', { name: 'Fenster maximieren' }).click();
    await expect(page.getByRole('button', { name: 'Fenster wiederherstellen' })).toBeVisible();
    await page.getByRole('button', { name: 'Fenster wiederherstellen' }).click();
    await page.getByRole('button', { name: 'Fenster schließen' }).click();
    expect(await page.evaluate(() => calls)).toEqual(['min', 'max', 'max', 'close']);
    await page.screenshot({ path: testInfo.outputPath('windows-tab-row.png') });
    await page.close();
  });
