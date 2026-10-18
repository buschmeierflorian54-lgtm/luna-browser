const { test } = require('@playwright/test');
const path = require('node:path');
const fs = require('fs');
const assert = require('assert');
test('notification-service', async ({ browser }) => {
  const p = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  const root = path.join(__dirname, '../src/');
  await p.route('http://luna.test/**', (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path === '/notifications.js' || path === '/style.css' || path.startsWith('/styles/'))
      return r.fulfill({
        contentType: path.endsWith('css') ? 'text/css' : 'text/javascript',
        body: fs.readFileSync(root + path.slice(1), 'utf8'),
      });
    return r.fulfill({
      contentType: 'text/html',
      body: '<link rel="stylesheet" href="/style.css"><input id="focus"><script type="module">import {createBrowserNotifications} from "/notifications.js";window.covers=0;window.results=[];window.n=createBrowserNotifications({cover:async on=>window.covers+=on?1:-1});</script>',
    });
  });
  await p.goto('http://luna.test');
  await p.waitForFunction(() => window.n);
  await p.locator('#focus').focus();
  await p.evaluate(() => {
    n.ask({
      kind: 'settings',
      title: 'First',
      message: '<img src=x onerror=alert(1)>',
      alternativeLabel: 'Web suchen',
    }).then((r) => results.push(r));
    n.ask({
      kind: 'history',
      title: 'Second',
      message: 'Delete?',
      onConfirm: () => {
        window.deleted = true;
      },
    }).then((r) => results.push(r));
    n.toast('Gespeichert', 10000);
  });
  await p.getByRole('heading', { name: 'First', exact: true }).waitFor();
  assert.equal(await p.locator('dialog[open]').count(), 1);
  assert.equal(await p.locator('dialog img').count(), 0);
  assert.equal(await p.locator('#toast').isVisible(), false);
  await p.getByRole('button', { name: 'Web suchen', exact: true }).click();
  await p.getByRole('heading', { name: 'Second', exact: true }).waitFor();
  assert.equal(await p.evaluate(() => window.deleted), undefined);
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => results.length === 2);
  assert.deepEqual(await p.evaluate(() => results), ['alternative', 'cancel']);
  assert.equal(await p.evaluate(() => window.deleted), undefined);
  assert.equal(await p.evaluate(() => covers), 0);
  await p.locator('#toast').waitFor();
  await p.getByRole('button', { name: 'Meldung schließen' }).click();
  await p.locator('#toast').waitFor({ state: 'hidden' });
  await p.evaluate(() => {
    window.fail = true;
    n.ask({
      title: 'Async',
      message: 'Try',
      onConfirm: async () => {
        if (window.fail) throw Error('Failed');
        window.deleted = true;
      },
    });
  });
  await p.getByRole('button', { name: 'Weiter', exact: true }).click();
  await p.getByRole('alert').waitFor();
  assert.equal(await p.evaluate(() => window.deleted), undefined);
  await p.evaluate(() => (window.fail = false));
  await p.getByRole('button', { name: 'Weiter', exact: true }).click();
  await p.waitForFunction(() => covers === 0);
  assert.equal(await p.evaluate(() => window.deleted), true);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: queued confirmations, explicit consent, alternative action, Escape, async errors/retry, text escaping, native cover balance, deferred/dismissible toast.',
  );
});
