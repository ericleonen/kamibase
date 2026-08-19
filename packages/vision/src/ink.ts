import type { EdgeAssignment } from "@kamibase/core";
import { createGray, type GrayImage } from "./image.js";
import {
  colourDistance,
  profileRaster,
  toHsv,
  type Rgb,
  type RgbImage,
} from "./raster.js";

/**
 * Separating a drawing into the colours somebody drew it with.
 *
 * A published crease pattern is a stack of layers that happen to share a
 * canvas: a light grey grid, a black paper outline, red mountains, blue
 * valleys, and often a dashed pair of those for creases the designer wanted to
 * mark differently. Pulling them apart first, and finding lines in each layer
 * separately, is worth doing for three reasons.
 *
 * It answers the mountain/valley question outright, which is otherwise the
 * hardest thing this package does and only ever answered up to a global flip.
 *
 * It removes the crossings. Every place a mountain crosses a valley is a
 * junction that a line detector has to reason its way through; split by colour,
 * the two lines never touch, and each one is a clean uninterrupted run.
 *
 * And it lets the grid be *thrown away*. The grey lattice under a box-pleated
 * design is not a crease. It is the drawing's own scaffolding, and a detector
 * that treats it as ink comes back with a 32-by-32 waffle on top of the
 * pattern, which is worse than finding nothing at all because it looks right.
 *
 * The unmixing is the only subtle part. Strokes are anti-aliased, so a pixel
 * near a crease is a blend of paper and ink in some unknown proportion, and its
 * colour is therefore *not* the colour it was drawn with. Projecting the
 * pixel's departure from the background onto each candidate ink's departure
 * recovers both at once: the projection length is how much ink is there, and
 * the residual says whether that ink is a plausible explanation at all.
 */

/** What a colour turned out to be for. */
export type InkRole =
  /** A crease: goes into the pattern. */
  | "crease"
  /** Scaffolding: the reference grid and anything else too faint to be ink. */
  | "guide";

export interface InkLayer {
  /** The colour it was drawn with, un-blended. */
  readonly colour: Rgb;
  /** What that colour means, by the conventions below. */
  readonly assignment: EdgeAssignment;
  readonly role: InkRole;
  /** Why it was called that. Shown to the person who uploaded the file. */
  readonly reason: string;
  /** Share of the image this layer covers, as ink weight. */
  readonly coverage: number;
  /** Per-pixel ink weight, 0 (paper) to 1 (solid). */
  readonly ink: GrayImage;
  /** Drawn as a dashed or dotted line rather than a solid one. */
  readonly dashed: boolean;
}

export interface InkResult {
  readonly background: Rgb;
  /** Ordered by coverage, heaviest first. */
  readonly layers: readonly InkLayer[];
}

export interface InkOptions {
  /** Most ink colours to separate. Beyond this the tail is merged into noise. */
  readonly maxLayers?: number;
  /** Colours closer than this in RGB are the same ink. */
  readonly mergeDistance?: number;
  /**
   * How far from the background a pixel must sit to count as ink at all.
   *
   * The floor under a reference grid, which is often drawn at 10% grey and is
   * still real ink; raise it to drop faint scaffolding outright, lower it to
   * pull creases out of a washed-out JPEG.
   */
  readonly minInk?: number;
  /** Override what a colour means, by layer index into the sorted palette. */
  readonly assignments?: Readonly<Record<number, EdgeAssignment>>;
}

/**
 * Split an image into its ink layers.
 *
 * The background comes from {@link profileRaster}, so what counts as paper here
 * and what counted as paper when deciding this was line art are the same
 * number.
 */
