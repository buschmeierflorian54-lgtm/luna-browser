const { test } = require('@playwright/test');
const path = require('node:path');
const fs = require('fs');
test('global-notifications', async ({ browser }) => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  const src = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
  const names = [...src.matchAll(/export const (\w+)/g)].map((x) => x[1]);
  const mocks = {
    prefs: 'async()=>({restoreSession:true,...window.preferences})',
    setPref: 'async(k,v)=>window.preferences={...window.preferences,[k]:v}',
    spotifyNextStatus: 'async()=>window.pendingNext||{}',
    spotifyScheduleNext: 'async(uri,title)=>window.pendingNext={uri,title,status:"waiting"}',
    spotifyCancelNext: 'async()=>window.pendingNext={}',
    onSpotifyNext: 'cb=>window.nextEvent=cb',
    spotifySearch:
      'async(q)=>({tracks:{items:[{name:q,uri:"spotify:track:1234567890123456789012",artists:[{name:"Artist"}],album:{images:[],name:"Album"}}]},artists:{items:[]},albums:{items:[]}})',
    spotifyGetQueue:
      'async()=>({queue:[{name:"Next Song",uri:"spotify:track:1234567890123456789012",album:{images:[]}}]})',
    spotifyQueue:
      'async(uri)=>{if(window.queueFail)throw Error("Both queues failed");window.queued=uri}',
    spotifyPlay: 'async(uri)=>window.played=uri',
    IS_NATIVE: 'false',
    keyStatus: 'async()=>false',
    bookmarks: 'async()=>[]',
    downloads: 'async()=>[]',
    notes: 'async()=>[]',
    history: 'async()=>[]',
    spotifyState:
      "async()=>({status:'paused',title:'Current Song',artist:'Artist',duration:180,position:60,volume:50})",
    spotifyAPIStatus: 'async()=>({})',
    sonosStatus: 'async()=>({enabled:false,devices:[],selected:[]})',
    sessionLoad: 'async()=>localStorage.getItem("test-session")',
    sessionSave: 'async(s)=>localStorage.setItem("test-session",s)',
    mcpStatus: 'async()=>window.serverState',
    mcpConfigure: 'async(on)=>window.serverState={...window.serverState,enabled:on,running:on}',
    mcpCopySetup: 'async()=>window.copied=true',
    onMCP: 'cb=>window.mcpCommand=cb',
    mcpCommandActive: 'async()=>true',
    mcpReply: 'async(id,value,error)=>window.replies.get(id)({value,error})',
  };
  await p.addInitScript(() => {
    window.serverState = {
      enabled: false,
      running: false,
      command: '/Applications/Luna.app/Contents/MacOS/browser-mac',
      endpoint: 'http://127.0.0.1:17845/mcp',
    };
    window.replies = new Map();
    window.seq = 0;
    window.callMCP = (name, args = {}) =>
      new Promise((resolve) => {
        const id = String(++window.seq);
        window.replies.set(id, resolve);
        window.mcpCommand({ id, name, args });
      });
  });
  await p.route('**/src/api.js*', (r) =>
    r.fulfill({
      contentType: 'text/javascript',
      body: names.map((x) => `export const ${x}=${mocks[x] || 'async()=>null'};`).join('\n'),
    }),
  );
  await p.goto('http://127.0.0.1:5174');
  await p.locator('#splash.gone').waitFor({ state: 'attached' });
  const call = async (name, args = {}) => {
    const r = await p.evaluate(([n, a]) => window.callMCP(n, a), [name, args]);
    if (r.error) throw Error(name + ': ' + r.error);
    return r.value;
  };

  await call('browser_customize', { panel_action: 'open', id: 'spotify' });
  await p.locator('#lunaMusicPanel').waitFor();
  await p.getByRole('textbox', { name: 'Spotify durchsuchen' }).fill('Hello');
  await p.getByRole('button', { name: 'Abspielen: Hello', exact: true }).waitFor();
  await p.getByRole('button', { name: 'Zur Warteschlange: Hello', exact: true }).click();
  if (!(await p.evaluate(() => window.queued))) throw Error('add');
  await p.evaluate(() => (window.queueFail = true));
  await p.getByRole('button', { name: 'Zur Warteschlange: Hello', exact: true }).click();
  await p.getByRole('dialog').waitFor();
  await p.getByRole('checkbox', { name: 'Luna soll das immer machen' }).check();
  await p.getByRole('button', { name: 'Ja, Luna übernimmt' }).click();
  await p.locator('.music-next-pending:not([hidden])').waitFor();
  if ((await p.evaluate(() => window.pendingNext.uri)) !== 'spotify:track:1234567890123456789012')
    throw Error('wrong scheduled URI');
  await p.getByRole('button', { name: 'Vorgemerkten Song abbrechen' }).click();
  await p.evaluate(() => (window.queueFail = false));
  await p.getByRole('button', { name: 'Abspielen: Hello', exact: true }).click();
  if (!(await p.evaluate(() => window.played))) throw Error('play');
  await p.getByRole('tab', { name: 'Warteschlange', exact: true }).click();
  await p.getByText('Next Song', { exact: true }).waitFor();
  await p.waitForTimeout(300);
  await p.getByRole('tab', { name: 'Suche', exact: true }).click();
  if ((await p.getByRole('textbox', { name: 'Spotify durchsuchen' }).inputValue()) !== 'Hello')
    throw Error('lost query');
  if (await p.locator('#lunaMusicPanel').evaluate((e) => e.scrollWidth > e.clientWidth + 1))
    throw Error('overflow');
  await p.getByRole('button', { name: 'Spotify-Einstellungen', exact: true }).click();
  const toggle = p.getByRole('switch', { name: 'Luna automatisch übernehmen lassen', exact: true });
  await toggle.waitFor();
  if ((await toggle.getAttribute('aria-checked')) !== 'true')
    throw Error('setting did not reflect checkbox');
  await toggle.click();
  await p.waitForFunction(() => window.preferences.spotifyAutoNextAlways === false);
  if ((await toggle.getAttribute('aria-checked')) !== 'false')
    throw Error('setting did not disable');
  await p.locator('#url').fill('einstellungen');
  await p.locator('[data-notice="settings"]').waitFor();
  await p.waitForTimeout(450);
  await p.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await p.locator('[data-notice="settings"]').waitFor({ state: 'detached' });
  await p.locator('#url').fill('');
  await p.locator('#url').fill('einstellungen');
  await p.locator('[data-notice="settings"]').waitFor();
  await p.getByRole('button', { name: 'Einstellungen öffnen', exact: true }).click();
  await p.locator('#settingsView').waitFor();
  // Chapter isolation and tab grouping remain intact after the module split.
  await p.locator('[data-act="set-nav"][data-s="data"]').click();
  if (
    (await p.locator('#settingsView section').count()) !== 1 ||
    !(await p.locator('#set-data').isVisible())
  )
    throw Error('settings chapters are not isolated');
  const state = await call('browser_state');
  const group = await call('browser_tab_group', {
    action: 'create',
    tab_id: state.active_tab,
    title: 'Testgruppe',
  });
  if (!(await call('browser_state')).tabs.some((t) => t.group)) throw Error('tab grouping failed');
  if (errors.length) throw Error(errors.join('\n'));
  console.log(
    'PASS: music sidebar search, play, add, queue tab, query persistence, no overflow or JS errors.',
  );
});
