import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateProjectConfig,
  validateTimeline,
} from '../scripts/lib/config.mjs';

const validProject = () => ({
  project: {
    id: 'pantry-pal',
    name: 'Pantry Pal',
    androidPackage: 'com.example.pantrypal',
  },
  locales: [
    {
      id: 'en',
      copy: {
        title: 'Plan meals with less waste',
        subtitle: 'Keep your pantry organised.',
      },
    },
    {
      id: 'pl',
      copy: {
        title: 'Planuj posiłki bez marnowania',
        subtitle: 'Uporządkuj swoją spiżarnię.',
      },
    },
  ],
  paths: {
    captures: 'artifacts/store-assets/captures',
    takes: 'artifacts/store-assets/takes',
  },
  device: {
    serial: 'emulator-5554',
  },
});

test('validateProjectConfig accepts a portable project with localized store copy', () => {
  assert.doesNotThrow(() => validateProjectConfig(validProject()));
});

test('validateProjectConfig requires project identity and at least one locale', () => {
  for (const missingField of ['id', 'name', 'androidPackage']) {
    const config = validProject();
    delete config.project[missingField];

    assert.throws(
      () => validateProjectConfig(config),
      new RegExp(`project\\.${missingField}`, 'i'),
    );
  }

  const withoutLocales = validProject();
  withoutLocales.locales = [];
  assert.throws(() => validateProjectConfig(withoutLocales), /locale/i);
});

test('validateProjectConfig requires isolated capture and recording paths plus an ADB device serial', () => {
  for (const missingPath of ['captures', 'takes']) {
    const config = validProject();
    delete config.paths[missingPath];

    assert.throws(
      () => validateProjectConfig(config),
      new RegExp(`paths\\.${missingPath}`, 'i'),
    );
  }

  const withoutSerial = validProject();
  delete withoutSerial.device.serial;
  assert.throws(() => validateProjectConfig(withoutSerial), /device\.serial/i);
});

test('validateProjectConfig rejects duplicate locale IDs and locales without copy', () => {
  const duplicateLocale = validProject();
  duplicateLocale.locales[1].id = 'en';
  assert.throws(() => validateProjectConfig(duplicateLocale), /duplicate.*locale|locale.*duplicate/i);

  const withoutCopy = validProject();
  delete withoutCopy.locales[1].copy;
  assert.throws(() => validateProjectConfig(withoutCopy), /copy.*pl|pl.*copy/i);
});

test('validateTimeline accepts positive scene lengths and a non-negative crossfade', () => {
  assert.doesNotThrow(() =>
    validateTimeline({
      scenes: [
        { id: 'open-recipe', durationMs: 3_000 },
        { id: 'save-recipe', durationMs: 4_000 },
      ],
      crossfadeMs: 500,
    }),
  );
});

test('validateTimeline rejects invalid scene durations, duplicate IDs, and impossible crossfades', () => {
  assert.throws(
    () => validateTimeline({ scenes: [{ id: 'open-recipe', durationMs: 0 }], crossfadeMs: 0 }),
    /duration.*positive|positive.*duration/i,
  );

  assert.throws(
    () => validateTimeline({
      scenes: [
        { id: 'open-recipe', durationMs: 3_000 },
        { id: 'open-recipe', durationMs: 4_000 },
      ],
      crossfadeMs: 0,
    }),
    /duplicate.*scene|scene.*duplicate/i,
  );

  assert.throws(
    () => validateTimeline({
      scenes: [
        { id: 'open-recipe', durationMs: 3_000 },
        { id: 'save-recipe', durationMs: 1_000 },
      ],
      crossfadeMs: 1_000,
    }),
    /crossfade.*(duration|scene)|(duration|scene).*crossfade/i,
  );
});