export function extractInk(image: RgbImage, options: InkOptions = {}): InkResult {
  const maxLayers = options.maxLayers ?? 8;
  const mergeDistance = options.mergeDistance ?? 56;
  const minInk = options.minInk ?? 14;

  const background = profileRaster(image).background;
  const palette = buildPalette(image, background, { maxLayers, mergeDistance, minInk });
  if (palette.length === 0) return { background, layers: [] };

  const inks = palette.map(() => createGray(image.width, image.height));
  const coverage = palette.map(() => 0);

  // Direction from paper to each ink, and its squared length, hoisted out of
  // the per-pixel loop: this is the inner loop of the whole line-art path.
  const dirs = palette.map((colour) => {
    const dr = colour.r - background.r;
    const dg = colour.g - background.g;
    const db = colour.b - background.b;
    return { dr, dg, db, lengthSq: Math.max(1e-6, dr * dr + dg * dg + db * db) };
  });

  const pixels = image.width * image.height;
  for (let i = 0, p = 0; i < pixels; i += 1, p += 3) {
    const dr = (image.data[p] ?? 0) - background.r;
    const dg = (image.data[p + 1] ?? 0) - background.g;
    const db = (image.data[p + 2] ?? 0) - background.b;

    const departure = Math.hypot(dr, dg, db);
    if (departure < minInk) continue;

    let best = -1;
    let bestResidual = Infinity;
    let bestAlpha = 0;

    for (let k = 0; k < dirs.length; k += 1) {
      const dir = dirs[k]!;
      // How much of this ink would explain the pixel, allowing a little over
      // 1 for a stroke drawn slightly darker than its own palette entry.
      const t = Math.min(
        1.2,
        Math.max(0, (dr * dir.dr + dg * dir.dg + db * dir.db) / dir.lengthSq),
      );
      const residual = Math.hypot(dr - t * dir.dr, dg - t * dir.dg, db - t * dir.db);
      if (residual < bestResidual) {
        bestResidual = residual;
        bestAlpha = Math.min(1, t);
        best = k;
      }
    }

    /*
     * A pixel that no ink explains is left out entirely rather than given to
     * the nearest one. That is what a JPEG's coloured ringing looks like, and
     * what the blend at a crossing of two different colours looks like, and
     * both are better dropped than filed under a colour they are not.
     */
    if (best < 0 || bestResidual > Math.max(26, departure * 0.4)) continue;

    inks[best]!.data[i] = bestAlpha;
    coverage[best] = (coverage[best] ?? 0) + bestAlpha;
  }

  const layers: InkLayer[] = palette.map((colour, index) => {
    const ink = inks[index]!;
    const classified = classify(colour, background);
    const override = options.assignments?.[index];
    return {
      colour,
      assignment: override ?? classified.assignment,
      role: override === undefined ? classified.role : "crease",
      reason: override === undefined ? classified.reason : "Set by hand.",
      coverage: (coverage[index] ?? 0) / Math.max(1, pixels),
      ink,
      dashed: isDashed(ink),
    };
  });

  return { background, layers: promoteSecondFamily(layers) };
}

/* -------------------------------------------------------------------------- */

/**
 * The ink colours, as the modes of a histogram over stroke *cores*.
 *
 * The first version of this histogrammed every pixel that differed from the
 * paper, and it did not work, for a reason worth writing down. A red line two
 * pixels wide is not two pixels of red. It is a core of red with a skirt of
 * every pink between red and white, and there are as many skirt pixels as core
 * ones — so the histogram grows a second peak in the middle of the skirt, that
 * peak becomes "an ink colour", and from then on half of every red crease is
 * filed under a colour nobody drew with. The pattern comes back doubled,
 * fragmented, and with a phantom layer in the import notes.
 *
 * A stroke's core is where its departure from the paper is a local maximum.
 * Skirt pixels never are, by construction: they sit on the ramp between the
 * core and the paper. So restricting the histogram to local maxima is the
 * whole fix, and it is exact rather than a threshold that happened to work —
 * the blends are then explained by the unmixing, which is what the unmixing is
 * for.
 *
 * It separates a pale grey reference grid from a black outline for the same
 * reason: their skirts overlap completely, and their cores do not.
 */
function buildPalette(
  image: RgbImage,
  background: Rgb,
  options: { maxLayers: number; mergeDistance: number; minInk: number },
): Rgb[] {
  const { width, height } = image;
  const departure = new Float32Array(width * height);
  for (let i = 0, p = 0; i < departure.length; i += 1, p += 3) {
    departure[i] = colourDistance(
      { r: image.data[p] ?? 0, g: image.data[p + 1] ?? 0, b: image.data[p + 2] ?? 0 },
      background,
    );
  }

  const bins = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const here = departure[i] ?? 0;
      if (here < options.minInk) continue;

      // Ridge test: no neighbour is more inked than this pixel. Ties count, so
      // the flat middle of a three-pixel stroke qualifies along its whole
      // length rather than only where rounding happened to favour it.
      let peak = true;
      for (let dy = -1; dy <= 1 && peak; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          if ((departure[i + dy * width + dx] ?? 0) > here) {
            peak = false;
            break;
          }
        }
      }
      if (!peak) continue;

      const p = i * 3;
      const r = image.data[p] ?? 0;
      const g = image.data[p + 1] ?? 0;
      const b = image.data[p + 2] ?? 0;
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
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
  }

  const modes = [...bins.values()]
    .map((bin) => ({
      count: bin.count,
      colour: { r: bin.r / bin.count, g: bin.g / bin.count, b: bin.b / bin.count },
    }))
    .sort((a, b) => b.count - a.count);

  let total = 0;
  for (const mode of modes) total += mode.count;

  const palette: Rgb[] = [];
  for (const mode of modes) {
    if (palette.length >= options.maxLayers) break;
    // A colour has to be worth a half percent of the ridge pixels to be its
    // own layer. Below that it is a compression artefact, or the one pixel
    // where two differently coloured creases cross.
    if (mode.count < Math.max(12, total * 0.005)) break;
    if (palette.some((chosen) => colourDistance(chosen, mode.colour) < options.mergeDistance)) {
      continue;
    }
    palette.push(mode.colour);
  }

  return palette;
}

/* -------------------------------------------------------------------------- */

interface Classification {
  readonly assignment: EdgeAssignment;
  readonly role: InkRole;
  readonly reason: string;
}

