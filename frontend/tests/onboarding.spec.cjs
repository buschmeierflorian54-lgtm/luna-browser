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
 export const screenshot=async id=>{window.calls.push(["screenshot",id]);return ""};
 export const gestureWriteSound=async on=>{window.calls.push(["write",on])};
 export const playClick=async()=>{window.calls.push(["click"])};
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
  if (!initial.liveAnimation)
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
  await expect(page.locator('.setup-gesture-stage')).toBeVisible();
  await expect(page.locator('#setupKey')).toHaveCount(0);
  await expect(page.getByText('OpenRouter kannst du später', { exact: false })).toHaveCount(1);
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
  await expect(
    page.getByRole('button', { name: /Konto erneut verbinden|Spotify-Konto verknüpfen|Weiter →/ }),
  ).toHaveCount(0);
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
  await expect(page.locator('.setup-gesture-stage')).toBeVisible();
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

test('practice text stays 2s, a mouse clicks and draws the S with sounds, then the invitation returns', async ({
  page,
}) => {
  await setup(page, { prefs: { googleSearch: true }, resume: 2, liveAnimation: true });
  const prompt = page.locator('.setup-practice-prompt');
  const stage = page.locator('.setup-gesture-stage');
  const soundCalls = () =>
    page.evaluate(() => window.calls.filter((c) => /write|click/.test(c[0])));
  // 1) „Probier es selber“ steht zuerst, die Demo ist noch nicht zu sehen
  await expect(prompt).toBeVisible();
  await expect(prompt.locator('svg')).toHaveAttribute('aria-label', 'Probier es selber');
  await expect(page.locator('.setup-gesture-demo')).toBeHidden();
  expect(await soundCalls()).toEqual([]);
  // 2) Nach etwa 2 Sekunden zeigt die Demo die Maus
  await expect(stage).toHaveClass(/demo-run/, { timeout: 4000 });
  await expect(prompt).toBeHidden();
  await expect(page.locator('.setup-mouse')).toBeVisible();
  await expect(page.locator('.setup-mouse')).toHaveClass(/pressed/, { timeout: 3000 });
  expect((await soundCalls())[0]).toEqual(['click']);
  await expect.poll(soundCalls, { timeout: 3000 }).toEqual([['click'], ['write', true]]);
  await expect(page.locator('.setup-gesture-line')).not.toHaveCSS('stroke-dashoffset', '1px');
  // 3) Nach dem S endet der Schreibton, die Einladung kehrt zurück
  await expect(prompt).toBeVisible({ timeout: 8000 });
  expect(await soundCalls()).toEqual([['click'], ['write', true], ['write', false]]);
  const area = await stage.boundingBox();
  await page.mouse.move(area.x + 30, area.y + 30);
  await page.mouse.down();
  await expect(prompt).toBeHidden();
  await page.mouse.move(area.x + 80, area.y + 60);
  await page.mouse.up();
});

test('drawing during the demo stops it and silences the write sound', async ({ page }) => {
  await setup(page, { prefs: { googleSearch: true }, resume: 2, liveAnimation: true });
  await expect(page.locator('.setup-gesture-stage')).toHaveClass(/demo-run/, { timeout: 4000 });
  await expect(page.locator('.setup-mouse')).toHaveClass(/pressed/, { timeout: 3000 });
  const area = await page.locator('.setup-gesture-stage').boundingBox();
  await page.mouse.move(area.x + 30, area.y + 30);
  await page.mouse.down();
  await expect(page.locator('.setup-gesture-stage')).not.toHaveClass(/demo-run/);
  await page.mouse.up();
  await page.waitForTimeout(500);
  const calls = await page.evaluate(() => window.calls.filter((c) => c[0] === 'write'));
  expect(calls.at(-1)).toEqual(['write', false]);
});

test('drawing S on the onboarding page invokes screenshot without touching saved gestures', async ({
  page,
}) => {
  await setup(page, { prefs: { googleSearch: true }, resume: 2, liveAnimation: true });
  // Während die Demo sichtbar ist, liefert die Vorlage echte Bildschirmkoordinaten.
  await expect(page.locator('.setup-gesture-stage')).toHaveClass(/demo-run/, { timeout: 4000 });
  const points = await page.locator('.setup-gesture-line').evaluate((path) => {
    const matrix = path.getScreenCTM();
    return Array.from({ length: 90 }, (_, i) => {
      const p = path.getPointAtLength((path.getTotalLength() * i) / 89).matrixTransform(matrix);
      return { x: p.x, y: p.y };
    });
  });
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  for (const p of points.slice(1)) await page.mouse.move(p.x, p.y);
  await page.mouse.up();
  await expect(page.getByRole('status')).toContainText('Geschafft!');
  expect(await page.evaluate(() => window.calls.filter((c) => c[0] === 'screenshot'))).toEqual([
    ['screenshot', -1],
  ]);
});
