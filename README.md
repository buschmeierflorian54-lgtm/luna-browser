# Luna Browser (macOS, Wails)

Browser mit wählbaren Farbthemes. Jede Seite rendert in einem **nativen WKWebView**
(`internal/web`, cgo/ObjC) als Unteransicht des Fensters; Tabs, Adressleiste und Seitenleisten sind HTML.

```
wails dev      # Entwicklung
wails build    # Release (build/bin/browser-mac.app)
go test ./internal/...
```

## Funktionen
Tabs (auch Seiten, die selbst Tabs öffnen, ⌘-Klick auf Links), Adressleiste mit Vorschlägen aus Verlauf und
Lesezeichen, Zurück/Vor/Neu laden/Stopp, Ladebalken, Favicons, Lesezeichen (⌘D, Leiste,
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

## Prüfung und Grenzen

`go test ./...` prüft die Backend-Pakete. Die Playwright-Prüfungen im Frontend
verwenden ein simuliertes Backend: Musikpanel mit Suche und Warteschlange,
Luna-Übernahme, Einstellungsdialoge und isolierte Kapitel, Tab-Gruppen sowie
Benachrichtigungen und das Entfernen der Gestenspur vor Screenshots.
Sie verändern keine echten Konten, Geräte oder Browserdaten.

Native WKWebView-Schichtung, macOS-Zwischenablage, hörbare Spotify-Wiedergabe und
Sonos-Hardware brauchen weiterhin separate Tests in der laufenden macOS-App.
Ein erfolgreicher Build allein bestätigt diese Abläufe nicht.

## Seitenleiste erweitern

`frontend/src/sidepanel.js` verwaltet Navigation, Suche, Größenänderung und Inhalte.
Neue Bereiche werden in `main.js` mit `registerPanel({ id, title, desc, icon, render })`
registriert. `parent: 'bookmarks'` macht einen Bereich zum Untermenü der Lesezeichen.
Den Elternbereich zuerst registrieren; IDs müssen eindeutig sein. Zurück-Navigation
und Hervorhebung des Hauptbereichs entstehen automatisch. Ohne `render` kann ein
Bereich ausschließlich weitere Untermenüs enthalten. `search`, `primary`, `menu`,
`count` und `badge` ergänzen Suche, Aktionen und Status. Ausblenden eines Elternbereichs
blendet auch dessen Untermenüs aus.

Eigene Menüs lassen sich unter Einstellungen → Seitenpanel erstellen, umbenennen,
verschachteln und auflösen. Beim Auflösen bleiben die enthaltenen Bereiche erhalten.
Die Zuordnung und Reihenfolge werden lokal gespeichert. Ausblenden betrifft nur
die Navigation; direkte Aktionen wie die Kreisgeste öffnen Notizen weiterhin.
Die Einstellungen zeigen ausschließlich das gewählte Kapitel.

## Spotify API und eigene Suche

„spotify “ (oder weiterhin „open spotify “) aktiviert den Spotify-Chip. Suchanfragen laufen über die Spotify Web API
und erscheinen direkt in Luna (Top-Treffer, Songs, Künstler, Alben). Play-Buttons steuern
Spotify per AppleScript; es wird keine Web-API-Wiedergabe verwendet.

Unter Einstellungen → Spotify die Client ID einer Spotify Developer-App speichern.
Dort muss `http://127.0.0.1:8888/callback` als Redirect URI registriert sein.
„Konto verknüpfen“ öffnet die OAuth-Freigabe im Standardbrowser. Der Desktop-Login
verwendet PKCE, kein Client Secret. Access-/Refresh-Tokens bleiben im Go-Backend und
liegen im bestehenden geschützten App-Ordner (`spotify-account.json`, 0600).
„Verbindung trennen“ löscht die lokale Kontoverknüpfung; die Client ID bleibt erhalten.
Spotify-Premium und die Nutzerfreigabe im Developer Dashboard können erforderlich sein.

OAuth/Refresh/Suche wurden gegen einen lokalen Testserver geprüft; der UI-Ablauf mit
Testantworten. Die Live-Verknüpfung und hörbare AppleScript-Wiedergabe erfordern die
Client ID und die Anmeldung des Benutzers und sind noch nicht bestätigt.


## Sonos Sync
Unter Einstellungen → Spotify → Sonos Sync einschalten: Die Suche startet automatisch, danach Lautsprecher auswählen.
Die Erkennung übernimmt den lokalen IPv4-/24-Scan auf Port 1400 aus SonosMacSync;
Raumnamen werden zusätzlich über DeviceProperties abgefragt, Produktbilder stammen
 aus den vorhandenen Sonos-Assets. Geräte werden über ihre UDN statt ihrer IP gespeichert.
CoreAudio liest alle 180 ms die Systemlautstärke. Änderungen gehen per lokalem
RenderingControl/SetVolume an die ausgewählten erreichbaren Geräte. Beim Einschalten
oder Wechsel des Audioausgangs wird zuerst ein Ausgangswert übernommen, ohne die
Sonos-Lautstärke zu ändern. Danach gilt derselbe Prozentwert wie am Mac.
Sync läuft auch im Hintergrund, solange Luna geöffnet ist, und sucht alle 30 Sekunden
nach neuen Geräten. Bekannte Geräte werden alle 5 Sekunden per HTTP auf Erreichbarkeit und Sonos-Identität geprüft; ausgeschaltet entfällt diese Prüfung. Audioausgänge ohne regelbare CoreAudio-Lautstärke werden angezeigt.
Tests: SOAP/Begrenzung, Auswahl/Persistenz, Ausgangswechsel, deaktivierter Sync und
unveränderte Lautstärke; Hardware-Erkennung und CoreAudio lesend lokal geprüft.
Ein tatsächlicher Lautstärketasten-/Hörtest steht aus.

## Projektstruktur und Wartung

- `main.go`, `app.go`, `mcp.go`, `dock_icon.go`: App-Start, Wails-Anbindung,
  MCP und macOS-App-Icon.
- `internal/`: getrennte Go-Pakete für Browseransichten, Speicherung, Suche,
  Spotify, Sonos, lokale Warteschlange und MCP.
- `frontend/src/main.js`: Browser-Zustand, Navigation und Verdrahtung der Bereiche.
- `frontend/src/settings.js`: Einstellungskapitel, Statusabfragen und API-Schlüssel-UI.
- `frontend/src/tab-groups.js`: Tab-Reihenfolge, Gruppen und Drag-and-drop.
- `frontend/src/screenshots.js`: Screenshot-Status und Vorschauanimation.
- `frontend/src/ui.js`: gemeinsame Darstellungshelfer.
- `frontend/src/music-*.js`, `spotify*.js`, `sonos-view.js`: Musik und Geräteoberflächen.
- `frontend/src/notifications.js`, `sidepanel.js`: gemeinsame Dialoge und Seitenpanel.
- `frontend/src/styles/`: Styles nach Bereichen; `style.css` legt die Reihenfolge fest.
  Die Reihenfolge ist Teil der CSS-Kaskade und darf nicht blind alphabetisch sortiert werden.
- `frontend/tests/`: wiederholbare Oberflächentests mit simuliertem Backend.
- `frontend/wailsjs/`: von Wails erzeugte Bindings; nicht manuell umbauen.
- `frontend/dist/`, `build/bin/`, `frontend/test-results/`: erzeugte Ausgaben,
  keine Quellcode-Ablage.

### Frontend entwickeln und prüfen

Benötigt werden Node/npm sowie für den nativen Build Go, Wails und die macOS-Werkzeuge.
Im Verzeichnis `frontend`:

```sh
npm ci
npx playwright install chromium  # einmalig für die Oberflächentests
npm run dev                    # reine Oberfläche, ohne natives Backend
npm run format                 # eigenen JS-/CSS-Code einheitlich formatieren
npm run check                  # Formatprüfung, Oberflächentests und Vite-Build
```

Die Tests starten ihren Vite-Server selbst auf `127.0.0.1:5174`; dieser Port muss frei sein.
Im Projektstamm prüft `go test ./...` das Backend. `wails build` erzeugt anschließend
die App unter `build/bin/browser-mac.app`.

Neue Funktionen möglichst in einem eigenen Fachmodul halten und über explizite
Callbacks an den Browser anbinden. Keine Rückimporte aus Fachmodulen in `main.js`.
`main.js` enthält weiterhin die zentrale Navigation; weitere Aufteilungen können
schrittweise erfolgen, ohne funktionierende Musik- oder Geräteabläufe neu zu schreiben.
