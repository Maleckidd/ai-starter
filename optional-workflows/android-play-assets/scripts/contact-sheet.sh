#!/usr/bin/env bash
# Lays a take (or the finished video) out as one image of evenly spaced frames,
# so it can be checked — and its in/out points picked — without scrubbing.
#
#   bash scripts/contact-sheet.sh artifacts/store-assets/takes/en/browse.webm
#   bash scripts/contact-sheet.sh take.webm 0.25 sheet.jpg
#
# Frames run left to right, top to bottom, six to a row; frame N (from 0) is at
# N * <every> seconds. That is how a storyboard's inMs/outMs get chosen: find
# the frame where the action starts and the one where it has settled.
set -euo pipefail
IN="${1:?usage: contact-sheet.sh <video> [seconds-between-frames=0.5] [out.jpg]}"
EVERY="${2:-0.5}"
OUT="${3:-${IN%.*}-sheet.jpg}"
COLS=6
LENGTH="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$IN")"
ROWS="$(awk -v d="$LENGTH" -v e="$EVERY" -v c="$COLS" 'BEGIN { n = int(d / e) + 1; r = int((n + c - 1) / c); print (r < 1 ? 1 : r) }')"
ffmpeg -y -v error -i "$IN" -vf "fps=1/$EVERY,scale=270:-2,tile=${COLS}x${ROWS}:padding=6:color=white" -frames:v 1 -update 1 "$OUT"
echo "Wrote $OUT (${LENGTH}s, one frame every ${EVERY}s, ${COLS} per row)"
