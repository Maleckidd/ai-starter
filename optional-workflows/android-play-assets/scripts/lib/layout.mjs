// Pure geometry for the three renderers. No I/O, so it is unit-tested.
//
// A "capture set" describes raw device captures: their size, and the rows of
// *system* UI along the top and bottom edges. Everything that composites a
// capture crops those rows off — they are launcher chrome, not the app, and a
// stray notification icon in a store screenshot is the kind of thing nobody
// spots until it is live.

/** x264 wants even dimensions. */
export function even(n) {
  return n % 2 === 0 ? n : n + 1;
}

/**
 * Screenshot frame: a headline block above a device frame that takes the rest
 * of the canvas and bleeds off the bottom edge.
 *
 * Everything is expressed against the canvas width (`unit`), so one layout
 * holds for a 1080, 1200 and 1600 wide form.
 */
export function screenshotLayout(form, set) {
  const frameWidth = Math.round(form.width * form.frame);
  const scale = frameWidth / set.width;
  return {
    width: form.width,
    height: form.height,
    frameWidth,
    scale,
    cropTop: Math.round(set.statusBarRows * scale),
    cropBottom: Math.round(set.bottomBarRows * scale),
    /** Never taller than the app area, so the bottom system bar cannot show. */
    maxFrameHeight: Math.round((set.height - set.statusBarRows - set.bottomBarRows) * scale),
    unit: (fraction) => Math.round(form.width * fraction),
  };
}

/**
 * Promo video scene: copy in a column on the left, the recording in a device
 * frame on the right. Sized for a landscape canvas — Play shows the promo video
 * above the screenshots, where a portrait video would be pillarboxed.
 */
export function videoLayout(canvas, set) {
  const s = canvas.height / 1080;
  const cropHeight = set.height - set.statusBarRows - set.bottomBarRows;
  const deviceHeight = even(Math.round((canvas.height * 8) / 9));
  const deviceWidth = even(Math.round((deviceHeight * set.width) / cropHeight));
  const deviceX = Math.round(canvas.width * 0.7604 - deviceWidth / 2);
  const copyLeft = Math.round(150 * s);
  return {
    width: canvas.width,
    height: canvas.height,
    /** Type and spacing scale with the canvas height; 1 at 1080p. */
    scale: s,
    deviceWidth,
    deviceHeight,
    deviceX,
    deviceY: Math.round((canvas.height - deviceHeight) / 2),
    radius: Math.round(34 * s),
    /** The part of each recorded frame that is the app, in capture pixels. */
    crop: { width: set.width, height: cropHeight, y: set.statusBarRows },
    copyLeft,
    copyWidth: deviceX - copyLeft - Math.round(110 * s),
  };
}

/**
 * Google Play feature graphic: always 1024x500. Wordmark on the left, device on
 * the right, centre left clear because Play may overlay a play button there.
 * The device bleeds off the bottom — a whole phone would be too small to read.
 */
export function featureGraphicLayout(set) {
  const deviceWidth = 306;
  return {
    width: 1024,
    height: 500,
    deviceWidth,
    deviceHeight: 632,
    deviceRight: 96,
    deviceTop: 34,
    radius: 34,
    cropTop: Math.round((deviceWidth / set.width) * set.statusBarRows),
    copyLeft: 76,
    /** Room for the wordmark before it would run under the device. */
    copyWidth: 1024 - 96 - deviceWidth - 76 - 40,
  };
}
