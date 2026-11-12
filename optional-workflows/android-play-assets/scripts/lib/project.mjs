// Loads config/project.json and resolves everything the build scripts need
// from it: absolute paths, the brand, the capture sets and the spec files.
//
// This is the only module that knows where things live on disk. The scripts
// carry layout and composition; the config carries project facts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveBrand } from './brand.mjs';
import { captureSet, capturePath, validateCaptureSets, validateProjectConfig } from './config.mjs';
import { parseSelectors, takeOption } from './cli.mjs';

/** The workflow directory: the parent of scripts/. */
export const WORKFLOW_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const DEFAULT_SPECS = {
  screenshots: 'config/screenshots.json',
  featureGraphic: 'config/feature-graphic.json',
  storyboard: 'config/storyboard.json',
};

function readJson(file, what) {
  if (!fs.existsSync(file)) throw new Error(`missing ${what}: ${file}`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${what} is not valid JSON (${file}): ${error.message}`);
  }
}

export function loadProject(configPath = path.join(WORKFLOW_ROOT, 'config/project.json')) {
  const file = path.resolve(configPath);
  const config = validateProjectConfig(readJson(file, 'project config'));
  validateCaptureSets(config);

  // Relative paths in the config are relative to the directory that holds
  // config/ — the same rule the bash scripts use.
  const root = path.resolve(path.dirname(file), '..');
  const abs = (value) => (path.isAbsolute(value) ? value : path.join(root, value));
  const optional = (value) => (value ? abs(value) : undefined);

  const paths = {
    captures: abs(config.paths.captures),
    takes: abs(config.paths.takes),
    output: abs(config.paths.output ?? 'artifacts/store-assets/output'),
    logo: optional(config.paths.logo),
    music: optional(config.paths.music),
  };
  const specs = { ...DEFAULT_SPECS, ...config.specs };

  return {
    config,
    root,
    paths,
    brand: resolveBrand(config.brand),
    locales: config.locales.map((locale) => locale.id),
    captureSet: (name) => captureSet(config, name),
    spec: (key) => readJson(abs(specs[key]), `${key} spec`),
    /** Absolute path of a raw capture, failing with what to do about a gap. */
    requireCapture(set, localeId, screenId) {
      const capture = capturePath(paths.captures, set, localeId, screenId);
      if (!fs.existsSync(capture)) {
        throw new Error(
          `missing capture ${path.relative(root, capture)} — shoot it first: ` +
            `CAPTURE_SET=${set} bash scripts/capture.sh <config> ${localeId} ${screenId}`,
        );
      }
      return capture;
    },
    relative: (target) => path.relative(root, target),
  };
}

/**
 * The command line every build script shares: bare words narrow the build
 * (`phone`, `tablet10`), `--locale` narrows the language, `--config` points at
 * a project. Narrowing to nothing builds everything.
 */
export function parseBuildArgs(argv, { selectors = [], options = [] } = {}) {
  const args = [...argv];
  const taken = {};
  for (const name of options) taken[name] = takeOption(args, name);
  const project = loadProject(takeOption(args, 'config'));
  const allowed = typeof selectors === 'function' ? selectors(project) : selectors;
  const parsed = parseSelectors(args, { selectors: allowed, locales: project.locales });
  return {
    project,
    options: taken,
    selectors: parsed.selectors.length ? parsed.selectors : allowed,
    locales: parsed.locale ? [parsed.locale] : project.locales,
  };
}

/** Runs a script's main(), turning a thrown Error into one line and exit 1. */
export function run(main) {
  try {
    main();
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exit(1);
  }
}
