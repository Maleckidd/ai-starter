import test from 'node:test';
import assert from 'node:assert/strict';

import { even, featureGraphicLayout, screenshotLayout, videoLayout } from '../scripts/lib/layout.mjs';
import { escapeHtml, hexToRgb, resolveBrand } from '../scripts/lib/brand.mjs';

const phone = { width: 1080, height: 2400, statusBarRows: 66, bottomBarRows: 60 };
const tablet = { width: 1600, height: 2560, statusBarRows: 64, bottomBarRows: 130 };

test('even rounds odd pixel counts up so x264 accepts the dimensions', () => {
  assert.equal(even(455), 456);
  assert.equal(even(456), 456);
});

test('screenshotLayout scales the capture to the frame and converts system-bar rows to canvas pixels', () => {
  const layout = screenshotLayout({ width: 1080, height: 1920, frame: 0.806 }, phone);

  assert.equal(layout.frameWidth, 870);
  assert.equal(layout.cropTop, 53);
  assert.equal(layout.cropBottom, 48);
  // Never taller than the app area of the capture, so system UI cannot show.
  assert.equal(layout.maxFrameHeight, Math.round((2400 - 66 - 60) * (870 / 1080)));
  assert.equal(layout.unit(0.1), 108);
});

test('screenshotLayout keeps one layout across canvas widths', () => {
  const small = screenshotLayout({ width: 1200, height: 1920, frame: 0.93 }, tablet);
  const large = screenshotLayout({ width: 1600, height: 2560, frame: 0.93 }, tablet);

  assert.equal(small.frameWidth, 1116);
  assert.equal(large.frameWidth, 1488);
  assert.equal(large.cropBottom, Math.round(130 * (1488 / 1600)));
});

test('videoLayout places an even-sized device frame on the right of a landscape canvas', () => {
  const layout = videoLayout({ width: 1920, height: 1080 }, phone);

  assert.equal(layout.deviceHeight, 960);
  assert.equal(layout.deviceWidth, 456);
  assert.equal(layout.deviceWidth % 2, 0);
  assert.equal(layout.deviceY, 60);
  assert.ok(layout.deviceX > 1920 / 2, 'device sits in the right half');
  assert.ok(layout.deviceX + layout.deviceWidth < 1920, 'device stays on the canvas');
  assert.deepEqual(layout.crop, { width: 1080, height: 2274, y: 66 });
  assert.ok(layout.copyWidth > 600, 'copy column is wide enough for a headline');
});

test('featureGraphicLayout crops the status bar at the device-frame scale', () => {
  const layout = featureGraphicLayout(phone);

  assert.equal(layout.width, 1024);
  assert.equal(layout.height, 500);
  assert.equal(layout.cropTop, Math.round((layout.deviceWidth / 1080) * 66));
});

test('hexToRgb turns a brand colour into an rgb triple for rgba()', () => {
  assert.equal(hexToRgb('#C84B31'), '200, 75, 49');
  assert.equal(hexToRgb('#ffffff'), '255, 255, 255');
});

test('resolveBrand overlays project colours on the defaults and rejects malformed ones', () => {
  const brand = resolveBrand({ primary: '#C84B31' });
  assert.equal(brand.primary, '#C84B31');
  assert.match(brand.ink, /^#[0-9a-f]{6}$/i);
  assert.equal(brand.background.length, 3);

  assert.throws(() => resolveBrand({ primary: 'red' }), /brand\.primary/);
  assert.throws(() => resolveBrand({ background: ['#fff'] }), /brand\.background/);
});

test('escapeHtml neutralises copy that would otherwise become markup', () => {
  assert.equal(escapeHtml('Tom & "Jerry" <b>'), 'Tom &amp; &quot;Jerry&quot; &lt;b&gt;');
});
