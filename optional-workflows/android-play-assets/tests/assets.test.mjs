import test from 'node:test';
import assert from 'node:assert/strict';

import {
  capturePath,
  validateCaptureSets,
  validateFeatureGraphic,
  validateScreenshots,
  validateStoryboard,
} from '../scripts/lib/config.mjs';
import { takeOption } from '../scripts/lib/cli.mjs';
import { chromeArgs, findChrome } from '../scripts/lib/render.mjs';

const project = () => ({
  project: { id: 'example', name: 'Example App', androidPackage: 'com.example.app' },
  locales: [
    { id: 'en', copy: { title: 'Example' } },
    { id: 'pl', copy: { title: 'Przykład' } },
  ],
  paths: { captures: 'artifacts/captures', takes: 'artifacts/takes', output: 'artifacts/output' },
  device: { serial: 'emulator-5554' },
  captureSets: {
    phone: { width: 1080, height: 2400, statusBarRows: 66, bottomBarRows: 60 },
    tablet: { width: 1600, height: 2560, statusBarRows: 64, bottomBarRows: 130 },
  },
});

const copy = (headline) => ({ en: { headline, subline: 'x' }, pl: { headline, subline: 'x' } });

const screenshots = () => ({
  forms: {
    phone: { width: 1080, height: 1920, captureSet: 'phone', frame: 0.806 },
    tablet10: { width: 1600, height: 2560, captureSet: 'tablet', frame: 0.93 },
  },
  screens: [
    { id: '01-home', copy: copy('Home') },
    { id: '02-detail', align: 'bottom', copy: copy('Detail') },
  ],
});

test('validateCaptureSets requires at least one set with real dimensions and bar heights', () => {
  assert.doesNotThrow(() => validateCaptureSets(project()));

  const none = project();
  none.captureSets = {};
  assert.throws(() => validateCaptureSets(none), /captureSets/);

  const badRows = project();
  badRows.captureSets.phone.statusBarRows = -1;
  assert.throws(() => validateCaptureSets(badRows), /captureSets\.phone\.statusBarRows/);

  const tooTall = project();
  tooTall.captureSets.phone.bottomBarRows = 2400;
  assert.throws(() => validateCaptureSets(tooTall), /captureSets\.phone/);
});

test('validateScreenshots accepts forms and screens with copy for every locale', () => {
  assert.doesNotThrow(() => validateScreenshots(screenshots(), project()));
});

test('validateScreenshots rejects forms Google Play would refuse', () => {
  const tooNarrow = screenshots();
  tooNarrow.forms.phone = { width: 1000, height: 3000, captureSet: 'phone', frame: 0.8 };
  assert.throws(() => validateScreenshots(tooNarrow, project()), /forms\.phone.*(9:16|aspect)/i);

  const tooLarge = screenshots();
  tooLarge.forms.phone = { width: 2400, height: 4000, captureSet: 'phone', frame: 0.8 };
  assert.throws(() => validateScreenshots(tooLarge, project()), /forms\.phone.*3840/);

  const unknownSet = screenshots();
  unknownSet.forms.phone.captureSet = 'watch';
  assert.throws(() => validateScreenshots(unknownSet, project()), /forms\.phone.*watch/);

  const badFrame = screenshots();
  badFrame.forms.phone.frame = 1.4;
  assert.throws(() => validateScreenshots(badFrame, project()), /forms\.phone\.frame/);
});

test('validateScreenshots rejects screens that would silently drop out of a listing', () => {
  const missingLocale = screenshots();
  delete missingLocale.screens[1].copy.pl;
  assert.throws(() => validateScreenshots(missingLocale, project()), /02-detail.*pl|pl.*02-detail/);

  const duplicate = screenshots();
  duplicate.screens[1].id = '01-home';
  assert.throws(() => validateScreenshots(duplicate, project()), /duplicate.*01-home/i);

  const badAlign = screenshots();
  badAlign.screens[1].align = 'middle';
  assert.throws(() => validateScreenshots(badAlign, project()), /align/);

  const tooFew = screenshots();
  tooFew.screens.length = 1;
  assert.throws(() => validateScreenshots(tooFew, project()), /2.*8|between/);

  const tooMany = screenshots();
  tooMany.screens = Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, copy: copy('x') }));
  assert.throws(() => validateScreenshots(tooMany, project()), /2.*8|between/);
});

