// Einzige Stelle, an der das Frontend das Go-Backend aufruft.
import * as App from '../wailsjs/go/main/App.js';
import { EventsOn } from '../wailsjs/runtime/runtime.js';

// Tabs (native WKWebViews)
// Der Entwicklungs-Zugang im normalen Browser (http://localhost:34115) teilt sich die nativen Tab-Ansichten mit dem
// App-Fenster. Damit er dessen Seiten nicht verschiebt oder umschaltet, sendet er native Befehle nur mit ?native=1.
const NATIVE_OK =
  !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.external) ||
  new URLSearchParams(location.search).has('native');
export const IS_NATIVE = NATIVE_OK;
const nat =
  (fn, fallback) =>
  (...a) =>
    NATIVE_OK ? fn(...a) : Promise.resolve(fallback);
export const load = nat((id, url) => App.WebLoad(id, url));
export const back = nat((id) => App.WebBack(id));
export const forward = nat((id) => App.WebForward(id));
export const reload = nat((id) => App.WebReload(id));
export const stop = nat((id) => App.WebStop(id));
export const setFrame = nat((x, y, w, h) => App.WebSetFrame(x, y, w, h));
export const show = nat((id) => App.WebShow(id));
export const close = nat((id) => App.WebClose(id));
export const find = nat((id, text, forward) => App.WebFind(id, text, forward));
export const zoom = nat((id, f) => App.WebZoom(id, f));
export const focusUI = nat(() => App.WebFocusUI());
export const setGesture = nat((on) => App.SetGesture(on));
export const setAppearance = nat((mode) => App.SetAppearance(mode));
// Screenshot ist bewusst nicht gesperrt: Er ändert nichts an den Ansichten (aber: kopiert in die Zwischenablage und spielt den Ton)
export const screenshot = (id) => App.Screenshot(id);
export const snapshot = nat((id) => App.WebSnapshot(id), '');

// Lesezeichen, Verlauf, Downloads, Sitzung
export const bookmarks = () => App.Bookmarks();
export const setBookmark = (url, title, on) => App.SetBookmark(url, title, on);
export const editBookmark = (oldUrl, url, title) => App.EditBookmark(oldUrl, url, title);
export const historyAdd = (url, title) => App.HistoryAdd(url, title);
export const history = (q, limit) => App.History(q, limit);
export const historyRemove = (url) => App.HistoryRemove(url);
export const historyClear = () => App.HistoryClear();
export const downloads = () => App.Downloads();
export const downloadAdd = (name, path) => App.DownloadAdd(name, path);
export const downloadsClear = () => App.DownloadsClear();
export const prefs = () => App.Prefs();
export const setPref = (key, v) => App.SetPref(key, v);
export const notes = () => App.Notes();
export const setNote = (key, title, text) => App.SetNote(key, title, text);
export const sessionSave = (js) => App.SessionSave(js);
export const sessionLoad = () => App.SessionLoad();
export const openFile = (path, reveal) => App.OpenFile(path, reveal);

// Ereignisse aus Go
export const onWeb = (cb) => EventsOn('web', (j) => cb(JSON.parse(j))); // Tab-Ereignisse
export const onCmd = (cb) => EventsOn('cmd', cb); // Menü-Befehle

// Spotify
export const spotifyState = () => App.SpotifyState();
export const spotifyCommand = (cmd, arg) => App.SpotifyCommand(cmd, arg);

// Eigene Suche (Brave); der Schlüssel wird nur gesendet, nie gelesen
export const search = (q, page) => App.Search(q, page);
export const keyStatus = () => App.SearchKeyStatus();
export const keySet = (key) => App.SearchKeySet(key);
export const keyClear = () => App.SearchKeyClear();
export const keyTest = () => App.SearchKeyTest();

export const spotifyAPIStatus = () => App.SpotifyAPIStatus();
export const spotifyAPIConfigure = (id) => App.SpotifyAPIConfigure(id);
export const spotifyAPIConnect = () => App.SpotifyAPIConnect();
export const spotifyAPIDisconnect = () => App.SpotifyAPIDisconnect();
export const spotifySearch = (q) => App.SpotifySearch(q);
export const spotifyPlay = (uri) => App.SpotifyPlay(uri);

export const sonosStatus = () => App.SonosStatus();
export const sonosScan = () => App.SonosScan();
export const sonosConfigure = (on, ids) => App.SonosConfigure(on, ids);

export const mcpStatus = () => App.MCPStatus();
export const mcpConfigure = (on) => App.MCPConfigure(on);
export const mcpCopySetup = () => App.MCPCopySetup();
export const onMCP = (cb) => EventsOn('mcp-command', (j) => cb(JSON.parse(j)));
export const mcpCommandActive = (id) => App.MCPCommandActive(id);
export const mcpReply = (id, value, error) =>
  App.MCPReply(id, JSON.stringify(value ?? null), error || '');
export const mcpPage = (id, args) => App.MCPPage(id, JSON.stringify(args));

export const setDockIcon = nat((png) => App.SetDockIcon(png));

export const spotifyQueue = (uri) => App.SpotifyQueue(uri);

export const spotifyGetQueue = () => App.SpotifyGetQueue();

export const spotifyScheduleNext = (uri, title) => App.SpotifyScheduleNext(uri, title);
export const spotifyCancelNext = () => App.SpotifyCancelNext();
export const spotifyNextStatus = () => App.SpotifyNextStatus();
export const onSpotifyNext = (cb) => EventsOn('spotify-next', (j) => cb(JSON.parse(j)));

export const gestureBindings = () => App.GestureBindings();
export const setGestureBinding = (letter, action, value = '') =>
  App.SetGestureBinding(letter, action, value);
export const resetGestureBindings = () => App.ResetGestureBindings();

export const chatStatus = () => App.ChatStatus();
export const chatSetKey = (key) => App.ChatSetKey(key);
export const chatClearKey = () => App.ChatClearKey();
export const chatList = () => App.ChatList();
export const chatGet = (id) => App.ChatGet(id);
export const chatCreate = () => App.ChatCreate();
export const chatSend = (id, text) => App.ChatSend(id, text);
export const chatCancel = (id) => App.ChatCancel(id);
export const chatDelete = (id) => App.ChatDelete(id);
export const onChat = (cb) => EventsOn('chat-update', (j) => cb(JSON.parse(j)));

export const chatProviderKey = (provider, key) => App.ChatProviderKey(provider, key);
export const chatRemoveProviderKey = (provider) => App.ChatRemoveProviderKey(provider);
export const chatModels = (provider) => App.ChatModels(provider);
export const chatSaveModel = (slot, provider, id) => App.ChatSaveModel(slot, provider, id);
export const chatSelectModel = (slot) => App.ChatSelectModel(slot);

export const updateStatus = () => App.UpdateStatus();
export const checkUpdates = () => App.CheckUpdates();
export const setAutomaticUpdates = (enabled) => App.SetAutomaticUpdates(enabled);

export const setErrorPalette = nat((palette) => App.SetErrorPalette(palette));
export const onboardingClipboard = nat(
  async (id, provider) => JSON.parse(await App.OnboardingClipboard(id, provider)),
  { count: 0, eligible: false },
);
export const onboardingSpotifyConnect = (id) => App.OnboardingSpotifyConnect(id);

export const resetBrowserSettings = () => App.ResetBrowserSettings();
