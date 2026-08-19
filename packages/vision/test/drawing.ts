import { createRgb, type Rgb, type RgbImage } from "../src/raster.js";
import type { Line } from "../src/segments.js";
import type { EdgeAssignment } from "@kamibase/core";

/**
 * Drawing crease patterns the way they get published.
 *
 * We cannot ship the files this is modelled on. The patterns on
 * langorigami.com and obb.design are their designers' work, under their own
 * terms, and a test suite is not a licence to redistribute them. What can be
 * shipped is everything about them that makes them hard to read, reproduced
 * here on patterns we are free to use:
 *
 *   - strokes one to three pixels wide, anti-aliased, on a flat background
 *   - a pale grey reference lattice under the creases, which is not a crease
 *   - red for mountain and blue for valley, and sometimes neither
 *   - dashed and dotted strokes alongside solid ones
 *   - a margin, so the paper's edge is not the file's edge
 *   - JPEG-ish ringing and resampling softness
 *   - a slight rotation, because half the CPs on the internet are screenshots
 *
 * Every one of those is in here because it broke a draft of the line-art
 * pipeline. Together they are a harder input than most real files, which is
 * the point: a suite that only passes on the easy half of the corpus tells you
 * nothing about the half you care about.
 */

/** A crease with a known assignment, in paper coordinates with y upwards. */
export interface Crease extends Line {
  readonly assignment: EdgeAssignment;
}

export interface Pattern {
  readonly name: string;
  /** Paper extent. Height is 1 for a square; less for a wide sheet. */
  readonly width: number;
  readonly height: number;
  readonly creases: readonly Crease[];
  /** Divisions of the reference lattice, if the drawing shows one. */
  readonly grid?: { readonly x: number; readonly y: number };
}

export interface RenderOptions {
  /** Pixels along the paper's longer side. */
  readonly size?: number;
  /** Blank border around the paper, as a fraction of the paper. */
  readonly margin?: number;
  readonly background?: Rgb;
  readonly palette?: Partial<Record<EdgeAssignment, Rgb>>;
  /** Stroke half-width in pixels. */
  readonly strokeWidth?: number;
  /** Draw the pattern's reference lattice underneath, in pale grey. */
  readonly showGrid?: boolean;
  /**
   * Draw the paper's outline. On by default, because a published crease
   * pattern always shows the sheet it is folded from — and because that
   * outline is what tells the reader (and the scanner) where the paper ends
   * and the margin begins.
   */
  readonly drawBorder?: boolean;
  /** Assignments to draw as dashes rather than solid strokes. */
  readonly dashed?: readonly EdgeAssignment[];
  /** Compression-like ringing and softness, 0 to about 0.05. */
  readonly noise?: number;
  /** Rotate the whole drawing, in degrees. For screenshots of screenshots. */
  readonly rotateDegrees?: number;
  readonly seed?: number;
}

/** The Origami Simulator palette, which is what published patterns use. */
export const PUBLISHED_PALETTE: Record<EdgeAssignment, Rgb> = {
  M: { r: 227, g: 26, b: 28 },
  V: { r: 31, g: 78, b: 191 },
  B: { r: 20, g: 20, b: 20 },
  F: { r: 120, g: 120, b: 120 },
  U: { r: 120, g: 120, b: 120 },
  C: { r: 20, g: 20, b: 20 },
  J: { r: 20, g: 20, b: 20 },
};

const GRID_COLOUR: Rgb = { r: 205, g: 208, b: 214 };

export function renderPattern(pattern: Pattern, options: RenderOptions = {}): RgbImage {
  const size = options.size ?? 1000;
  const margin = options.margin ?? 0.04;
  const background = options.background ?? { r: 255, g: 255, b: 255 };
  const palette = { ...PUBLISHED_PALETTE, ...options.palette };
  const strokeWidth = options.strokeWidth ?? 1.1;
  const dashed = new Set(options.dashed ?? []);

  const span = Math.max(pattern.width, pattern.height);
  const scale = size / span;
  const pad = Math.round(size * margin);
  const width = Math.round(pattern.width * scale) + pad * 2;
  const height = Math.round(pattern.height * scale) + pad * 2;

  const image = createRgb(width, height);
  for (let i = 0; i < image.data.length; i += 3) {
    image.data[i] = background.r;
    image.data[i + 1] = background.g;
    image.data[i + 2] = background.b;
  }

  // Paper coordinates to pixels, with y flipped: the pattern has y upwards and
  // the image has it downwards, which is the whole reason the pipeline flips
  // back on the way out.
  const project = (line: Line): Line => ({
    x1: pad + line.x1 * scale,
    y1: pad + (pattern.height - line.y1) * scale,
    x2: pad + line.x2 * scale,
    y2: pad + (pattern.height - line.y2) * scale,
  });

  if (options.drawBorder ?? true) {
    const { width: pw, height: ph } = pattern;
    const outline: Line[] = [
      { x1: 0, y1: 0, x2: pw, y2: 0 },
      { x1: pw, y1: 0, x2: pw, y2: ph },
      { x1: pw, y1: ph, x2: 0, y2: ph },
      { x1: 0, y1: ph, x2: 0, y2: 0 },
    ];
    for (const line of outline) {
      stroke(image, project(line), palette.B ?? PUBLISHED_PALETTE.B, strokeWidth, null);
    }
  }

  if (options.showGrid && pattern.grid) {
    for (const line of latticeLines(pattern)) {
      stroke(image, project(line), GRID_COLOUR, strokeWidth * 0.65, null);
    }
  }

  for (const crease of pattern.creases) {
    stroke(
      image,
      project(crease),
      palette[crease.assignment] ?? PUBLISHED_PALETTE.U,
      strokeWidth,
      dashed.has(crease.assignment) ? { on: 5, off: 4 } : null,
    );
  }

  const rotated =
    options.rotateDegrees === undefined || options.rotateDegrees === 0
      ? image
      : rotate(image, options.rotateDegrees, background);

  if (options.noise && options.noise > 0) {
    addCompressionArtefacts(rotated, options.noise, options.seed ?? 11);
  }

  return rotated;
}

