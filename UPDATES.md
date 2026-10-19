# Automatische macOS-Updates

Luna verwendet Sparkle 2.10.0 im Hauptprozess. Das Framework wird beim Build aus
seinem offiziellen Release geladen und anhand einer fest hinterlegten SHA-256
geprüft. Die Lizenz liegt im eingebetteten Framework.

- Feed: https://github.com/buschmeierflorian54-lgtm/luna-browser/releases/latest/download/appcast.xml
- Automatische Prüfung alle vier Stunden während Luna läuft; Sparkle verwaltet
  den Zeitplan und Downloads/Installation, wenn möglich im Hintergrund.
- Manuelle Prüfung: App-Menü → **Nach Updates suchen …**.
- Sparkle kann für Abschluss/Neustart oder fehlende Schreibrechte eine Anfrage
  anzeigen. Benutzerpräferenzen von Sparkle haben Vorrang vor den Defaults.
- Archive werden mit Ed25519 signiert. Luna vertraut ausschließlich dem in
  `Info.plist` hinterlegten öffentlichen Schlüssel. Keine GitHub-Tokens im Client.
- Privater Schlüssel: macOS-Schlüsselbund, Sparkle-Account `luna-browser-updates`.
  Nicht löschen: Er wird für zukünftige Releases benötigt. Nicht ins Repo exportieren.
- Keine Übermittlung des optionalen Sparkle-Systemprofils.

## Neue Version veröffentlichen

1. `info.productVersion` in `wails.json` erhöhen (z. B. 1.1.1).
2. `wails build` ausführen, Tests durchführen und Änderungen committen/pushen.
3. `sh scripts/release.sh` auf diesem Mac ausführen. Das Skript prüft die
   App-Signatur und den öffentlichen Schlüssel, erstellt/signiert das Appcast,
   lädt ZIP und Feed in ein Draft-Release und veröffentlicht beide gemeinsam.

Ein Git-Push allein ist **kein** App-Update. Nur veröffentlichte Releases mit
signiertem Archiv und Appcast werden verteilt. Das Skript überschreibt keine
bestehenden Releases. Es verpackt die Architektur des Build-Macs (aktuell arm64).

Die aktuelle App ist ad-hoc codesigniert und nicht Apple-notarisiert. Ed25519
sichert Updates, ersetzt aber keine Developer-ID-Signatur/Notarisierung für die
erste Installation auf fremden Macs. Vor breiter Verteilung Developer ID und
Notarisierung ergänzen. Alte Versionen ohne Sparkle benötigen einmal die neue App.

## Downloadseite und Erstinstallation

GitHub Pages veröffentlicht `docs/` von `main`. Der Download-Dialog erklärt die Terminal-Installation; alternativ gibt es den direkten DMG-Download. `docs/install.sh` lädt die neueste Release-Version, prüft SHA-256 und die App-Signatur und öffnet das Installationsfenster (Luna-Symbol und Ordner „Programme“ zum Hineinziehen); mit `--auto` kopiert es Luna ohne sudo selbst in `/Applications` (ersatzweise `~/Applications`) und legt eine ältere Installation in den Papierkorb. `--verify-only` prüft den vollständigen Download ohne Installation. Bestehende Installationen werden gesichert.

`scripts/release.sh` veröffentlicht auch DMG und SHA256SUMS. `scripts/make-dmg.sh` benötigt eine unveränderte, signierte App. Für bereits laufende Builds die App aus dem Release-ZIP extrahieren, da das dynamische Dock-Icon die lokale Bundle-Signatur verändern kann.
