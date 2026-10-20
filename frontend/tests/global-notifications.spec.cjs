const { test } = require('@playwright/test');
const path = require('node:path');
const fs = require('fs');
test('global-notifications', async ({ browser }) => {
  // This flow specifically exercises the macOS-only local Spotify fallback.
  // Windows capability boundaries are covered separately in platform.spec.cjs.
  const p = await browser.newPage({
    viewport: { width: 1280, height: 950 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36',
  });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  const src = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8');
  const names = [...src.matchAll(/export const (\w+)/g)].map((x) => x[1]);
  const mocks = {
    resetBrowserSettings: 'async()=>{sessionStorage.setItem("reset-called","yes")}',
    updateStatus:
      'async()=>({version:"1.1.1",ready:true,canCheck:true,automatic:window.autoUpdates!==false,message:window.updateChecked?"Du verwendest die neueste Version.":"Bereit",lastCheck:0})',
    checkUpdates: 'async()=>{window.updateChecked=true}',
    setAutomaticUpdates: 'async(on)=>{window.autoUpdates=on}',

    gestureBindings: 'async()=>window.gestures||{O:{action:"notes"},S:{action:"screenshot"}}',
    setGestureBinding:
      'async(letter,action,value)=>window.gestures={...(window.gestures||{O:{action:"notes"},S:{action:"screenshot"}}),[letter]:{action,value}}',
    resetGestureBindings: 'async()=>window.gestures={O:{action:"notes"},S:{action:"screenshot"}}',

    prefs: 'async()=>({restoreSession:true,...window.preferences})',
    setPref: 'async(k,v)=>window.preferences={...window.preferences,[k]:v}',
    spotifyNextStatus: 'async()=>window.pendingNext||{}',
    spotifyScheduleNext: 'async(uri,title)=>window.pendingNext={uri,title,status:"waiting"}',
    spotifyCancelNext: 'async()=>window.pendingNext={}',
    onSpotifyNext: 'cb=>window.nextEvent=cb',
    spotifySearch:
      'async(q)=>(window.lastSpotifyQuery=q,{tracks:{items:[{name:q,uri:"spotify:track:1234567890123456789012",artists:[{name:"Artist"}],album:{images:[],name:"Album"}}]},artists:{items:[]},albums:{items:[]}})',
    spotifyGetQueue:
      'async()=>({queue:[{name:"Next Song",uri:"spotify:track:1234567890123456789012",album:{images:[]}}]})',
    spotifyQueue:
      'async(uri)=>{if(window.queueFail)throw Error("Both queues failed");window.queued=uri}',
    spotifyPlay: 'async(uri)=>window.played=uri',
    IS_NATIVE: 'false',
    keyStatus: 'async()=>true',
    search:
      'async()=>({results:[{title:"Luna Browser",url:"https://example.com",host:"example.com",path:"/",desc:"Ein Suchergebnis zum Prüfen der Lesbarkeit auf dem animierten Hintergrund."}],news:[],videos:[]})',

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
  await p.getByRole('button', { name: 'Luna Music öffnen', exact: true }).click();
  await p.getByRole('heading', { name: 'Was möchtest du hören?' }).waitFor();
  const welcomeLayout = await p.locator('.music-welcome').evaluate((el) => ({
    background: getComputedStyle(el).backgroundColor,
    height: el.getBoundingClientRect().height,
    viewport: document.querySelector('#searchView').clientHeight,
  }));
  if (welcomeLayout.background !== 'rgba(0, 0, 0, 0)')
    throw Error('music welcome covers the shared wave background');
  if (welcomeLayout.height < welcomeLayout.viewport)
    throw Error('music welcome does not fill the search viewport');
  await p.screenshot({ path: test.info().outputPath('music-welcome.png') });
  const address = p.locator('#url');
  if (!(await address.evaluate((el) => el === document.activeElement)))
    throw Error('music entry lost focus');
  await address.fill('First');
  await p.waitForTimeout(550);
  if ((await p.locator('#searchView .music-head h1').textContent()) !== 'Was möchtest du hören?')
    throw Error('search started too early');
  await address.fill('Second');
  await p.waitForTimeout(550);
  if ((await p.locator('#searchView .music-head h1').textContent()) !== 'Was möchtest du hören?')
    throw Error('debounce did not reset');
  await p.locator('#searchView .music-head h1').filter({ hasText: 'Second' }).waitFor();
  if (!(await address.evaluate((el) => el === document.activeElement)))
    throw Error('live search lost focus');
  await address.fill('Cancelled');
  await call('browser_tab', { action: 'open', url: 'about:blank' });
  await p.waitForTimeout(1150);
  const afterSwitch = await call('browser_state');
  if (afterSwitch.tabs.find((t) => t.id === afterSwitch.active_tab).url !== 'about:blank')
    throw Error('pending search changed another tab');
  await address.focus();
  await address.fill('spotify');
  await p.getByRole('heading', { name: 'Was möchtest du hören?' }).waitFor();
  if ((await address.inputValue()) !== '') throw Error('Spotify command not consumed');
  await address.fill('Hello again');
  await p.locator('#searchView .music-head h1').filter({ hasText: 'Hello again' }).waitFor();

  await p.screenshot({ path: test.info().outputPath('spotify-results.png') });
  await call('browser_tab', { action: 'open', url: 'search:Luna' });
  await p.locator('#searchView .sr').waitFor();
  await p.screenshot({ animations: 'disabled', path: test.info().outputPath('luna-results.png') });
  await call('browser_gestures', { action: 'set', letter: 'V', binding: 'music' });
  await call('browser_settings', { section: 'gestures' });
  const gesture = p.locator('[data-gesture-letter="V"]');
  if ((await gesture.locator('select').inputValue()) !== 'music')
    throw Error('MCP gesture not in settings');
  await gesture.locator('select').selectOption('bookmarks');
  await gesture.getByRole('button', { name: 'Speichern' }).click();
  await p.waitForFunction(() => window.gestures.V.action === 'bookmarks');
  if ((await call('browser_gestures', { action: 'list' })).bindings.V.action !== 'bookmarks')
    throw Error('settings gesture not visible to MCP');
  await p.evaluate(() => {
    window.played = '';
    window.lastSpotifyQuery = '';
  });
  await address.fill('play Nobody’s Home Avril Lavigne');
  await p.waitForTimeout(1100);
  if (await p.evaluate(() => window.played || window.lastSpotifyQuery))
    throw Error('play ran before Enter');
  await address.press('Enter');
  await p.waitForFunction(() => window.played === 'spotify:track:1234567890123456789012');
  if ((await p.evaluate(() => window.lastSpotifyQuery)) !== 'Nobody’s Home Avril Lavigne')
    throw Error('play query was not stripped');
  // Explicit tab commands also override the play chip mode.
  const beforeTabs = (await call('browser_state', {})).tabs.length;
  await address.fill('tab open youtube.com');
  await address.press('Enter');
  await p.waitForFunction(() => document.querySelector('#url').value.includes('youtube.com'));
  const openedState = await call('browser_state', {});
  if (
    openedState.tabs.length !== beforeTabs + 1 ||
    !openedState.tabs.some((t) => t.url === 'https://youtube.com')
  )
    throw Error('tab open failed');
  await address.fill('tab close');
  await address.press('Enter');
  await p.waitForTimeout(500);
  if ((await call('browser_state', {})).tabs.length !== beforeTabs) throw Error('tab close failed');
  for (const target of [
    'https://example.com/one',
    'https://www.example.com/two',
    'https://m.example.com/three',
    'https://notexample.com',
    'https://example.com.other.test',
  ]) {
    await call('browser_tab', { action: 'open', url: target });
  }
  await address.fill('tab close example.com');
  await address.press('Enter');
  await p.waitForTimeout(1000);
  const remaining = (await call('browser_state', {})).tabs;
  if (remaining.some((t) => /^https:\/\/(?:www\.|m\.)?example\.com(?:\/|$)/.test(t.url)))
    throw Error('domain tabs remain');
  if (
    !remaining.some((t) => t.url === 'https://notexample.com') ||
    !remaining.some((t) => t.url === 'https://example.com.other.test')
  )
    throw Error('unrelated domain closed');
  await call('browser_settings', { section: 'updates' });
  await p.getByRole('button', { name: 'Nach Updates suchen', exact: true }).click();
  await p.getByText('Du verwendest die neueste Version.', { exact: true }).waitFor();
  await p.getByRole('switch', { name: 'Automatische Updates', exact: true }).click();
  await p.waitForFunction(() => window.autoUpdates === false);
  if (await p.locator('#set-look').count()) throw Error('updates chapter not isolated');
  await call('browser_settings', { section: 'search' });
  await p.getByRole('button', { name: 'Google', exact: true }).click();
  await address.fill('test search with spaces & umlaut ä');
  await address.press('Enter');
  await p.waitForFunction(() =>
    document.querySelector('#url').value.startsWith('https://www.google.com/search?q='),
  );
  if (
    !decodeURIComponent(await address.inputValue()).includes('test search with spaces & umlaut ä')
  )
    throw Error('Google query lost');
  await call('browser_settings', { section: 'search' });
  await p.getByRole('button', { name: 'Luna Search', exact: true }).click();
  if (await p.evaluate(() => window.preferences.googleSearch))
    throw Error('search provider not saved');
  await call('browser_settings', { section: 'data' });
  await p.evaluate(() => {
    localStorage.setItem('luna-color-theme', 'ocean');
    localStorage.setItem('luna-chat-active', 'keep-chat');
  });
  await p.locator('[data-act="reset-browser"]').click();
  await p.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  if (await p.evaluate(() => sessionStorage.getItem('reset-called')))
    throw Error('reset ran on cancel');
  await p.locator('[data-act="reset-browser"]').click();
  await Promise.all([
    p.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    p.getByRole('button', { name: 'Jetzt zurücksetzen', exact: true }).click(),
  ]);
  await p.waitForFunction(
    () =>
      sessionStorage.getItem('reset-called') === 'yes' && !localStorage.getItem('luna-color-theme'),
  );
  if ((await p.evaluate(() => localStorage.getItem('luna-chat-active'))) !== 'keep-chat')
    throw Error('chat selection erased');
  if (errors.length) throw Error(errors.join('\n'));
  console.log(
    'PASS: music sidebar search, play, add, queue tab, query persistence, no overflow or JS errors.',
  );
});
