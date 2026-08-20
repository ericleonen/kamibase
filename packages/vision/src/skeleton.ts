import type { EdgeMap } from "./edges.js";
import { boxBlur, createGray, type GrayImage } from "./image.js";

/**
 * Turning a drawn stroke into something the line detector can read.
 *
 * The photograph path finds creases with Canny: differentiate, suppress
 * non-maxima, threshold. That is the right tool when the thing being looked for
 * is a soft ridge in white paper, and it is the wrong tool here. A drawn line
 * already *is* an edge; running an edge detector over it produces two lines,
 * one down each side of the stroke, which then have to be merged back into the
 * one line that was there all along. On a two-pixel stroke the two sides land
 * two pixels apart, which is inside every tolerance downstream, so what
 * actually happens is that half of them merge and half do not, and a fifth of
 * the pattern comes out doubled.
 *
 * So line art skips Canny entirely. The ink layer is thinned to a
 * single-pixel skeleton, and that skeleton is handed to the same Hough
 * transform in the shape it expects. What Hough needs beyond the pixels is a
 * direction per pixel: it uses each pixel's own gradient to decide which lines
 * that pixel is allowed to vote for, which is where an order of magnitude of
 * its speed and most of its sharpness come from. A drawn line's direction comes
 * from the structure tensor: over a window, the two flanks of a stroke have
 * gradients pointing in opposite directions across it, and the tensor is blind
 * to sign, so they reinforce rather than cancel.
 */

export interface InkEdgeOptions {
  /** Ink weight at which a pixel counts as drawn. */
  readonly threshold?: number;
  /**
   * Bridge gaps up to this many pixels before thinning.
   *
   * For dotted and dashed strokes. A dotted line thinned as it stands is a row
   * of isolated points with no direction between them, and closing it first is
   * the difference between finding the line and finding forty specks.
   */
  readonly bridge?: number;
  /** Window the stroke direction is measured over, in pixels. */
  readonly orientationRadius?: number;
}

/**
 * An ink layer as an {@link EdgeMap}: thinned pixels, plus the direction across
 * the stroke at each one.
 */
export function edgeMapFromInk(ink: GrayImage, options: InkEdgeOptions = {}): EdgeMap {
  const threshold = options.threshold ?? 0.35;
  const bridge = options.bridge ?? 0;
  const { width, height } = ink;

  let mask: Uint8Array = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i += 1) mask[i] = (ink.data[i] ?? 0) >= threshold ? 1 : 0;
  if (bridge > 0) mask = close(mask, width, height, bridge);

  const { direction, magnitude } = orientationField(
    ink,
    options.orientationRadius ?? 3,
  );

  return { width, height, data: thin(mask, width, height), direction, magnitude };
}

/**
 * The direction across the stroke at every pixel, from the structure tensor.
 *
 * `magnitude` comes back as the tensor's own energy rather than as the raw ink
 * weight, because that is what the callers of an `EdgeMap` use it for: how much
 * this pixel believes there is a line here. A pixel in the middle of a filled
 * blob has plenty of ink and no orientation, and should not be reported as a
 * confident edge.
 */
export function orientationField(
  ink: GrayImage,
  radius: number,
): { direction: Float32Array; magnitude: Float32Array } {
  const { width, height } = ink;
  const direction = new Float32Array(width * height);
  const magnitude = new Float32Array(width * height);

  const xx = createGray(width, height);
  const xy = createGray(width, height);
  const yy = createGray(width, height);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const gx = (ink.data[i + 1] ?? 0) - (ink.data[i - 1] ?? 0);
      const gy = (ink.data[i + width] ?? 0) - (ink.data[i - width] ?? 0);
      xx.data[i] = gx * gx;
      xy.data[i] = gx * gy;
      yy.data[i] = gy * gy;
    }
  }

  // Averaging the tensor, not the gradient. Averaging gradients across a
  // stroke gives zero, because the two sides point opposite ways; averaging
  // their outer products keeps the axis and discards the sign, which is
  // exactly the distinction between an orientation and a direction.
  const sxx = boxBlur(xx, radius);
  const sxy = boxBlur(xy, radius);
  const syy = boxBlur(yy, radius);

  for (let i = 0; i < direction.length; i += 1) {
    const a = sxx.data[i] ?? 0;
    const b = sxy.data[i] ?? 0;
    const c = syy.data[i] ?? 0;
    // Principal axis of [[a, b], [b, c]]: the direction of greatest change,
    // which for a line is the normal to it. Hough wants the normal.
    direction[i] = 0.5 * Math.atan2(2 * b, a - c);
    magnitude[i] = Math.hypot(a - c, 2 * b);
  }

  return { direction, magnitude };
}

