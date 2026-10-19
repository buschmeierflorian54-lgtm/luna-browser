#!/bin/bash
# Usage: make-dmg.sh pristine.app output-directory
set -euo pipefail
app=$1
output=$2
codesign --verify --deep --strict "$app"
mkdir -p "$output"
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
ditto "$app" "$stage/Luna Browser.app"
ln -s /Applications "$stage/Programme"
printf 'Luna Browser installieren\n\nZiehe Luna Browser.app auf Programme. Starte danach Luna aus dem Programme-Ordner.\n\nApple Silicon, macOS 13 oder neuer. Noch nicht Apple-notarisiert.\nFalls macOS den Start blockiert, prüfe die Meldung in Systemeinstellungen > Datenschutz & Sicherheit.\n\nhttps://lunaai.dev/\n' > "$stage/Installation.txt"
hdiutil create -volname 'Luna Browser' -srcfolder "$stage" -format UDZO -ov "$output/Luna-Browser-macos-arm64.dmg"
(cd "$output" && shasum -a 256 Luna-Browser-macos-arm64.dmg > SHA256SUMS)
