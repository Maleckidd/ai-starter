#!/usr/bin/env node
// Builds the promo video from the recorded takes and config/storyboard.json.
//
// The result is a landscape mp4 — Play links the promo video from YouTube and
// shows it above the screenshots. Each scene is the brand background with a
// headline on the left and the recording, in a rounded device frame, on the
// right: deliberately the same look as the still frames.
//
// Backgrounds and cards are rendered by the same headless Chrome as the
// screenshots; ffmpeg does the compositing, the crossfades and the audio.
//
//   node scripts/build-promo-video.mjs                    # every locale
//   node scripts/build-promo-video.mjs --locale pl        # one language
//   node scripts/build-promo-video.mjs --music track.mp3  # with a soundtrack
//   node scripts/build-promo-video.mjs --music-start 46   # start the excerpt later
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { validateStoryboard } from './lib/config.mjs';
import { videoLayout } from './lib/layout.mjs';
import { parseBuildArgs, run } from './lib/project.mjs';
import { dataUri, findChrome, renderHtml } from './lib/render.mjs';
import { cardHtml, maskHtml, sceneHtml } from './lib/templates.mjs';
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
} from './lib/video.mjs';

const DEFAULT_CANVAS = { width: 1920, height: 1080, fps: 30 };
/** Integrated loudness to land on, and the true-peak ceiling not to cross. */
const DEFAULT_MUSIC = { targetLufs: -17, peakCeilingDb: -1.5, fadeInMs: 1200, fadeOutMs: 2000 };

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
}

/** ffmpeg's analysis filters report on stderr, which execFileSync drops. */
function ffmpegReport(args) {
  return spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args, '-f', 'null', '-'], { encoding: 'utf8' }).stderr ?? '';
}

function mediaSeconds(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  return Number(out.toString().trim());
}

const seconds = (ms) => (ms / 1000).toFixed(3);

/**
 * One scene as its own mp4. Keeping scenes separate means the crossfade chain
 * only has to line up whole files, and a scene that comes out wrong can be
 * inspected on its own.
 */
