#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="${1:-$ROOT/config/project.json}"
for bin in adb ffmpeg ffprobe node; do command -v "$bin" >/dev/null || { echo "missing required command: $bin" >&2; exit 1; }; done
[ -f "$CONFIG" ] || { echo "missing config: $CONFIG (copy config/project.example.json)" >&2; exit 1; }
node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const { validateProjectConfig } = await import(process.argv[2]);
  validateProjectConfig(JSON.parse(readFileSync(process.argv[1], "utf8")));
' "$CONFIG" "$ROOT/scripts/lib/config.mjs" || { echo "invalid project config: $CONFIG" >&2; exit 1; }
SERIAL="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1])).device.serial)" "$CONFIG")"
adb devices | awk 'NR>1 && $2=="device" {print $1}' | grep -Fxq "$SERIAL" || { echo "emulator not connected: $SERIAL" >&2; exit 1; }
adb -s "$SERIAL" emu avd name >/dev/null 2>&1 || { echo "$SERIAL is not an Android emulator; console recording is unavailable" >&2; exit 1; }
echo "Ready: $SERIAL"
