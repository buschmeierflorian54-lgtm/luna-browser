# Gemeinsame Updates: macOS und Windows

Ab dem gemeinsamen Projekt ersetzt [docs/RELEASES.md](docs/RELEASES.md) den bisherigen
Mac-only-Release-Ablauf. `scripts/release.sh RUN_ID` verarbeitet ausschließlich einen
vollständig erfolgreichen CI-Lauf für beide Plattformen und bereitet ein Draft-Release vor.
Mit `--publish` wird dieses Release nach allen Uploads gemeinsam sichtbar.
Windows ist weiterhin **experimentell / instabil**.

macOS nutzt den bestehenden Sparkle-Schlüssel; Windows prüft ein signiertes Manifest
mit demselben öffentlichen Ed25519-Schlüssel, prüft SHA-256 und Größe des ZIPs und
installiert nach bewusstem Klick auf das Update. Beide Clients nutzen dasselbe
GitHub-Latest-Release. Ein Release ist gleichzeitig verfügbar; die einzelnen Geräte
finden es bei der nächsten Prüfung (oder sofort über „Nach Updates suchen“).

Der private Schlüssel verbleibt im Schlüsselbund dieses Macs. CI erhält keine
privaten Schlüssel. Während der Testphase werden nur CI-Artefakte erzeugt; ein Push
allein veröffentlicht weiterhin **kein** Update.

## Bestehende macOS-Technik


Luna verwendet Sparkle 2.10.0 im Hauptprozess. Das Framework wird beim Build aus
seinem offiziellen Release geladen und anhand einer fest hinterlegten SHA-256
geprüft. Die Lizenz liegt im eingebetteten Framework.

- Feed: https://github.com/fcore247/luna-browser/releases/latest/download/appcast.xml
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

## Downloadseite und Erstinstallation

GitHub Pages veröffentlicht `docs/` von `main`. Der Download-Dialog erklärt die Terminal-Installation; alternativ gibt es den direkten DMG-Download. `docs/install.sh` lädt die neueste Release-Version, prüft SHA-256 und die App-Signatur und öffnet das Installationsfenster (Luna-Symbol und Ordner „Programme“ zum Hineinziehen); mit `--auto` kopiert es Luna ohne sudo selbst in `/Applications` (ersatzweise `~/Applications`) und legt eine ältere Installation in den Papierkorb. `--verify-only` prüft den vollständigen Download ohne Installation. Bestehende Installationen werden gesichert.

`scripts/release.sh` veröffentlicht auch DMG und SHA256SUMS. `scripts/make-dmg.sh` benötigt eine unveränderte, signierte App. Für bereits laufende Builds die App aus dem Release-ZIP extrahieren, da das dynamische Dock-Icon die lokale Bundle-Signatur verändern kann.

Der Text jedes GitHub-Releases (mit dem Installationsbefehl) steht in `scripts/release-notes.md`; `scripts/release.sh` übernimmt ihn. Die DMG soll nicht einzeln aus dem Browser geladen werden, solange Luna nicht notarisiert ist.
