#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
app="build/bin/browser-mac.app"
sh scripts/setup-sparkle.sh
mkdir -p "$app/Contents/Frameworks"
ditto build/sparkle/Sparkle.framework "$app/Contents/Frameworks/Sparkle.framework"
arch=$(uname -m)
xcrun swiftc -O -target "${arch}-apple-macosx13.0" native/applemodel/main.swift -o "$app/Contents/MacOS/luna-apple-model"
codesign --force --sign - "$app/Contents/MacOS/luna-apple-model"
codesign --force --deep --sign - "$app"
