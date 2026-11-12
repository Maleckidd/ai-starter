// Pure logic for the promo video: storyboard → scenes → ffmpeg filter graphs,
// and reading ffmpeg's audio measurements. No I/O, so it is unit-tested;
// scripts/build-promo-video.mjs does the spawning.

const seconds = (ms) => (ms / 1000).toFixed(3);

/** Length of a title/end card that does not say otherwise. */
const DEFAULT_CARD_MS = 3000;

/**
 * Flattens a storyboard into scenes for one locale.
 *
 * A scene is either a *card* (`card`, `durationMs`) — a still with centred
 * copy — or a *take* (`take`, `inMs`, `outMs`) — a range of a recorded screen
 * take with copy beside it.
 */
export function resolveScenes(storyboard, localeId) {
  const scenes = storyboard?.scenes;
  if (!Array.isArray(scenes) || scenes.length === 0) throw new Error('storyboard: at least one scene is required');

  return scenes.map((scene) => {
    const id = scene?.id;
    if (typeof id !== 'string' || !id.trim()) throw new Error('storyboard: scene.id is required');
    const isCard = Boolean(scene.card);
    const isTake = typeof scene.take === 'string' && scene.take.trim() !== '';
    if (isCard === isTake) throw new Error(`scene ${id} must be either a card or a take`);

    const copy = scene.copy?.[localeId];
    if (typeof copy?.headline !== 'string' || !copy.headline.trim()) {
      throw new Error(`scene ${id} has no copy (headline) for locale ${localeId}`);
    }
    const resolvedCopy = { headline: copy.headline, subline: copy.subline ?? '' };

    if (isCard) {
      const durationMs = scene.durationMs ?? DEFAULT_CARD_MS;
      return { id, kind: 'card', card: scene.card, durationMs, copy: resolvedCopy };
    }
    const inMs = scene.inMs ?? 0;
    const outMs = scene.outMs;
    if (!Number.isFinite(inMs) || !Number.isFinite(outMs) || inMs < 0 || outMs <= inMs) {
      throw new Error(`scene ${id} needs inMs < outMs (milliseconds into take "${scene.take}")`);
    }
    return { id, kind: 'take', take: scene.take, inMs, outMs, durationMs: outMs - inMs, copy: resolvedCopy };
  });
}

/**
 * A take shorter than the scene asks for does not make ffmpeg fail — it runs
 * out of frames and the shot freezes on the last one, which is easy to miss in
 * a 30-second video. Takes come out a second longer or shorter every time they
 * are re-recorded, so check.
 */
export function assertTakeCovers(scene, takeSeconds) {
  const out = scene.outMs / 1000;
  if (out > takeSeconds) {
    throw new Error(
      `scene ${scene.id} runs to ${out.toFixed(2)}s but take "${scene.take}" is only ${takeSeconds.toFixed(2)}s — ` +
        're-record it, or pull outMs back in the storyboard',
    );
  }
}

/**
 * When each crossfade starts, and how long the result is.
 *
 * Every transition eats one crossfade of overlap, so the running length after
 * k transitions is sum(durations so far) - k * crossfade, and the next one
 * starts a crossfade before that.
 */
export function crossfadePlan(durationsMs, crossfadeMs) {
  const offsetsMs = [];
  let running = durationsMs[0];
  for (let i = 1; i < durationsMs.length; i++) {
    offsetsMs.push(running - crossfadeMs);
    running += durationsMs[i] - crossfadeMs;
  }
  return { offsetsMs, totalMs: running };
}

/** The xfade chain for a plan: filter steps plus the label (or stream) to map. */
export function xfadeFilter(plan, crossfadeMs) {
  const count = plan.offsetsMs.length + 1;
  if (count === 1) return { steps: [], output: '0:v' };
  const steps = [];
  let label = '[0:v]';
  plan.offsetsMs.forEach((offsetMs, index) => {
    const i = index + 1;
    const next = i === count - 1 ? '[v]' : `[v${i}]`;
    steps.push(`${label}[${i}:v]xfade=transition=fade:duration=${seconds(crossfadeMs)}:offset=${seconds(offsetMs)}${next}`);
    label = next;
  });
  return { steps, output: '[v]' };
}

