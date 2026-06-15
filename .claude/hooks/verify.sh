#!/usr/bin/env sh
# Stop hook — the mechanical guardrail. When the main agent finishes a turn, this runs the
# project's checks so you never end with broken types or red tests. It covers work done
# OUTSIDE the /feature pipeline too (the reviewer covers work done inside it).
#
# Configure the two commands at bootstrap to mirror CLAUDE.md -> Commands. Until then this
# is a no-op, so a fresh clone never breaks.
#
# Exit 2 = block the stop and feed the failure back to the agent so it fixes things.
# To disable: empty the variables, or remove the Stop hook from .claude/settings.json.

TYPECHECK=""   # e.g. npx tsc --noEmit
TEST=""        # e.g. npm test

fail=0
if [ -n "$TYPECHECK" ]; then
  if ! out=$(eval "$TYPECHECK" 2>&1); then
    fail=1; printf 'Type-check failed:\n%s\n' "$out" >&2
  fi
fi
if [ -n "$TEST" ]; then
  if ! out=$(eval "$TEST" 2>&1); then
    fail=1; printf 'Tests failed:\n%s\n' "$out" >&2
  fi
fi

[ "$fail" -eq 1 ] && exit 2
exit 0
