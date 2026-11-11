#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="${1:-$ROOT/config/project.json}"; LOCALE="${2:?locale required}"; SCREEN="${3:?screen id required}"
"$ROOT/scripts/check-prerequisites.sh" "$CONFIG"
source "$ROOT/project/automation.sh"
OUT="$(node -e "const c=require(process.argv[1]); console.log(c.paths.captures)" "$CONFIG")/$LOCALE"
PROJECT_DIR="$(cd "$(dirname "$CONFIG")/.." && pwd)"
[[ "$OUT" = /* ]] || OUT="$PROJECT_DIR/$OUT"
mkdir -p "$OUT"; prepare_demo "$LOCALE"; wait_ready; capture_screen "$LOCALE" "$SCREEN"
SERIAL="$(node -e "console.log(require(process.argv[1]).device.serial)" "$CONFIG")"
adb -s "$SERIAL" exec-out screencap -p > "$OUT/$SCREEN.png"
echo "Wrote $OUT/$SCREEN.png"
