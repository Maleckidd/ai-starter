# Android Play assets (optional workflow)

This is an opt-in, stack-agnostic capture toolkit for Android/Google Play material. It does not build an app, upload to Play, or know anything about a product's data, routes, copy, package names, or UI coordinates.

## What it provides

- repeatable raw PNG captures with `adb exec-out screencap`;
- repeatable emulator `.webm` takes through `adb emu screenrecord`;
- preflight checks for ADB, FFmpeg, a selected emulator, and project configuration;
- a deliberately isolated app adapter where each project defines demo state and UI automation.

It is intentionally not a generic replacement for creative direction: composition, copy, device framing and the final FFmpeg/HTML render are project-owned. Raw captures and takes are stable inputs for any renderer.

## Install in a project

Copy this directory into the project that needs store materials. Then:

1. Copy `config/project.example.json` to `config/project.json` and set the package id, locales, paths and emulator serial.
2. Copy `project/automation.example.sh` to `project/automation.sh`, make it executable, and implement its four functions. Keep UI coordinates, test fixtures, deep links, reset logic and readiness checks **only** there.
3. Start a real app build on an Android emulator. For smooth video, start it with `-gpu host`; use gesture navigation and the dimensions declared in the config.
4. Run `bash scripts/check-prerequisites.sh`, then capture with `bash scripts/capture.sh config/project.json en home` or record with `bash scripts/record.sh config/project.json en onboarding`.

`adb emu screenrecord` is emulator-only. A physical device should use a separate recording strategy; the preflight refuses it instead of producing a misleading file.

## Adapter contract

The core sources `project/automation.sh` and calls:

- `prepare_demo <locale>` — reset/seed a repeatable showcase state.
- `wait_ready` — wait for a visual, app-specific readiness condition.
- `capture_screen <locale> <screen-id>` — navigate to a composed still.
- `record_scene <locale> <scene-id>` — perform actions while recording is active.

The adapter may use ADB taps, deep links, test-only seed commands, or manual preparation. It must not be copied from another product unchanged.

## Quality gate

Before rendering/upload: inspect every take, verify locale and no personal/notification data, check music and image rights, and confirm current Play Console requirements. Screenshot images and the YouTube promo URL are uploaded manually.

## Test the portable core

```bash
node --test tests/*.test.mjs
```

The tests do not require an emulator or Android SDK.