/**
 * What a colour means.
 *
 * Red is mountain and blue is valley. That is the Origami Simulator palette,
 * it is what ORIPA, Oriedita and every CP posted in the last twenty years use,
 * and DESIGN.md §3.3 already names it as the convention the SVG importer reads.
 * This is the same table, applied to pixels instead of to stroke attributes.
 *
 * The hue boundaries are wide because published patterns are not colour
 * managed: a "red" off a JPEG can be anywhere from vermilion to crimson, and a
 * "blue" is as often cyan or indigo. Magenta is split at 315°, which is roughly
 * where a purple stops reading as a warm colour.
 */
function classify(colour: Rgb, background: Rgb): Classification {
  const { h, s, v } = toHsv(colour);
  const contrast = colourDistance(colour, background);

  /*
   * Faint and colourless is scaffolding. Both halves matter: a faint *red* is
   * a mountain drawn thin or half-dissolved by resampling and must be kept,
   * while a strong grey is a paper edge and must also be kept. Only the
   * intersection — pale, neutral — is the reference grid.
   */
  if (s < 0.16 && contrast < 110) {
    return {
      assignment: "U",
      role: "guide",
      reason: "Pale grey: read as a reference grid and left out.",
    };
  }

  if (s < 0.18) {
    return v < 0.45
      ? { assignment: "B", role: "crease", reason: "Black: read as the paper edge." }
      : { assignment: "U", role: "crease", reason: "Grey: kept, but unassigned." };
  }

  if (h >= 330 || h < 45) {
    return { assignment: "M", role: "crease", reason: "Red: mountain." };
  }
  if (h >= 165 && h < 315) {
    return { assignment: "V", role: "crease", reason: "Blue: valley." };
  }

  // Yellow, green and the magentas nobody has a convention for. Kept as
  // creases, because they were plainly drawn on purpose, but not guessed at.
  return {
    assignment: "U",
    role: "crease",
    reason: "No standard meaning for this colour: left unassigned.",
  };
}

/**
 * If the drawing has one crease family and one unexplained colour, the
 * unexplained colour is the other family.
 *
 * Plenty of published patterns are drawn red-and-green, or black-and-green, or
 * in two colours from a palette that had nothing to do with origami. Nothing
 * about the hue says which is which, but a crease pattern with mountains and no
 * valleys is not a crease pattern, and a second colour used at comparable
 * weight is not a coincidence. So it is promoted, and the reason says so, so
 * that a person reading the import notes can disagree.
 */
function promoteSecondFamily(layers: readonly InkLayer[]): InkLayer[] {
  const sorted = [...layers].sort((a, b) => b.coverage - a.coverage);
  const creases = sorted.filter((layer) => layer.role === "crease");
  const hasMountain = creases.some((layer) => layer.assignment === "M");
  const hasValley = creases.some((layer) => layer.assignment === "V");
  if (hasMountain === hasValley) return sorted;

  const candidate = creases.find((layer) => layer.assignment === "U" && isChromatic(layer.colour));
  if (!candidate) return sorted;

  const missing: EdgeAssignment = hasMountain ? "V" : "M";
  return sorted.map((layer) =>
    layer === candidate
      ? {
          ...layer,
          assignment: missing,
          reason: `The only other colour in the drawing: read as ${
            missing === "V" ? "valley" : "mountain"
          }.`,
        }
      : layer,
  );
}

function isChromatic(colour: Rgb): boolean {
  return toHsv(colour).s >= 0.18;
}

/* -------------------------------------------------------------------------- */

/**
 * Is this layer drawn as dashes?
 *
 * Measured as the size of its connected pieces. A solid stroke is one long
 * component; a dotted line of the same length is fifty tiny ones. The answer
 * is reported rather than acted on: dashes mean different things in different
 * people's notation, and guessing would be worse than saying what was seen.
 */
function isDashed(ink: GrayImage): boolean {
  const { width, height, data } = ink;
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  let components = 0;
  let inkPixels = 0;
  let largest = 0;

  for (let start = 0; start < data.length; start += 1) {
    if (seen[start] === 1 || (data[start] ?? 0) < 0.4) continue;
    seen[start] = 1;
    stack.push(start);
    let size = 0;

    while (stack.length > 0) {
      const index = stack.pop()!;
      size += 1;
      const x = index % width;
      const y = (index - x) / width;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (seen[next] === 1 || (data[next] ?? 0) < 0.4) continue;
          seen[next] = 1;
          stack.push(next);
        }
      }
    }

    components += 1;
    inkPixels += size;
    if (size > largest) largest = size;
  }

  if (components < 20 || inkPixels === 0) return false;
  const mean = inkPixels / components;
  /*
   * Short pieces, and no single long one holding the layer together.
   *
   * "Short" has to mean *dash* short. A solid layer is broken into pieces too,
   * wherever a crease of another colour is drawn across it — the boundary of a
   * 32-grid box pleat arrives in sixty pieces — and calling that dotted is
   * wrong twice over: it says so in the import notes, and it bridges gaps that
   * were creases crossing rather than ink missing.
   */
  return mean < 26 && largest < inkPixels * 0.25;
}
