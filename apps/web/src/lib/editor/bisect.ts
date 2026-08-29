import type { EditorDoc } from "./model";

/**
 * Bisection, which is most of what folding paper actually is.
 *
 * Two of the seven Huzita–Justin axioms are here: fold one point onto another
 * (the perpendicular bisector of the two, which is how you find a midpoint
 * without measuring), and fold one crease onto another (the angle bisector,
 * which is how a 22.5° system gets built out of a 45° one). Both are things a
 * designer does constantly and neither is something anybody wants to do by
 * typing coordinates.
 */

export type Point = readonly [number, number];

/** Two points closer than this are the same point. */
const EPSILON = 1e-6;

function near(a: Point, b: Point, tolerance = EPSILON): boolean {
  return Math.abs(a[0] - b[0]) <= tolerance && Math.abs(a[1] - b[1]) <= tolerance;
}

/** Into (-π, π]. */
function normalizeAngle(radians: number): number {
  const wrapped = ((radians + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  return wrapped - Math.PI;
}

/**
 * The directions of every crease leaving `point`.
 *
 * A crease that merely *passes through* the point counts as two directions,
 * because for bisection purposes it is two rays: the angle between a line and
 * itself is not what anybody means by "bisect these".
 */
export function directionsAt(doc: EditorDoc, point: Point, tolerance = 1e-4): number[] {
  const directions: number[] = [];
  for (const segment of doc) {
    const a: Point = [segment.x1, segment.y1];
    const b: Point = [segment.x2, segment.y2];
    if (near(a, point, tolerance)) directions.push(Math.atan2(b[1] - a[1], b[0] - a[0]));
    else if (near(b, point, tolerance)) directions.push(Math.atan2(a[1] - b[1], a[0] - b[0]));
  }
  return directions;
}

export interface BisectorHit {
  /** Where the crease being drawn should end. */
  readonly point: Point;
  /** The direction it was snapped to. */
  readonly direction: number;
  /** The two crease directions it sits between, for drawing the mark. */
  readonly between: readonly [number, number];
}

/**
 * Snap a direction to the bisector of the creases it is drawn between.
 *
 * Only from a point that already has two or more creases at it, which is
 * exactly when a bisector is a thing somebody could mean. The tolerance is
 * angular rather than in pixels so it behaves the same at every zoom: five
 * degrees is close enough to catch an intention and far enough that a
 * deliberate 30° line does not get dragged to 22.5°.
 *
 * The result keeps the length the pointer asked for and changes only the
 * direction, so the crease still ends where the hand is reaching.
 */
export function snapToBisector(
  start: Point,
  target: Point,
  doc: EditorDoc,
  toleranceDegrees = 5,
): BisectorHit | null {
  const length = Math.hypot(target[0] - start[0], target[1] - start[1]);
  if (length < EPSILON) return null;

  const directions = directionsAt(doc, start);
  if (directions.length < 2) return null;

  const sorted = [...directions].sort((a, b) => a - b);
  const raw = Math.atan2(target[1] - start[1], target[0] - start[0]);
  const tolerance = (toleranceDegrees * Math.PI) / 180;

  let best: BisectorHit | null = null;
  let bestDistance = tolerance;

  for (let i = 0; i < sorted.length; i += 1) {
    const a = sorted[i] as number;
    const b = (sorted[(i + 1) % sorted.length] as number) + (i + 1 === sorted.length ? 2 * Math.PI : 0);
    const gap = b - a;
    // A pair opening onto a straight line has no meaningful bisector to speak
    // of and one opening onto nothing has none at all.
    if (gap < 1e-3 || gap > 2 * Math.PI - 1e-3) continue;

    const direction = normalizeAngle(a + gap / 2);
    const distance = Math.abs(normalizeAngle(direction - raw));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = {
        point: [start[0] + Math.cos(direction) * length, start[1] + Math.sin(direction) * length],
        direction,
        between: [normalizeAngle(a), normalizeAngle(b)],
      };
    }
  }

  return best;
}

export interface Segment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/**
 * The crease that folds `a` onto `b`: their perpendicular bisector, clipped to
 * the sheet.
 *
 * Huzita–Justin axiom 2, and the reason the tool exists. It passes through the
 * midpoint of the two points, which is how you halve a segment in paper: you
 * do not measure it, you bring one end to the other.
 *
 * Clipped to the unit square because that is the paper. Every pattern in this
 * editor is normalised to it, so the four edges are `x = 0`, `x = 1`, `y = 0`,
 * `y = 1` and nothing else needs to be known about the sheet's shape.
 */
export function perpendicularBisector(a: Point, b: Point): Segment | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (Math.hypot(dx, dy) < 1e-4) return null;

  const midpoint: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  // Perpendicular to a→b.
  return clipToUnitSquare(midpoint, [-dy, dx]);
}

/**
 * An infinite line through `origin` along `direction`, cut down to the sheet.
 *
 * Liang–Barsky, which is the shortest correct way to do this: walk the four
 * edges as inequalities and keep the interval of the parameter that satisfies
 * all of them. The alternative — intersect with each edge and sort the hits —
 * needs special cases for a line that runs along an edge and for one that
 * clips a corner exactly.
 */
export function clipToUnitSquare(origin: Point, direction: Point): Segment | null {
  let low = -Infinity;
  let high = Infinity;

  const limits: readonly [number, number][] = [
    [-direction[0], origin[0] - 0],
    [direction[0], 1 - origin[0]],
    [-direction[1], origin[1] - 0],
    [direction[1], 1 - origin[1]],
  ];

  for (const [p, q] of limits) {
    if (Math.abs(p) < 1e-12) {
      // Parallel to this edge: outside it means outside the square entirely.
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) low = Math.max(low, r);
    else high = Math.min(high, r);
  }

  if (low >= high) return null;

  const segment = {
    x1: origin[0] + direction[0] * low,
    y1: origin[1] + direction[1] * low,
    x2: origin[0] + direction[0] * high,
    y2: origin[1] + direction[1] * high,
  };
  // A line grazing a corner produces a zero-length crease, which is a defect
  // rather than a fold.
  return Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1) < 1e-4 ? null : segment;
}
