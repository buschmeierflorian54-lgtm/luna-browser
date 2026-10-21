const { test, expect } = require('@playwright/test');
test('Windows labels and unavailable local Spotify fallback', async ({ browser }) => {
  const page = await browser.newPage({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36',
  });
  await page.route('**/src/api.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `
    export const onSpotifyNext=()=>{};
    export const spotifyNextStatus=async()=>({});
    export const spotifyQueue=async()=>{throw Error('Queue unavailable')};
    export const prefs=async()=>({spotifyAutoNextAlways:true});
    export const spotifyScheduleNext=async()=>{window.scheduled=true};
  `,
    }),
  );
  await page.route('**/__platform_test', (route) =>
    route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: `<body><div id="toolbar"></div><script type="module">
    import { WINDOWS, shortcut, windowsCommand } from '/src/platform.js';
    import { spotifySettingsHTML } from '/src/spotify-view.js';
    import { initAutoNext } from '/src/music-autonext.js';
    window.keyCommand=windowsCommand;window.windows=WINDOWS; window.keys=shortcut('⌥⌘S');
    document.body.insertAdjacentHTML('beforeend', spotifySettingsHTML({}, false));
    const enqueue=initAutoNext({cover(){},toast(message){window.notice=message},notifications:{ask(){window.asked=true}}});
    await enqueue('spotify:track:1234567890123456789012','Test song');window.ready=true;
  </script></body>`,
    }),
  );
  await page.goto('http://127.0.0.1:5174/__platform_test');
  await page.waitForFunction(() => window.ready);
  expect(await page.evaluate(() => window.windows)).toBe(true);
  expect(await page.evaluate(() => window.keys)).toBe('Alt+Strg+S');
  await expect(
    page.getByRole('switch', { name: 'Luna automatisch übernehmen lassen' }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.asked || window.scheduled || false)).toBe(false);
  expect(await page.evaluate(() => window.notice)).toContain('unter Windows noch nicht verfügbar');
  expect(
    await page.evaluate(() =>
      ['t', 'w', 'l', 'f'].map((key) => keyCommand({ key, ctrlKey: true })),
    ),
  ).toEqual(['new-tab', 'close-tab', 'focus-url', 'find']);
  expect(
    await page.evaluate(() =>
      keyCommand({ key: 'l', ctrlKey: true, getModifierState: () => true }),
    ),
  ).toBe(null);
  await page.close();
});
