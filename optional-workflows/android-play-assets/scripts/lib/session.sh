# shellcheck shell=bash
#
# What capture.sh and record.sh do before they touch the device: read the
# config, run the preflight, pin the device, check its screen against the
# capture set, and load the helpers and the project adapter.
#
#   source "$ROOT/scripts/lib/session.sh"
#   session_start "$CONFIG"

# cfg <js expression over `c`> — one value out of the project config.
cfg() { node -e "const c=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); const v=($1); if (v !== undefined && v !== null) console.log(v)" "$CONFIG"; }

# project_path <config path value> — relative paths are relative to the
# directory that holds config/.
project_path() {
  case "$1" in
    /*) printf '%s\n' "$1" ;;
    *) printf '%s\n' "$PROJECT_DIR/$1" ;;
  esac
}

session_start() {
  CONFIG="$1"
  bash "$ROOT/scripts/check-prerequisites.sh" "$CONFIG"
  CONFIG="$(cd "$(dirname "$CONFIG")" && pwd)/$(basename "$CONFIG")"
  PROJECT_DIR="$(cd "$(dirname "$CONFIG")/.." && pwd)"

  # With two emulators up, letting adb pick "the only device" is how a take
  # gets recorded on the one that was never reset. Pin it once, for every call.
  ANDROID_SERIAL="$(cfg 'c.device.serial')"
  APP_PACKAGE="$(cfg 'c.project.androidPackage')"
  APP_ACTIVITY="$(cfg 'c.project.activity')"
  export ANDROID_SERIAL APP_PACKAGE APP_ACTIVITY

  CAPTURE_SET="${CAPTURE_SET:-$(cfg 'Object.keys(c.captureSets)[0]')}"
  local want have
  want="$(cfg "c.captureSets['$CAPTURE_SET'] && c.captureSets['$CAPTURE_SET'].width + 'x' + c.captureSets['$CAPTURE_SET'].height")"
  [ -n "$want" ] || { echo "unknown capture set: $CAPTURE_SET" >&2; exit 1; }
  # `wm size` prints the physical size and, under it, any override in effect.
  have="$(adb shell wm size | tr -d '\r' | awk 'END {print $NF}')"
  if [ "$have" != "$want" ]; then
    echo "$ANDROID_SERIAL is ${have}, but capture set \"$CAPTURE_SET\" is ${want}." >&2
    echo "Landmarks and crops are measured for ${want}: use a matching emulator, run" >&2
    echo "\"adb -s $ANDROID_SERIAL shell wm size ${want}\", or fix captureSets in the config." >&2
    exit 1
  fi

  # shellcheck source=adb.sh
  source "$ROOT/scripts/lib/adb.sh"
  [ -f "$ROOT/project/automation.sh" ] || {
    echo "missing project/automation.sh (copy project/automation.example.sh)" >&2
    exit 1
  }
  # shellcheck disable=SC1091
  source "$ROOT/project/automation.sh"
}

# has_hook <function> — adapters may leave optional hooks out.
has_hook() { declare -F "$1" >/dev/null; }
