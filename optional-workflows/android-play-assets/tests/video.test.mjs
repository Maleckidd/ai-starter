import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertTakeCovers,
  crossfadePlan,
  musicFilter,
  musicGainDb,
  parseLeadingSilence,
  parseLoudness,
  resolveScenes,
  sceneFilter,
  xfadeFilter,
} from '../scripts/lib/video.mjs';

const storyboard = () => ({
  crossfadeMs: 500,
  scenes: [
    { id: 'title', card: 'title', durationMs: 2600, copy: { en: { headline: 'Example', subline: 'Hello' }, pl: { headline: 'Example', subline: 'Cześć' } } },
    { id: 'home', take: 'home', inMs: 600, outMs: 6000, copy: { en: { headline: 'One', subline: 'A' }, pl: { headline: 'Jeden', subline: 'A' } } },
    { id: 'end', card: 'end', copy: { en: { headline: 'Example' }, pl: { headline: 'Example' } } },
  ],
});

test('resolveScenes turns cards and take ranges into durations with one locale of copy', () => {
  const scenes = resolveScenes(storyboard(), 'pl');

  assert.deepEqual(scenes.map((s) => [s.id, s.kind, s.durationMs]), [
    ['title', 'card', 2600],
    ['home', 'take', 5400],
    ['end', 'card', 3000],
  ]);
  assert.equal(scenes[1].copy.headline, 'Jeden');
  assert.equal(scenes[1].take, 'home');
  assert.equal(scenes[1].inMs, 600);
  assert.equal(scenes[2].copy.subline, '');
});

test('resolveScenes fails on missing copy, empty ranges and scenes that are neither card nor take', () => {
  const missingCopy = storyboard();
  delete missingCopy.scenes[1].copy.pl;
  assert.throws(() => resolveScenes(missingCopy, 'pl'), /copy.*home|home.*copy/i);

  const emptyRange = storyboard();
  emptyRange.scenes[1].outMs = 600;
  assert.throws(() => resolveScenes(emptyRange, 'en'), /home.*(inMs|outMs)|(inMs|outMs).*home/i);

  const neither = storyboard();
  neither.scenes[1] = { id: 'home', copy: neither.scenes[1].copy };
  assert.throws(() => resolveScenes(neither, 'en'), /home.*(card|take)/i);

  const both = storyboard();
  both.scenes[1].card = 'title';
  assert.throws(() => resolveScenes(both, 'en'), /home.*(card|take)/i);
});

test('crossfadePlan starts each transition one crossfade before the running end', () => {
  assert.deepEqual(crossfadePlan([2600, 5400, 3600], 500), {
    offsetsMs: [2100, 7000],
    totalMs: 10600,
  });
  assert.deepEqual(crossfadePlan([4000], 500), { offsetsMs: [], totalMs: 4000 });
});

test('xfadeFilter chains every scene into one labelled output', () => {
  const { steps, output } = xfadeFilter(crossfadePlan([2600, 5400, 3600], 500), 500);

  assert.equal(output, '[v]');
  assert.deepEqual(steps, [
    '[0:v][1:v]xfade=transition=fade:duration=0.500:offset=2.100[v1]',
    '[v1][2:v]xfade=transition=fade:duration=0.500:offset=7.000[v]',
  ]);
});

test('xfadeFilter passes a single scene through untouched', () => {
  assert.deepEqual(xfadeFilter(crossfadePlan([4000], 500), 500), { steps: [], output: '0:v' });
});

test('sceneFilter trims, crops the system bars, scales into the device frame and masks it', () => {
  const filter = sceneFilter({
    inMs: 600,
    durationMs: 5400,
    fps: 30,
    layout: { deviceWidth: 456, deviceHeight: 960, deviceX: 1232, deviceY: 60, crop: { width: 1080, height: 2274, y: 66 } },
  });

  assert.match(filter, /\[1:v\]trim=start=0\.600:duration=5\.400,setpts=PTS-STARTPTS/);
  assert.match(filter, /fps=30,crop=1080:2274:0:66,scale=456:960/);
  assert.match(filter, /\[vid\]\[2:v\]alphamerge\[vidm\]/);
  assert.match(filter, /\[0:v\]\[vidm\]overlay=1232:60/);
  assert.match(filter, /\[out\]$/);
});

