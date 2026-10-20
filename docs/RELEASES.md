# Ein Projekt, ein Versionsstand, ein Release

Quellrepo: https://github.com/fcore247/luna-browser (öffentlich).
`wails.json` → `info.productVersion` ist die maßgebliche Versionsnummer für beide Apps.
CI übergibt diese Version an Go, den Windows-Host und die Paketnamen. Änderungen
an gemeinsamen Features gehören in denselben Branch, nicht in separate OS-Repos.

## Build und Tests

Jeder Push auf `main` und jeder Pull Request läuft in `.github/workflows/build.yml`:

- macOS ARM64: Go-Tests, Playwright-Oberflächentests, nativer Wails-Build,
  Swift-Helfer, Sparkle-Einbettung und Signaturprüfung.
- Windows x64: dieselben Go-/Oberflächentests, .NET-/WebView2-Host,
  echte native Navigation/DOM, mehrere Tabs, Zoom, Screenshot und Bild-Zwischenablage,
  Sicherheitstests für Providerseiten, anschließend gepackter Wails-App-Start.
- „Both platforms ready“ ist nur grün, wenn beide Jobs erfolgreich waren.

Unter Actions lassen sich beide ZIP-Artefakte herunterladen. Windows-Artefakte
tragen ausdrücklich `EXPERIMENTAL`. Keine CI-Schlüssel oder Tokens gelangen in Apps.

## Gemeinsames Update veröffentlichen

1. Version in `wails.json` erhöhen, Änderungen nach `main` pushen.
2. Den vollständigen grünen CI-Lauf abwarten. Seine Run-ID kopieren.
3. Auf diesem Mac den sauberen Checkout desselben Commits verwenden:

   ```sh
   sh scripts/release.sh RUN_ID
   ```

   Das Skript prüft Commit, Branch, Workflow, Ergebnis und beide Artefakte.
   Der vorhandene Sparkle-Schlüssel im macOS-Schlüsselbund signiert Mac-Update
   und Windows-Metadaten. Es entsteht ein gemeinsames GitHub-Draft-Release.

4. Draft prüfen. Mit GitHub veröffentlichen oder bereits bei Schritt 3
   `--publish` angeben. **Erst dann** wird es für beide Systeme als neuestes Update
   sichtbar. Bereits existierende Versionen/Release-Staging werden nicht überschrieben.

Ein gemeinsames Release enthält Mac-ZIP, DMG, signiertes `appcast.xml`, Windows-ZIP,
`windows-update.json`, `windows-update.sig` und `SHA256SUMS`. Der Windows-Hinweis
bleibt in Release-Text, README und App sichtbar, solange die Version experimentell ist.

Das bedeutet gleichzeitige **Verfügbarkeit**, nicht einen erzwungenen gleichzeitigen
Neustart aller Geräte. Automatische Prüfung: ungefähr täglich. Manuell jederzeit.
Windows lädt/installiert erst nach „Installieren“; macOS behält Sparkles Verhalten.

## Plattformgrenzen

Die gemeinsame Wails-Oberfläche und Go-Dienste bleiben erhalten. `*_darwin.go` und
Objective-C/Swift stellen macOS-Funktionen bereit. `*_windows.go` sprechen über
geerbte stdin/stdout-Pipes mit `native/windows` (.NET, WebView2, Windows Hello,
Windows-Mediensitzungen/CoreAudio). Der Host öffnet keinen Netzwerk-Steuerport;
Webseiten erhalten keine Wails-/Go-Bindings und können nur Gesten melden.

Apple Intelligence ist nicht auf Windows portierbar. Das wird ausdrücklich angezeigt.
Die Windows-Testliste und alle bekannten Einschränkungen stehen in WINDOWS-TEST.md.
