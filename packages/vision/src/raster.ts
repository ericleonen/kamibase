import { createGray, type GrayImage } from "./image.js";

/**
 * Colour, and the question of what kind of picture this is.
 *
 * The rest of the package was written for a photograph of a creased sheet,
 * where colour is camera noise and the only signal is luminance. That is the
 * hard case, and it is not the common one. Most crease patterns arrive as a
 * *published drawing*: a PNG off langorigami.com, a JPEG from a designer's
 * site, an export from Oriedita or ORIPA. Those images are not photographs of
 * paper at all. They are line art, with a flat background, strokes one to three
 * pixels wide, and, this being the part that matters, a red line where the
 * designer meant mountain and a blue one where they meant valley.
 *
 * Throwing that away and inferring the assignment from Maekawa is not merely
 * wasteful, it is worse than wasteful: Maekawa is invariant under flipping the
 * whole pattern, so the answer comes back correct up to being inside out, when
 * the file said which way round it went in the first pixel.
 *
 * So the pipeline forks, and this file is the fork. It carries colour, and it
 * decides which kind of picture it is looking at.
 */

/** Packed RGB, one byte per channel, three bytes per pixel. */
export interface RgbImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/** A colour, 0-255 per channel. */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export function createRgb(width: number, height: number): RgbImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 3) };
}

export function pixelAt(image: RgbImage, x: number, y: number): Rgb {
  const p = (y * image.width + x) * 3;
  return { r: image.data[p] ?? 0, g: image.data[p + 1] ?? 0, b: image.data[p + 2] ?? 0 };
}

/**
 * RGBA bytes to RGB, compositing over white.
 *
 * The white matters. A published crease pattern is very often a PNG with a
 * transparent background, and reading its alpha as opaque black turns the
 * paper into a black field with black boundary lines drawn on it, and the
 * boundary vanishes and every stroke inverts. Compositing over white is what
 * the browser does when it draws the same file onto a page, so it is also what
 * the person who exported it saw.
 */
export function rgbFromRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): RgbImage {
  const out = createRgb(width, height);
  for (let i = 0, p = 0, q = 0; i < width * height; i += 1, p += 4, q += 3) {
    const a = (data[p + 3] ?? 255) / 255;
    out.data[q] = (data[p] ?? 0) * a + 255 * (1 - a);
    out.data[q + 1] = (data[p + 1] ?? 0) * a + 255 * (1 - a);
    out.data[q + 2] = (data[p + 2] ?? 0) * a + 255 * (1 - a);
  }
  return out;
}

/** Rec. 601 luma, matching `fromRgba`, so the two paths agree about grey. */
export function toGray(image: RgbImage): GrayImage {
  const out = createGray(image.width, image.height);
  for (let i = 0, p = 0; i < out.data.length; i += 1, p += 3) {
    out.data[i] =
      (0.299 * (image.data[p] ?? 0) +
        0.587 * (image.data[p + 1] ?? 0) +
        0.114 * (image.data[p + 2] ?? 0)) /
      255;
  }
  return out;
}

/** RGB back to RGBA, for putting a stage on a canvas. */
export function rgbToRgba(image: RgbImage): Uint8ClampedArray {
  const out = new Uint8ClampedArray(image.width * image.height * 4);
  for (let i = 0, p = 0, q = 0; i < image.width * image.height; i += 1, p += 3, q += 4) {
    out[q] = image.data[p] ?? 0;
    out[q + 1] = image.data[p + 1] ?? 0;
    out[q + 2] = image.data[p + 2] ?? 0;
    out[q + 3] = 255;
  }
  return out;
}

/**
 * Scale down by whole-pixel averaging, as `downscale` does for grey.
 *
 * Averaging rather than nearest: a crease pattern's strokes are one pixel wide
 * at their thinnest, and point-sampling a 3000px export down to 1200 deletes
 * roughly two thirds of them outright. Averaging keeps them, faint, and a
 * faint line is something the detector can still find.
 */
export function downscaleRgb(image: RgbImage, maxEdge: number): RgbImage {
  const longest = Math.max(image.width, image.height);
  if (longest <= maxEdge) return image;

  const scale = maxEdge / longest;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const out = createRgb(width, height);

  const xStep = image.width / width;
  const yStep = image.height / height;

  for (let y = 0; y < height; y += 1) {
    const y0 = Math.floor(y * yStep);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * yStep));
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor(x * xStep);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * xStep));

      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let sy = y0; sy < y1 && sy < image.height; sy += 1) {
        for (let sx = x0; sx < x1 && sx < image.width; sx += 1) {
          const p = (sy * image.width + sx) * 3;
          r += image.data[p] ?? 0;
          g += image.data[p + 1] ?? 0;
          b += image.data[p + 2] ?? 0;
          count += 1;
        }
      }

      const q = (y * width + x) * 3;
      if (count > 0) {
        out.data[q] = r / count;
        out.data[q + 1] = g / count;
        out.data[q + 2] = b / count;
      }
    }
  }
  return out;
}

