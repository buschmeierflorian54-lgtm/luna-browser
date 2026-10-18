// Einzige Stelle, an der das Frontend das Go-Backend aufruft.
import * as App from '../wailsjs/go/main/App.js';
import { EventsOn } from '../wailsjs/runtime/runtime.js';

// Tabs (native WKWebViews)
// Der Entwicklungs-Zugang im normalen Browser (http://localhost:34115) teilt sich die nativen Tab-Ansichten mit dem
// App-Fenster. Damit er dessen Seiten nicht verschiebt oder umschaltet, sendet er native Befehle nur mit ?native=1.
const NATIVE_OK = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.external) || new URLSearchParams(location.search).has('native');
const nat = (fn, fallback) => (...a) => (NATIVE_OK ? fn(...a) : Promise.resolve(fallback));
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
export const setAppearance = nat((mode) => App.SetAppearance(mode));
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
export const sessionSave = (js) => App.SessionSave(js);
export const sessionLoad = () => App.SessionLoad();
export const openFile = (path, reveal) => App.OpenFile(path, reveal);

// Ereignisse aus Go
export const onWeb = (cb) => EventsOn('web', (j) => cb(JSON.parse(j)));   // Tab-Ereignisse
export const onCmd = (cb) => EventsOn("cmd", cb);                         // Menü-Befehle

// Spotify
export const spotifyState = () => App.SpotifyState();
export const spotifyCommand = (cmd, arg) => App.SpotifyCommand(cmd, arg);

// Eigene Suche (Brave); der Schlüssel wird nur gesendet, nie gelesen
export const search = (q, page) => App.Search(q, page);
export const keyStatus = () => App.SearchKeyStatus();
export const keySet = (key) => App.SearchKeySet(key);
export const keyClear = () => App.SearchKeyClear();
export const keyTest = () => App.SearchKeyTest();
