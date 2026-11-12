import path from 'node:path';

import { resolveScenes } from './video.mjs';

export function validateProjectConfig(config) {
  const project = config?.project;
  for (const key of ['id', 'name', 'androidPackage']) {
    if (!project?.[key]?.trim?.()) throw new Error(`project.${key} is required`);
  }
  for (const key of ['captures', 'takes']) {
    if (!config?.paths?.[key]?.trim?.()) throw new Error(`paths.${key} is required`);
  }
  if (!config?.device?.serial?.trim?.()) throw new Error('device.serial is required');
  if (!Array.isArray(config.locales) || config.locales.length === 0) throw new Error('at least one locale is required');
  const ids = new Set();
  for (const locale of config.locales) {
    if (!locale?.id?.trim?.()) throw new Error('locale.id is required');
    if (ids.has(locale.id)) throw new Error(`duplicate locale id: ${locale.id}`);
    if (!locale?.copy || typeof locale.copy !== 'object' || !Object.values(locale.copy).some((value) => typeof value === 'string' && value.trim())) {
      throw new Error(`locale.copy is required for ${locale.id}`);
    }
    ids.add(locale.id);
  }
  return config;
}

export function validateTimeline(timeline) {
  const scenes = timeline?.scenes;
  if (!Array.isArray(scenes) || scenes.length === 0) throw new Error('at least one scene is required');
  const crossfade = timeline.crossfadeMs ?? 0;
  if (!Number.isFinite(crossfade) || crossfade < 0) throw new Error('crossfadeMs must be non-negative');
  const ids = new Set();
  for (const scene of scenes) {
    if (!scene?.id?.trim?.()) throw new Error('scene.id is required');
    if (ids.has(scene.id)) throw new Error(`duplicate scene id: ${scene.id}`);
    if (!Number.isFinite(scene.durationMs) || scene.durationMs <= 0) throw new Error(`scene.durationMs must be positive for ${scene.id}`);
    ids.add(scene.id);
  }
  for (let i = 0; i < scenes.length - 1; i++) {
    if (crossfade >= scenes[i].durationMs || crossfade >= scenes[i + 1].durationMs) throw new Error('crossfadeMs must be shorter than adjacent scenes');
  }
  return timeline;
}

// --- capture sets --------------------------------------------------------------

const isCount = (value) => Number.isInteger(value) && value >= 0;
const isSize = (value) => Number.isInteger(value) && value > 0;
const hasText = (value) => typeof value === 'string' && value.trim() !== '';

/**
 * A capture set is one kind of raw device capture: its pixel size and the rows
 * of system UI (status bar on top, gesture bar or taskbar at the bottom) that
 * every renderer crops off.
 */
export function validateCaptureSets(config) {
  const sets = config?.captureSets;
  if (!sets || typeof sets !== 'object' || Object.keys(sets).length === 0) {
    throw new Error('captureSets: at least one capture set is required');
  }
  for (const [name, set] of Object.entries(sets)) {
    for (const key of ['width', 'height']) {
      if (!isSize(set?.[key])) throw new Error(`captureSets.${name}.${key} must be a positive integer`);
    }
    for (const key of ['statusBarRows', 'bottomBarRows']) {
      if (!isCount(set[key])) throw new Error(`captureSets.${name}.${key} must be a non-negative integer`);
    }
    if (set.statusBarRows + set.bottomBarRows >= set.height) {
      throw new Error(`captureSets.${name}: the system bars leave no app area`);
    }
  }
  return sets;
}

/** Looks a capture set up by name; with no name, the first one declared. */
export function captureSet(config, name) {
  const sets = validateCaptureSets(config);
  const key = name ?? Object.keys(sets)[0];
  if (!sets[key]) throw new Error(`unknown capture set: ${key} (declared: ${Object.keys(sets).join(', ')})`);
  return { name: key, ...sets[key] };
}

/**
 * Path to a raw capture. Always address captures by screen id rather than by a
 * hand-written filename: screens are numbered in listing order, so inserting
 * one renumbers everything after it, and a stale literal path only fails when
 * the script is next run — months later, right before an upload.
 */
