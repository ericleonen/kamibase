import type { EdgeAssignment } from "@kamibase/core";
import type { Line } from "../src/segments.js";
import type { Crease } from "./drawing.js";

/**
 * How to tell whether a scan is any good.
 *
 * Counting segments does not work, and the reason is structural rather than
 * fussy. `planarize` splits every crease at every crossing, so one drawn line
 * across a 16-grid arrives back as sixteen edges, so a perfect reading scores 16
 * against an expected 1, and a reading that missed half the pattern can score
 * higher than one that found all of it. The same goes the other way: a detector
 * that reports one crease in three fragments has not made three mistakes.
 *
 * So everything here is measured in *length*. For each crease that was drawn:
 * what share of it is covered by detected edges lying along it, and of that
 * share, how much carries the assignment it was drawn with. And the other way
 * round, so that a reading cannot win by drawing extra: what share of the
 * detected length lies along nothing that was ever drawn.
 *
 * Those three numbers, coverage, assignment accuracy, and spurious length,
 * are what "the lines do not quite match up" means when it is made precise.
 */

export interface Found extends Line {
  readonly assignment: EdgeAssignment;
}

export interface ScanQuality {
  /** Share of drawn crease length that was found. 1 is everything. */
  readonly coverage: number;
  /** Share of the found length whose assignment matches what was drawn. */
  readonly assignment: number;
  /** Share of detected crease length lying along nothing that was drawn. */
  readonly spurious: number;
  /** Per-pattern detail, for a failure message worth reading. */
  readonly worst: { readonly crease: Crease; readonly coverage: number } | null;
}

export interface QualityOptions {
  /** How far off its line a detected edge may sit, in paper units. */
  readonly tolerance?: number;
  /** How far off in direction, in degrees. */
  readonly angleToleranceDegrees?: number;
}

export function measure(
  found: readonly Found[],
  expected: readonly Crease[],
  options: QualityOptions = {},
): ScanQuality {
  const tolerance = options.tolerance ?? 0.012;
  const angleTolerance = ((options.angleToleranceDegrees ?? 4) * Math.PI) / 180;

  let expectedLength = 0;
  let coveredLength = 0;
  let agreeingLength = 0;
  let worst: { crease: Crease; coverage: number } | null = null;

  for (const crease of expected) {
    const total = lengthOf(crease);
    if (total < 1e-9) continue;
    expectedLength += total;

    const covered: [number, number][] = [];
    const agreeing: [number, number][] = [];

    for (const edge of found) {
      const span = overlapAlong(crease, edge, tolerance, angleTolerance);
      if (!span) continue;
      covered.push(span);
      if (edge.assignment === crease.assignment) agreeing.push(span);
    }

    // `union` works in `crease`'s own parameter, so it comes back as a share
    // of that crease and has to be put back into length before it can be
    // added to a total that spans creases of different lengths.
    const share = union(covered);
    coveredLength += share * total;
    agreeingLength += union(agreeing) * total;

    if (!worst || share < worst.coverage) worst = { crease, coverage: share };
  }

  let foundLength = 0;
  let explainedLength = 0;
  for (const edge of found) {
    if (edge.assignment === "B") continue;
    const total = lengthOf(edge);
    if (total < 1e-9) continue;
    foundLength += total;

    const explained: [number, number][] = [];
    for (const crease of expected) {
      const span = overlapAlong(edge, crease, tolerance, angleTolerance);
      if (span) explained.push(span);
    }
    explainedLength += union(explained) * total;
  }

  return {
    coverage: expectedLength === 0 ? 1 : coveredLength / expectedLength,
    assignment: coveredLength === 0 ? 0 : agreeingLength / coveredLength,
    spurious: foundLength === 0 ? 0 : 1 - explainedLength / foundLength,
    worst,
  };
}

/**
 * How much of `base` the segment `other` lies along, as a `[from, to]` span in
 * `base`'s own parameter, or null if it does not lie along it at all.
 *
 * Both ends have to be near `base`'s infinite line and the directions have to
 * agree. Requiring both is what stops a crease crossing at 90 degrees from
 * counting as a millimetre of coverage at every intersection.
 */
function overlapAlong(
  base: Line,
  other: Line,
  tolerance: number,
  angleTolerance: number,
): [number, number] | null {
  const dx = base.x2 - base.x1;
  const dy = base.y2 - base.y1;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return null;

  if (angleBetween(base, other) > angleTolerance) return null;

  const ux = dx / length;
  const uy = dy / length;
  const project = (x: number, y: number): { t: number; offset: number } => ({
    t: ((x - base.x1) * ux + (y - base.y1) * uy) / length,
    offset: Math.abs((x - base.x1) * -uy + (y - base.y1) * ux),
  });

  const a = project(other.x1, other.y1);
  const b = project(other.x2, other.y2);
  if (a.offset > tolerance || b.offset > tolerance) return null;

  const from = Math.max(0, Math.min(a.t, b.t));
  const to = Math.min(1, Math.max(a.t, b.t));
  return to > from ? [from, to] : null;
}

function angleBetween(a: Line, b: Line): number {
  const angle = (line: Line): number => {
    const raw = Math.atan2(line.y2 - line.y1, line.x2 - line.x1);
    return ((raw % Math.PI) + Math.PI) % Math.PI;
  };
  const difference = Math.abs(angle(a) - angle(b)) % Math.PI;
  return Math.min(difference, Math.PI - difference);
}

/** Total length of a set of possibly overlapping spans, as a fraction of 1. */
function union(spans: readonly [number, number][]): number {
  if (spans.length === 0) return 0;
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [start, end] = sorted[0]!;

  for (const [from, to] of sorted.slice(1)) {
    if (from > end) {
      total += end - start;
      start = from;
      end = to;
    } else if (to > end) {
      end = to;
    }
  }
  return total + (end - start);
}

function lengthOf(line: Line): number {
  return Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
}

/**
 * How many detected endpoints fail to coincide with any other endpoint.
 *
 * The direct measurement of "the lines do not quite match up": in a healed
 * pattern every interior endpoint is shared with at least one neighbour, so a
 * count of lonely ones is a count of junctions that did not close.
 */
export function danglingEnds(found: readonly Found[], epsilon = 1e-6): number {
  const ends: [number, number][] = [];
  for (const edge of found) {
    ends.push([edge.x1, edge.y1], [edge.x2, edge.y2]);
  }

  let lonely = 0;
  for (let i = 0; i < ends.length; i += 1) {
    const [x, y] = ends[i]!;
    const shared = ends.some(
      (other, j) => j !== i && Math.hypot(other[0] - x, other[1] - y) <= epsilon,
    );
    if (!shared) lonely += 1;
  }
  return lonely;
}
