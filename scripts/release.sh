#!/bin/sh
# Both platforms must come from the same successful GitHub Actions run.
set -eu
cd "$(dirname "$0")/.."
exec python3 scripts/release.py "$@"
