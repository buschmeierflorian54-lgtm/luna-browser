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

## Release-Commit vor der Veröffentlichung festhalten

Vor dem Anlegen eines Releases einen Branch `release/VERSION` exakt auf den
bereits erfolgreich geprüften Quellcommit setzen (für 1.2.2:
`release/1.2.2` → `beb294d975a74d6ef16f34f9edaf60d91f710ab4`).
Den Branch für die Nachvollziehbarkeit behalten und nicht auf spätere Commits verschieben.

GitHub verlangt zusätzliche Workflow-Schreibrechte, wenn ein Release auf einen
Commit mit Workflow-Änderungen zeigt, der weder Branch-Kopf noch Tag ist. Der
normale Actions-Token besitzt diese Rechte nicht; die API kann deshalb trotz
`contents: write` mit 403 „Resource not accessible by integration“ antworten.
Der Release-Branch hält den geprüften Commit als bestehenden Ref fest, ohne die
Token-Berechtigungen zu erweitern. Pakete, Quellcommit und erfolgreicher CI-Lauf
müssen weiterhin exakt zusammenpassen.

GitHub-Regel: https://github.blog/changelog/2023-11-02-github-actions-enforcing-workflow-scope-when-creating-a-release/

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

## Personalisierte Hintergründe

`docs/youtube-background.html` muss vor Auslieferung der Personalisierung über
GitHub Pages unter `https://luna-browser.com/youtube-background.html` verfügbar
sein. Die HTTPS-Seite gibt dem eingebetteten YouTube-Player einen gültigen
Web-Ursprung, auch wenn Luna selbst unter einem nativen URL-Schema läuft.
Sie übermittelt nur Wiedergabestatus an das Elternfenster; Luna prüft Herkunft
und sendendes Fenster. Es werden keine Luna-Zugangsdaten an die Seite gesendet.

Name (Startseite/Fenstertitel), Icon und Hintergrundauswahl werden im lokalen
Profil gespeichert. Fotos/Videos liegen in IndexedDB und werden nicht hochgeladen.
YouTube verbindet sich erst bei sichtbarer Startseite und aktivierter Bewegung.
App-Paketname, Update-Identität und signierte Bundle-Metadaten bleiben unverändert.


### Internes Veröffentlichungstool

Nach dem Merge den sauberen, zu veröffentlichenden `main`-Commit auschecken und aus dem Repository ausführen:

```sh
python3 scripts/publish-update.py --notes-file work/release-notes.md --wait --publish
```

Das Tool findet den CI-Lauf genau dieses Commits, wartet auf beide Plattformen, prüft/erstellt den unveränderlichen Release-Zweig, hält den Mac während der Arbeit wach und ruft die Signierung und Veröffentlichung auf. Anschließend vergleicht es die öffentlichen Update-Metadaten mit den signierten lokalen Dateien. Private Schlüssel bleiben im Schlüsselbund. Ohne `--publish` entsteht nur ein Entwurf; `--dry-run` liest ausschließlich den Status.

Das Tool gehört zum Entwicklungsablauf und wird nicht in Luna eingebaut. Ein fehlgeschlagener CI-Lauf oder ein abweichender Release-Zweig stoppt die Veröffentlichung. Vorhandene Release-Staging-Verzeichnisse werden weiterhin nicht überschrieben; nach einem abgebrochenen Signier-/Upload-Schritt den erhaltenen Stand prüfen, bevor erneut veröffentlicht wird.
