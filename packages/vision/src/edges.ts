import { at, createGray, gaussianish, type GrayImage } from "./image.js";

/**
 * Canny edge detection.
 *
 * Hough needs thin edges. Feed it raw gradient magnitude and every crease
 * becomes a three-pixel-wide ridge that votes for three parallel lines, which
 * then have to be merged back together downstream. Non-maximum suppression
 * costs one pass and removes that whole class of problem.
 */

export interface EdgeMap {
  readonly width: number;
  readonly height: number;
  /** 1 where an edge survived, 0 elsewhere. */
  readonly data: Uint8Array;
  /** Gradient direction in radians at every pixel, whether or not it survived. */
  readonly direction: Float32Array;
  /** Gradient magnitude, kept for the confidence a segment reports later. */
  readonly magnitude: Float32Array;
}

export interface EdgeOptions {
  /**
   * How much of the image is allowed to be edge, as a fraction, before the
   * strong threshold kicks in. 0.06 means "the top 6% of gradients are edges".
   *
   * A percentile rather than an absolute threshold because photographs vary by
   * orders of magnitude in contrast: a crease in a raking light and the same
   * crease under a ceiling bulb differ by 20x, and no fixed number serves both.
   */
  readonly strongPercentile?: number;
  /** The weak threshold, as a fraction of the strong one. */
  readonly weakRatio?: number;
  /** Blur applied before differentiating. Suppresses sensor noise. */
  readonly blurRadius?: number;
  /**
   * How many times the median gradient an edge has to be. This is the absolute
   * floor that keeps a blank sheet blank; lower it to pull out very faint
   * creases at the cost of finding some that are not there.
   */
  readonly noiseFloorMultiple?: number;
}

export function detectEdges(image: GrayImage, options: EdgeOptions = {}): EdgeMap {
  const strongPercentile = options.strongPercentile ?? 0.06;
  const weakRatio = options.weakRatio ?? 0.4;
  const blurRadius = options.blurRadius ?? 2;

  const smooth = gaussianish(image, blurRadius);
  const { width, height } = smooth;
  const magnitude = new Float32Array(width * height);
  const direction = new Float32Array(width * height);

  // Sobel.
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const tl = at(smooth, x - 1, y - 1);
      const tc = at(smooth, x, y - 1);
      const tr = at(smooth, x + 1, y - 1);
      const ml = at(smooth, x - 1, y);
      const mr = at(smooth, x + 1, y);
      const bl = at(smooth, x - 1, y + 1);
      const bc = at(smooth, x, y + 1);
      const br = at(smooth, x + 1, y + 1);

      const gx = tr + 2 * mr + br - (tl + 2 * ml + bl);
      const gy = bl + 2 * bc + br - (tl + 2 * tc + tr);

      const index = y * width + x;
      magnitude[index] = Math.hypot(gx, gy);
      direction[index] = Math.atan2(gy, gx);
    }
  }

  /*
   * A percentile on its own always finds edges, because "the strongest 6% of
   * gradients" exists in every image including a blank sheet of paper. So the
   * threshold is also held above the image's own noise: the median non-trivial
   * gradient is what paper texture looks like, and a crease is many times
   * that. On a creased photo the percentile is far higher and this floor never
   * binds; on a blank one it is the only thing standing between noise and a
   * confident pile of imaginary creases.
   */
  const strong = Math.max(
    percentileThreshold(magnitude, strongPercentile),
    medianMagnitude(magnitude) * (options.noiseFloorMultiple ?? 5),
  );
  const weak = strong * weakRatio;

  // Non-maximum suppression: keep a pixel only if it is the local peak along
  // the gradient, which is the direction across the crease.
  const candidate = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const m = magnitude[index] ?? 0;
      if (m < weak) continue;

      const angle = direction[index] ?? 0;
      // Round the gradient to one of four axes and compare with the two
      // neighbours along it.
      const sector = (Math.round(angle / (Math.PI / 4)) + 4) % 4;
      const [dx, dy] =
        sector === 0 ? [1, 0] : sector === 1 ? [1, 1] : sector === 2 ? [0, 1] : [-1, 1];

      const before = magnitude[(y - dy) * width + (x - dx)] ?? 0;
      const after = magnitude[(y + dy) * width + (x + dx)] ?? 0;
      if (m >= before && m >= after) candidate[index] = m >= strong ? 2 : 1;
    }
  }

  return {
    width,
    height,
    data: hysteresis(candidate, width, height),
    direction,
    magnitude,
  };
}

/**
 * Promote weak pixels that touch a strong one, and drop the rest.
 *
 * This is what keeps a crease continuous where it fades. A hand-made crease is
 * not uniformly deep: it is firm where a thumb pressed and faint between, and
 * without hysteresis it arrives at Hough as a dotted line.
 */
function hysteresis(candidate: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height);
  const stack: number[] = [];

  for (let i = 0; i < candidate.length; i += 1) {
    if (candidate[i] === 2) {
      out[i] = 1;
      stack.push(i);
    }
  }

  while (stack.length > 0) {
    const index = stack.pop()!;
    const x = index % width;
    const y = (index - x) / width;

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const neighbour = ny * width + nx;
        if (candidate[neighbour] === 1 && out[neighbour] === 0) {
          out[neighbour] = 1;
          stack.push(neighbour);
        }
      }
    }
  }

  return out;
}

/**
 * The value below which `1 - fraction` of the non-trivial magnitudes fall.
 *
 * A 4096-bucket histogram rather than a sort: this runs on a million-pixel
 * array and the precision of a full sort buys nothing when the answer only has
 * to separate edges from paper.
 */
export function percentileThreshold(magnitude: Float32Array, fraction: number): number {
  let max = 0;
  for (let i = 0; i < magnitude.length; i += 1) {
    const value = magnitude[i] ?? 0;
    if (value > max) max = value;
  }
  if (max <= 0) return 0;

  const buckets = 4096;
  const histogram = new Int32Array(buckets);
  let total = 0;
  for (let i = 0; i < magnitude.length; i += 1) {
    const value = magnitude[i] ?? 0;
    // Skip the flat paper, which is most of the image and would otherwise
    // dominate the percentile.
    if (value <= 1e-6) continue;
    const bucket = Math.min(buckets - 1, Math.floor((value / max) * (buckets - 1)));
    histogram[bucket] = (histogram[bucket] ?? 0) + 1;
    total += 1;
  }
  if (total === 0) return 0;

  const target = total * (1 - fraction);
  let seen = 0;
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    seen += histogram[bucket] ?? 0;
    if (seen >= target) return ((bucket + 0.5) / (buckets - 1)) * max;
  }
  return max;
}

/**
 * The median of the non-trivial gradients: an estimate of what this image's
 * paper texture and sensor noise look like.
 */
export function medianMagnitude(magnitude: Float32Array): number {
  const values: number[] = [];
  for (let i = 0; i < magnitude.length; i += 1) {
    const value = magnitude[i] ?? 0;
    if (value > 1e-6) values.push(value);
  }
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)] ?? 0;
}

/** How many pixels survived. Used to tell "no creases" from "nothing detected". */
export function edgeCount(edges: EdgeMap): number {
  let count = 0;
  for (let i = 0; i < edges.data.length; i += 1) if (edges.data[i] === 1) count += 1;
  return count;
}

/** An edge map as a viewable image, for the tuning preview. */
export function edgesToGray(edges: EdgeMap): GrayImage {
  const out = createGray(edges.width, edges.height);
  for (let i = 0; i < out.data.length; i += 1) out.data[i] = edges.data[i] === 1 ? 1 : 0;
  return out;
}
