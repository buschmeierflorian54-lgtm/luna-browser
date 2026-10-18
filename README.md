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

## Notizzettel und Mausgeste
Linke Maustaste halten und einen Kreis zeichnen: öffnet das Seitenpanel „Notizen“ mit einem Notizzettel für die aktuelle
Seite (Schlüssel = Adresse ohne #Anker; Suchen: Suchbegriff). Ein zweiter Kreis schließt das Panel wieder. Auf Webseiten
läuft die Erkennung in einem eingeschleusten Skript (`frontend/src/gesture-core.js`, per `WKUserScript` in jede Seite,
Nachricht über `fmGesture`), in der eigenen Oberfläche direkt. **S zeichnen** (Maustaste halten, Buchstabe S, loslassen) macht einen Screenshot der Seite (Webseite bzw. Seitenbereich der
Oberfläche) in die Zwischenablage, spielt den Kamera-Sound (`assets/shutter.mp3`, per `NSSound`) und zeigt Blitz und
fliegende Vorschau. Ohne Berechtigung: Der Screenshot nutzt `WKWebView.takeSnapshot`, braucht also keine Bildschirmaufnahme-Rechte
(Ränder der App, z. B. Titelleiste, sind nicht enthalten). Ein/Aus in den Einstellungen (Bedienung); Notizen liegen
in `notes.json`. Menü: Darstellung → Notizzettel ein/aus (⌥⌘N).

## Lesezeichen
Hinzufügen (+ in der Leiste, auf der Startseite, in der Seitenleiste und in den Einstellungen), Bearbeiten und Löschen
(Rechtsklick auf ein Lesezeichen, ✕ auf den Startseiten-Kacheln, Verwaltung in den Einstellungen). Die Lesezeichenleiste
lässt sich in den Einstellungen ausblenden (`showBookmarkBar` in `prefs.json`).

## Start und Sitzung
Standard: Der Browser startet immer mit der Startseite. In den Einstellungen (⌘,; eigene Seite in eigenem Tab) lässt sich „Zuletzt geöffnete Seiten merken“
einschalten; dann stellt er beim nächsten Start die Tabs von zuletzt wieder her. Ist es aus, wird nichts gespeichert
(eine alte Sitzung wird gelöscht). Der Schalter liegt in `prefs.json` im App-Ordner.

## Erscheinungsbild und Start
Hell, Dunkel oder Automatisch (Einstellungen ⌘, oder ⇧⌘D). Das Theme besteht aus CSS-Variablen; zusätzlich setzt die App
die System-Erscheinung (`NSApp.appearance`), damit auch Webseiten über `prefers-color-scheme` mitziehen.
Beim Start zeigt ein animierter Startbildschirm das echte Hochfahren (Einstellungen, Lesezeichen, Spotify, Tabs); die
aktive Seite lädt dabei schon im Hintergrund, native Ansichten bleiben bis zum Ende verborgen.

## Eigene Suche (Brave)
Die Adressleiste sucht über die Brave-Search-API; `internal/search` liefert bereinigte Daten, die Ergebnisse stellt die
Oberfläche selbst dar (eingebaute Ansicht, keine Webseite, kein lokaler Server). Zurück/Vor laufen nahtlos zwischen
Startseite, Suche und Webseiten. Den Schlüssel trägst du unter ⌘, ein. Er liegt in
`~/Library/Application Support/browser-mac/brave-api-key` (Ordner 0700, Datei 0600), nicht im Schlüsselbund (der
fragt bei nicht signierten Apps nach jedem Neubau neu nach) und wird nie ans Frontend zurückgegeben.
Das ist weniger geschützt als ein Schlüsselbund: Jeder Prozess unter deinem Benutzer kann die Datei lesen.

## Technische Notiz
Ereignisse aus Go ans Frontend laufen über eine Warteschlange (`App.emit`), nie direkt vom Main-Thread:
Wails' `ExecJS` gibt dort einen autoreleasten String frei und stürzt ab.
Overlays (Menü, Vorschläge) über der Seite: kurz ein Foto der Seite zeigen und die native Ansicht verbergen.

## Nicht getestet / nicht umgesetzt
- Nur über den Browser-Zugang von `wails dev` getestet (Go-Backend und native Tabs echt, aber das native Fenster
  habe ich nie selbst gesehen; kein Screenshot-Zugriff). Optik und Positionierung der Seite im Fenster sind unbestätigt.
- Ungetestet: Downloads, Popups (`window.open`), JS-Dialoge, Datei-Upload, Spotify-Overlay über einer geladenen Seite.
- Fehlt: Privates Fenster, Druck, Lesezeichen-Ordner, Tabs verschieben, Passwörter, Erweiterungen, Kamera/Mikrofon.
