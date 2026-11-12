#!/usr/bin/env bash
# Records raw screen takes: the inputs for build-promo-video.mjs.
#
#   bash scripts/record.sh config/project.json en browse plan
#   SKIP_PREPARE=1 bash scripts/record.sh config/project.json en plan
#
# The app is prepared once, then each take is reached by navigating inside the
# running app (the adapter's optional before_scene) and recorded while
# record_scene drives it. Takes land in <takes>/<locale>/<id>.webm.
#
# This uses the *emulator console* recorder (`adb emu screenrecord`), not
# `adb shell screenrecord`: on an emulator the on-device one can capture a
# single frame and write a file with no timing. Frame rate depends on how fast
# the emulator renders — start it with `-gpu host`, or expect a slideshow.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="${1:-$ROOT/config/project.json}"
LOCALE="${2:?usage: record.sh <config> <locale> <take-id>...}"
[ "$#" -ge 3 ] || { echo "usage: record.sh <config> <locale> <take-id>..." >&2; exit 1; }
shift 2

# shellcheck source=lib/session.sh
source "$ROOT/scripts/lib/session.sh"
session_start "$CONFIG"

OUT="$(project_path "$(cfg 'c.paths.takes')")/$LOCALE"
mkdir -p "$OUT"

RECORDING=0
stop_recording() {
  if [ "$RECORDING" -eq 1 ]; then
    adb emu screenrecord stop >/dev/null 2>&1 || true
    RECORDING=0
  fi
}
trap stop_recording EXIT INT TERM

if [ "${SKIP_PREPARE:-0}" != 1 ]; then
  prepare_demo "$LOCALE"
  wait_ready
fi

for SCENE in "$@"; do
  # Navigation that should not be in the shot happens before the recorder starts.
  if has_hook before_scene; then before_scene "$LOCALE" "$SCENE"; fi

  rm -f "$OUT/$SCENE.webm"
  adb emu screenrecord start "$OUT/$SCENE.webm" >/dev/null
  RECORDING=1
  sleep 0.8
  record_scene "$LOCALE" "$SCENE"
  sleep 0.6
  stop_recording
  sleep 2 # the muxer keeps writing after the console call returns

  [ -s "$OUT/$SCENE.webm" ] || { echo "no recording was written for $SCENE" >&2; exit 1; }
  # A take that looks fine frame by frame can still be a slideshow.
  FRAMES="$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of default=nw=1:nk=1 "$OUT/$SCENE.webm")"
  SECONDS_LONG="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT/$SCENE.webm")"
  FPS="$(awk -v f="$FRAMES" -v s="$SECONDS_LONG" 'BEGIN { if (s > 0) printf "%.1f", f / s; else print "0" }')"
  echo "Wrote $OUT/$SCENE.webm (${SECONDS_LONG}s, ${FPS} fps)"
  if awk -v fps="$FPS" 'BEGIN { exit !(fps < 15) }'; then
    echo "  warning: under 15 fps — restart the emulator with -gpu host before using this take" >&2
  fi
done
