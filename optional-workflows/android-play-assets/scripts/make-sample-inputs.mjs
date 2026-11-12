#!/usr/bin/env node
// Generates stand-in inputs — raw captures, screen takes and a logo — for a
// made-up app, so the three build scripts can be tried before a real app is
// wired up:
//
//   node scripts/make-sample-inputs.mjs --config config/project.example.json
//   node scripts/build-screenshots.mjs  --config config/project.example.json
//
// Everything here is synthetic: the "screens" are HTML mock-ups rendered at the
// capture-set size, and the "takes" are ffmpeg animations of them. A real
// project never runs this — its inputs come from scripts/capture.sh and
// scripts/record.sh driving the app on an emulator.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { capturePath } from './lib/config.mjs';
import { canvasCss, escapeHtml, hexToRgb } from './lib/brand.mjs';
import { parseBuildArgs, run } from './lib/project.mjs';
import { findChrome, renderHtml } from './lib/render.mjs';

const TEXT = {
  en: {
    home: 'Collections', list: 'Weekend ideas', plan: 'Add to plan', add: 'Add to this week',
    items: 'items', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    collections: ['Weekend ideas', 'Reading list', 'Garden', 'Home projects', 'Recipes to try', 'Gift ideas'],
    rows: ['Morning hike', 'Farmers market', 'Repot the fern', 'Call grandma', 'Bake sourdough', 'Fix the bike', 'Museum visit', 'Plan the trip', 'Paint the fence', 'Movie night', 'Sort old photos', 'Try the new café', 'Write postcards', 'Clean the attic', 'Picnic by the lake', 'Visit the library'],
    notes: ['2 h · outdoors', 'Saturday morning', '20 min · balcony', 'Sunday evening', '4 h · kitchen', '45 min · garage'],
  },
  pl: {
    home: 'Kolekcje', list: 'Pomysły na weekend', plan: 'Dodaj do planu', add: 'Dodaj do tego tygodnia',
    items: 'pozycji', days: ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'],
    collections: ['Pomysły na weekend', 'Do przeczytania', 'Ogród', 'Projekty domowe', 'Przepisy do wypróbowania', 'Pomysły na prezent'],
    rows: ['Poranna wędrówka', 'Targ śniadaniowy', 'Przesadzić paproć', 'Zadzwonić do babci', 'Upiec chleb', 'Naprawić rower', 'Wizyta w muzeum', 'Zaplanować wyjazd', 'Pomalować płot', 'Wieczór filmowy', 'Uporządkować zdjęcia', 'Nowa kawiarnia', 'Napisać pocztówki', 'Posprzątać strych', 'Piknik nad jeziorem', 'Odwiedzić bibliotekę'],
    notes: ['2 godz. · na zewnątrz', 'Sobota rano', '20 min · balkon', 'Niedziela wieczór', '4 godz. · kuchnia', '45 min · garaż'],
  },
};

const HUES = ['#2F6FED', '#12B5A6', '#F2994A', '#9B51E0', '#EB5757', '#27AE60', '#56CCF2', '#F2C94C'];
const tile = (i) => `linear-gradient(135deg, ${HUES[i % HUES.length]}, ${HUES[(i + 3) % HUES.length]})`;

/** Density a capture set is drawn at, so the mock-up is laid out in dp. */
const density = (set) => (set.width >= 1400 ? 2 : 2.625);

