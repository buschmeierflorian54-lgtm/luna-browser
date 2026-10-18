package main

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"browser-mac/internal/search"
	"browser-mac/internal/secret"
	"browser-mac/internal/spotify"
	"browser-mac/internal/store"
	"browser-mac/internal/web"
	wr "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App bündelt alle Methoden, die das Frontend aufrufen darf (nur über frontend/src/api.js).
type App struct {
	ctx context.Context
	st  *store.Store
	out chan [2]string // Ereignisse ans Frontend

	secrets *secret.Store
	search  *search.Client
	gesture string // Skript der Mausgeste (wird in jede Seite eingeschleust)
}

const (
	keyFile = "brave-api-key"
)

func NewApp() *App { return &App{} }

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	dir, err := os.UserConfigDir() // ~/Library/Application Support
	if err != nil {
		dir = os.TempDir()
	}
	if a.st, err = store.New(filepath.Join(dir, "browser-mac")); err != nil {
		println("Speicher nicht verfügbar:", err.Error())
	}
	// Ereignisse dürfen nie direkt vom Main-Thread aus an wr.EventsEmit gehen: Wails' ExecJS gibt dort
	// einen bereits autoreleasten String frei und stürzt ab. Darum eine Warteschlange mit eigenem Thread.
	a.out = make(chan [2]string, 2048)
	go func() {
		for e := range a.out {
			wr.EventsEmit(ctx, e[0], e[1])
		}
	}()
	web.SetEmitter(func(j string) { a.emit("web", j) })
	// Mausgeste (Kreis): Skript in jede Seite, Ein/Aus aus den Einstellungen (Standard: an)
	a.gesture = pageGestureScript()
	web.ConfigureGesture(a.gesture, a.st.Prefs()["circleGesture"] || !hasPref(a.st.Prefs(), "circleGesture"))

	// Eigene Suchmaschine (Brave-API); der Schlüssel wird bei jeder Anfrage frisch aus der geschützten Datei gelesen.
	a.secrets = secret.New(filepath.Join(dir, "browser-mac"))
	a.search = search.NewClient(func() (string, error) {
		v, _, err := a.secrets.Get(keyFile)
		return v, err
	})
}

func (a *App) emit(name, data string) {
	select {
	case a.out <- [2]string{name, data}:
	default: // Warteschlange voll: lieber verwerfen als den Main-Thread blockieren
	}
}

/* Tabs (native WKWebViews) */

func (a *App) WebLoad(id int, url string)                { web.Load(id, url) }
func (a *App) WebBack(id int)                            { web.Back(id) }
func (a *App) WebForward(id int)                         { web.Forward(id) }
func (a *App) WebReload(id int)                          { web.Reload(id) }
func (a *App) WebStop(id int)                            { web.Stop(id) }
func (a *App) WebSetFrame(x, y, w, h float64)            { web.SetFrame(x, y, w, h) }
func (a *App) WebShow(id int)                            { web.Show(id) }
func (a *App) WebClose(id int)                           { web.Close(id) }
func (a *App) WebFind(id int, text string, forward bool) { web.Find(id, text, forward) }
func (a *App) WebZoom(id int, factor float64)            { web.Zoom(id, factor) }

// SetGesture schaltet die Mausgeste (Kreis) in allen Seiten ein oder aus.
func (a *App) SetGesture(on bool)                 { web.ConfigureGesture("", on) }
func (a *App) SetAppearance(mode string)          { web.SetAppearance(mode) }
func (a *App) WebFocusUI()                        { web.FocusUI() }
func (a *App) WebSnapshot(id int) (string, error) { return web.Snapshot(id) }

/* Lesezeichen, Verlauf, Downloads, Sitzung */

func (a *App) Bookmarks() []store.Bookmark { return a.st.Bookmarks() }
func (a *App) SetBookmark(url, title string, on bool) []store.Bookmark {
	return a.st.SetBookmark(url, title, on)
}
func (a *App) EditBookmark(oldURL, url, title string) []store.Bookmark {
	return a.st.EditBookmark(oldURL, url, title)
}
func (a *App) Notes() []store.Note { return a.st.Notes() }
func (a *App) SetNote(key, title, text string) []store.Note {
	return a.st.SetNote(key, title, text)
}
func (a *App) HistoryAdd(url, title string)                  { a.st.HistoryAdd(url, title) }
func (a *App) History(query string, limit int) []store.Visit { return a.st.History(query, limit) }
func (a *App) HistoryRemove(url string)                      { a.st.HistoryRemove(url) }
func (a *App) HistoryClear()                                 { a.st.HistoryClear() }
func (a *App) Downloads() []store.Download                   { return a.st.Downloads() }
func (a *App) DownloadAdd(name, path string)                 { a.st.DownloadAdd(name, path) }
func (a *App) DownloadsClear()                               { a.st.DownloadsClear() }
func (a *App) Prefs() map[string]bool                        { return a.st.Prefs() }
func (a *App) SetPref(key string, v bool) map[string]bool    { return a.st.SetPref(key, v) }
func (a *App) SessionSave(js string)                         { a.st.SessionSave(js) }
func (a *App) SessionLoad() string                           { return a.st.SessionLoad() }

// OpenFile öffnet eine heruntergeladene Datei; reveal zeigt sie stattdessen im Finder.
func (a *App) OpenFile(path string, reveal bool) error {
	args := []string{path}
	if reveal {
		args = []string{"-R", path}
	}
	return exec.Command("open", args...).Run()
}

/* Spotify (AppleScript) */

func (a *App) SpotifyState() spotify.State { return spotify.Get() }
func (a *App) SpotifyCommand(cmd string, arg float64) error {
	return spotify.Command(cmd, arg)
}

/* Eigene Suche (Brave) – der Schlüssel geht nur hinein, nie wieder heraus */

// Search liefert die Ergebnisse (bereinigt) für Suchbegriff q, Seite page (0-basiert).
func (a *App) Search(q string, page int) (*search.Page, error) {
	ctx, cancel := context.WithTimeout(a.ctx, 14*time.Second)
	defer cancel()
	return a.search.Search(ctx, q, page)
}

// SearchKeyStatus sagt nur, OB ein Schlüssel gespeichert ist.
func (a *App) SearchKeyStatus() bool {
	_, ok, _ := a.secrets.Get(keyFile)
	return ok
}

func (a *App) SearchKeySet(key string) error {
	key = strings.TrimSpace(key)
	if key == "" || len(key) > 200 || strings.ContainsAny(key, " \t\r\n\x00") {
		return errors.New("Das sieht nicht nach einem gültigen API-Schlüssel aus.")
	}
	return a.secrets.Set(keyFile, key)
}

func (a *App) SearchKeyClear() error { return a.secrets.Delete(keyFile) }

// SearchKeyTest prüft den gespeicherten Schlüssel mit einer echten Anfrage an Brave.
func (a *App) SearchKeyTest() error {
	ctx, cancel := context.WithTimeout(a.ctx, 12*time.Second)
	defer cancel()
	return a.search.Test(ctx)
}

func hasPref(p map[string]bool, k string) bool { _, ok := p[k]; return ok }

// pageGestureScript: gemeinsamer Kern + Anbindung an die App (Nachricht an window.webkit.messageHandlers.fmGesture).
func pageGestureScript() string {
	return "(function(){\n" + gestureCore + "\nwindow.__fmCircle({target:window,onCircle:function(i){try{window.webkit.messageHandlers.fmGesture.postMessage({kind:'circle',dir:i.dir});}catch(e){}}});\n})();"
}
