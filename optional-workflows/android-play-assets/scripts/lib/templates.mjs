// The HTML each asset is rendered from. Composition lives here; colours come
// from lib/brand.mjs and numbers from lib/layout.mjs.
//
// Headlines use `white-space: pre-line`, so a `\n` in the copy is a line break.
// Nothing shrinks text to fit — keep headlines to two short lines and look at
// the result.
import { brandBackground, canvasCss, deviceFrame, escapeHtml } from './brand.mjs';

/** A Play screenshot: headline, subline, rule, then the capture in a frame. */
export function screenshotHtml({ brand, layout, copy, image, align = 'top' }) {
  const u = layout.unit;
  // Top-anchored: pull the status bar up out of view and let the bottom clip.
  // Bottom-anchored: pin the capture's bottom edge (less the system bar) to the
  // frame's bottom edge, so the top is clipped instead. A bottom sheet lives at
  // the bottom of the screen and no amount of scrolling moves it up.
  const imagePosition =
    align === 'bottom'
      ? `position: absolute; left: 0; bottom: -${layout.cropBottom}px;`
      : `margin-top: -${layout.cropTop}px;`;

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  ${canvasCss(layout.width, layout.height)}
  body {
    font-family: ${brand.font};
    ${brandBackground(brand, {
      primary: { size: '120% 70%', at: '78% -8%', alpha: 0.2, fade: 62 },
      accent: { size: '90% 55%', at: '8% 104%', alpha: 0.16, fade: 60 },
      tilt: 168,
      mid: 52,
    })}
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .headline {
    margin-top: ${u(0.107)}px;
    max-width: ${u(0.85)}px;
    text-align: center;
    font-size: ${u(0.0667)}px;
    line-height: 1.1;
    font-weight: 700;
    letter-spacing: -0.025em;
    color: ${brand.ink};
    white-space: pre-line;
  }
  .subline {
    margin-top: ${u(0.024)}px;
    max-width: ${u(0.76)}px;
    text-align: center;
    font-size: ${u(0.0306)}px;
    line-height: 1.35;
    font-weight: 400;
    letter-spacing: -0.005em;
    color: ${brand.muted};
  }
  .rule {
    margin-top: ${u(0.031)}px;
    width: ${u(0.085)}px;
    height: ${u(0.0056)}px;
    border-radius: ${u(0.003)}px;
    background: ${brand.primary};
    opacity: 0.9;
  }
  /* The frame takes whatever height is left under the headline and clips the
     capture there. That keeps a half-empty screen from rendering as a slab of
     blank app background. */
  .device {
    margin-top: ${u(0.054)}px;
    width: ${layout.frameWidth}px;
    flex: 1 1 auto;
    min-height: 0;
    max-height: ${layout.maxFrameHeight}px;
    overflow: hidden;
    position: relative;
    ${deviceFrame(brand, {
      radius: u(0.0426),
      contact: { y: 2, blur: 6, alpha: 0.06 },
      cast: { y: u(0.031), blur: u(0.065), alpha: 0.2 },
    })}
  }
  .device img { display: block; width: 100%; ${imagePosition} }
</style></head>
<body>
  <div class="headline">${escapeHtml(copy.headline)}</div>
  ${copy.subline ? `<div class="subline">${escapeHtml(copy.subline)}</div>` : ''}
  <div class="rule"></div>
  <div class="device"><img src="${image}"></div>
</body></html>`;
}

/** Splits the app name around the part to print in the brand colour. */
function wordmark(name, accent) {
  const at = accent ? name.indexOf(accent) : -1;
  if (at === -1) return escapeHtml(name);
  return `${escapeHtml(name.slice(0, at))}<span>${escapeHtml(accent)}</span>${escapeHtml(name.slice(at + accent.length))}`;
}

/**
 * The 1024x500 feature graphic.
 *
 * Two constraints drive it: Play may overlay a play button over the middle, so
 * the centre stays clear; and it is often displayed around 380px wide, so
 * nothing is set under 24px.
 */
export function featureGraphicHtml({ brand, layout, name, accent, copy, image }) {
  // Bold system type runs at roughly 0.56em per character; size the wordmark
  // so a long app name still clears the device.
  const wordmarkSize = Math.max(44, Math.min(84, Math.floor(layout.copyWidth / (0.56 * name.length))));
  const points = (copy.points ?? []).map(escapeHtml).join('<b>·</b>');

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  ${canvasCss(layout.width, layout.height)}
  body {
    font-family: ${brand.font};
    ${brandBackground(brand, {
      primary: { size: '90% 130%', at: '88% 12%', alpha: 0.22, fade: 62 },
      accent: { size: '70% 110%', at: '2% 100%', alpha: 0.16, fade: 60 },
      tilt: 160,
      mid: 55,
    })}
    position: relative;
  }
  /* Rules top and bottom give the banner an edge on the white Play card. */
  .edge { position: absolute; left: 0; right: 0; height: 7px; background: ${brand.primary}; }
  .edge.top { top: 0; }
  .edge.bottom { bottom: 0; }
  .copy { position: absolute; left: ${layout.copyLeft}px; top: 50%; transform: translateY(-50%); max-width: ${layout.copyWidth}px; }
  .wordmark {
    font-size: ${wordmarkSize}px;
    font-weight: 700;
    letter-spacing: -0.035em;
    color: ${brand.ink};
    line-height: 1;
    white-space: nowrap;
  }
  .wordmark span { color: ${brand.primary}; }
  .rule { margin-top: 26px; width: 300px; max-width: 100%; height: 5px; border-radius: 3px; background: ${brand.primary}; }
  .tagline { margin-top: 24px; font-size: 30px; font-weight: 500; letter-spacing: -0.01em; color: ${brand.body}; }
  .points { margin-top: 20px; font-size: 25px; font-weight: 400; color: ${brand.muted}; }
  .points b { color: ${brand.primary}; font-weight: 400; padding: 0 10px; }
  .device {
    position: absolute;
    right: ${layout.deviceRight}px;
    top: ${layout.deviceTop}px;
    width: ${layout.deviceWidth}px;
    height: ${layout.deviceHeight}px;
    overflow: hidden;
    ${deviceFrame(brand, {
      radius: layout.radius,
      contact: { y: 2, blur: 8, alpha: 0.08 },
      cast: { y: 26, blur: 60, alpha: 0.26 },
      borderAlpha: 0.1,
    })}
  }
  .device img { display: block; width: 100%; margin-top: -${layout.cropTop}px; }
</style></head>
<body>
  <div class="edge top"></div>
  <div class="copy">
    <div class="wordmark">${wordmark(name, accent)}</div>
    <div class="rule"></div>
    <div class="tagline">${escapeHtml(copy.tagline)}</div>
    ${points ? `<div class="points">${points}</div>` : ''}
  </div>
  <div class="device"><img src="${image}"></div>
  <div class="edge bottom"></div>
</body></html>`;
}

const videoBackground = (brand) =>
  brandBackground(brand, {
    primary: { size: '90% 90%', at: '82% -10%', alpha: 0.2, fade: 60 },
    accent: { size: '70% 80%', at: '4% 108%', alpha: 0.16, fade: 58 },
    tilt: 160,
    mid: 54,
  });

/** A video scene background: copy on the left, an empty device frame on the right. */
export function sceneHtml({ brand, layout, copy }) {
  const px = (n) => Math.round(n * layout.scale);
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  ${canvasCss(layout.width, layout.height)}
  body { font-family: ${brand.font}; ${videoBackground(brand)} }
  .copy {
    position: absolute; left: ${layout.copyLeft}px; top: 0; height: ${layout.height}px; width: ${layout.copyWidth}px;
    display: flex; flex-direction: column; justify-content: center;
  }
  .headline {
    font-size: ${px(92)}px; line-height: 1.08; font-weight: 700; letter-spacing: -0.03em;
    color: ${brand.ink}; white-space: pre-line;
  }
  .rule { margin-top: ${px(40)}px; width: ${px(116)}px; height: ${px(8)}px; border-radius: ${px(4)}px; background: ${brand.primary}; opacity: 0.9; }
  .subline {
    margin-top: ${px(40)}px; font-size: ${px(38)}px; line-height: 1.35; font-weight: 400;
    letter-spacing: -0.005em; color: ${brand.muted}; white-space: pre-line;
  }
  /* Filled with the app background, then covered by the recording, which is
     masked to exactly this rectangle. */
  .device {
    position: absolute; left: ${layout.deviceX}px; top: ${layout.deviceY}px;
    width: ${layout.deviceWidth}px; height: ${layout.deviceHeight}px;
    ${deviceFrame(brand, {
      radius: layout.radius,
      contact: { y: px(4), blur: px(12), alpha: 0.07 },
      cast: { y: px(40), blur: px(90), alpha: 0.22 },
    })}
  }
</style></head><body>
  <div class="copy">
    <div class="headline">${escapeHtml(copy.headline)}</div>
    <div class="rule"></div>
    ${copy.subline ? `<div class="subline">${escapeHtml(copy.subline)}</div>` : ''}
  </div>
  <div class="device"></div>
</body></html>`;
}

/** Title and end cards: centred logo (when the project has one) and copy. */
export function cardHtml({ brand, layout, copy, logo }) {
  const px = (n) => Math.round(n * layout.scale);
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  ${canvasCss(layout.width, layout.height)}
  body {
    font-family: ${brand.font}; ${videoBackground(brand)}
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  img { width: ${px(176)}px; height: ${px(176)}px; border-radius: ${px(40)}px; margin-bottom: ${px(52)}px;
        box-shadow: 0 ${px(18)}px ${px(44)}px rgba(0, 0, 0, 0.18); }
  .headline {
    font-size: ${px(104)}px; line-height: 1.05; font-weight: 700; letter-spacing: -0.035em;
    color: ${brand.ink}; text-align: center; white-space: pre-line;
  }
  .rule { margin-top: ${px(34)}px; width: ${px(116)}px; height: ${px(8)}px; border-radius: ${px(4)}px; background: ${brand.primary}; opacity: 0.9; }
  .subline {
    margin-top: ${px(34)}px; font-size: ${px(40)}px; line-height: 1.4; font-weight: 400;
    text-align: center; color: ${brand.muted}; white-space: pre-line;
  }
</style></head><body>
  ${logo ? `<img src="${logo}">` : ''}
  <div class="headline">${escapeHtml(copy.headline)}</div>
  <div class="rule"></div>
  ${copy.subline ? `<div class="subline">${escapeHtml(copy.subline)}</div>` : ''}
</body></html>`;
}

/** White rounded rectangle on black — ffmpeg's alphamerge reads it as alpha. */
export function maskHtml(layout) {
  const { deviceWidth: w, deviceHeight: h, radius } = layout;
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; }
  html, body { width: ${w}px; height: ${h}px; background: #000; overflow: hidden; }
  div { width: ${w}px; height: ${h}px; border-radius: ${radius}px; background: #fff; }
</style></head><body><div></div></body></html>`;
}
