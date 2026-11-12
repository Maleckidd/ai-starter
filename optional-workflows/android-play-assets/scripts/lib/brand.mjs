// The marketing look, in one place.
//
// Three different things are rendered against it — the screenshot frames, the
// feature graphic and the promo video's scene backgrounds — and the point is
// that a visitor to the listing reads them as one set. Keep the palette here
// and only here: when each renderer carries its own copy, they drift.
//
// The tokens are fixed per project (`brand` in config/project.json); the
// geometry is not. A 1024x500 banner and a 1600x2560 screenshot need the same
// colours placed differently, so the helpers take positions as arguments.

export const DEFAULT_BRAND = Object.freeze({
  /** Accent: rules, wordmark highlight, the stronger background glow. */
  primary: '#2F6FED',
  /** Second glow colour. Only ever used as a soft wash. */
  accent: '#12B5A6',
  /** Headline ink. */
  ink: '#14171F',
  /** Body copy on a light background. */
  body: '#3D4350',
  /** Sublines under a headline. */
  muted: '#5F6675',
  /** The app's own background — shows inside an empty device frame. */
  surface: '#FFFFFF',
  /** Background wash, light to deep. */
  background: ['#FBFCFF', '#F1F4FB', '#E6EBF7'],
  /** No bundled webfont: a store asset is not worth a font dependency. */
  font: '-apple-system, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
});

const HEX = /^#[0-9a-f]{6}$/i;
const COLOUR_KEYS = ['primary', 'accent', 'ink', 'body', 'muted', 'surface'];

/** Project overrides laid over the defaults, with every colour checked. */
export function resolveBrand(overrides = {}) {
  const brand = { ...DEFAULT_BRAND, ...overrides };
  for (const key of COLOUR_KEYS) {
    if (!HEX.test(brand[key])) throw new Error(`brand.${key} must be a #RRGGBB colour`);
  }
  if (!Array.isArray(brand.background) || brand.background.length !== 3 || !brand.background.every((c) => HEX.test(c))) {
    throw new Error('brand.background must be three #RRGGBB colours, light to deep');
  }
  if (typeof brand.font !== 'string' || !brand.font.trim()) throw new Error('brand.font must be a CSS font stack');
  return brand;
}

/** '#C84B31' → '200, 75, 49', for use inside rgba(). */
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/**
 * The background every asset sits on: two soft brand glows over a three-stop
 * wash. A glow is `{ size, at, alpha, fade }` — CSS radial-gradient size and
 * position, peak opacity, and the percentage where it reaches transparent.
 *
 * Returns the `background:` declaration, to be dropped into a rule.
 */
export function brandBackground(brand, { primary, accent, tilt, mid }) {
  const glow = (g, rgb) =>
    `radial-gradient(${g.size} at ${g.at}, rgba(${rgb}, ${g.alpha}) 0%, rgba(${rgb}, 0) ${g.fade}%)`;
  const [c0, c1, c2] = brand.background;
  return `background:
      ${glow(primary, hexToRgb(brand.primary))},
      ${glow(accent, hexToRgb(brand.accent))},
      linear-gradient(${tilt}deg, ${c0} 0%, ${c1} ${mid}%, ${c2} 100%);`;
}

/**
 * The rounded frame a capture is drawn into: app-surface fill, hairline border
 * and a two-layer shadow (`contact` pins it down, `cast` lifts it off the page).
 *
 * Returns declarations only — position and size stay with the caller, because
 * each canvas places the frame differently and the video needs the same radius
 * again as an ffmpeg alpha mask.
 */
export function deviceFrame(brand, { radius, contact, cast, borderAlpha = 0.08 }) {
  const ink = hexToRgb(brand.ink);
  const layer = (s) => `0 ${s.y}px ${s.blur}px rgba(${ink}, ${s.alpha})`;
  return `border-radius: ${radius}px;
    background: ${brand.surface};
    border: 1px solid rgba(${ink}, ${borderAlpha});
    box-shadow: ${layer(contact)}, ${layer(cast)};`;
}

/** Reset plus a canvas locked to exactly width x height, so the shot is exact. */
export function canvasCss(width, height) {
  return `* { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${width}px; height: ${height}px; overflow: hidden; }`;
}

/** Copy from the JSON specs goes into markup — escape it. */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
