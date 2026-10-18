package main

import (
	"browser-mac/internal/browsermcp"
	"browser-mac/internal/secret"
	"context"
	"embed"
	"fmt"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed all:frontend/dist
var assets embed.FS

// Kamera-Sound für den Screenshot (S-Geste).
//
//go:embed assets/shutter.mp3
var shutterSound []byte

// Kern der Mausgeste: dieselbe Datei läuft in der Oberfläche und – von hier eingeschleust – in jeder Webseite.
//
//go:embed frontend/src/gesture-core.js
var gestureCore string

//go:embed frontend/src/page-control.js
var pageControl string

// buildMenu: Tastenkürzel müssen im Menü liegen, damit sie auch gelten, wenn eine Webseite den Fokus hat.
// Jeder Eintrag schickt ein "cmd"-Ereignis ans Frontend.
func buildMenu(app *App) *menu.Menu {
	cmd := func(name string) menu.Callback {
		return func(*menu.CallbackData) { app.emit("cmd", name) }
	}
	m := menu.NewMenu()
	m.Append(menu.AppMenu())

	file := m.AddSubmenu("Ablage")
	file.AddText("Neuer Tab", keys.CmdOrCtrl("t"), cmd("new-tab"))
	file.AddText("Tab schließen", keys.CmdOrCtrl("w"), cmd("close-tab"))
	file.AddSeparator()
	file.AddText("Einstellungen …", keys.CmdOrCtrl(","), cmd("settings"))
	file.AddSeparator()
	file.AddText("Adresse öffnen", keys.CmdOrCtrl("l"), cmd("focus-url"))
	file.AddText("Auf der Seite suchen", keys.CmdOrCtrl("f"), cmd("find"))

	m.Append(menu.EditMenu())

	view := m.AddSubmenu("Darstellung")
	view.AddText("Seite neu laden", keys.CmdOrCtrl("r"), cmd("reload"))
	view.AddText("Laden stoppen", keys.CmdOrCtrl("."), cmd("stop"))
	view.AddSeparator()
	view.AddText("Größer", keys.CmdOrCtrl("="), cmd("zoom-in"))
	view.AddText("Kleiner", keys.CmdOrCtrl("-"), cmd("zoom-out"))
	view.AddText("Tatsächliche Größe", keys.CmdOrCtrl("0"), cmd("zoom-reset"))
	view.AddText("Dunkelmodus umschalten", keys.Combo("d", keys.CmdOrCtrlKey, keys.ShiftKey), cmd("toggle-theme"))
	view.AddSeparator()
	view.AddText("Seitenleiste ein/aus", keys.CmdOrCtrl("\\"), cmd("toggle-side"))
	view.AddText("Lesezeichenleiste ein/aus", keys.Combo("b", keys.CmdOrCtrlKey, keys.ShiftKey), cmd("toggle-bar"))

	hist := m.AddSubmenu("Verlauf")
	hist.AddText("Zurück", keys.CmdOrCtrl("["), cmd("back"))
	hist.AddText("Vorwärts", keys.CmdOrCtrl("]"), cmd("forward"))
	hist.AddSeparator()
	hist.AddText("Verlauf anzeigen", keys.CmdOrCtrl("y"), cmd("show-history"))
	hist.AddText("Downloads anzeigen", keys.Combo("l", keys.CmdOrCtrlKey, keys.OptionOrAltKey), cmd("show-downloads"))

	view.AddText("Screenshot der Seite kopieren", keys.Combo("s", keys.CmdOrCtrlKey, keys.OptionOrAltKey), cmd("screenshot"))
	view.AddText("Notizzettel ein/aus", keys.Combo("n", keys.CmdOrCtrlKey, keys.OptionOrAltKey), cmd("toggle-notes"))

	bm := m.AddSubmenu("Lesezeichen")
	bm.AddText("Lesezeichen hinzufügen", keys.CmdOrCtrl("d"), cmd("bookmark"))
	bm.AddText("Lesezeichen anzeigen", keys.Combo("b", keys.CmdOrCtrlKey, keys.OptionOrAltKey), cmd("show-bookmarks"))

	win := m.AddSubmenu("Fenster")
	win.AddText("Nächster Tab", keys.Combo("\uf703", keys.CmdOrCtrlKey, keys.OptionOrAltKey), cmd("next-tab"))
	win.AddText("Vorheriger Tab", keys.Combo("\uf702", keys.CmdOrCtrlKey, keys.OptionOrAltKey), cmd("prev-tab"))
	win.AddSeparator()
	for i := 1; i <= 9; i++ {
		win.AddText(fmt.Sprintf("Tab %d", i), keys.CmdOrCtrl(fmt.Sprint(i)), cmd(fmt.Sprintf("tab-%d", i)))
	}
	return m
}

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "--mcp":
			dir, err := os.UserConfigDir()
			if err == nil {
				err = browsermcp.RunBridge(context.Background(), secret.New(filepath.Join(dir, "browser-mac")))
			}
			if err != nil {
				fmt.Fprintln(os.Stderr, err)
				os.Exit(1)
			}
			return
		case "--mcp-setup-prompt":
			exe, _ := os.Executable()
			fmt.Print(browsermcp.SetupPrompt(exe))
			return
		}
	}
	app := NewApp()
	err := wails.Run(&options.App{
		Title:            "Browser",
		Width:            1280,
		Height:           820,
		MinWidth:         760,
		MinHeight:        480,
		BackgroundColour: &options.RGBA{R: 239, G: 182, B: 213, A: 1},
		AssetServer:      &assetserver.Options{Assets: assets},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind:             []interface{}{app},
		Menu:             buildMenu(app),
		Mac:              &mac.Options{TitleBar: mac.TitleBarHiddenInset()},
	})
	if err != nil {
		println("Error:", err.Error())
	}
}
