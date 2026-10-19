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

## Buchstaben-Gesten

Unter **Einstellungen → Mausgesten** lassen sich C, D, H, I, J, L, O, P, Q, S, V, W und Z mit Browseraktionen belegen.
Die Vorlagen zeigen die Strichfolge beim Darüberfahren. Mit gedrückter linker
Maustaste groß in einem Zug zeichnen und loslassen; Eingabefelder sind ausgenommen.
O/Kreis öffnet standardmäßig Notizen, S erstellt einen Screenshot. Nicht belegte
Buchstaben führen nichts aus. Die Erkennung arbeitet lokal mit Formvorlagen;
beliebige Handschrift oder mehrere getrennte Striche werden nicht unterstützt.

`gestures.json` speichert die Belegung im App-Datenordner. Die Erkennung für native
Seiten und Luna-Oberflächen teilt sich `gesture-core.js`; `gestures.js` verwaltet
UI und Aktionsausführung, `internal/store/gestures.go` validiert und speichert.
Das MCP-Werkzeug `browser_gestures` bietet dieselbe Konfiguration (siehe MCP_SETUP.md).


## Luna Chat mit Groq und OpenRouter

Unter **Einstellungen → KI & MCP** Groq oder OpenRouter wählen und den jeweiligen
API-Schlüssel speichern. Erst danach wird die Modellliste geladen. Nach Modellname
suchen oder nach Ersteller filtern und bis zu zwei Modelle hinzufügen (auch gemischt).
Der Picker im Chat wechselt zwischen diesen beiden Plätzen. Schlüssel und Auswahl
bleiben getrennt gespeichert. Bestehende OpenRouter-Installationen behalten Sonnet
als ersten Platz. Nicht chatfähige Modelle sind sichtbar, aber nicht auswählbar.
`chat` in der Adressleiste öffnet Luna Chat sofort, ohne Enter. Die maximale Ausgabe
beträgt 30.000 Tokens, begrenzt durch die vom Katalog gemeldete Modellgrenze.
Ein laufender Aufruf behält seinen Anbieter, Schlüssel und sein Modell auch bei
Änderungen der Einstellungen. API-Kataloge garantieren keine Kontingente oder
individuellen Modellberechtigungen; Fehler werden ohne Schlüsselinhalt angezeigt.
Antworten erscheinen laufend und können gestoppt werden. Die Seitenleiste zeigt
lokal gespeicherte Gespräche und lässt sich einklappen; Enter sendet, Shift+Enter
fügt eine neue Zeile ein.

Beim Senden gehen die Nachricht und der bisherige Verlauf dieses Gesprächs an
den gewählten Anbieter und gegebenenfalls dessen Modellanbieter. Bei aktiviertem MCP-Server kann der Chat dieselben Browser-Werkzeuge über eine
interne MCP-Verbindung nutzen. Gelesene Seiten und Tool-Ergebnisse gehen dabei
ebenfalls an den Anbieter. Abschalten unter KI & MCP stoppt laufende Antworten
und sperrt weitere Aufrufe. Pro Nachricht sind maximal 20 Werkzeugrunden möglich.
Screenshot-Werkzeuge sind aufrufbar; Bildpixel werden derzeit nicht an das Modell
übermittelt. Kosten entstehen
über das jeweilige Anbieterkonto. Der Schlüssel bleibt im Secret-Store des
Go-Backends und wird nicht an die Oberfläche zurückgegeben. `chats.json` im
App-Datenordner enthält den lokalen Verlauf. Gestoppte oder fehlgeschlagene
Antworten bleiben mit ihrem bereits empfangenen Text erhalten.

`internal/chat` übernimmt Streaming, Abbruch und Speicherung; `chat.go` ist die
Wails-Anbindung und `frontend/src/chat.js` die Oberfläche. Backendtests verwenden
einen lokalen Testserver; Oberflächentests simulieren den Provider ohne API-Kosten.

Der Modell-Picker sitzt in der Chat-Eingabebox und öffnet ein eigenes Menü nach oben.
Bei HTTP 413 verkleinert Luna ausschließlich die abgewiesene Anbieteranfrage: ältere
Gesprächsrunden und lange Werkzeugergebnisse sowie das angeforderte Ausgabelimit.
Die aktuelle Nutzernachricht und gespeicherte Chats bleiben unverändert. Ein Hinweis
zeigt die Anpassung. Höchstens zwei verkleinerte Wiederholungen werden ausgeführt.
Bei HTTP 429 erfolgen höchstens zwei Wiederholungen unter Beachtung von Retry-After;
Wartezeiten über 30 Sekunden werden als Meldung angezeigt. Bereits gestartete
Werkzeugaktionen oder teilweise empfangene Antworten werden nicht wiederholt.

### Lokales Apple-Modell

Der feste dritte Modellplatz nutzt `SystemLanguageModel.default` aus Apples Foundation Models. Die beiden Cloud-Favoriten bleiben unverändert. Der native Helfer prüft Geräteunterstützung, Apple-Intelligence-Freigabe und Modellbereitschaft; ohne Verfügbarkeit ist der Platz gesperrt. In KI & MCP lässt sich die Prüfung wiederholen. Kein API-Schlüssel, keine automatische Cloud-Weiterleitung. Browser-Werkzeuge können auf Nutzerauftrag weiterhin Onlinedienste kontaktieren.

Der Wails-Post-Build-Hook kompiliert `native/applemodel/main.swift` in die App und signiert Helfer und Bundle. Zum Bauen wird ein macOS-SDK mit FoundationModels benötigt; zum Nutzen macOS 26+ mit verfügbarem Apple Intelligence. Die lokale Ausgabe ist auf 1.024 Tokens begrenzt. Älterer Kontext und lange Toolresultate werden nur für die Anfrage gekürzt; die aktuelle Nutzernachricht bleibt vollständig (max. 5.000 Zeichen), der gespeicherte Verlauf unverändert.

Sira verwendet keine nativen Foundation-Models-Tools und keine strukturierte Generierung. Der Browser gibt ihr eine feste nummerierte Liste der verfügbaren Werkzeuge (1–17). Sie wählt mit einer einzelnen Nummer, z.B. 6 für browser_customize. Anschließend zeigt der Browser ihr dessen Beschreibung und Parameterschema mit erlaubten Optionen. Pro Antwort übergibt Sira genau ein Feld, etwa `{"color":"blau"}`. Jeder Wert wird separat validiert; fehlerhafte Werte führen zu einer Rückmeldung ohne Ausführung. `FERTIG` lässt den Browser den vollständigen Aufruf prüfen und an den MCP-Dispatcher übergeben. `ABBRECHEN`, Abbruch durch den Nutzer und das Limit von 24 Parameterschritten führen zu keiner Ausführung.

Normale Antworten sind weiterhin möglich (Präfix `ANTWORT:` schützt numerische Antworten vor Verwechslung mit Toolnummern). Der technische Dialog bleibt im normalen Chat verborgen und steht nach dem fertigen Aufruf mit Anfrage und Ergebnis unter Werkzeugdetails. Neue Antworten speichern ihre Modellherkunft und tragen bei Apple Intelligence die Kennzeichnung Sira · Apple Intelligence · lokal.

Optionaler nativer Integrationstest (keine echten Browseraktionen, Test-Dispatcher): `LUNA_TEST_APPLE_HELPER="$PWD/build/bin/browser-mac.app/Contents/MacOS/luna-apple-model" go test ./internal/chat -run TestAppleNative -v`.

## Automatische Updates

Updates kommen über signierte GitHub Releases. Details und Release-Ablauf: [UPDATES.md](UPDATES.md).
