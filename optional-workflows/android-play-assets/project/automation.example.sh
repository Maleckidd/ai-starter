#!/usr/bin/env bash
# Copy to project/automation.sh and replace every function with your app's flow.
# This adapter is intentionally the only place that knows app state or coordinates.
set -euo pipefail

prepare_demo() { : "Prepare repeatable content for locale $1"; }
wait_ready() { : "Wait until your app's home screen is ready"; }
capture_screen() { : "Navigate to capture $2 for locale $1"; }
record_scene() { : "Drive scene $2 for locale $1 while the core records"; }
