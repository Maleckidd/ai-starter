#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="${1:-$ROOT/config/project.json}"; LOCALE="${2:?locale required}"; SCENE="${3:?scene id required}"
"$ROOT/scripts/check-prerequisites.sh" "$CONFIG"
source "$ROOT/project/automation.sh"
OUT="$(node -e "const c=require(process.argv[1]); console.log(c.paths.takes)" "$CONFIG")/$LOCALE"
PROJECT_DIR="$(cd "$(dirname "$CONFIG")/.." && pwd)"
[[ "$OUT" = /* ]] || OUT="$PROJECT_DIR/$OUT"
mkdir -p "$OUT"
SERIAL="$(node -e "console.log(require(process.argv[1]).device.serial)" "$CONFIG")"
prepare_demo "$LOCALE"; wait_ready
RECORDING=0
stop_recording() {
  if [ "$RECORDING" -eq 1 ]; then adb -s "$SERIAL" emu screenrecord stop >/dev/null 2>&1 || true; RECORDING=0; fi
}
trap stop_recording EXIT INT TERM
adb -s "$SERIAL" emu screenrecord start "$OUT/$SCENE.webm"; RECORDING=1
record_scene "$LOCALE" "$SCENE"
stop_recording
echo "Wrote $OUT/$SCENE.webm"
