const { test, expect } = require('@playwright/test');
const harness = `<!doctype html><html data-theme="dark"><head><link rel="stylesheet" href="/src/styles/foundation.css"></head><body><main id="existing"><button>Existing browser</button></main><script type="module">import {createOnboarding} from '/src/onboarding.js';window.wizard=createOnboarding({onFinish(){window.finished=true},async refreshSearch(){window.refreshed=true}});await window.wizard.start();</script></body></html>`;
async function setup(page, initial = {}) {
  await page.addInitScript((initial) => {
    window.preferences = initial.prefs || {};
    window.clip = { count: 4, eligible: false, host: 'api-dashboard.search.brave.com' };
    window.calls = [];
    window.savedKeys = {};
    window.spotify = {};
    window.providerStatus = {};
    if (initial.resume !== undefined)
      localStorage.setItem('luna-onboarding-step', String(initial.resume));
  }, initial);
  await page.route('**/src/api.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `
 export const prefs=async()=>window.preferences;
 export const setPref=async(k,v)=>{window.preferences[k]=v;return window.preferences};
 export const keyStatus=async()=>!!window.savedKeys.brave;
 export const spotifyAPIStatus=async()=>window.spotify;
 export const chatStatus=async()=>({providers:window.providerStatus});
 export const onboardingClipboard=async()=>window.clip;
 export const load=async(id,url)=>window.calls.push(['load',id,url]);
 export const show=async(id)=>window.calls.push(['show',id]);
 export const close=async(id)=>window.calls.push(['close',id]);
 export const setFrame=async(...args)=>window.calls.push(['frame',...args]);
 export const focusUI=async()=>{};export const back=async()=>{};export const reload=async()=>{};
 export const keySet=async key=>{if(window.saveFails)throw Error('Speichern fehlgeschlagen');window.savedKeys.brave=key};
 export const spotifyAPIConfigure=async key=>{window.savedKeys.spotify=key;window.spotify.configured=true};
 export const chatProviderKey=async(p,key)=>{window.savedKeys[p]=key};
 export const onboardingSpotifyConnect=async id=>{window.calls.push(['connect',id])};
 `,
    }),
  );
  await page.route('**/__setup_test', (r) =>
    r.fulfill({ contentType: 'text/html', body: harness }),
  );
  await page.goto('http://127.0.0.1:5174/__setup_test');
  await expect(page.locator('.setup')).toBeVisible();
  await page.screenshot({ path: '/tmp/luna-setup-welcome.png', animations: 'disabled' });
}
test('Brave clipboard metadata, Enter, recovery split and preserved provider', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Luna kennenlernen' }).click();
  await expect(page.getByText('Ohne Brave-API-Key', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Luna Search öffnen' }).click();
  await expect(page.locator('.setup.portal')).toBeVisible();
  // Copying on a login page or another application does not hide it.
  await page.evaluate(() => {
    window.clip = { count: 5, eligible: false };
  });
  await page.waitForTimeout(650);
  await expect(page.locator('.setup.portal')).toBeVisible();
  await page.evaluate(() => {
    window.clip = { count: 6, eligible: true, text: 'BSA-auto-first' };
  });
  await expect(page.locator('.setup.form')).toBeVisible();
  await expect(page.locator('#setupKey')).toHaveValue('BSA-auto-first');
  expect(await page.evaluate(() => window.savedKeys.brave)).toBeUndefined();
  await expect(page.getByRole('button', { name: 'Hey, ich war noch nicht fertig' })).toBeVisible();
  await page.getByRole('button', { name: 'Hey, ich war noch nicht fertig' }).click();
  await expect(page.locator('.setup.split')).toBeVisible();
  await expect(page.getByText('Ich war zu aufgeregt.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => window.calls.filter((c) => c[0] === 'load').length)).toBe(1);
  await page.evaluate(() => {
    window.clip = { count: 7, eligible: true, text: 'BSA-auto-split' };
  });
  await page.waitForTimeout(650);
  await expect(page.locator('.setup.split')).toBeVisible();
  await expect(page.locator('#setupKey')).toHaveValue('BSA-auto-split');
  await expect(
    page.getByRole('button', { name: 'Anbieterseite wieder anzeigen', exact: true }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => window.savedKeys.brave)).toBeUndefined();
  await page.locator('#setupKey').fill('BSA-test-only');
  await page.getByRole('button', { name: 'Fertig', exact: true }).click();
  expect(await page.evaluate(() => window.savedKeys.brave)).toBe('BSA-test-only');
  expect(await page.evaluate(() => localStorage.getItem('luna-onboarding-step'))).toBe('1');
  expect(await page.locator('body').innerText()).not.toContain('BSA-test-only');
  await expect(page.getByRole('heading', { name: 'Deine Musik zieht mit ein.' })).toBeVisible();
});
test('Google without keys, optional providers, completion and resume', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Luna kennenlernen' }).click();
  await page.getByRole('button', { name: 'Google · ohne Key' }).click();
  await expect(page.locator('#setupKey')).toHaveCount(0);
  await page.getByRole('button', { name: 'Mit Google weiter' }).click();
  await page.getByRole('button', { name: 'Überspringen' }).click();
  await expect(
    page.getByRole('heading', { name: 'Zeichne ein S. Halte den Moment fest.' }),
  ).toBeVisible();
  await expect(page.locator('#setupKey')).toHaveCount(0);
  await expect(page.getByText('OpenRouter kannst du später', { exact: false })).toBeVisible();
  await page.screenshot({ path: '/tmp/luna-setup-gesture.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Weiter →', exact: true }).click();
  await page.getByRole('button', { name: 'Überspringen' }).click();
  await expect(page.getByText('Google ist deine Standardsuche.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Los geht’s' }).click();
  await expect(page.locator('.setup')).toHaveCount(0);
  expect(await page.evaluate(() => window.preferences)).toEqual({
    googleSearch: true,
    onboardingComplete: true,
  });
  expect(await page.locator('#existing').evaluate((e) => e.inert)).toBe(false);
  expect(await page.evaluate(() => window.calls.some((c) => c[0] === 'load'))).toBe(false);
});
test('save errors retain input; later resumes without completion', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Luna kennenlernen' }).click();
  await page.locator('#setupKey').fill('bad-test-key');
  await page.evaluate(() => (window.saveFails = true));
  await page.locator('#setupKey').press('Enter');
  await expect(page.getByRole('status')).toContainText('Speichern fehlgeschlagen');
  await expect(page.locator('#setupKey')).toHaveValue('bad-test-key');
  await page.getByRole('button', { name: 'Später fortsetzen' }).click();
  expect(await page.evaluate(() => window.preferences.onboardingComplete)).toBeUndefined();
  await page.evaluate(() => window.wizard.start());
  await expect(page.locator('#setupKey')).toHaveValue('');
});
test('Spotify login remains inside Luna and detects account connection', async ({ page }) => {
  await setup(page, { prefs: { googleSearch: true }, resume: 1 });
  await expect(
    page.getByText('Die Spotify API ist die offizielle Schnittstelle', { exact: false }),
  ).toBeVisible();
  await expect(page.locator('.setup-spotify-guide li')).toHaveCount(5);
  await page.locator('#setupKey').fill('client-id-test');
  await page.locator('#setupKey').press('Enter');
  await expect(page.locator('#setupKey')).toHaveValue('');
  await expect(page.getByRole('button', {name: /Konto erneut verbinden|Spotify-Konto verknüpfen|Weiter →/})).toHaveCount(0);
  await expect(page.locator('.setup.split')).toBeVisible();
  await page.screenshot({ path: '/tmp/luna-setup-split.png', animations: 'disabled' });
  expect(await page.evaluate(() => window.calls.some((c) => c[0] === 'connect'))).toBe(true);
  await page.evaluate(() => {
    window.spotify = {
      configured: true,
      connected: true,
      pending: false,
      message: 'Anmeldung abgebrochen.',
    };
  });
  await page.waitForTimeout(550);
  await expect(page.locator('.setup.split')).toBeVisible();
  await page.evaluate(() => {
    window.spotify.connected = true;
    window.spotify.pending = false;
    window.spotify.message = 'Spotify ist verknüpft.';
  });
  await expect(
    page.getByRole('heading', { name: 'Zeichne ein S. Halte den Moment fest.' }),
  ).toBeVisible();
  await expect(page.locator('.setup.form')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('luna-onboarding-step'))).toBe('2');
});

for (const [provider, step] of [['groq', 3]])
  test(`${provider} optional key setup`, async ({ page }) => {
    await setup(page, { prefs: { googleSearch: true }, resume: step });
    await page.getByRole('button', { name: /öffnen & Key holen/ }).click();
    await page.evaluate(
      () => (window.clip = { count: 8, eligible: true, text: 'test-provider-key' }),
    );
    await expect(page.locator('.setup.form')).toBeVisible();
    await page.locator('#setupKey').fill('test-provider-key');
    await page.locator('#setupKey').press('Enter');
    await expect(page.getByRole('heading', { name: 'Deine Luna ist bereit.' })).toBeVisible();
    expect(await page.evaluate((p) => window.savedKeys[p], provider)).toBe('test-provider-key');
  });