test('validateFeatureGraphic needs a captured screen and a tagline per locale', () => {
  const spec = () => ({
    screen: '01-home',
    captureSet: 'phone',
    copy: { en: { tagline: 'Yours. Offline.', points: ['A', 'B'] }, pl: { tagline: 'Twoje. Offline.' } },
  });
  assert.doesNotThrow(() => validateFeatureGraphic(spec(), project()));

  const noScreen = spec();
  delete noScreen.screen;
  assert.throws(() => validateFeatureGraphic(noScreen, project()), /screen/);

  const noTagline = spec();
  delete noTagline.copy.pl.tagline;
  assert.throws(() => validateFeatureGraphic(noTagline, project()), /tagline.*pl|pl.*tagline/);

  const manyPoints = spec();
  manyPoints.copy.en.points = ['A', 'B', 'C', 'D'];
  assert.throws(() => validateFeatureGraphic(manyPoints, project()), /points/);
});

test('validateStoryboard checks every locale and the crossfade against scene lengths', () => {
  const story = () => ({
    crossfadeMs: 500,
    captureSet: 'phone',
    scenes: [
      { id: 'title', card: 'title', durationMs: 2600, copy: copy('Example') },
      { id: 'home', take: 'home', inMs: 600, outMs: 6000, copy: copy('Home') },
    ],
  });
  assert.doesNotThrow(() => validateStoryboard(story(), project()));

  const missingLocale = story();
  delete missingLocale.scenes[0].copy.pl;
  assert.throws(() => validateStoryboard(missingLocale, project()), /title/);

  const shortScene = story();
  shortScene.scenes[1].outMs = 900;
  assert.throws(() => validateStoryboard(shortScene, project()), /crossfade/i);

  const unknownSet = story();
  unknownSet.captureSet = 'watch';
  assert.throws(() => validateStoryboard(unknownSet, project()), /watch/);
});

test('capturePath addresses a raw capture by set, locale and screen id', () => {
  assert.equal(capturePath('/work/captures', 'tablet', 'pl', '01-home'), '/work/captures/tablet/pl/01-home.png');
});

test('takeOption removes a flag and its value so the rest can be parsed as selectors', () => {
  const args = ['phone', '--config', 'config/x.json', '--locale', 'pl'];
  assert.equal(takeOption(args, 'config'), 'config/x.json');
  assert.deepEqual(args, ['phone', '--locale', 'pl']);
  assert.equal(takeOption(args, 'music'), undefined);
  assert.throws(() => takeOption(['--config'], 'config'), /--config/);
});

test('findChrome prefers CHROME_BIN, then the newest headless shell, then Chrome for Testing, then an installed Chrome', () => {
  const pw = '/home/u/Library/Caches/ms-playwright';
  const shell = (build) => `${pw}/${build}/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
  const full = (build) => `${pw}/${build}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
  const system = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const cache = ['chromium-1208', 'chromium-1232', 'chromium_headless_shell-1208', 'chromium_headless_shell-1248', 'firefox-1509'];
  const base = { platform: 'darwin', home: '/home/u', readdir: (dir) => (dir === pw ? cache : []) };
  const only = (...paths) => (p) => paths.includes(p);

  assert.equal(findChrome({ ...base, env: { CHROME_BIN: '/opt/chrome' }, exists: only('/opt/chrome', system) }), '/opt/chrome');
  assert.equal(
    findChrome({ ...base, env: {}, exists: only(system, full('chromium-1232'), shell('chromium_headless_shell-1208'), shell('chromium_headless_shell-1248')) }),
    shell('chromium_headless_shell-1248'),
  );
  assert.equal(
    findChrome({ ...base, env: {}, exists: only(system, full('chromium-1208'), full('chromium-1232')) }),
    full('chromium-1232'),
  );
  assert.equal(findChrome({ ...base, env: {}, exists: only(system) }), system);
  assert.throws(() => findChrome({ ...base, env: {}, exists: () => false }), /CHROME_BIN/);
  assert.throws(() => findChrome({ ...base, env: { CHROME_BIN: '/missing' }, exists: () => false }), /CHROME_BIN.*\/missing/);
});

test('chromeArgs gives the headless shell a profile of its own and leaves full Chrome on its default one', () => {
  const shell = chromeArgs('/x/chrome-headless-shell', { profile: '/tmp/p', shot: '/tmp/s.png', page: '/tmp/page.html', width: 1080, height: 1920 });
  assert.ok(shell.includes('--user-data-dir=/tmp/p'));
  assert.ok(!shell.includes('--headless'));
  assert.ok(shell.includes('--window-size=1080,1920'));
  assert.equal(shell.at(-1), 'file:///tmp/page.html');

  const full = chromeArgs('/x/Google Chrome for Testing', { profile: '/tmp/p', shot: '/tmp/s.png', page: '/tmp/page.html', width: 1080, height: 1920 });
  assert.ok(full.includes('--headless'));
  assert.ok(!full.some((arg) => arg.startsWith('--user-data-dir')));
});
