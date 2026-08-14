import test from 'node:test';
import assert from 'node:assert/strict';

import { parseSelectors } from '../scripts/lib/cli.mjs';

const allowed = {
  selectors: ['capture', 'render', 'video'],
  locales: ['en', 'pl'],
};

test('parseSelectors keeps allowed bare selectors and reads an explicit locale', () => {
  assert.deepEqual(
    parseSelectors(['capture', 'video', '--locale', 'pl'], allowed),
    { selectors: ['capture', 'video'], locale: 'pl' },
  );
});

test('parseSelectors rejects bare selectors that are not part of this workflow', () => {
  assert.throws(
    () => parseSelectors(['publish'], allowed),
    /unknown.*selector|selector.*unknown/i,
  );
});

test('parseSelectors rejects unknown and missing locale selectors', () => {
  assert.throws(
    () => parseSelectors(['capture', '--locale', 'de'], allowed),
    /unknown.*locale|locale.*unknown/i,
  );

  assert.throws(
    () => parseSelectors(['capture', '--locale'], allowed),
    /locale.*value|value.*locale/i,
  );
});
