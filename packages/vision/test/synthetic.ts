import { createGray, type GrayImage } from "../src/image.js";
import type { Line } from "../src/segments.js";
import type { Point, Quad } from "../src/quad.js";

/**
 * Fake photographs of creased paper.
 *
 * The whole package is pure functions over arrays, which means a test can
 * manufacture its own input: draw known creases into a buffer, then add the
 * things that make a real photograph hard. A synthetic photo is not a real one,
 * but it does let a test assert the thing that actually matters, which is
 * whether the pattern that went in is the pattern that comes out.
 *
 * What is modelled, because each one broke an earlier version of the pipeline:
 *
 *   - creases as soft ridges a few pixels wide, not one-pixel ideal lines
 *   - an uneven lighting gradient, so a global threshold cannot work
 *   - sensor noise, so exact pixel comparisons cannot work
 *   - perspective, so the angles are wrong until rectification fixes them
 */

export interface DrawOptions {
  /** How far above (or below) the paper the crease reads, 0 to 1. */
  readonly contrast?: number;
  /** Half-width of the ridge in pixels. Real creases are not one pixel wide. */
  readonly width?: number;
}

/** A blank sheet at the given brightness. */
export function blankPaper(size: number, brightness = 0.82): GrayImage {
  const image = createGray(size, size);
  image.data.fill(brightness);
  return image;
}

/**
 * Draw a crease as a soft ridge.
 *
 * A positive contrast is a bright line, which is roughly what a mountain looks
 * like under light from above; negative is a dark one. The falloff is linear,
 * which is crude but produces the thing that matters: a gradient with a single
 * peak across the crease, so non-maximum suppression has something to thin.
 */
export function drawLine(
  image: GrayImage,
  line: Line,
  options: DrawOptions = {},
): GrayImage {
  const contrast = options.contrast ?? 0.16;
  const width = options.width ?? 1.6;

  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return image;

  const steps = Math.ceil(length * 3);
  const reach = Math.ceil(width) + 1;

  for (let s = 0; s <= steps; s += 1) {
    const t = s / steps;
    const px = line.x1 + dx * t;
    const py = line.y1 + dy * t;

    for (let oy = -reach; oy <= reach; oy += 1) {
      for (let ox = -reach; ox <= reach; ox += 1) {
        const x = Math.round(px) + ox;
        const y = Math.round(py) + oy;
        if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;

        const distance = distanceToSegment(line, x, y);
        if (distance > width) continue;

        const strength = contrast * (1 - distance / width);
        const index = y * image.width + x;
        const current = image.data[index] ?? 0;
        // Keep the strongest contribution rather than summing, so crossing
        // creases do not stack into a bright blob at every intersection.
        if (Math.abs(strength) > Math.abs(current - (image.data[index] ?? 0))) {
          image.data[index] = Math.min(1, Math.max(0, current + strength));
        }
      }
    }
  }

  return image;
}

/** Draw a whole pattern, in unit coordinates, onto a square of `size`. */
export function drawPattern(
  size: number,
  creases: readonly { line: Line; mountain?: boolean }[],
  options: DrawOptions = {},
): GrayImage {
  const image = blankPaper(size);
  for (const crease of creases) {
    drawLine(
      image,
      {
        x1: crease.line.x1 * size,
        y1: crease.line.y1 * size,
        x2: crease.line.x2 * size,
        y2: crease.line.y2 * size,
      },
      {
        ...options,
        contrast: (options.contrast ?? 0.16) * (crease.mountain === false ? -1 : 1),
      },
    );
  }
  return image;
}

/**
 * A smooth brightness gradient across the sheet.
 *
 * This is the single most important thing in this file. Real photographs are
 * lit from one side, and a pipeline that thresholds globally finds the bright
 * half of the paper rather than the creases. Every detection test runs with
 * this applied.
 */