/** The reference lattice a drawing shows under a box-pleated pattern. */
export function latticeLines(pattern: Pattern): Line[] {
  const lines: Line[] = [];
  if (!pattern.grid) return lines;
  for (let i = 1; i < pattern.grid.x; i += 1) {
    const x = (i / pattern.grid.x) * pattern.width;
    lines.push({ x1: x, y1: 0, x2: x, y2: pattern.height });
  }
  for (let i = 1; i < pattern.grid.y; i += 1) {
    const y = (i / pattern.grid.y) * pattern.height;
    lines.push({ x1: 0, y1: y, x2: pattern.width, y2: y });
  }
  return lines;
}

/**
 * An anti-aliased stroke.
 *
 * Coverage is a linear ramp over the last pixel of the stroke's half-width,
 * which is roughly what a renderer does and is certainly enough to reproduce
 * the thing that matters: the edges of a drawn line are blends of ink and
 * paper, in proportions nobody recorded, and the unmixing in `ink.ts` has to
 * recover both from the blend alone.
 */
function stroke(
  image: RgbImage,
  line: Line,
  colour: Rgb,
  halfWidth: number,
  dash: { on: number; off: number } | null,
): void {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return;

  const reach = Math.ceil(halfWidth) + 1;
  const minX = Math.max(0, Math.floor(Math.min(line.x1, line.x2) - reach));
  const maxX = Math.min(image.width - 1, Math.ceil(Math.max(line.x1, line.x2) + reach));
  const minY = Math.max(0, Math.floor(Math.min(line.y1, line.y2) - reach));
  const maxY = Math.min(image.height - 1, Math.ceil(Math.max(line.y1, line.y2) + reach));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const t = ((x - line.x1) * dx + (y - line.y1) * dy) / (length * length);
      const clamped = Math.min(1, Math.max(0, t));
      const distance = Math.hypot(
        x - (line.x1 + clamped * dx),
        y - (line.y1 + clamped * dy),
      );
      if (distance > halfWidth + 1) continue;

      if (dash) {
        const along = clamped * length;
        if (along % (dash.on + dash.off) >= dash.on) continue;
      }

      const alpha = Math.min(1, Math.max(0, halfWidth + 1 - distance));
      if (alpha <= 0) continue;

      const p = (y * image.width + x) * 3;
      // Painted over rather than blended together, so a crossing takes the
      // colour of the line drawn last — which is what a drawing program does
      // and what makes crossings genuinely ambiguous to read back.
      image.data[p] = (image.data[p] ?? 0) * (1 - alpha) + colour.r * alpha;
      image.data[p + 1] = (image.data[p + 1] ?? 0) * (1 - alpha) + colour.g * alpha;
      image.data[p + 2] = (image.data[p + 2] ?? 0) * (1 - alpha) + colour.b * alpha;
    }
  }
}

/** Rotate about the centre, sampling bilinearly, on the given background. */
function rotate(image: RgbImage, degrees: number, background: Rgb): RgbImage {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const out = createRgb(image.width, image.height);
  const cx = (image.width - 1) / 2;
  const cy = (image.height - 1) / 2;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const sx = cx + dx * cos + dy * sin;
      const sy = cy - dx * sin + dy * cos;
      const p = (y * image.width + x) * 3;

      if (sx < 0 || sy < 0 || sx > image.width - 1 || sy > image.height - 1) {
        out.data[p] = background.r;
        out.data[p + 1] = background.g;
        out.data[p + 2] = background.b;
        continue;
      }

      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(image.width - 1, x0 + 1);
      const y1 = Math.min(image.height - 1, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;

      for (let c = 0; c < 3; c += 1) {
        const a = image.data[(y0 * image.width + x0) * 3 + c] ?? 0;
        const b = image.data[(y0 * image.width + x1) * 3 + c] ?? 0;
        const d = image.data[(y1 * image.width + x0) * 3 + c] ?? 0;
        const e = image.data[(y1 * image.width + x1) * 3 + c] ?? 0;
        out.data[p + c] =
          a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + d * (1 - fx) * fy + e * fx * fy;
      }
    }
  }

  return out;
}

/**
 * What a JPEG does to a line drawing.
 *
 * Two effects, and the second is the one that matters. Grain is easy to shrug
 * off. Ringing — a faint coloured halo beside every high-contrast edge — is
 * not, because it produces pixels that are neither paper nor any ink in the
 * drawing, sitting exactly where the strokes are. If the palette is built from
 * those, the pattern comes back in forty shades of nothing.
 */
function addCompressionArtefacts(image: RgbImage, amount: number, seed: number): void {
  let state = seed >>> 0 || 1;
  const next = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };

  const source = Uint8ClampedArray.from(image.data);
  const { width, height } = image;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = (y * width + x) * 3;
      for (let c = 0; c < 3; c += 1) {
        const here = source[p + c] ?? 0;
        // Ringing: an over- and undershoot proportional to the local contrast.
        const left = source[(y * width + Math.max(0, x - 1)) * 3 + c] ?? here;
        const right = source[(y * width + Math.min(width - 1, x + 1)) * 3 + c] ?? here;
        const overshoot = (here - (left + right) / 2) * amount * 8;
        const grain = (next() - 0.5) * 2 * amount * 255;
        image.data[p + c] = here + overshoot + grain;
      }
    }
  }
}
