#!/usr/bin/env bash
# Copy to project/automation.sh and replace every function with your app's flow.
#
# This adapter is the only place that knows the app: its demo state, its
# screens and its coordinates. capture.sh and record.sh source it after
# scripts/lib/adb.sh, so these helpers are available here:
#
#   tap "<x> <y>"   drag x1 y1 x2 y2 [ms]   back   type_text "…"   tap_ui "Label"
#   pixel "<x> <y>"   wait_for_pixel "<x> <y>" rrggbb [settle] [message]
#   app_restart   app_clear   app_start   app_stop   open_link "<uri>"
#   demo_status_bar   demo_status_bar_off   screenshot <file>
#
# Rules that keep takes reproducible:
#   - Wait for a pixel, never for a fixed time, whenever the app has to load.
#   - Keep every coordinate in the landmark block below. A UI change moves
#     them, and a missed tap only shows up when you look at the result.
#   - Coordinates are layout positions for ONE screen size (the capture set).

# --- landmarks (example values for a 1080x2400 phone) -------------------------
HOME_FAB="954 2082"        # last thing painted on the home screen
COLOR_PRIMARY="2f6fed"     # its colour, as pixel() reports it
FIRST_CARD="270 620"

# prepare_demo <locale> — put the app into the showcase state, from scratch.
# Typical: clear data, seed demo content (deep link, test-only import, restore
# a backup through the UI), switch the UI language, then cold start.
prepare_demo() {
  : "locale: $1"
  # app_clear
  # demo_status_bar
  # app_restart
}

# wait_ready — block until the app's home screen is really there.
wait_ready() {
  :
  # wait_for_pixel "$HOME_FAB" "$COLOR_PRIMARY" 1.5 "the app never reached the home screen"
}

# capture_screen <locale> <screen-id> — navigate to one still. Called once per
# id, in the order given on the command line, without a restart in between.
capture_screen() {
  case "$2" in
    # 01-home) ;;                                  # already there
    # 02-list) tap "$FIRST_CARD"; sleep 1.5 ;;
    *) : ;;
  esac
}

# before_scene <locale> <take-id> — optional. Runs before the recorder starts:
# navigation that should not be in the shot, burning one-time hints.
before_scene() {
  :
}

# record_scene <locale> <take-id> — the action, performed while recording.
# Leave a beat before the first tap and after the last one; the storyboard's
# inMs/outMs trim to the part worth showing.
record_scene() {
  case "$2" in
    # browse) sleep 1.2; drag 540 1800 540 700 900; sleep 1.8 ;;
    *) sleep 2 ;;
  esac
}
