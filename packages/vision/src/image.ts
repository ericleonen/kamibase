/**
 * A single-channel image, 0 (black) to 1 (white).
 *
 * Float rather than bytes because everything downstream is arithmetic:
 * gradients, blurs, divisions. Rounding to 8 bits between each step throws away
 * exactly the faint gradients a crease in white paper produces, which is the
 * signal this whole package exists to find.
 *
 * Nothing in this file touches a canvas or a DOM. The browser hands over an
 * `ImageData`, a test hands over a synthetic array, and the pipeline cannot
 * tell the difference. That is what makes any of this testable.
 */
export interface GrayImage {
  readonly width: number;
  readonly height: number;
  readonly data: Float32Array;
}

export function createGray(width: number, height: number): GrayImage {
  return { width, height, data: new Float32Array(width * height) };
}

export function at(image: GrayImage, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return 0;
  return image.data[y * image.width + x] ?? 0;
}

/**
 * Bilinear sample, clamped at the borders.
 *
 * Clamping rather than returning zero outside is not a detail. The warp samples
 * half a pixel past each edge, and treating that as black draws a dark frame
 * around every rectified image, which is four perfectly straight high-contrast
 * lines for the detector to find and report as creases along the paper's edge.
 */
export function sampleBilinear(image: GrayImage, x: number, y: number): number {
  const cx = Math.min(image.width - 1, Math.max(0, x));
  const cy = Math.min(image.height - 1, Math.max(0, y));

  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(image.width - 1, x0 + 1);
  const y1 = Math.min(image.height - 1, y0 + 1);
  const fx = cx - x0;
  const fy = cy - y0;

  const a = at(image, x0, y0);
  const b = at(image, x1, y0);
  const c = at(image, x0, y1);
  const d = at(image, x1, y1);

  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

/**
 * RGBA bytes (an `ImageData.data`) to gray.
 *
 * Rec. 601 luma. The alternative worth considering is a per-channel maximum,
 * which survives coloured pen better; luma wins because the target here is
 * pencil and bare creases on white paper, where the signal is luminance and
 * chroma is camera noise.
 */
export function fromRgba(data: Uint8ClampedArray, width: number, height: number): GrayImage {
  const out = createGray(width, height);
  for (let i = 0, p = 0; i < out.data.length; i += 1, p += 4) {
    const r = data[p] ?? 0;
    const g = data[p + 1] ?? 0;
    const b = data[p + 2] ?? 0;
    out.data[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  return out;
}

/** Gray back to RGBA, for drawing a processed stage on a canvas. */
export function toRgba(image: GrayImage): Uint8ClampedArray {
  const out = new Uint8ClampedArray(image.width * image.height * 4);
  for (let i = 0, p = 0; i < image.data.length; i += 1, p += 4) {
    const v = Math.round(Math.min(1, Math.max(0, image.data[i] ?? 0)) * 255);
    out[p] = v;
    out[p + 1] = v;
    out[p + 2] = v;
    out[p + 3] = 255;
  }
  return out;
}

/**
 * Box blur with a running sum: O(pixels) regardless of radius.
 *
 * Radius matters here. Illumination flattening wants a blur wide enough to
 * erase every crease and keep only the lighting, which means tens of pixels,
 * and a naive kernel at that radius would be the slowest thing in the pipeline.
 */
export function boxBlur(image: GrayImage, radius: number): GrayImage {
  if (radius < 1) return image;
  const pass = blurHorizontal(image, radius);
  return blurVertical(pass, radius);
}

function blurHorizontal(image: GrayImage, radius: number): GrayImage {
  const { width, height, data } = image;
  const out = createGray(width, height);
  const window = radius * 2 + 1;

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    // Seed the running sum with the left edge clamped, so the first pixel has
    // a full window rather than a half one.
    let sum = (data[row] ?? 0) * (radius + 1);
    for (let x = 1; x <= radius; x += 1) sum += data[row + Math.min(x, width - 1)] ?? 0;

    for (let x = 0; x < width; x += 1) {
      out.data[row + x] = sum / window;
      const leaving = data[row + Math.max(0, x - radius)] ?? 0;
      const entering = data[row + Math.min(width - 1, x + radius + 1)] ?? 0;
      sum += entering - leaving;
    }
  }
  return out;
}

function blurVertical(image: GrayImage, radius: number): GrayImage {
  const { width, height, data } = image;
  const out = createGray(width, height);
  const window = radius * 2 + 1;

  for (let x = 0; x < width; x += 1) {
    let sum = (data[x] ?? 0) * (radius + 1);
    for (let y = 1; y <= radius; y += 1) sum += data[Math.min(y, height - 1) * width + x] ?? 0;

    for (let y = 0; y < height; y += 1) {
      out.data[y * width + x] = sum / window;
      const leaving = data[Math.max(0, y - radius) * width + x] ?? 0;
      const entering = data[Math.min(height - 1, y + radius + 1) * width + x] ?? 0;
      sum += entering - leaving;
    }
  }
  return out;
}

/** Three box blurs approximate a Gaussian closely enough and stay O(pixels). */
export function gaussianish(image: GrayImage, radius: number): GrayImage {
  if (radius < 1) return image;
  const r = Math.max(1, Math.round(radius / 3));
  return boxBlur(boxBlur(boxBlur(image, r), r), r);
}

/**
 * Remove the lighting and keep the creases.
 *
 * A photo of white paper is never evenly lit: there is a bright patch under the
 * lamp, a gradient across the sheet, and often the photographer's own shadow. A
 * global threshold on that image finds the shadow, not the creases.
 *
 * Subtracting a heavy blur of the image from itself removes anything that
 * varies slowly, which is exactly what lighting is, and keeps anything that
 * varies over a few pixels, which is exactly what a crease is. The result is
 * recentred on mid-grey so both ridges and troughs survive as signed
 * departures from it.
 *
 * `radius` should be several times wider than the widest crease. It defaults to
 * a sixteenth of the image, which at the working size is around 60px.
 */
export function flattenIllumination(image: GrayImage, radius?: number): GrayImage {
  const r = radius ?? Math.max(8, Math.round(Math.max(image.width, image.height) / 16));
  const background = gaussianish(image, r);
  const out = createGray(image.width, image.height);
  for (let i = 0; i < out.data.length; i += 1) {
    out.data[i] = 0.5 + ((image.data[i] ?? 0) - (background.data[i] ?? 0));
  }
  return out;
}

/**
 * Stretch the middle of the histogram to fill the range.
 *
 * After flattening, a bare crease occupies a very narrow band around mid-grey.
 * Clipping a percentile from each end and rescaling makes that band usable
 * without amplifying the handful of outlier pixels that a specular highlight
 * produces.
 */
export function normalizeContrast(
  image: GrayImage,
  clipPercent = 0.5,
  maxGain = 6,
): GrayImage {
  const sorted = Float32Array.from(image.data).sort();
  const n = sorted.length;
  if (n === 0) return image;

  const lowIndex = Math.floor((clipPercent / 100) * (n - 1));
  const highIndex = Math.ceil((1 - clipPercent / 100) * (n - 1));
  const low = sorted[lowIndex] ?? 0;
  const high = sorted[highIndex] ?? 1;
  const span = high - low;
  if (span < 1e-6) return image;

  /*
   * The gain cap is what stops this from manufacturing a crease pattern out of
   * a blank sheet. An uncreased photo has a span of nothing but sensor noise,
   * and stretching that to fill the range produces a vivid field of texture
   * that every stage downstream is happy to interpret. Refusing to amplify
   * beyond `maxGain` leaves a flat image flat, which is the truth about it.
   */
  const gain = Math.min(maxGain, 1 / span);

  const out = createGray(image.width, image.height);
  for (let i = 0; i < out.data.length; i += 1) {
    out.data[i] = Math.min(1, Math.max(0, 0.5 + ((image.data[i] ?? 0) - (low + span / 2)) * gain));
  }
  return out;
}

/**
 * Scale down by whole-pixel averaging so the longest edge is at most `maxEdge`.
 *
 * Working small is not only about speed. A 12MP phone photo resolves the paper
 * fibre, and fibre produces thousands of tiny gradients that Hough happily
 * accumulates into lines nobody folded. Downsampling averages that away.
 */
export function downscale(image: GrayImage, maxEdge: number): GrayImage {
  const longest = Math.max(image.width, image.height);
  if (longest <= maxEdge) return image;

  const scale = maxEdge / longest;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const out = createGray(width, height);

  const xStep = image.width / width;
  const yStep = image.height / height;

  for (let y = 0; y < height; y += 1) {
    const y0 = Math.floor(y * yStep);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * yStep));
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor(x * xStep);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * xStep));
      let sum = 0;
      let count = 0;
      for (let sy = y0; sy < y1 && sy < image.height; sy += 1) {
        for (let sx = x0; sx < x1 && sx < image.width; sx += 1) {
          sum += image.data[sy * image.width + sx] ?? 0;
          count += 1;
        }
      }
      out.data[y * width + x] = count > 0 ? sum / count : 0;
    }
  }
  return out;
}

/**
 * How sharp an image is, as the variance of its Laplacian.
 *
 * Used to pick a frame out of a video. A blurred frame has a flat Laplacian; a
 * sharp one has a spiky one. It is a relative measure only, which is all that
 * choosing between frames of the same scene requires.
 */
export function sharpness(image: GrayImage): number {
  const { width, height } = image;
  if (width < 3 || height < 3) return 0;

  let sum = 0;
  let sumSquares = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const value =
        4 * at(image, x, y) -
        at(image, x - 1, y) -
        at(image, x + 1, y) -
        at(image, x, y - 1) -
        at(image, x, y + 1);
      sum += value;
      sumSquares += value * value;
      count += 1;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  return sumSquares / count - mean * mean;
}