/** Straight-line distance in RGB, 0 to about 442. */
export function colourDistance(a: Rgb, b: Rgb): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

/** Hue in degrees (0 red, 120 green, 240 blue), saturation and value, 0 to 1. */
export function toHsv(colour: Rgb): { h: number; s: number; v: number } {
  const r = colour.r / 255;
  const g = colour.g / 255;
  const b = colour.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const span = max - min;

  let h = 0;
  if (span > 1e-6) {
    if (max === r) h = 60 * (((g - b) / span + 6) % 6);
    else if (max === g) h = 60 * ((b - r) / span + 2);
    else h = 60 * ((r - g) / span + 4);
  }

  return { h, s: max <= 1e-6 ? 0 : span / max, v: max };
}

export interface RasterProfile {
  /** The paper: whatever colour most of the picture is. */
  readonly background: Rgb;
  /** Share of pixels within `backgroundTolerance` of it. */
  readonly backgroundShare: number;
  /**
   * Share of pixels identical to both their right and lower neighbours.
   *
   * Reported but not decided on. A pristine render lands above 0.9 and a noisy
   * photograph near zero, which is suggestive, but a resampled JPEG of a
   * drawing has almost no flat pixels left, and a photograph of evenly lit
   * paper has plenty, so the two populations overlap in exactly the cases that
   * matter. `inkContrast` below is what the decision is actually made on.
   */
  readonly flatShare: number;
  /** Share of pixels carrying real colour, as opposed to grey. */
  readonly chromaShare: number;
  /**
   * Of the pixels that differ from the paper at all, the share that differ
   * from it *a lot*.
   *
   * This is the discriminator that works, and the reason is that it measures
   * the one thing the two kinds of picture genuinely disagree about: how ink
   * meets paper. A drawn stroke is a step. It is either ink or it is paper,
   * with a pixel of ramp between, so most of what is not paper is fully ink
   * and this lands above 0.5. A crease in a photograph is a shallow ridge in a
   * lit sheet: everything that is not paper is *slightly* not paper, the
   * departures form a smooth continuum from nothing to a little, and this
   * lands near 0.1.
   *
   * `flatShare` was tried first and is not sufficient. A rendered pattern that
   * has been through JPEG and a resample has almost no exactly-flat pixels
   * left, and a photograph of evenly lit paper has plenty.
   */
  readonly inkContrast: number;
  /** How many distinct ink colours the strong pixels fall into. */
  readonly paletteSize: number;
  /** Line art gets the colour path; anything else gets the photo path. */
  readonly lineArt: boolean;
}

/** How far from the background a pixel may sit and still count as paper. */
export const BACKGROUND_TOLERANCE = 26;

/** Past this, a pixel is something other than the paper. */
const NOT_PAPER = 20;

/**
 * Look at the picture and decide what it is.
 *
 * Three numbers, no model. `flatShare` separates renders from photographs,
 * `backgroundShare` insists there is a paper rather than a scene, and
 * `chromaShare` is the tie-breaker for a grey-scale render: a black-and-white
 * crease pattern is still line art and still wants the colour path, because
 * that path is really the *flat-ink* path and colour is only its best case.
 *
 * The consequence of getting this wrong is asymmetric, which is why the bar is
 * where it is. A photograph sent down the line-art path finds nothing, because
 * there is no flat background to subtract and every pixel becomes ink. A
 * drawing sent down the photo path still works, which is what shipped before
 * this file existed. It just throws the colours away. So the test leans
 * towards calling things photographs.
 */
