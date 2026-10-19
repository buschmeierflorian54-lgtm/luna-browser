#!/bin/bash
# Luna Browser installer. No sudo and no changes to Gatekeeper.
set -euo pipefail
fail() { printf '\nInstallation abgebrochen: %s\n' "$*" >&2; exit 1; }
[[ $(uname -s) == Darwin ]] || fail 'Luna benötigt macOS.'
[[ $(uname -m) == arm64 ]] || fail 'Bitte auf einem Apple-Silicon-Mac im nativen Terminal ausführen.'
major=$(sw_vers -productVersion | cut -d. -f1)
[[ $major -ge 13 ]] || fail 'macOS 13 oder neuer erforderlich.'
mode=${1:-install}
[[ $mode == install || $mode == --verify-only ]] || fail 'Unbekannte Option.'
if [[ $mode == install ]] && { pgrep -x 'Luna Browser' || pgrep -x browser-mac; } >/dev/null; then fail 'Bitte Luna vollständig beenden und den Befehl erneut ausführen.'; fi
work=$(mktemp -d)
mounted=false
cleanup() { if $mounted; then hdiutil detach "$work/volume" -quiet || true; fi; rm -rf "$work"; }
trap cleanup EXIT
fetch() { curl --fail --location --retry 2 --connect-timeout 20 --max-time 600 --proto '=https' --proto-redir '=https' "$1" -o "$2"; }
repo=https://github.com/buschmeierflorian54-lgtm/luna-browser
printf 'Aktuelle Luna-Version ermitteln …\n'
fetch https://api.github.com/repos/buschmeierflorian54-lgtm/luna-browser/releases/latest "$work/release.json"
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
mkdir -p "$HOME/Applications"
stage=$(mktemp -d "$HOME/Applications/.luna-install.XXXXXX")
if ! ditto "$source_app" "$stage/Luna Browser.app"; then rm -rf "$stage"; fail 'App konnte nicht kopiert werden.'; fi
destination="$HOME/Applications/Luna Browser.app"
legacy="$HOME/Applications/browser-mac.app"
backup=''
# Eine frühere Installation unter dem alten Namen wird gesichert und ersetzt.
[[ -e $destination || ! -e $legacy ]] || mv "$legacy" "$destination"
if [[ -e $destination ]]; then
 backup="$HOME/Applications/Luna-Backup-$(date +%Y%m%d-%H%M%S)-$$.app"
 mv "$destination" "$backup"
fi
if ! mv "$stage/Luna Browser.app" "$destination"; then
 [[ -z $backup ]] || mv "$backup" "$destination"
 rm -rf "$stage"
 fail 'Installation fehlgeschlagen; vorherige Version wiederhergestellt.'
fi
rmdir "$stage"
printf '\nLuna wurde installiert: %s\n' "$destination"
[[ -z $backup ]] || printf 'Vorherige Version gesichert: %s\n' "$backup"
printf 'Falls macOS den ersten Start blockiert: Systemeinstellungen → Datenschutz & Sicherheit öffnen und die Meldung prüfen.\n'
open "$destination" || printf 'Bitte Luna im Finder aus deinem Programme-Ordner starten.\n'
