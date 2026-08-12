import { sampleBilinear, type GrayImage } from "./image.js";
import type { Line } from "./segments.js";

/**
 * What the photograph has to say about which way a crease went.
 *
 * Not much, and this file is careful to claim no more than it can support.
 *
 * A crease in a sheet that has been opened out again is not perfectly flat. It
 * stands slightly proud on one side and slightly hollow on the other, and under
 * directional light that shows up as a thin bright line or a thin dark one. So
 * a signed measurement across each crease does carry a signal.
 *
 * What it does not carry is a *label*. Whether bright means mountain depends on
 * where the lamp was, which nothing here knows. What survives is the
 * separation: creases that went the same way tend to score alike, and creases
 * that went opposite ways tend to score opposite. So this is used as a weak
 * prior that helps Maekawa's search pick between two mirror-image solutions,
 * and never as an assignment in its own right.
 *
 * Read the sign as "bright side up", check the result, and turn the whole
 * pattern over if it came out backwards. The UI offers exactly that button.
 */

export interface ShadingOptions {
  /** Half-width of the profile sampled across each crease, in pixels. */
  readonly halfWidth?: number;
  /** Samples taken along the crease and averaged. */
  readonly samples?: number;
  /** Fraction of each end skipped, where creases meet and the profile is noisy. */
  readonly endMargin?: number;
}

/**
 * A signed score per segment, roughly -1 to +1.
 *
 * Positive means the crease reads brighter than the paper beside it. Zero means
 * the profile was flat, or the crease was too short to sample, and the solver
 * should treat it as no information at all rather than as a weak vote.
 */
export function shadingPrior(
  image: GrayImage,
  segments: readonly Line[],
  options: ShadingOptions = {},
): number[] {
  const halfWidth = options.halfWidth ?? 4;
  const samples = options.samples ?? 24;
  const endMargin = options.endMargin ?? 0.15;

  return segments.map((segment) => {
    const dx = segment.x2 - segment.x1;
    const dy = segment.y2 - segment.y1;
    const length = Math.hypot(dx, dy);
    if (length < 4) return 0;

    // Unit vector across the crease.
    const nx = -dy / length;
    const ny = dx / length;

    let centre = 0;
    let flanks = 0;
    let centreCount = 0;
    let flankCount = 0;

    for (let s = 0; s < samples; s += 1) {
      const t = endMargin + ((1 - 2 * endMargin) * s) / Math.max(1, samples - 1);
      const px = segment.x1 + dx * t;
      const py = segment.y1 + dy * t;

      for (let offset = -halfWidth; offset <= halfWidth; offset += 1) {
        const value = sampleBilinear(image, px + nx * offset, py + ny * offset);
        if (Math.abs(offset) <= 1) {
          centre += value;
          centreCount += 1;
        } else if (Math.abs(offset) >= halfWidth - 1) {
          flanks += value;
          flankCount += 1;
        }
      }
    }

    if (centreCount === 0 || flankCount === 0) return 0;

    const contrast = centre / centreCount - flanks / flankCount;
    // The scale is empirical: a crease in a flattened image departs from the
    // paper around it by a few percent, so this maps a 5% difference to about
    // 0.76 and leaves anything under a percent as near enough nothing.
    return Math.tanh(contrast * 20);
  });
}

/**
 * Spread a per-segment prior over the edges of the planarized graph.
 *
 * Planarization splits crossing creases, so one detected segment becomes
 * several edges. Each edge inherits the prior of whichever segment it lies
 * along, matched by midpoint distance and direction.
 */
export function priorForEdges(
  edges: readonly (readonly [number, number])[],
  vertices: readonly (readonly [number, number])[],
  segments: readonly Line[],
  segmentPrior: readonly number[],
  tolerance = 0.02,
): number[] {
  return edges.map((edge) => {
    const a = vertices[edge[0]];
    const b = vertices[edge[1]];
    if (!a || !b) return 0;

    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;

    let best = 0;
    let bestDistance = tolerance;

    segments.forEach((segment, i) => {
      const distance = distanceToSegment(segment, mx, my);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = segmentPrior[i] ?? 0;
      }
    });

    return best;
  });
}

function distanceToSegment(segment: Line, x: number, y: number): number {
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 1e-12) return Math.hypot(x - segment.x1, y - segment.y1);

  const t = Math.min(
    1,
    Math.max(0, ((x - segment.x1) * dx + (y - segment.y1) * dy) / lengthSquared),
  );
  return Math.hypot(x - (segment.x1 + t * dx), y - (segment.y1 + t * dy));
}
