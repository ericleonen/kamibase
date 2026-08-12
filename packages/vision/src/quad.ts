import { createGray, downscale, sampleBilinear, type GrayImage } from "./image.js";

/**
 * Finding the sheet of paper and flattening it back into a square.
 *
 * Nobody photographs a square sheet square-on. The result is a trapezoid, and
 * every angle in it is wrong, which matters more here than it would elsewhere:
 * Kawasaki's theorem is a statement about angles, so a pattern read off an
 * uncorrected photo fails its own validation for reasons that have nothing to
 * do with the folding.
 *
 * Correcting it is a homography, which four point correspondences determine
 * exactly. Those four points are the paper's corners, and the whole difficulty
 * is finding them. The auto-detection below is a decent first guess; the UI
 * lets the user drag it, because every document scanner ever written does that
 * and the reason is that automatic corner detection fails on exactly the photos
 * people actually take.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Four corners, clockwise from the top left. */
export type Quad = readonly [Point, Point, Point, Point];

/**
 * Sort four corners into clockwise-from-top-left order.
 *
 * The user can drag handles past each other, and a quad whose corners are in
 * the wrong order warps into a bow tie. Sorting by angle around the centroid
 * makes that unrepresentable.
 */
export function orderCorners(points: readonly Point[]): Quad {
  const centre = {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };

  const sorted = [...points].sort(
    (a, b) =>
      Math.atan2(a.y - centre.y, a.x - centre.x) -
      Math.atan2(b.y - centre.y, b.x - centre.x),
  );

  // atan2 starts at "east" and increases clockwise in screen coordinates, so
  // the sorted list is already clockwise. Rotate it so it starts top left.
  let best = 0;
  let bestScore = Infinity;
  sorted.forEach((point, i) => {
    const score = point.x + point.y;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });

  return [
    sorted[best % 4]!,
    sorted[(best + 1) % 4]!,
    sorted[(best + 2) % 4]!,
    sorted[(best + 3) % 4]!,
  ];
}

/**
 * A 3x3 homography taking `from` to `to`, as nine row-major numbers.
 *
 * Eight unknowns (the ninth is fixed at 1 because the matrix is only defined up
 * to scale) and eight equations from four point pairs, so this is an exact
 * solve rather than a fit.
 */
export function homography(from: Quad, to: Quad): Float64Array {
  const a: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i += 1) {
    const s = from[i]!;
    const d = to[i]!;
    a.push([s.x, s.y, 1, 0, 0, 0, -s.x * d.x, -s.y * d.x]);
    b.push(d.x);
    a.push([0, 0, 0, s.x, s.y, 1, -s.x * d.y, -s.y * d.y]);
    b.push(d.y);
  }

  const h = solve(a, b);
  return Float64Array.from([...h, 1]);
}

/** Gaussian elimination with partial pivoting. Eight by eight, so this is fine. */
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(m[row]![col]!) > Math.abs(m[pivot]![col]!)) pivot = row;
    }
    if (Math.abs(m[pivot]![col]!) < 1e-12) continue;
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];

    const lead = m[col]![col]!;
    for (let k = col; k <= n; k += 1) m[col]![k] = m[col]![k]! / lead;

    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = m[row]![col]!;
      if (factor === 0) continue;
      for (let k = col; k <= n; k += 1) {
        m[row]![k] = m[row]![k]! - factor * m[col]![k]!;
      }
    }
  }

  return m.map((row) => row[n]!);
}

export function applyHomography(h: Float64Array, point: Point): Point {
  const w = h[6]! * point.x + h[7]! * point.y + h[8]!;
  const safe = Math.abs(w) < 1e-12 ? 1e-12 : w;
  return {
    x: (h[0]! * point.x + h[1]! * point.y + h[2]!) / safe,
    y: (h[3]! * point.x + h[4]! * point.y + h[5]!) / safe,
  };
}

/**
 * Warp the quad out of the photo and into a square of `size` pixels.
 *
 * The homography is solved in the destination-to-source direction and every
 * output pixel pulls its value from the photo. Pushing pixels the other way
 * would leave holes wherever the source was stretched.
 */
export function warpToSquare(image: GrayImage, quad: Quad, size: number): GrayImage {
  const ordered = orderCorners(quad);
  const destination: Quad = [
    { x: 0, y: 0 },
    { x: size, y: 0 },
    { x: size, y: size },
    { x: 0, y: size },
  ];
  const h = homography(destination, ordered);

  const out = createGray(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const source = applyHomography(h, { x: x + 0.5, y: y + 0.5 });
      out.data[y * size + x] = sampleBilinear(image, source.x, source.y);
    }
  }
  return out;
}

/**
 * Guess where the paper is.
 *
 * Split the image into two brightness classes, take the blob containing the
 * centre, and read its four extreme corners. It works when a sheet sits on a
 * contrasting surface and it fails on white paper on a white table, which is
 * why the answer is a starting point for the user's handles rather than the
 * final word.
 */
