const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
test('chat opens without Enter, streams safely, preserves history and stops responses', async ({
  page,
}) => {
  test.setTimeout(45000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
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
    spotifyPlay: 'async(uri)=>{window.playedSong=uri}',
    chatStatus: 'async()=>structuredClone(window.modelConfig)',
    chatProviderKey:
      'async(p,key)=>{modelConfig.providers[p]=true;saveModelConfig();return structuredClone(modelConfig)}',
    chatRemoveProviderKey:
      'async(p)=>{modelConfig.providers[p]=false;saveModelConfig();return structuredClone(modelConfig)}',
    chatModels:
      'async(p)=>{window.catalogCalls++;if(!modelConfig.providers[p])throw Error("key missing");return modelCatalog[p]}',
    chatSaveModel:
      'async(slot,p,id)=>{modelConfig.favorites[slot]=modelCatalog[p].find(m=>m.id===id);modelConfig.configured=true;modelConfig.model=modelConfig.favorites[modelConfig.selected].id;saveModelConfig();return structuredClone(modelConfig)}',
    chatSelectModel:
      'async(slot)=>{modelConfig.selected=slot;modelConfig.model=(slot===2?modelConfig.local_model:modelConfig.favorites[slot]).id;saveModelConfig();return structuredClone(modelConfig)}',
    chatList: 'async()=>Object.values(window.testChats).map(({messages,...rest})=>rest)',
    chatGet: 'async(id)=>structuredClone(window.testChats[id])',
    chatCreate:
      'async()=>{const c={id:crypto.randomUUID(),title:"Neuer Chat",messages:[],revision:0,status:"idle",updated:Date.now()};window.testChats[c.id]=c;window.saveChats();return structuredClone(c)}',
    chatSend: 'async(id,text)=>window.sendMock(id,text)',
    chatCancel:
      'async(id)=>{const c=window.testChats[id];c.status="stopped";c.revision++;window.saveChats();window.chatEvent(structuredClone(c))}',
    chatDelete: 'async(id)=>{delete window.testChats[id];window.saveChats()}',
    onChat: 'cb=>window.chatEvent=cb',
  };
  await page.addInitScript(() => {
    window.modelConfig = JSON.parse(
      localStorage.getItem('model-config') ||
        '{"configured":false,"providers":{},"favorites":[],"selected":0,"max_tokens":30000}',
    );
    window.modelConfig.local_model = {
      id: 'apple-local',
      name: 'Apple Intelligence',
      provider: 'apple',
      max_tokens: 1024,
    };
    window.modelConfig.apple = { available: true, reason: 'Bereit · läuft auf diesem Mac' };
    window.modelConfig.providers.apple = true;
    window.saveModelConfig = () =>
      localStorage.setItem('model-config', JSON.stringify(modelConfig));
    window.catalogCalls = 0;
    window.modelCatalog = {
      openrouter: [
        {
          id: 'anthropic/claude',
          name: 'Claude',
          creator: 'Anthropic',
          provider: 'openrouter',
          chat: true,
          tools: true,
          max_tokens: 30000,
        },
        {
          id: 'openai/test',
          name: 'GPT Test',
          creator: 'OpenAI',
          provider: 'openrouter',
          chat: true,
          tools: true,
          max_tokens: 30000,
        },
      ],
      groq: [
        {
          id: 'llama-test',
          name: 'Llama Test',
          creator: 'Meta',
          provider: 'groq',
          chat: true,
          tools: true,
          max_tokens: 8192,
        },
      ],
    };
    window.testChats = JSON.parse(localStorage.getItem('chat-tests') || '{}');
    window.saveChats = () => localStorage.setItem('chat-tests', JSON.stringify(testChats));
    window.sendMock = (id, text) => {
      const c = testChats[id];
      c.title = text.slice(0, 50);
      c.messages.push({ role: 'user', content: text }, { role: 'assistant', content: '' });
      c.status = 'streaming';
      c.revision++;
      c.updated = Date.now();
      saveChats();
      setTimeout(() => {
        if (c.status !== 'streaming') return;
        c.messages.at(-1).content =
          '**Hallo!**\n\n<script>window.bad=true</script>\n\n[Unsafe](javascript:alert(1))\n\n```js\nconst answer = 42;\n```';
        c.revision++;
        chatEvent(structuredClone(c));
        saveChats();
      }, 150);
      return structuredClone(c);
    };
  });
  await page.route('**/src/api.js*', (r) =>
    r.fulfill({
      contentType: 'text/javascript',
      body: names.map((n) => `export const ${n}=${mocks[n] || 'async()=>null'};`).join('\n'),
    }),
  );
  await page.goto('http://127.0.0.1:5174');
  await page.locator('#splash.gone').waitFor({ state: 'attached' });
  await page.locator('#url').fill('chat');
  await expect(page.locator('#chatView')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Was beschäftigt dich?' })).toBeVisible();
  await page.getByRole('button', { name: 'Modelle & Einstellungen ↗' }).click();
  await page.getByRole('textbox', { name: 'OpenRouter API-Schlüssel' }).fill('sk-or-test-only-key');
  expect(await page.evaluate(() => catalogCalls)).toBe(0);
  await page.getByRole('button', { name: 'Speichern & Modelle laden', exact: true }).click();
  await expect(page.locator('.chat-model-row')).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Nach Ersteller filtern' }).selectOption('Anthropic');
  await expect(page.locator('.chat-model-row')).toHaveCount(1);
  await page.locator('[data-model-add="anthropic/claude"][data-slot="0"]').click();
  await page.locator('[data-chat-provider="groq"]').click();
  await expect(page.locator('#chatModelResults')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Groq API-Schlüssel' }).fill('groq-fake-test-key');
  await page.getByRole('button', { name: 'Speichern & Modelle laden' }).click();
  await expect(page.locator('.chat-model-row')).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Modellname suchen' }).fill('absent');
  await expect(page.locator('.chat-model-row')).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Modellname suchen' }).fill('Llama');
  await page.locator('[data-model-add="llama-test"][data-slot="1"]').click();
  await page.locator('#settingsView').evaluate((el) => (el.scrollTop = 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: test.info().outputPath('models.png') });
  await expect(page.locator('#chatAPIKey')).toHaveValue('');
  await page.locator('#url').fill('chat');
  await page.locator('#chatModelPicker').click();
  await expect(page.getByRole('menu', { name: 'Chat-Modell wählen' })).toBeVisible();
  await page.waitForTimeout(200);
  await page.screenshot({ path: test.info().outputPath('model-picker.png') });
  await page.getByRole('menuitemradio', { name: /Apple Intelligence/ }).click();
  await expect(page.locator('#chatModelPicker')).toContainText('Apple Intelligence');
  await expect(page.locator('#chatNotice')).toContainText('lokal auf diesem Mac');
  expect(await page.evaluate(() => modelConfig.favorites.length)).toBe(2);
  await page.locator('#chatModelPicker').click();
  await page.getByRole('menuitemradio', { name: /Llama Test/ }).click();
  await expect(page.locator('#chatModelPicker')).toContainText('Llama Test');
  await expect(page.locator('#chatModelMenu')).toBeHidden();
  await page.locator('#chatModelPicker').press('ArrowDown');
  await expect(page.locator('#chatModelMenu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#chatModelPicker')).toBeFocused();
  await page.locator('#chatPrompt').fill('Meine erste Idee');
  await page.getByRole('button', { name: 'Nachricht senden' }).click();
  await expect(page.locator('.chat-message.assistant strong')).toHaveText('Hallo!');
  await expect(page.locator('.chat-message.assistant pre')).toContainText('const answer = 42;');
  expect(await page.evaluate(() => window.bad)).toBeUndefined();
  await expect(page.locator('.chat-message-text a[href^="javascript:"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Antwort stoppen' })).toBeVisible();
  const first = await page.evaluate(() => Object.keys(testChats)[0]);
  await page.getByRole('button', { name: 'Neues Gespräch', exact: true }).click();
  await page.locator('#chatPrompt').fill('Entwurf bleibt erhalten');
  await page.locator(`[data-chat="select"][data-id="${first}"]`).click();
  await expect(page.locator('#chatPrompt')).toHaveValue('');
  await page.getByRole('button', { name: 'Antwort stoppen' }).click();
  await expect(page.locator('#chatError')).toHaveText('Antwort gestoppt.');
  await page.getByRole('button', { name: 'Neues Gespräch', exact: true }).click();
  await expect(page.locator('#chatPrompt')).toHaveValue('Entwurf bleibt erhalten');
  await page.locator(`[data-chat="select"][data-id="${first}"]`).click();
  await page.getByRole('button', { name: 'Chatverlauf einklappen' }).click();
  await expect(page.locator('#chatHistory')).toBeHidden();
  await page.screenshot({ path: test.info().outputPath('chat.png') });
  await page.reload();
  await page.locator('#splash.gone').waitFor({ state: 'attached' });
  await page.locator('#url').fill('chat');
  await expect(page.locator('#chatHistory')).toBeHidden();
  await expect(page.locator('.chat-message.user')).toContainText('Meine erste Idee');
  await page.getByRole('button', { name: 'Chatverlauf ausklappen' }).click();
  await expect(page.locator('#chatHistory')).toBeVisible();
  await page.evaluate((id) => {
    const c = testChats[id];
    c.messages.at(-1).content = Array.from(
      { length: 120 },
      (_, i) => 'Absatz ' + i + ' mit Text.',
    ).join('\n\n');
    c.revision++;
    chatEvent(structuredClone(c));
  }, first);
  await page.locator('#chatScroll').evaluate((el) => (el.scrollTop = 0));
  await page.evaluate((id) => {
    const c = testChats[id];
    c.messages.at(-1).content += '\n\nEin weiterer Absatz.';
    c.revision++;
    chatEvent(structuredClone(c));
  }, first);
  expect(await page.locator('#chatScroll').evaluate((el) => el.scrollTop)).toBe(0);
  await page.setViewportSize({ width: 650, height: 820 });
  await page.getByRole('button', { name: 'Chatverlauf einklappen' }).click();
  expect(
    await page.locator('.chat-main').evaluate((el) => el.scrollWidth > el.clientWidth + 1),
  ).toBe(false);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate((id) => {
    const c = testChats[id];
    c.messages.push(
      { role: 'user', content: 'Spiel Lovely' },
      {
        role: 'assistant',
        content: 'Ich suche den Song.',
        tool_calls: [
          {
            id: 'song1',
            type: 'function',
            function: { name: 'browser_play_song', arguments: '{"song":"lovely"}' },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'song1',
        content: JSON.stringify({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                playback_requested: true,
                track: {
                  name: 'lovely',
                  uri: 'spotify:track:0123456789012345678901',
                  artists: [{ name: 'Billie Eilish & Khalid' }],
                  album: { name: 'lovely' },
                  duration_ms: 200000,
                },
              }),
            },
          ],
        }),
      },
      { role: 'assistant', content: 'Hier ist lovely von Billie Eilish und Khalid.' },
    );
    c.revision++;
    c.status = 'done';
    saveChats();
    chatEvent(structuredClone(c));
  }, first);
  await expect(page.locator('.chat-song')).toHaveCount(1);
  await expect(page.locator('.chat-message.assistant').last().locator('.chat-song')).toContainText(
    'Billie Eilish & Khalid',
  );
  await page.locator('.chat-song').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'lovely erneut abspielen' }).click();
  expect(await page.evaluate(() => playedSong)).toBe('spotify:track:0123456789012345678901');
  await page.screenshot({ path: test.info().outputPath('music-card.png') });
  await page.reload();
  await page.locator('#splash.gone').waitFor({ state: 'attached' });
  await page.locator('#url').fill('chat');
  await expect(page.locator('.chat-song')).toHaveCount(1);
  await page.evaluate((id) => {
    const c = testChats[id];
    c.messages.push(
      { role: 'user', content: 'Welche Farbe passt?' },
      {
        role: 'assistant',
        content: '',
        provider: 'apple',
        tool_calls: [
          {
            id: 'theme1',
            type: 'function',
            function: { name: 'browser_customize', arguments: '{"show_color_picker":true}' },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'theme1',
        content: JSON.stringify({
          content: [{ type: 'text', text: JSON.stringify({ show_color_picker: true }) }],
        }),
      },
      { role: 'assistant', content: 'Wähle deinen Look.' },
    );
    c.revision++;
    saveChats();
    chatEvent(structuredClone(c));
  }, first);
  const themes = page.locator('.chat-theme-card');
  await expect(themes.locator('[data-color]')).toHaveCount(10);
  await expect(themes).toContainText('Luna Rosé');
  await expect(themes).toContainText('Ozean');
  await themes.locator('[data-color="ocean"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-color-theme', 'ocean');
  expect(await page.evaluate(() => localStorage.getItem('luna-color-theme'))).toBe('ocean');
  await expect(themes.locator('[role="status"]')).toContainText('Ozean ausgewählt');
  await themes.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath('theme-card.png') });
  const matching = await page.evaluate(async () => {
    const { themeCardAnchors } = await import('/src/chat-themes.js');
    const count = (content) =>
      themeCardAnchors([
        { role: 'user', content: 'Farbe?' },
        { role: 'assistant', content },
      ]).size;
    return [
      count('Theme Wid'),
      count('Hier ist dein THEME WIDGET.'),
      count('Theme-Widget'),
      themeCardAnchors([
        { role: 'user', content: 'Theme Widget' },
        { role: 'assistant', content: 'Hallo' },
      ]).size,
    ];
  });
  expect(matching).toEqual([0, 1, 1, 0]);
  await page.evaluate((id) => {
    const c = testChats[id];
    c.messages.push(
      { role: 'user', content: 'Auswahl bitte' },
      {
        role: 'assistant',
        content: 'Wähle deinen Look im Theme Widget.',
        provider: 'apple',
        model: 'apple-local',
      },
    );
    c.revision++;
    saveChats();
    chatEvent(structuredClone(c));
  }, first);
  await expect(page.locator('.chat-theme-card')).toHaveCount(2);
  await expect(
    page.locator('.chat-message.assistant').last().locator('.chat-theme-card [data-color]'),
  ).toHaveCount(10);
  await page.reload();
  await page.locator('#splash.gone').waitFor({ state: 'attached' });
  await page.locator('#url').fill('chat');
  await expect(page.locator('.chat-theme-card')).toHaveCount(2);
  await expect(
    page.locator('.chat-message.assistant').last().locator('.chat-message-meta'),
  ).toContainText('Sira');
  await expect(page.locator('.chat-message.assistant').last().locator('.chat-origin')).toHaveText(
    'Apple Intelligence · lokal',
  );
  await expect(page.locator('#chatModelPicker')).toContainText('Llama Test');
  const trace = page.locator('.sira-tool-details').first();
  await expect(trace).toBeAttached();
  await trace.locator('summary').click();
  await expect(trace.locator('pre')).toContainText('ANFRAGE · browser_customize');
  await expect(trace.locator('pre')).toContainText('show_color_picker');
  await expect(trace.locator('pre')).toContainText('ANTWORT');
  expect(errors).toEqual([]);
});