function css(brand, set, heightPx) {
  const d = density(set);
  return `${canvasCss(set.width, heightPx)}
  body { font-family: ${brand.font}; background: ${brand.surface}; color: ${brand.ink}; }
  #app { zoom: ${d}; width: ${set.width / d}px; height: ${heightPx / d}px; position: relative; overflow: hidden; }
  .status { height: ${set.statusBarRows / d}px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 600; background: ${brand.surface}; }
  .appbar { height: 64px; padding: 0 20px; display: flex; align-items: center; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; background: ${brand.surface}; border-bottom: 1px solid rgba(${hexToRgb(brand.ink)}, 0.06); }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding: 18px 20px; }
  .card { border-radius: 18px; overflow: hidden; background: #fff; box-shadow: 0 1px 3px rgba(${hexToRgb(brand.ink)}, 0.12); }
  .card .art { aspect-ratio: 4 / 3; }
  .card .t { padding: 10px 12px 2px; font-size: 15px; font-weight: 600; }
  .card .m { padding: 0 12px 12px; font-size: 12px; color: ${brand.muted}; }
  .row { display: flex; align-items: center; gap: 14px; padding: 12px 20px; border-bottom: 1px solid rgba(${hexToRgb(brand.ink)}, 0.06); }
  .row .art { width: 56px; height: 56px; border-radius: 14px; flex: none; }
  .row .t { font-size: 16px; font-weight: 600; }
  .row .m { margin-top: 3px; font-size: 13px; color: ${brand.muted}; }
  .scrim { position: absolute; inset: 0; background: rgba(${hexToRgb(brand.ink)}, 0.38); }
  .sheet { position: absolute; left: 0; right: 0; bottom: ${set.bottomBarRows / d}px; background: #fff; border-radius: 26px 26px 0 0; padding: 14px 20px 22px; }
  .sheet .grab { width: 40px; height: 4px; border-radius: 2px; background: rgba(${hexToRgb(brand.ink)}, 0.2); margin: 0 auto 16px; }
  .sheet h2 { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
  .days { display: flex; gap: 8px; margin: 18px 0; }
  .day { flex: 1; text-align: center; padding: 12px 0; border-radius: 14px; font-size: 13px; font-weight: 600; background: rgba(${hexToRgb(brand.primary)}, 0.08); color: ${brand.primary}; }
  .day.on { background: ${brand.primary}; color: #fff; }
  .cta { padding: 16px; border-radius: 16px; text-align: center; font-size: 16px; font-weight: 600; background: ${brand.primary}; color: #fff; }
  .sysbar { position: absolute; left: 0; right: 0; bottom: 0; height: ${set.bottomBarRows / d}px; background: #fff; display: flex; align-items: center; justify-content: center; }
  .sysbar i { width: 108px; height: 4px; border-radius: 2px; background: rgba(${hexToRgb(brand.ink)}, 0.5); }`;
}

const page = (style, body) => `<!doctype html><html><head><meta charset="utf-8"><style>${style}</style></head><body><div id="app">${body}</div></body></html>`;
const status = '<div class="status"><span>9:30</span><span>▲ ◼ ▮</span></div>';
const sysbar = '<div class="sysbar"><i></i></div>';
const appbar = (title) => `<div class="appbar">${escapeHtml(title)}</div>`;

function rows(t, count) {
  return Array.from({ length: count }, (_, i) => `<div class="row"><div class="art" style="background:${tile(i)}"></div><div>
    <div class="t">${escapeHtml(t.rows[i % t.rows.length])}</div><div class="m">${escapeHtml(t.notes[i % t.notes.length])}</div></div></div>`).join('');
}

function sheet(t) {
  const days = t.days.map((day, i) => `<div class="day${i === 5 ? ' on' : ''}">${escapeHtml(day)}</div>`).join('');
  return `<div class="scrim"></div><div class="sheet"><div class="grab"></div><h2>${escapeHtml(t.plan)}</h2>
    <div class="days">${days}</div><div class="cta">${escapeHtml(t.add)}</div></div>`;
}

/** One mock screen per screen id, picked by position in the spec. */
function screenBody(index, t) {
  if (index === 0) {
    const cards = t.collections.concat(t.collections).slice(0, 8).map((name, i) => `<div class="card"><div class="art" style="background:${tile(i)}"></div>
      <div class="t">${escapeHtml(name)}</div><div class="m">${(i * 5 + 7) % 23 + 3} ${escapeHtml(t.items)}</div></div>`).join('');
    return `${status}${appbar(t.home)}<div class="grid">${cards}</div>${sysbar}`;
  }
  const list = `${status}${appbar(t.list)}${rows(t, 14)}`;
  return index === 1 ? `${list}${sysbar}` : `${list}${sheet(t)}${sysbar}`;
}

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
}