export function capturePath(capturesDir, set, localeId, screenId) {
  return path.join(capturesDir, set, localeId, `${screenId}.png`);
}

const localeIds = (config) => config.locales.map((locale) => locale.id);

// --- screenshots ---------------------------------------------------------------

// Google Play: JPEG or 24-bit PNG, each side 320–3840 px, aspect ratio between
// 16:9 and 9:16, 2–8 screenshots per device type.
const PLAY_MIN_SIDE = 320;
const PLAY_MAX_SIDE = 3840;
const PLAY_MAX_ASPECT = 16 / 9;

export function validateScreenshots(spec, config) {
  const forms = spec?.forms;
  if (!forms || typeof forms !== 'object' || Object.keys(forms).length === 0) {
    throw new Error('screenshots: at least one form is required');
  }
  for (const [name, form] of Object.entries(forms)) {
    for (const key of ['width', 'height']) {
      if (!isSize(form?.[key])) throw new Error(`forms.${name}.${key} must be a positive integer`);
      if (form[key] < PLAY_MIN_SIDE || form[key] > PLAY_MAX_SIDE) {
        throw new Error(`forms.${name}.${key} is ${form[key]}; Google Play accepts ${PLAY_MIN_SIDE}–${PLAY_MAX_SIDE} px`);
      }
    }
    const aspect = Math.max(form.width, form.height) / Math.min(form.width, form.height);
    if (aspect > PLAY_MAX_ASPECT + 1e-9) {
      throw new Error(`forms.${name} is ${form.width}x${form.height}; Google Play needs an aspect ratio between 16:9 and 9:16`);
    }
    if (!(form.frame > 0 && form.frame <= 1)) throw new Error(`forms.${name}.frame must be a fraction of the canvas width, 0–1`);
    if (!config.captureSets?.[form.captureSet]) {
      throw new Error(`forms.${name} uses unknown capture set: ${form.captureSet}`);
    }
  }

  const screens = spec.screens;
  if (!Array.isArray(screens) || screens.length < 2 || screens.length > 8) {
    throw new Error('screens: Google Play takes between 2 and 8 screenshots per device type');
  }
  const ids = new Set();
  for (const screen of screens) {
    if (!hasText(screen?.id)) throw new Error('screen.id is required');
    if (ids.has(screen.id)) throw new Error(`duplicate screen id: ${screen.id}`);
    ids.add(screen.id);
    if (screen.align !== undefined && screen.align !== 'top' && screen.align !== 'bottom') {
      throw new Error(`screen ${screen.id}: align must be "top" or "bottom"`);
    }
    for (const locale of localeIds(config)) {
      if (!hasText(screen.copy?.[locale]?.headline)) {
        throw new Error(`screen ${screen.id} has no headline for locale ${locale}`);
      }
    }
  }
  return spec;
}

// --- feature graphic -----------------------------------------------------------

export function validateFeatureGraphic(spec, config) {
  if (!hasText(spec?.screen)) throw new Error('feature graphic: screen (a captured screen id) is required');
  captureSet(config, spec.captureSet);
  for (const locale of localeIds(config)) {
    const copy = spec.copy?.[locale];
    if (!hasText(copy?.tagline)) throw new Error(`feature graphic: tagline is required for locale ${locale}`);
    const points = copy.points ?? [];
    if (!Array.isArray(points) || points.length > 3 || !points.every(hasText)) {
      throw new Error(`feature graphic: points for locale ${locale} must be at most three short strings`);
    }
  }
  return spec;
}

// --- storyboard ----------------------------------------------------------------

export function validateStoryboard(storyboard, config) {
  captureSet(config, storyboard?.captureSet);
  for (const locale of localeIds(config)) {
    validateTimeline({ scenes: resolveScenes(storyboard, locale), crossfadeMs: storyboard.crossfadeMs ?? 0 });
  }
  return storyboard;
}
