# shellcheck shell=bash
#
# adb helpers for project/automation.sh. Sourced by capture.sh and record.sh
# before the adapter, so every function here is available inside it.
#
# They work the way a person would: taps at coordinates, and reading pixels
# back off the screen to find out what happened. That is deliberate — a release
# build is not debuggable, so there is no `run-as`, no pushing a database in.
#
# Expects, exported by lib/session.sh:
#   ANDROID_SERIAL  the device every adb call goes to
#   APP_PACKAGE     the Android application id
#   APP_ACTIVITY    launcher activity (optional), e.g. ".MainActivity"

# --- input -------------------------------------------------------------------
#
# A landmark is one "x y" string, e.g. HOME_FAB="954 2082". Keep them together
# at the top of the adapter: any UI change moves them, and a missed tap only
# shows up when you look at the result.

# tap <landmark>
tap() {
  local x y
  read -r x y <<<"$1"
  adb shell input tap "$x" "$y"
}

# drag <x1> <y1> <x2> <y2> [ms] — long durations keep a list from flinging
# past the frame you want to land on, which is what makes a take reproducible.
drag() { adb shell input swipe "$1" "$2" "$3" "$4" "${5:-900}"; }

# back — the system back gesture.
back() { adb shell input keyevent KEYCODE_BACK; }

# type_text <text> — into the focused field. Spaces are sent as %s.
type_text() { adb shell input text "${1// /%s}"; }

# tap_ui <text> — taps the element with exactly this text or content
# description; fails when the screen has none. For system screens (file
# pickers, permission dialogs): their layout depends on how they were last
# used, so a landmark will not do.
tap_ui() {
  local at
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  at="$(adb shell cat /sdcard/ui.xml | perl -e '
    my $want = shift; local $/; my $xml = <STDIN>;
    for my $node ($xml =~ /<node [^>]*>/g) {
      next unless $node =~ /(?:text|content-desc)="\Q$want\E"/;
      next unless $node =~ /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/;
      printf "%d %d", ($1 + $3) / 2, ($2 + $4) / 2;
      exit;
    }' "$1")"
  [ -n "$at" ] || return 1
  tap "$at"
}

# --- reading the screen ------------------------------------------------------

# pixel <landmark> — that screen pixel as "rrggbb". Roughly a second per call.
pixel() {
  local x y
  read -r x y <<<"$1"
  adb exec-out screencap -p |
    ffmpeg -v error -i - -vf "crop=w=1:h=1:x=$x:y=$y" -f rawvideo -pix_fmt rgb24 - |
    od -An -tx1 | tr -d ' \n'
}

# screenshot <file> — the whole screen, for eyeballing what a script saw.
screenshot() { adb exec-out screencap -p >"$1"; }

# wait_for_pixel <landmark> <rrggbb> [settle-seconds] [failure message] [tries]
#
# Polls until that pixel is that colour, then waits `settle` seconds more for
# whatever is still decoding.
#
# Use this instead of `sleep` for anything that waits on the app. A cold start
# on a loaded host can take 20 s, and taps sent into the launch splash land on
# whatever appears next — which produces a session that looks plausible until
# you watch it.
wait_for_pixel() {
  local landmark="$1" want="$2" settle="${3:-1}" msg="${4:-screen never became ready}" tries="${5:-40}" i
  for ((i = 0; i < tries; i++)); do
    if [ "$(pixel "$landmark")" = "$want" ]; then
      sleep "$settle"
      return 0
    fi
    sleep 1
  done
  echo "$msg (pixel $landmark is $(pixel "$landmark"), wanted $want)" >&2
  return 1
}

# --- app lifecycle -----------------------------------------------------------

app_stop() { adb shell am force-stop "$APP_PACKAGE"; }

app_start() {
  if [ -n "${APP_ACTIVITY:-}" ]; then
    adb shell am start -n "$APP_PACKAGE/$APP_ACTIVITY" >/dev/null
  else
    adb shell monkey -p "$APP_PACKAGE" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  fi
}

# app_clear — wipes the app's data. Also resets any "seen it once" flags, so
# one-time hints and onboarding come back: burn them before recording.
app_clear() { adb shell pm clear "$APP_PACKAGE" >/dev/null; }

# app_restart — a cold start. Landing on the home screen this way is more
# reliable than pressing Back an assumed number of times.
app_restart() {
  app_stop
  sleep 1
  app_start
}

# open_link <uri> — a deep link into the app, when it has them. The most
# reliable navigation there is: no coordinates involved.
open_link() { adb shell am start -a android.intent.action.VIEW -d "$1" "$APP_PACKAGE" >/dev/null; }

# --- presentation ------------------------------------------------------------

# demo_status_bar — light theme and a status bar fit for a recording: 9:30,
# full battery, full wifi, no notification icons. Changes global settings on
# the device; demo_status_bar_off undoes it.
#
# A VPN shield or wifi warning can survive this. It does not matter — every
# renderer crops the status bar off.
demo_status_bar() {
  adb shell cmd uimode night no >/dev/null
  adb shell settings put global sysui_demo_allowed 1
  local cmd
  for cmd in \
    "command enter" \
    "command clock -e hhmm 0930" \
    "command battery -e level 100 -e plugged false" \
    "command network -e wifi show -e level 4 -e mobile hide" \
    "command notifications -e visible false"; do
    # shellcheck disable=SC2086
    adb shell am broadcast -a com.android.systemui.demo -e $cmd >/dev/null
  done
}

demo_status_bar_off() {
  adb shell am broadcast -a com.android.systemui.demo -e command exit >/dev/null
}