const VP9 = ['-r', '20', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', '-deadline', 'realtime', '-cpu-used', '8', '-pix_fmt', 'yuv420p'];

function main() {
  const { project, locales } = parseBuildArgs(process.argv.slice(2));
  const { brand } = project;
  const chrome = findChrome();
  const screenshots = project.spec('screenshots');
  const storyboard = project.spec('storyboard');
  const setNames = [...new Set(Object.values(screenshots.forms).map((form) => form.captureSet))];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'store-assets-sample-'));

  try {
    // Raw captures: one per capture set, locale and screen.
    for (const setName of setNames) {
      const set = project.captureSet(setName);
      for (const locale of locales) {
        const t = TEXT[locale] ?? TEXT.en;
        screenshots.screens.forEach((screen, index) => {
          const out = capturePath(project.paths.captures, setName, locale, screen.id);
          renderHtml({ chrome, html: page(css(brand, set, set.height), screenBody(index, t)), width: set.width, height: set.height, out });
          console.log(`  ${project.relative(out)}`);
        });
      }
    }

    // Screen takes, in the storyboard's capture set.
    const set = project.captureSet(storyboard.captureSet);
    const d = density(set);
    const takes = [...new Set(storyboard.scenes.filter((scene) => scene.take).map((scene) => scene.take))];
    for (const locale of locales) {
      const t = TEXT[locale] ?? TEXT.en;
      const dir = path.join(project.paths.takes, locale);
      fs.mkdirSync(dir, { recursive: true });
      const shot = (name, html, height) => {
        const file = path.join(tmp, `${locale}-${name}.png`);
        renderHtml({ chrome, html, width: set.width, height, out: file });
        return file;
      };
      const topHeight = Math.round(set.statusBarRows + 64 * d);
      const top = shot('top', page(css(brand, set, topHeight), `${status}${appbar(t.list)}`), topHeight);
      const bottom = shot('bottom', page(css(brand, set, set.bottomBarRows), sysbar), set.bottomBarRows);
      const tallHeight = Math.round(set.height * 1.9);
      const tall = shot('tall', page(css(brand, set, tallHeight), `${status}${appbar(t.list)}${rows(t, 28)}`), tallHeight);
      const listStill = shot('list', page(css(brand, set, set.height), screenBody(1, t)), set.height);
      const sheetStill = shot('sheet', page(css(brand, set, set.height), screenBody(2, t)), set.height);

      takes.forEach((take, index) => {
        const out = path.join(dir, `${take}.webm`);
        if (index % 2 === 0) {
          // A list scrolling under a fixed app bar: hold, scroll, hold.
          const travel = tallHeight - set.height;
          const scroll = `crop=${set.width}:${set.height}:0:'min(max(t-0.9\\,0)*${Math.round(travel / 3.2)}\\,${travel})'`;
          ffmpeg([
            '-loop', '1', '-i', tall, '-loop', '1', '-i', top, '-loop', '1', '-i', bottom,
            '-filter_complex', `[0:v]${scroll}[c];[c][1:v]overlay=0:0[d];[d][2:v]overlay=0:${set.height - set.bottomBarRows}[o]`,
            '-map', '[o]', '-t', '6', ...VP9, out,
          ]);
        } else {
          // A bottom sheet coming up over the list.
          ffmpeg([
            '-loop', '1', '-t', '2.2', '-i', listStill, '-loop', '1', '-t', '4.2', '-i', sheetStill,
            '-filter_complex', '[0:v][1:v]xfade=transition=fade:duration=0.4:offset=1.6[o]',
            '-map', '[o]', ...VP9, out,
          ]);
        }
        console.log(`  ${project.relative(out)}`);
      });
    }

    // A stand-in app icon for the video's title and end cards.
    if (project.paths.logo) {
      const initial = escapeHtml(project.config.project.name.trim()[0] ?? 'A');
      renderHtml({
        chrome,
        html: `<!doctype html><html><head><meta charset="utf-8"><style>${canvasCss(512, 512)}
          body { display: flex; align-items: center; justify-content: center; font-family: ${brand.font};
                 background: linear-gradient(135deg, ${brand.primary}, ${brand.accent}); color: #fff; font-size: 300px; font-weight: 700; }
          </style></head><body>${initial}</body></html>`,
        width: 512,
        height: 512,
        out: project.paths.logo,
      });
      console.log(`  ${project.relative(project.paths.logo)}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

run(main);
