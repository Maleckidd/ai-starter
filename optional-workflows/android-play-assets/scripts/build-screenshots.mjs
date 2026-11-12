#!/usr/bin/env node
// Composes the Google Play screenshot sets: takes the raw device captures and
// renders each one into a marketing frame — brand background, a headline from
// config/screenshots.json, and the capture in a rounded device frame.
//
// Play has separate slots for phone, 7-inch tablet and 10-inch tablet. Each is
// a *form* in the spec, with its own canvas and a capture set to read from. Two
// tablet forms can share one tablet capture set — what must not happen is
// pushing phone captures into a tablet slot: the frame would be a scaled-up
// phone, which is exactly what the tablet slots exist to rule out.
//
//   node scripts/build-screenshots.mjs                      # everything
//   node scripts/build-screenshots.mjs --locale pl          # one language
//   node scripts/build-screenshots.mjs tablet10 --locale pl # one of each
//   node scripts/build-screenshots.mjs --config config/project.example.json
import path from 'node:path';

import { validateScreenshots } from './lib/config.mjs';
import { screenshotLayout } from './lib/layout.mjs';
import { parseBuildArgs, run } from './lib/project.mjs';
import { dataUri, findChrome, renderHtml } from './lib/render.mjs';
import { screenshotHtml } from './lib/templates.mjs';

function main() {
  // The form names come from the spec, which is only known once the project is
  // loaded — so peek at the spec to learn what the selectors may be.
  const { project, selectors: forms, locales } = parseBuildArgs(process.argv.slice(2), {
    selectors: (loaded) => Object.keys(loaded.spec('screenshots').forms ?? {}),
  });
  const spec = validateScreenshots(project.spec('screenshots'), project.config);
  const chrome = findChrome();
  const outRoot = path.join(project.paths.output, 'screenshots');
  let written = 0;

  for (const formName of forms) {
    const form = spec.forms[formName];
    const layout = screenshotLayout(form, project.captureSet(form.captureSet));
    for (const locale of locales) {
      for (const screen of spec.screens) {
        const capture = project.requireCapture(form.captureSet, locale, screen.id);
        const out = path.join(outRoot, formName, locale, `${screen.id}.jpg`);
        renderHtml({
          chrome,
          html: screenshotHtml({
            brand: project.brand,
            layout,
            copy: screen.copy[locale],
            image: dataUri(capture),
            align: screen.align,
          }),
          width: form.width,
          height: form.height,
          out,
        });
        console.log(`  ${project.relative(out)}`);
        written++;
      }
    }
  }
  console.log(`Wrote ${written} frames to ${project.relative(outRoot)}`);
}

run(main);