/**
 * One take scene. Inputs: 0 = background still, 1 = the take, 2 = the rounded
 * alpha mask.
 *
 * Emulator takes are variable frame rate, as fast as the emulator rendered.
 * `fps` resamples to a constant rate by repeating frames. Motion-compensated
 * interpolation is the alternative and looks worse: it warps small text while
 * it scrolls.
 */
export function sceneFilter({ inMs, durationMs, fps, layout }) {
  const { crop } = layout;
  return [
    `[1:v]trim=start=${seconds(inMs)}:duration=${seconds(durationMs)},setpts=PTS-STARTPTS,`,
    `fps=${fps},crop=${crop.width}:${crop.height}:0:${crop.y},`,
    `scale=${layout.deviceWidth}:${layout.deviceHeight},setsar=1[vid];`,
    '[vid][2:v]alphamerge[vidm];',
    `[0:v][vidm]overlay=${layout.deviceX}:${layout.deviceY}:format=auto,format=yuv420p[out]`,
  ].join('');
}

/**
 * Seconds of digital silence at the head of a track, from `silencedetect`.
 *
 * Encoders routinely leave a fraction of a second there, and starting on it
 * spends the fade-in on nothing. Only a silence that starts at 0 counts.
 */
export function parseLeadingSilence(stderr) {
  const lines = String(stderr ?? '').split('\n');
  const start = lines.findIndex((line) => /silence_start:\s*-?0(\.0+)?\s*$/.test(line));
  if (start === -1) return 0;
  for (const line of lines.slice(start)) {
    const end = line.match(/silence_end:\s*([\d.]+)/);
    if (end) return Number(end[1]);
  }
  return 0;
}

/**
 * Integrated loudness and true peak from `ebur128=peak=true`.
 *
 * Reads the Summary block only. The filter also logs a running `I:` on every
 * frame, starting at -70 LUFS, and the first match in the output is that one.
 */
export function parseLoudness(stderr) {
  const text = String(stderr ?? '');
  const at = text.lastIndexOf('Summary:');
  if (at === -1) return null;
  const summary = text.slice(at);
  const lufs = summary.match(/I:\s*(-?[\d.]+) LUFS/);
  const peak = summary.match(/Peak:\s*(-?[\d.]+) dBFS/);
  if (!lufs || !peak) return null;
  return { lufs: Number(lufs[1]), peak: Number(peak[1]) };
}

/**
 * How far to turn the music up or down, in dB.
 *
 * A fixed percentage is the wrong control: the result then depends on how hot
 * the track happened to be mastered. With no voiceover the music is the whole
 * soundtrack and should land at a predictable level — quiet is the failure
 * nobody notices until the video is live, because YouTube turns loud audio
 * down but never turns quiet audio up.
 */
export function musicGainDb(measured, { targetLufs, peakCeilingDb }) {
  if (!measured) return 0;
  const wanted = targetLufs - measured.lufs;
  const headroom = peakCeilingDb - measured.peak;
  return Math.min(wanted, headroom);
}

/** Cut the excerpt, set its level, fade it in and out under the whole video. */
export function musicFilter({ inputIndex, startMs, totalMs, gainDb, fadeInMs, fadeOutMs }) {
  const fadeOutStart = Math.max(0, totalMs - fadeOutMs);
  return (
    `[${inputIndex}:a]atrim=${seconds(startMs)}:${seconds(startMs + totalMs)},asetpts=PTS-STARTPTS,` +
    `volume=${gainDb.toFixed(2)}dB,afade=t=in:st=0:d=${seconds(fadeInMs)},` +
    `afade=t=out:st=${seconds(fadeOutStart)}:d=${seconds(fadeOutMs)}[a]`
  );
}