test('assertTakeCovers refuses a scene that runs past the end of its take', () => {
  assert.doesNotThrow(() => assertTakeCovers({ id: 'home', take: 'home', outMs: 6000 }, 6.4));
  assert.throws(
    () => assertTakeCovers({ id: 'home', take: 'home', outMs: 6000 }, 5.2),
    /home.*6\.00.*5\.20/s,
  );
});

test('parseLeadingSilence only counts silence that starts at zero', () => {
  const leading = [
    '[silencedetect @ 0x1] silence_start: 0',
    '[silencedetect @ 0x1] silence_end: 0.600045 | silence_duration: 0.600045',
    '[silencedetect @ 0x1] silence_start: 12.5',
    '[silencedetect @ 0x1] silence_end: 13.1 | silence_duration: 0.6',
  ].join('\n');
  assert.equal(parseLeadingSilence(leading), 0.600045);

  const later = [
    '[silencedetect @ 0x1] silence_start: 12.5',
    '[silencedetect @ 0x1] silence_end: 13.1 | silence_duration: 0.6',
  ].join('\n');
  assert.equal(parseLeadingSilence(later), 0);
  assert.equal(parseLeadingSilence(''), 0);
});

test('parseLoudness reads the summary block, not the running per-frame values', () => {
  const stderr = [
    '[Parsed_ebur128_0 @ 0x1] t: 0.0999773  TARGET:-23 LUFS    M:-120.7 S:-120.7     I: -70.0 LUFS       LRA:   0.0 LU  FTPK:  -inf dBFS  TPK:  -inf dBFS',
    '[Parsed_ebur128_0 @ 0x1] t: 3.9  TARGET:-23 LUFS    M: -21.9 S: -22.4     I: -22.3 LUFS       LRA:   0.8 LU  FTPK:  -4.1 dBFS  TPK:  -3.0 dBFS',
    '[Parsed_ebur128_0 @ 0x1] Summary:',
    '',
    '  Integrated loudness:',
    '    I:         -22.0 LUFS',
    '    Threshold: -32.0 LUFS',
    '',
    '  True peak:',
    '    Peak:       -2.5 dBFS',
  ].join('\n');

  assert.deepEqual(parseLoudness(stderr), { lufs: -22, peak: -2.5 });
  assert.equal(parseLoudness('no measurement here'), null);
});

test('musicGainDb aims for the target loudness but never pushes the peak past the ceiling', () => {
  // Wants +5 dB, but the peak only leaves 1 dB of headroom.
  assert.equal(musicGainDb({ lufs: -22, peak: -2.5 }, { targetLufs: -17, peakCeilingDb: -1.5 }), 1);
  // A hot master is turned down all the way to the target.
  assert.equal(musicGainDb({ lufs: -9, peak: -0.1 }, { targetLufs: -17, peakCeilingDb: -1.5 }), -8);
  // No measurement: leave the track alone.
  assert.equal(musicGainDb(null, { targetLufs: -17, peakCeilingDb: -1.5 }), 0);
});

test('musicFilter cuts the excerpt to the video length and fades both ends', () => {
  const filter = musicFilter({ inputIndex: 3, startMs: 560, totalMs: 10600, gainDb: 1, fadeInMs: 1200, fadeOutMs: 2000 });

  assert.equal(
    filter,
    '[3:a]atrim=0.560:11.160,asetpts=PTS-STARTPTS,volume=1.00dB,afade=t=in:st=0:d=1.200,afade=t=out:st=8.600:d=2.000[a]',
  );
});
