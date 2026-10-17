// Einzige Stelle, an der das Frontend das Go-Backend aufruft.
import * as App from '../wailsjs/go/main/App.js';
import { EventsOn } from '../wailsjs/runtime/runtime.js';

// Tabs (native WKWebViews)
export const load = (id, url) => App.WebLoad(id, url);
export const back = (id) => App.WebBack(id);
export const forward = (id) => App.WebForward(id);
export const reload = (id) => App.WebReload(id);
export const stop = (id) => App.WebStop(id);
export const setFrame = (x, y, w, h) => App.WebSetFrame(x, y, w, h);
export const show = (id) => App.WebShow(id);
export const close = (id) => App.WebClose(id);
export const find = (id, text, forward) => App.WebFind(id, text, forward);
export const zoom = (id, f) => App.WebZoom(id, f);
export const focusUI = () => App.WebFocusUI();
export const snapshot = (id) => App.WebSnapshot(id);

// Lesezeichen, Verlauf, Downloads, Sitzung
export const bookmarks = () => App.Bookmarks();
export const setBookmark = (url, title, on) => App.SetBookmark(url, title, on);
export const historyAdd = (url, title) => App.HistoryAdd(url, title);
export const history = (q, limit) => App.History(q, limit);
export const historyRemove = (url) => App.HistoryRemove(url);
export const historyClear = () => App.HistoryClear();
export const downloads = () => App.Downloads();
export const downloadAdd = (name, path) => App.DownloadAdd(name, path);
export const downloadsClear = () => App.DownloadsClear();
export const sessionSave = (js) => App.SessionSave(js);
export const sessionLoad = () => App.SessionLoad();
export const openFile = (path, reveal) => App.OpenFile(path, reveal);

// Ereignisse aus Go
export const onWeb = (cb) => EventsOn('web', (j) => cb(JSON.parse(j)));   // Tab-Ereignisse
export const onCmd = (cb) => EventsOn("cmd", cb);                         // Menü-Befehle

// Spotify
export const spotifyState = () => App.SpotifyState();
export const spotifyCommand = (cmd, arg) => App.SpotifyCommand(cmd, arg);
