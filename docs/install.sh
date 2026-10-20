#!/bin/bash
# Luna Browser installer. No sudo and no changes to Gatekeeper.
# Standard: lädt und prüft Luna und öffnet das Installationsfenster (Luna-Symbol + Programme-Ordner zum Hineinziehen).
# --auto: kopiert Luna selbst in den Programme-Ordner. --verify-only: prüft nur.
set -euo pipefail
fail() { printf '\nInstallation abgebrochen: %s\n' "$*" >&2; exit 1; }
[[ $(uname -s) == Darwin ]] || fail 'Luna benötigt macOS.'
[[ $(uname -m) == arm64 ]] || fail 'Bitte auf einem Apple-Silicon-Mac im nativen Terminal ausführen.'
major=$(sw_vers -productVersion | cut -d. -f1)
[[ $major -ge 13 ]] || fail 'macOS 13 oder neuer erforderlich.'
mode=${1:-install}
[[ $mode == install || $mode == --auto || $mode == --verify-only ]] || fail 'Unbekannte Option.'
if [[ $mode == --auto ]] && { pgrep -x 'Luna Browser' || pgrep -x browser-mac; } >/dev/null; then fail 'Bitte Luna vollständig beenden und den Befehl erneut ausführen.'; fi
work=$(mktemp -d)
mounted=false
cleanup() { if $mounted; then hdiutil detach "$work/volume" -quiet || true; fi; rm -rf "$work"; }
trap cleanup EXIT
fetch() { curl --fail --location --retry 2 --connect-timeout 20 --max-time 600 --proto '=https' --proto-redir '=https' "$1" -o "$2"; }
repo=https://github.com/fcore247/luna-browser
printf 'Aktuelle Luna-Version ermitteln …\n'
fetch https://api.github.com/repos/fcore247/luna-browser/releases/latest "$work/release.json"
tag=$(/usr/bin/plutil -extract tag_name raw -o - "$work/release.json")
[[ $tag =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail 'Ungültige Versionsinformation.'
asset=Luna-Browser-macos-arm64.dmg
printf 'Luna %s herunterladen …\n' "$tag"
fetch "$repo/releases/download/$tag/$asset" "$work/$asset"
fetch "$repo/releases/download/$tag/SHA256SUMS" "$work/SHA256SUMS"
expected=$(awk '$2 == "Luna-Browser-macos-arm64.dmg" {print $1}' "$work/SHA256SUMS")
[[ $expected =~ ^[a-f0-9]{64}$ ]] || fail 'Keine eindeutige Prüfsumme vorhanden.'
actual=$(shasum -a 256 "$work/$asset" | awk '{print $1}')
[[ $actual == "$expected" ]] || fail 'Prüfsumme stimmt nicht überein.'
mkdir "$work/volume"
hdiutil attach "$work/$asset" -readonly -nobrowse -mountpoint "$work/volume" -quiet
mounted=true
# Ältere Downloads heißen noch browser-mac.app; installiert wird immer „Luna Browser.app“.
source_app="$work/volume/Luna Browser.app"
[[ -d $source_app ]] || source_app="$work/volume/browser-mac.app"
[[ $(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$source_app/Contents/Info.plist") == com.wails.browser-mac ]] || fail 'Unerwartete App im Download.'
codesign --verify --deep --strict "$source_app" || fail 'App-Signatur ungültig.'
if [[ $mode == --verify-only ]]; then printf 'Download, Prüfsumme, DMG und App-Signatur erfolgreich geprüft. Nichts installiert.\n'; exit 0; fi
if [[ $mode == install ]]; then
 # Das Installationsfenster öffnen: Der Nutzer zieht Luna selbst in den Programme-Ordner.
 # Danach nimmt dieses Skript der kopierten App die Download-Markierung ab, damit macOS sie ohne Schadsoftware-Meldung startet.
 mkdir -p "$HOME/Downloads"
 dmg="$HOME/Downloads/$asset"
 new_version=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$source_app/Contents/Info.plist")
 cp -f "$work/$asset" "$dmg" || fail 'Das Installationsabbild konnte nicht gespeichert werden.'
 hdiutil detach "$work/volume" -quiet || true
 mounted=false
 printf '\nLuna ist bereit. Es öffnen sich zwei Fenster:\n'
 printf '  1. der Ordner „Programme“\n  2. ein Fenster mit dem Luna-Symbol\n'
 printf 'Ziehe „Luna Browser“ aus dem Luna-Fenster in den Ordner „Programme“.\n'
 printf 'Lass dieses Terminal-Fenster offen: Sobald Luna kopiert ist, räume ich auf und starte sie.\n'
 printf 'Ist schon eine ältere Luna installiert, beende sie vorher und wähle beim Ziehen „Ersetzen“.\n'
 open /Applications || true
 open "$dmg" || printf 'Bitte öffne die Datei %s per Doppelklick.\n' "$dmg"
 target=''
 tries=0
 while [[ -z $target && $tries -lt 300 ]]; do
  tries=$((tries + 1))
  for candidate in "/Applications/Luna Browser.app" "$HOME/Applications/Luna Browser.app"; do
   if [[ -x "$candidate/Contents/MacOS/Luna Browser" ]] \
    && [[ $(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$candidate/Contents/Info.plist" 2>/dev/null) == "$new_version" ]] \
    && codesign --verify --deep --strict "$candidate" 2>/dev/null; then target=$candidate; break; fi
  done
  [[ -n $target ]] || sleep 2
 done
 if [[ -z $target ]]; then
  printf '\nIch habe Luna nicht im Ordner „Programme“ gefunden. Ziehe sie hinein und führe danach diesen Befehl aus:\n'
  printf '  xattr -dr com.apple.quarantine "/Applications/Luna Browser.app"\n'
  exit 0
 fi
 xattr -dr com.apple.quarantine "$target" 2>/dev/null || true
 hdiutil detach "/Volumes/Luna Browser" -quiet 2>/dev/null || true
 printf '\nLuna ist installiert: %s\nViel Freude damit!\n' "$target"
 open "$target" || true
 exit 0
fi
# Ziel: der Programme-Ordner des Macs. Ist er für dich nicht beschreibbar, nimmt Luna deinen persönlichen (~/Applications).
if [[ -w /Applications ]]; then apps=/Applications; else apps="$HOME/Applications"; mkdir -p "$apps"; fi
stage=$(mktemp -d "$apps/.luna-install.XXXXXX")
if ! ditto "$source_app" "$stage/Luna Browser.app"; then rm -rf "$stage"; fail 'App konnte nicht kopiert werden.'; fi
destination="$apps/Luna Browser.app"
# Frühere Installationen (auch unter dem alten Namen browser-mac.app) wandern in den Papierkorb und lassen sich von dort zurückholen.
backup=''
for old in "$destination" "$apps/browser-mac.app" "$HOME/Applications/Luna Browser.app" "$HOME/Applications/browser-mac.app"; do
 if [[ -e $old ]]; then
  trashed="$HOME/.Trash/Luna-vorher-$(date +%Y%m%d-%H%M%S)-$$-$RANDOM.app"
  mv "$old" "$trashed"
  [[ -n $backup ]] || { backup=$trashed; backup_from=$old; }
 fi
done
if ! mv "$stage/Luna Browser.app" "$destination"; then
 [[ -z $backup ]] || mv "$backup" "$backup_from"
 rm -rf "$stage"
 fail 'Installation fehlgeschlagen; vorherige Version wiederhergestellt.'
fi
rmdir "$stage"
printf '\nLuna wurde installiert: %s\n' "$destination"
[[ -z $backup ]] || printf 'Vorherige Version liegt im Papierkorb: %s\n' "$backup"
printf 'Falls macOS den ersten Start blockiert: Systemeinstellungen → Datenschutz & Sicherheit öffnen und die Meldung prüfen.\n'
open "$destination" || printf 'Bitte Luna im Finder aus deinem Programme-Ordner starten.\n'
