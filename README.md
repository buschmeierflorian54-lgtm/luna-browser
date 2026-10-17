# Browser (macOS, Wails)

Echter Browser im Pink-Design des Dateimanagers. Jede Seite rendert in einem **nativen WKWebView**
(`internal/web`, cgo/ObjC) als Unteransicht des Fensters; Tabs, Adressleiste und Seitenleisten sind HTML.

```
wails dev      # Entwicklung
wails build    # Release (build/bin/browser-mac.app)
go test ./internal/...
```

## Funktionen
Tabs (auch Seiten, die selbst Tabs öffnen, ⌘-Klick auf Links), Adressleiste mit Vorschlägen aus Verlauf und
Lesezeichen (Suche über DuckDuckGo), Zurück/Vor/Neu laden/Stopp, Ladebalken, Favicons, Lesezeichen (⌘D, Leiste,
Seitenleiste), Verlauf (durchsuchbar, löschbar), Downloads (nach ~/Downloads, Öffnen/Im Finder zeigen),
Suche auf der Seite (⌘F), Zoom (⌘+ ⌘- ⌘0), Sitzung wird wiederhergestellt, JS-Dialoge, Datei-Upload,
Fehlerseite. Tastenkürzel liegen im Menü, damit sie auch gelten, wenn eine Seite den Fokus hat.
Daten: `~/Library/Application Support/browser-mac/`.

## Spotify
`internal/spotify` steuert die Spotify-App per AppleScript (wie im Dateimanager): Chip in der Werkzeugleiste,
Widget auf der Startseite, Klick öffnet ein Vollbild-Overlay im Fenster (Klick irgendwohin, Esc oder X schließt).
Beim ersten Zugriff fragt macOS nach Automation-Rechten für Spotify.

## Technische Notiz
Ereignisse aus Go ans Frontend laufen über eine Warteschlange (`App.emit`), nie direkt vom Main-Thread:
Wails' `ExecJS` gibt dort einen autoreleasten String frei und stürzt ab.
Overlays (Menü, Vorschläge) über der Seite: kurz ein Foto der Seite zeigen und die native Ansicht verbergen.

## Nicht getestet / nicht umgesetzt
- Nur über den Browser-Zugang von `wails dev` getestet (Go-Backend und native Tabs echt, aber das native Fenster
  habe ich nie selbst gesehen; kein Screenshot-Zugriff). Optik und Positionierung der Seite im Fenster sind unbestätigt.
- Ungetestet: Downloads, Popups (`window.open`), JS-Dialoge, Datei-Upload, Spotify-Overlay über einer geladenen Seite.
- Fehlt: Privates Fenster, Druck, Lesezeichen-Ordner, Tabs verschieben, Passwörter, Erweiterungen, Kamera/Mikrofon.
