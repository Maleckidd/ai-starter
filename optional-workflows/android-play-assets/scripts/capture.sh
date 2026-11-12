#!/usr/bin/env bash
# Shoots raw screen captures: the inputs for build-screenshots.mjs and
# build-feature-graphic.mjs.
#
#   bash scripts/capture.sh config/project.json en 01-home 02-list
#   CAPTURE_SET=tablet bash scripts/capture.sh config/project.json pl 01-home
#   SKIP_PREPARE=1 bash scripts/capture.sh config/project.json en 03-plan
#
# For each screen id the adapter's capture_screen navigates there, then the
# screen is saved to <captures>/<set>/<locale>/<id>.png.
#
# SKIP_PREPARE=1 leaves the app as it is — for composing a screen by hand
# (scroll position, an open sheet) and shooting exactly that. With an empty
# capture_screen this is a plain "save what is on screen under this id".
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="${1:-$ROOT/config/project.json}"
LOCALE="${2:?usage: capture.sh <config> <locale> <screen-id>...}"
[ "$#" -ge 3 ] || { echo "usage: capture.sh <config> <locale> <screen-id>..." >&2; exit 1; }
shift 2

# shellcheck source=lib/session.sh
source "$ROOT/scripts/lib/session.sh"
session_start "$CONFIG"

OUT="$(project_path "$(cfg 'c.paths.captures')")/$CAPTURE_SET/$LOCALE"
mkdir -p "$OUT"

if [ "${SKIP_PREPARE:-0}" != 1 ]; then
  prepare_demo "$LOCALE"
  wait_ready
fi

for SCREEN in "$@"; do
  capture_screen "$LOCALE" "$SCREEN"
  adb exec-out screencap -p >"$OUT/$SCREEN.png"
  echo "Wrote $OUT/$SCREEN.png"
done
