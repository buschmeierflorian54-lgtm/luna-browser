#!/bin/sh
# Build with a bumped info.productVersion in wails.json, then run this script.
# The private signing key stays in the login Keychain; never commit/export it.
set -eu
cd "$(dirname "$0")/.."
repo=buschmeierflorian54-lgtm/luna-browser
app=build/bin/browser-mac.app
version=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app/Contents/Info.plist")
case "$version" in ''|*[!0-9.]*) echo 'Invalid version' >&2; exit 1;; esac
if [ -n "$(git status --porcelain)" ]; then echo 'Commit the source before publishing.' >&2; exit 1; fi
codesign --verify --deep --strict "$app"
sh scripts/setup-sparkle.sh
expected=$(/usr/libexec/PlistBuddy -c 'Print :SUPublicEDKey' "$app/Contents/Info.plist")
actual=$(build/sparkle/bin/generate_keys --account luna-browser-updates -p)
if [ "$expected" != "$actual" ]; then echo 'Wrong signing key; refusing release.' >&2; exit 1; fi
folder="build/releases/$version"
mkdir -p "$folder"
archive="Luna-Browser-$version-macos-$(uname -m).zip"
ditto -c -k --sequesterRsrc --keepParent "$app" "$folder/$archive"
build/sparkle/bin/generate_appcast --account luna-browser-updates --maximum-deltas 0 --download-url-prefix "https://github.com/$repo/releases/download/v$version/" "$folder"
bash scripts/make-dmg.sh "$app" "$folder"
# Publish all files together from a draft so the feed never points at a missing archive.
gh release create "v$version" "$folder/$archive" "$folder/appcast.xml" "$folder/Luna-Browser-macos-arm64.dmg" "$folder/SHA256SUMS" --repo "$repo" --target "$(git rev-parse HEAD)" --draft --title "Luna Browser $version" --notes "Luna Browser für Apple Silicon ab macOS 13. Automatische, signaturgeprüfte Updates über Sparkle. Erstinstallation nicht Apple-notarisiert."
gh release edit "v$version" --repo "$repo" --draft=false --latest