function buildScene({ scene, locale, project, layout, fps, chrome, tmp, logo, mask }) {
  const background = path.join(tmp, `bg-${locale}-${scene.id}.png`);
  const out = path.join(tmp, `scene-${locale}-${scene.id}.mp4`);
  const encode = ['-r', String(fps), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18'];
  const shot = (html) => renderHtml({ chrome, html, width: layout.width, height: layout.height, out: background });

  if (scene.kind === 'card') {
    shot(cardHtml({ brand: project.brand, layout, copy: scene.copy, logo }));
    ffmpeg(['-loop', '1', '-t', seconds(scene.durationMs), '-i', background, ...encode, '-pix_fmt', 'yuv420p', out]);
    return out;
  }

  const take = path.join(project.paths.takes, locale, `${scene.take}.webm`);
  if (!fs.existsSync(take)) {
    throw new Error(
      `missing take ${project.relative(take)} — record it first: bash scripts/record.sh <config> ${locale} ${scene.take}`,
    );
  }
  assertTakeCovers(scene, mediaSeconds(take));

  shot(sceneHtml({ brand: project.brand, layout, copy: scene.copy }));
  ffmpeg([
    '-loop', '1', '-t', seconds(scene.durationMs), '-i', background,
    '-i', take,
    '-i', mask,
    '-filter_complex', sceneFilter({ inMs: scene.inMs, durationMs: scene.durationMs, fps, layout }),
    '-map', '[out]',
    ...encode,
    out,
  ]);
  return out;
}

/** Chain the scenes with crossfades, then lay the music under the result. */
function assemble({ files, scenes, crossfadeMs, fps, music, out }) {
  const plan = crossfadePlan(scenes.map((scene) => scene.durationMs), crossfadeMs);
  const { steps, output } = xfadeFilter(plan, crossfadeMs);
  const args = files.flatMap((file) => ['-i', file]);
  const filters = [...steps];

  if (music) {
    const trackSeconds = mediaSeconds(music.file);
    const needed = (music.startMs + plan.totalMs) / 1000;
    if (needed > trackSeconds) {
      throw new Error(
        `the music runs out: ${(plan.totalMs / 1000).toFixed(1)}s needed from ${(music.startMs / 1000).toFixed(1)}s, ` +
          `but the track is only ${trackSeconds.toFixed(1)}s`,
      );
    }
    const measured = parseLoudness(
      ffmpegReport(['-ss', seconds(music.startMs), '-t', seconds(plan.totalMs), '-i', music.file, '-af', 'ebur128=peak=true']),
    );
    const gainDb = musicGainDb(measured, music);
    console.log(
      measured
        ? `  music: ${measured.lufs.toFixed(1)} LUFS, peak ${measured.peak.toFixed(1)} dBFS → ${gainDb >= 0 ? '+' : ''}${gainDb.toFixed(1)} dB`
        : '  music: loudness could not be measured, level left as is',
    );
    args.push('-i', music.file);
    filters.push(
      musicFilter({
        inputIndex: files.length,
        startMs: music.startMs,
        totalMs: plan.totalMs,
        gainDb,
        fadeInMs: music.fadeInMs,
        fadeOutMs: music.fadeOutMs,
      }),
    );
  }

  if (filters.length) args.push('-filter_complex', filters.join(';'));
  args.push('-map', output);
  if (music) args.push('-map', '[a]', '-c:a', 'aac', '-b:a', '192k', '-shortest');
  args.push('-r', String(fps), '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out);
  ffmpeg(args);
  return plan.totalMs;
}

function resolveMusic(project, storyboard, options) {
  const file = options.music ? path.resolve(options.music) : project.paths.music;
  if (options.music && !fs.existsSync(file)) throw new Error(`--music: no such file: ${file}`);
  // A configured track that is not there yet is not an error: music is added last.
  if (!file || !fs.existsSync(file)) return undefined;

  const settings = { ...DEFAULT_MUSIC, ...storyboard.music };
  let startMs;
  if (options['music-start'] !== undefined) {
    const startSeconds = Number(options['music-start']);
    if (!Number.isFinite(startSeconds) || startSeconds < 0) throw new Error('--music-start expects a number of seconds');
    startMs = Math.round(startSeconds * 1000);
  } else {
    // Left alone, the excerpt is the top of the track, minus any leading silence.
    startMs = Math.round(parseLeadingSilence(ffmpegReport(['-v', 'info', '-i', file, '-af', 'silencedetect=noise=-50dB:d=0.2'])) * 1000);
  }
  console.log(`music: ${path.basename(file)} from ${(startMs / 1000).toFixed(2)}s`);
  return { file, startMs, ...settings };
}

function main() {
  const { project, locales, options } = parseBuildArgs(process.argv.slice(2), { options: ['music', 'music-start'] });
  const storyboard = validateStoryboard(project.spec('storyboard'), project.config);
  const canvas = { ...DEFAULT_CANVAS, ...storyboard.canvas };
  const layout = videoLayout(canvas, project.captureSet(storyboard.captureSet));
  const crossfadeMs = storyboard.crossfadeMs ?? 500;
  const music = resolveMusic(project, storyboard, options);
  const chrome = findChrome();
  const logo = project.paths.logo && fs.existsSync(project.paths.logo) ? dataUri(project.paths.logo) : undefined;
  const outDir = path.join(project.paths.output, 'promo');
  fs.mkdirSync(outDir, { recursive: true });

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'store-assets-promo-'));
  try {
    const mask = path.join(tmp, 'mask.png');
    renderHtml({ chrome, html: maskHtml(layout), width: layout.deviceWidth, height: layout.deviceHeight, out: mask });

    for (const locale of locales) {
      console.log(`${locale}:`);
      const scenes = resolveScenes(storyboard, locale);
      const files = scenes.map((scene) => {
        const file = buildScene({ scene, locale, project, layout, fps: canvas.fps, chrome, tmp, logo, mask });
        console.log(`  ${scene.id} (${(scene.durationMs / 1000).toFixed(1)}s)`);
        return file;
      });
      const out = path.join(outDir, `${project.config.project.id}-promo-${locale}.mp4`);
      const totalMs = assemble({ files, scenes, crossfadeMs, fps: canvas.fps, music, out });
      console.log(`  → ${project.relative(out)} (${(totalMs / 1000).toFixed(1)}s${music ? '' : ', no music track'})`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

run(main);