export function guessPaperQuad(image: GrayImage): Quad {
  // Small: this only needs to find a large bright rectangle, and the flood fill
  // below is the one genuinely superlinear thing in the package.
  const small = downscale(image, 160);
  const { width, height } = small;
  const threshold = otsuThreshold(small);

  const centreIndex = Math.floor(height / 2) * width + Math.floor(width / 2);
  const paperIsBright = (small.data[centreIndex] ?? 0) >= threshold;

  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i += 1) {
    const bright = (small.data[i] ?? 0) >= threshold;
    mask[i] = bright === paperIsBright ? 1 : 0;
  }

  const blob = largestComponentContaining(mask, width, height, centreIndex);
  const scaleX = image.width / width;
  const scaleY = image.height / height;

  if (blob.length < width * height * 0.05) return insetQuad(image, 0.04);

  // Extremes of x+y and x-y are the corners of a rotated rectangle, which is
  // what a photographed sheet very nearly is.
  let tl = blob[0]!;
  let br = blob[0]!;
  let tr = blob[0]!;
  let bl = blob[0]!;
  let minSum = Infinity;
  let maxSum = -Infinity;
  let maxDiff = -Infinity;
  let minDiff = Infinity;

  for (const index of blob) {
    const x = index % width;
    const y = (index - x) / width;
    const sum = x + y;
    const diff = x - y;
    if (sum < minSum) {
      minSum = sum;
      tl = index;
    }
    if (sum > maxSum) {
      maxSum = sum;
      br = index;
    }
    if (diff > maxDiff) {
      maxDiff = diff;
      tr = index;
    }
    if (diff < minDiff) {
      minDiff = diff;
      bl = index;
    }
  }

  const toPoint = (index: number): Point => {
    const x = index % width;
    const y = (index - x) / width;
    return { x: (x + 0.5) * scaleX, y: (y + 0.5) * scaleY };
  };

  return orderCorners([toPoint(tl), toPoint(tr), toPoint(br), toPoint(bl)]);
}

/** The whole frame, pulled in a little. The fallback when detection gives up. */
export function insetQuad(image: GrayImage, fraction: number): Quad {
  const dx = image.width * fraction;
  const dy = image.height * fraction;
  return [
    { x: dx, y: dy },
    { x: image.width - dx, y: dy },
    { x: image.width - dx, y: image.height - dy },
    { x: dx, y: image.height - dy },
  ];
}

/**
 * Otsu's method: the threshold that best separates the histogram into two
 * groups, by maximising the variance between them.
 */
export function otsuThreshold(image: GrayImage): number {
  const buckets = 256;
  const histogram = new Int32Array(buckets);
  for (let i = 0; i < image.data.length; i += 1) {
    const value = Math.min(1, Math.max(0, image.data[i] ?? 0));
    const bucket = Math.round(value * (buckets - 1));
    histogram[bucket] = (histogram[bucket] ?? 0) + 1;
  }

  const total = image.data.length;
  let sum = 0;
  for (let i = 0; i < buckets; i += 1) sum += i * (histogram[i] ?? 0);

  let sumBackground = 0;
  let weightBackground = 0;
  let best = 0;
  let bestVariance = -1;

  for (let i = 0; i < buckets; i += 1) {
    weightBackground += histogram[i] ?? 0;
    if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += i * (histogram[i] ?? 0);
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const variance =
      weightBackground *
      weightForeground *
      (meanBackground - meanForeground) *
      (meanBackground - meanForeground);

    if (variance > bestVariance) {
      bestVariance = variance;
      best = i;
    }
  }

  /*
   * Half a bucket above the split, so the threshold falls strictly between the
   * two classes. Returning the boundary bucket itself puts every pixel of the
   * darker class exactly on it, and a `>=` comparison then counts the table as
   * part of the paper.
   */
  return (best + 0.5) / (buckets - 1);
}

/** Flood fill from `seed`, or the largest component anywhere if the seed is unset. */
function largestComponentContaining(
  mask: Uint8Array,
  width: number,
  height: number,
  seed: number,
): number[] {
  if (mask[seed] !== 1) {
    let best: number[] = [];
    const seen = new Uint8Array(mask.length);
    for (let i = 0; i < mask.length; i += 1) {
      if (mask[i] !== 1 || seen[i] === 1) continue;
      const component = flood(mask, seen, width, height, i);
      if (component.length > best.length) best = component;
    }
    return best;
  }
  return flood(mask, new Uint8Array(mask.length), width, height, seed);
}

function flood(
  mask: Uint8Array,
  seen: Uint8Array,
  width: number,
  height: number,
  start: number,
): number[] {
  const out: number[] = [];
  const stack = [start];
  seen[start] = 1;

  while (stack.length > 0) {
    const index = stack.pop()!;
    out.push(index);
    const x = index % width;
    const y = (index - x) / width;

    const neighbours = [
      x > 0 ? index - 1 : -1,
      x < width - 1 ? index + 1 : -1,
      y > 0 ? index - width : -1,
      y < height - 1 ? index + width : -1,
    ];
    for (const neighbour of neighbours) {
      if (neighbour < 0) continue;
      if (mask[neighbour] !== 1 || seen[neighbour] === 1) continue;
      seen[neighbour] = 1;
      stack.push(neighbour);
    }
  }

  return out;
}
