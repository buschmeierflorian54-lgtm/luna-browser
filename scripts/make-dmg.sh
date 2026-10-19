#!/bin/bash
# Usage: make-dmg.sh pristine.app output-directory
# Baut die DMG mit gestaltetem Fenster: Luna-Symbol, Pfeil und der Ordner „Programme“ zum Hineinziehen.
# Das Aussehen setzt der Finder per AppleScript (läuft nur auf einem Mac mit angemeldetem Benutzer).
set -euo pipefail
app=$1
output=$2
here=$(cd "$(dirname "$0")" && pwd)
volume='Luna Browser'
codesign --verify --deep --strict "$app"
mkdir -p "$output"
work=$(mktemp -d)
mount_point="/Volumes/$volume"
cleanup() { hdiutil detach "$mount_point" -quiet 2>/dev/null || true; rm -rf "$work"; }
trap cleanup EXIT
if [[ -e $mount_point ]]; then hdiutil detach "$mount_point" -quiet || { echo "Bitte „$volume“ im Finder auswerfen." >&2; exit 1; }; fi
stage="$work/stage"
mkdir -p "$stage/.background"
ditto "$app" "$stage/Luna Browser.app"
ln -s /Applications "$stage/Programme"
cp "$here/dmg-background.tiff" "$stage/.background/background.tiff"
hdiutil create -volname "$volume" -srcfolder "$stage" -format UDRW -fs HFS+ -ov "$work/rw.dmg" >/dev/null
hdiutil attach "$work/rw.dmg" -readwrite -noverify -noautoopen -mountpoint "$mount_point" >/dev/null
# Fenster: 600 × 400, große Symbole, Hintergrund mit Pfeil. Schlägt das fehl, bleibt die DMG nutzbar, nur schlichter.
osascript <<OSA || echo 'Hinweis: Das Fenster konnte nicht gestaltet werden (Finder-Freigabe?). Die DMG funktioniert trotzdem.' >&2
tell application "Finder"
  tell disk "$volume"
    open
    delay 1
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set the bounds of container window to {200, 120, 800, 550}
    set opts to the icon view options of container window
    set arrangement of opts to not arranged
    set icon size of opts to 128
    set text size of opts to 13
    set background picture of opts to file ".background:background.tiff"
    set position of item "Luna Browser.app" of container window to {170, 215}
    set position of item "Programme" of container window to {430, 215}
    update without registering applications
    delay 1
    close
  end tell
end tell
OSA
sync
hdiutil detach "$mount_point" -quiet || { sleep 2; hdiutil detach "$mount_point" -force -quiet; }
rm -f "$output/Luna-Browser-macos-arm64.dmg"
hdiutil convert "$work/rw.dmg" -format UDZO -imagekey zlib-level=9 -o "$output/Luna-Browser-macos-arm64.dmg" >/dev/null
(cd "$output" && shasum -a 256 Luna-Browser-macos-arm64.dmg > SHA256SUMS)