/* -------------------------------------------------------------------------- */
/* Morphology                                                                  */
/* -------------------------------------------------------------------------- */

/** Dilate then erode: closes gaps smaller than `radius` without fattening. */
export function close(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  return erode(dilate(mask, width, height, radius), width, height, radius);
}

export function dilate(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  return sweep(mask, width, height, radius, true);
}

export function erode(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  return sweep(mask, width, height, radius, false);
}

/** Separable max (dilate) or min (erode) over a square window. */
function sweep(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
  maximum: boolean,
): Uint8Array {
  const pass = new Uint8Array(width * height);
  const out = new Uint8Array(width * height);
  const seed = maximum ? 0 : 1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = seed;
      for (let d = -radius; d <= radius; d += 1) {
        const nx = x + d;
        if (nx < 0 || nx >= width) continue;
        const sample = mask[y * width + nx] ?? 0;
        value = maximum ? Math.max(value, sample) : Math.min(value, sample);
      }
      pass[y * width + x] = value;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = seed;
      for (let d = -radius; d <= radius; d += 1) {
        const ny = y + d;
        if (ny < 0 || ny >= height) continue;
        const sample = pass[ny * width + x] ?? 0;
        value = maximum ? Math.max(value, sample) : Math.min(value, sample);
      }
      out[y * width + x] = value;
    }
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* Thinning                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Zhang-Suen thinning: a mask in, its one-pixel-wide skeleton out.
 *
 * Two sub-iterations per pass, each deleting boundary pixels whose removal
 * cannot break the shape apart or shorten an end. It is the standard algorithm
 * and it is used here for the standard reason: it preserves connectivity, which
 * a naive erosion does not, and connectivity is what the segment extraction
 * downstream walks along.
 *
 * A three-pixel stroke thins to one pixel, so the crease is found once instead
 * of two or three times, and its position is the middle of the stroke rather
 * than one of its sides. On a dense pattern that is the difference between a
 * pleat and a pair of pleats half a millimetre apart.
 */
export function thin(mask: Uint8Array, width: number, height: number): Uint8Array {
  const current = Uint8Array.from(mask);
  const doomed: number[] = [];

  for (let pass = 0; pass < 64; pass += 1) {
    let removed = 0;

    for (let step = 0; step < 2; step += 1) {
      doomed.length = 0;

      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const i = y * width + x;
          if (current[i] !== 1) continue;

          // Neighbours clockwise from north, as Zhang and Suen number them.
          const p2 = current[i - width] ?? 0;
          const p3 = current[i - width + 1] ?? 0;
          const p4 = current[i + 1] ?? 0;
          const p5 = current[i + width + 1] ?? 0;
          const p6 = current[i + width] ?? 0;
          const p7 = current[i + width - 1] ?? 0;
          const p8 = current[i - 1] ?? 0;
          const p9 = current[i - width - 1] ?? 0;

          const neighbours = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (neighbours < 2 || neighbours > 6) continue;

          // Transitions from 0 to 1 going round the ring. Exactly one means
          // the pixel is on a simple boundary, so deleting it cannot split the
          // stroke in two.
          const ring = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let transitions = 0;
          for (let k = 0; k < 8; k += 1) {
            if (ring[k] === 0 && ring[k + 1] === 1) transitions += 1;
          }
          if (transitions !== 1) continue;

          const first = step === 0 ? p2 * p4 * p6 : p2 * p4 * p8;
          const second = step === 0 ? p4 * p6 * p8 : p2 * p6 * p8;
          if (first !== 0 || second !== 0) continue;

          doomed.push(i);
        }
      }

      for (const index of doomed) current[index] = 0;
      removed += doomed.length;
    }

    if (removed === 0) break;
  }

  return current;
}
