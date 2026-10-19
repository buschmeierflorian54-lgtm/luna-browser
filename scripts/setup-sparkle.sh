#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
archive=build/sparkle/package.tar.xz
mkdir -p build/sparkle
if [ ! -f "$archive" ]; then
  curl --fail --location --proto '=https' --proto-redir '=https' https://github.com/sparkle-project/Sparkle/releases/download/2.10.0/Sparkle-2.10.0.tar.xz -o "$archive"
fi
printf '%s  %s\n' c2bf58aa8387266ac179357b1415d6f2635f044da8be41042af32425dae6da0c "$archive" | shasum -a 256 -c -
if [ ! -d build/sparkle/Sparkle.framework ]; then tar -xJf "$archive" -C build/sparkle; fi
