// HTML → image, shared by all three renderers (the video builder renders its
// scene backgrounds and its rounded alpha mask this way, then hands them to
// ffmpeg).
//
// Uses a Chrome that is already on the machine and ffmpeg for the final
// encode, so store assets can be rebuilt without adding an image-processing
// dependency to the project.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SYSTEM_CHROME = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
};

const PLAYWRIGHT_CACHE = {
  darwin: 'Library/Caches/ms-playwright',
  linux: '.cache/ms-playwright',
};

/** Browser builds in the Playwright cache, best choice first. */
const PLAYWRIGHT_BUILDS = [
  {
    // chrome-headless-shell: no window, no profile sync, exits when done.
    prefix: 'chromium_headless_shell-',
    binaries: {
      darwin: ['chrome-headless-shell-mac-arm64/chrome-headless-shell', 'chrome-headless-shell-mac-x64/chrome-headless-shell'],
      linux: ['chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-linux/headless_shell'],
    },
  },
  {
    prefix: 'chromium-',
    binaries: {
      darwin: [
        'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
      ],
      linux: ['chrome-linux64/chrome', 'chrome-linux/chrome'],
    },
  },
];

/**
 * Finds a Chrome to render with: `CHROME_BIN`, then the newest headless shell
 * in the Playwright browser cache, then the newest Chrome for Testing there,
 * then an installed Chrome.
 *
 * An installed Chrome comes last on purpose: it is the one the user may have
 * open, and it has to run on its default profile (see chromeArgs).
 *
 * The lookups are injectable so the order can be tested without a browser.
 */
export function findChrome({
  env = process.env,
  platform = process.platform,
  home = os.homedir(),
  exists = fs.existsSync,
  readdir = fs.readdirSync,
} = {}) {
  if (env.CHROME_BIN) {
    if (exists(env.CHROME_BIN)) return env.CHROME_BIN;
    throw new Error(`CHROME_BIN points at ${env.CHROME_BIN}, which does not exist`);
  }
  const cacheDir = PLAYWRIGHT_CACHE[platform];
  if (cacheDir) {
    const cache = path.join(home, cacheDir);
    let entries = [];
    try {
      entries = readdir(cache);
    } catch {
      entries = [];
    }
    for (const { prefix, binaries } of PLAYWRIGHT_BUILDS) {
      const builds = entries
        .filter((dir) => dir.startsWith(prefix) && /^\d+$/.test(dir.slice(prefix.length)))
        .sort((a, b) => Number(b.slice(prefix.length)) - Number(a.slice(prefix.length)));
      for (const build of builds) {
        for (const binary of binaries[platform] ?? []) {
          const candidate = path.join(cache, build, binary);
          if (exists(candidate)) return candidate;
        }
      }
    }
  }
  for (const candidate of SYSTEM_CHROME[platform] ?? []) {
    if (exists(candidate)) return candidate;
  }
  throw new Error(
    'no Chrome found — run "npx playwright install chromium-headless-shell", install Google Chrome, or set CHROME_BIN',
  );
}

const isHeadlessShell = (chrome) => /headless[-_]shell/.test(path.basename(chrome));

/**
 * The command line for one screenshot.
 *
 * The headless shell gets a throwaway profile. Full Chrome does not: started
 * headless on a fresh `--user-data-dir` it sets the profile up, never takes
 * the screenshot and never exits, so it has to run on its default profile.
 */
export function chromeArgs(chrome, { profile, shot, page, width, height }) {
  const shell = isHeadlessShell(chrome);
  return [
    ...(shell ? [`--user-data-dir=${profile}`] : ['--headless', '--disable-gpu']),
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--force-device-scale-factor=1',
    `--screenshot=${shot}`,
    `--window-size=${width},${height}`,
    `file://${page}`,
  ];
}

/** Reads an image off disk as a data: URI, for inlining into the page. */
export function dataUri(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

/** Width and height from a PNG's IHDR chunk. */
export function pngSize(file) {
  const header = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  try {
    fs.readSync(fd, header, 0, 24, 0);
  } finally {
    fs.closeSync(fd);
  }
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

/** A render that has not finished by now is stuck, not slow. */
const CHROME_TIMEOUT_MS = 60_000;

/**
 * Renders an HTML string to an image of exactly width x height.
 *
 * `out` decides the format: `.jpg` is a high-quality JPEG, `.png` is a 24-bit
 * PNG without alpha — the two formats Google Play accepts.
 */
export function renderHtml({ chrome, html, width, height, out, quality = 2 }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'store-assets-render-'));
  try {
    const page = path.join(tmp, 'page.html');
    const shot = path.join(tmp, 'shot.png');
    fs.writeFileSync(page, html);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    try {
      execFileSync(chrome, chromeArgs(chrome, { profile: path.join(tmp, 'profile'), shot, page, width, height }), {
        stdio: 'ignore',
        timeout: CHROME_TIMEOUT_MS,
        killSignal: 'SIGKILL',
      });
    } catch (error) {
      if (error.code !== 'ETIMEDOUT' && !error.killed) throw error;
      throw new Error(
        `Chrome did not finish a ${width}x${height} render in ${CHROME_TIMEOUT_MS / 1000}s (${chrome}) — ` +
          'run "npx playwright install chromium-headless-shell", or point CHROME_BIN at another build',
      );
    }
    if (!fs.existsSync(shot)) throw new Error(`Chrome produced no screenshot (${chrome})`);
    const size = pngSize(shot);
    if (size.width !== width || size.height !== height) {
      throw new Error(
        `Chrome rendered ${size.width}x${size.height} instead of ${width}x${height} — ` +
          'point CHROME_BIN at a different Chrome build',
      );
    }
    const encode = /\.jpe?g$/i.test(out)
      ? ['-q:v', String(quality), '-pix_fmt', 'yuvj444p']
      : ['-pix_fmt', 'rgb24'];
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', shot, '-frames:v', '1', '-update', '1', ...encode, out], {
      stdio: ['ignore', 'ignore', 'inherit'],
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
