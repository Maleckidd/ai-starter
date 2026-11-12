#!/usr/bin/env node
// Renders the Google Play feature graphic (1024x500) — the banner Play uses
// when it promotes the app, and the image that sits above the listing when
// there is a promo video.
//
// It reuses the screenshot frames' palette and type, so the listing reads as
// one set, and it shows a real captured screen rather than placeholder cards.
//
//   node scripts/build-feature-graphic.mjs               # every locale
//   node scripts/build-feature-graphic.mjs --locale pl   # one language
import path from 'node:path';

import { validateFeatureGraphic } from './lib/config.mjs';
import { featureGraphicLayout } from './lib/layout.mjs';
import { parseBuildArgs, run } from './lib/project.mjs';
import { dataUri, findChrome, renderHtml } from './lib/render.mjs';
import { featureGraphicHtml } from './lib/templates.mjs';

function main() {
  const { project, locales } = parseBuildArgs(process.argv.slice(2));
  const spec = validateFeatureGraphic(project.spec('featureGraphic'), project.config);
  const set = project.captureSet(spec.captureSet);
  const layout = featureGraphicLayout(set);
  const chrome = findChrome();

  for (const locale of locales) {
    const capture = project.requireCapture(set.name, locale, spec.screen);
    const out = path.join(project.paths.output, 'feature-graphic', `feature-graphic-${locale}.png`);
    renderHtml({
      chrome,
      html: featureGraphicHtml({
        brand: project.brand,
        layout,
        name: project.config.project.name,
        accent: spec.wordmarkAccent,
        copy: spec.copy[locale],
        image: dataUri(capture),
      }),
      width: layout.width,
      height: layout.height,
      out,
    });
    console.log(`  ${project.relative(out)}`);
  }
}

run(main);