export function addLighting(image: GrayImage, strength = 0.3): GrayImage {
  const { width, height } = image;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = x / Math.max(1, width - 1);
      const v = y / Math.max(1, height - 1);
      // A diagonal ramp with a hot spot, which is what a lamp off to one side
      // and slightly in front actually does.
      const ramp = 0.6 * u + 0.4 * v;
      const hotspot = 0.5 * Math.exp(-(((u - 0.3) ** 2 + (v - 0.25) ** 2) / 0.08));
      const index = y * width + x;
      image.data[index] = Math.min(
        1,
        Math.max(0, (image.data[index] ?? 0) * (1 - strength * ramp) + strength * 0.25 * hotspot),
      );
    }
  }
  return image;
}

/** Reproducible noise, so a flaky test is a real failure. */
export function addNoise(image: GrayImage, amount = 0.01, seed = 7): GrayImage {
  let state = seed >>> 0 || 1;
  const next = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };

  for (let i = 0; i < image.data.length; i += 1) {
    image.data[i] = Math.min(
      1,
      Math.max(0, (image.data[i] ?? 0) + (next() - 0.5) * 2 * amount),
    );
  }
  return image;
}

/**
 * Photograph the square from an angle.
 *
 * Places the sheet inside a larger frame under a perspective transform and
 * returns both the image and where the corners ended up, so a test can hand
 * those corners to the rectifier the way the UI hands over dragged ones.
 */
export function photograph(
  square: GrayImage,
  frameSize: number,
  corners: Quad,
  background = 0.35,
): GrayImage {
  const out = createGray(frameSize, frameSize);
  out.data.fill(background);

  // Forward-map every source pixel into the frame. Slower than pulling, and
  // leaves the odd gap, but the gaps are sub-pixel at these sizes and this is
  // test scaffolding rather than the pipeline.
  const steps = square.width * 2;
  for (let sy = 0; sy <= steps; sy += 1) {
    for (let sx = 0; sx <= steps; sx += 1) {
      const u = sx / steps;
      const v = sy / steps;

      const top = lerp(corners[0]!, corners[1]!, u);
      const bottom = lerp(corners[3]!, corners[2]!, u);
      const point = lerp(top, bottom, v);

      const px = Math.round(point.x);
      const py = Math.round(point.y);
      if (px < 0 || py < 0 || px >= frameSize || py >= frameSize) continue;

      const value =
        square.data[
          Math.min(square.height - 1, Math.round(v * (square.height - 1))) * square.width +
            Math.min(square.width - 1, Math.round(u * (square.width - 1)))
        ] ?? 0;
      out.data[py * frameSize + px] = value;
    }
  }

  return out;
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function distanceToSegment(line: Line, x: number, y: number): number {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 1e-12) return Math.hypot(x - line.x1, y - line.y1);
  const t = Math.min(
    1,
    Math.max(0, ((x - line.x1) * dx + (y - line.y1) * dy) / lengthSquared),
  );
  return Math.hypot(x - (line.x1 + t * dx), y - (line.y1 + t * dy));
}

/**
 * Does a detected segment match an expected one?
 *
 * Endpoint distance rather than angle, because a crease that is right but a
 * little short is a different failure from one that points the wrong way, and
 * the tests want to tell them apart.
 */
export function matchesLine(found: Line, expected: Line, tolerance: number): boolean {
  const forward =
    Math.hypot(found.x1 - expected.x1, found.y1 - expected.y1) <= tolerance &&
    Math.hypot(found.x2 - expected.x2, found.y2 - expected.y2) <= tolerance;
  const reversed =
    Math.hypot(found.x1 - expected.x2, found.y1 - expected.y2) <= tolerance &&
    Math.hypot(found.x2 - expected.x1, found.y2 - expected.y1) <= tolerance;
  return forward || reversed;
}

/** How many of `expected` appear somewhere in `found`. */
export function recallOf(
  found: readonly Line[],
  expected: readonly Line[],
  tolerance: number,
): number {
  return expected.filter((want) => found.some((got) => matchesLine(got, want, tolerance)))
    .length;
}