export function profileRaster(image: RgbImage): RasterProfile {
  const { width, height, data } = image;
  const pixels = width * height;
  if (pixels === 0) {
    return {
      background: { r: 255, g: 255, b: 255 },
      backgroundShare: 0,
      flatShare: 0,
      chromaShare: 0,
      inkContrast: 0,
      paletteSize: 0,
      lineArt: false,
    };
  }

  // The background is the mode of a coarse histogram, refined to the mean of
  // the pixels that landed in the winning bin. Coarse because a JPEG spreads
  // one flat white across a dozen exact values; refined because the bin centre
  // can sit several units off and everything downstream measures from here.
  const bins = new Map<number, { count: number; r: number; g: number; b: number }>();
  const step = Math.max(1, Math.floor(Math.sqrt(pixels / 200_000)));
  for (let i = 0; i < pixels; i += step) {
    const p = i * 3;
    const r = data[p] ?? 0;
    const g = data[p + 1] ?? 0;
    const b = data[p + 2] ?? 0;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key);
    if (bin) {
      bin.count += 1;
      bin.r += r;
      bin.g += g;
      bin.b += b;
    } else {
      bins.set(key, { count: 1, r, g, b });
    }
  }

  let winner = { count: 0, r: 255, g: 255, b: 255 };
  for (const bin of bins.values()) if (bin.count > winner.count) winner = bin;
  const background: Rgb = {
    r: winner.r / Math.max(1, winner.count),
    g: winner.g / Math.max(1, winner.count),
    b: winner.b / Math.max(1, winner.count),
  };

  let backgroundPixels = 0;
  let chromaPixels = 0;
  let flat = 0;
  let flatConsidered = 0;
  const inkBins = new Map<number, number>();
  const departures: number[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = (y * width + x) * 3;
      const r = data[p] ?? 0;
      const g = data[p + 1] ?? 0;
      const b = data[p + 2] ?? 0;

      const distance = colourDistance({ r, g, b }, background);
      if (distance > NOT_PAPER) departures.push(distance);
      if (distance <= BACKGROUND_TOLERANCE) backgroundPixels += 1;
      else if (distance > 60) {
        // Strong ink only. Anti-aliased skirts are blends of paper and ink and
        // would populate the palette with colours nobody drew with.
        const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        inkBins.set(key, (inkBins.get(key) ?? 0) + 1);
      }

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max > 40 && (max - min) / max > 0.18) chromaPixels += 1;

      if (x + 1 < width && y + 1 < height) {
        flatConsidered += 1;
        const right = (y * width + x + 1) * 3;
        const below = ((y + 1) * width + x) * 3;
        const same =
          Math.abs((data[right] ?? 0) - r) <= 2 &&
          Math.abs((data[right + 1] ?? 0) - g) <= 2 &&
          Math.abs((data[right + 2] ?? 0) - b) <= 2 &&
          Math.abs((data[below] ?? 0) - r) <= 2 &&
          Math.abs((data[below + 1] ?? 0) - g) <= 2 &&
          Math.abs((data[below + 2] ?? 0) - b) <= 2;
        if (same) flat += 1;
      }
    }
  }

  const backgroundShare = backgroundPixels / pixels;
  const flatShare = flatConsidered === 0 ? 0 : flat / flatConsidered;
  const chromaShare = chromaPixels / pixels;

  // Palette size counts bins holding at least a thousandth of the ink, so a
  // JPEG's ringing around a red line does not read as forty shades of red.
  let inkTotal = 0;
  for (const count of inkBins.values()) inkTotal += count;
  let paletteSize = 0;
  for (const count of inkBins.values()) {
    if (count >= Math.max(8, inkTotal * 0.001)) paletteSize += 1;
  }

  /*
   * The bimodality measure. Sorted rather than bucketed because the answer
   * hangs on a high percentile, and a percentile off a coarse histogram of a
   * long-tailed distribution is not worth the memory it saves.
   */
  departures.sort((a, b) => a - b);
  const ceiling = departures[Math.floor(departures.length * 0.99)] ?? 0;
  let strong = 0;
  for (const value of departures) if (value > ceiling * 0.6) strong += 1;
  const inkContrast = departures.length === 0 ? 0 : strong / departures.length;

  /*
   * Getting this wrong is asymmetric, which is where the bar comes from. A
   * photograph sent down the line-art path finds nothing, because there is no
   * flat paper to subtract and every pixel becomes ink. A drawing sent down
   * the photo path still works, which is what shipped before this file
   * existed. It merely throws the colours away. So the test leans towards
   * calling things photographs, and the margin it leaves is wide: drawings
   * measure around 0.6 here and photographs around 0.1.
   */
  const lineArt =
    backgroundShare >= 0.35 &&
    // A blank canvas is neither, and sending it down either path finds
    // nothing. Requiring some ink keeps the label honest.
    departures.length >= pixels * 0.0005 &&
    inkContrast >= 0.35;

  return {
    background,
    backgroundShare,
    flatShare,
    chromaShare,
    inkContrast,
    paletteSize,
    lineArt,
  };
}
