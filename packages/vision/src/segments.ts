import { angleDistance, type DetectedSegment } from "./hough.js";

/**
 * Turning detected runs of pixels into creases somebody would recognise.
 *
 * Hough gives back what the photograph supports, which is not the same as what
 * was folded. One crease often arrives as two collinear pieces because a
 * highlight washed out its middle; a thick crease arrives twice; every endpoint
 * is a pixel or two short of where it belongs.
 *
 * The cleanup here is deliberately conservative, and specifically it does not
 * invent geometry. Extending a crease to a vertex it nearly reaches is
 * repairing a measurement; extending it to a vertex it never approached is
 * making one up, and the resulting pattern would validate perfectly while being
 * wrong. Everything below is the first kind.
 */

export interface Line {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export function length(line: Line): number {
  return Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
}

/** Direction of the line, folded into [0, pi). */
export function angleOf(line: Line): number {
  const raw = Math.atan2(line.y2 - line.y1, line.x2 - line.x1);
  return ((raw % Math.PI) + Math.PI) % Math.PI;
}

/** Map pixel coordinates in a square of `size` onto the unit square. */
export function toUnitSquare<T extends Line>(lines: readonly T[], size: number): T[] {
  return lines.map((line) => ({
    ...line,
    x1: line.x1 / size,
    y1: line.y1 / size,
    x2: line.x2 / size,
    y2: line.y2 / size,
  }));
}

/**
 * Join segments that are the same crease seen twice.
 *
 * Two pieces merge when they point the same way, sit on the same line, and
 * either overlap or nearly touch. The merged segment is the extreme span of
 * both, which is right for the split-by-a-highlight case and harmless for the
 * overlap case.
 */
export function mergeCollinear<T extends DetectedSegment>(
  segments: readonly T[],
  options: { angleToleranceDegrees?: number; offsetTolerance?: number; gapTolerance?: number } = {},
): DetectedSegment[] {
  const angleTolerance = ((options.angleToleranceDegrees ?? 3) * Math.PI) / 180;
  const offsetTolerance = options.offsetTolerance ?? 6;
  const gapTolerance = options.gapTolerance ?? 8;

  // Longest first, so a long crease absorbs its fragments rather than the other
  // way round.
  const pending = [...segments].sort((a, b) => length(b) - length(a));
  const out: DetectedSegment[] = [];

  for (const segment of pending) {
    let merged = false;

    for (let i = 0; i < out.length; i += 1) {
      const existing = out[i]!;
      if (angleDistance(angleOf(existing), angleOf(segment)) > angleTolerance) continue;

      /*
       * Measured at the midpoint, not at the far ends.
       *
       * Two Hough peaks describing one crease differ by a fraction of a degree,
       * which is nothing in the middle and several pixels 400px away. Testing
       * the endpoints therefore rejects exactly the pairs that most need
       * merging: the long ones. The tight angle check above is what keeps this
       * honest, since it is the angle, not the endpoint, that says whether two
       * fragments are the same crease.
       */
      const offset = distanceToLine(
        existing,
        (segment.x1 + segment.x2) / 2,
        (segment.y1 + segment.y2) / 2,
      );
      if (offset > offsetTolerance) continue;

      const span = projectedSpan(existing, segment);
      if (span.gap > gapTolerance) continue;

      out[i] = {
        ...span.line,
        strength: (existing.strength + segment.strength) / 2,
        support: existing.support + segment.support,
      };
      merged = true;
      break;
    }

    if (!merged) out.push(segment);
  }

  return removeSubsumed(out, offsetTolerance, angleTolerance * 2);
}

/**
 * Drop any segment that lies inside a longer one along the same line.
 *
 * The merge above is strict about angle, on purpose: it moves endpoints, so a
 * wrong merge damages the geometry. That strictness leaves behind the odd short
 * fragment whose angle drifted a degree too far, usually near a corner where
 * the crease fades.
 *
 * Removing it is a safer operation than merging it, because nothing moves and
 * nothing is lost: the fragment is already covered end to end by a crease that
 * is longer, straighter and better supported. So this pass runs at twice the
 * angular tolerance.
 */
function removeSubsumed(
  segments: readonly DetectedSegment[],
  offsetTolerance: number,
  angleTolerance: number,
): DetectedSegment[] {
  const byLength = [...segments].sort((a, b) => length(b) - length(a));

  return byLength.filter((segment, index) =>
    !byLength.some((longer, other) => {
      if (other >= index) return false;
      if (angleDistance(angleOf(longer), angleOf(segment)) > angleTolerance) return false;

      const midX = (segment.x1 + segment.x2) / 2;
      const midY = (segment.y1 + segment.y2) / 2;
      if (distanceToLine(longer, midX, midY) > offsetTolerance) return false;

      // Covered along its whole length, not merely pointing the same way from
      // somewhere else on the same line.
      const span = projectedSpan(longer, segment);
      return span.gap <= 0;
    }),
  );
}

function distanceToLine(line: Line, x: number, y: number): number {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return Math.hypot(x - line.x1, y - line.y1);
  return Math.abs((x - line.x1) * dy - (y - line.y1) * dx) / len;
}

/**
 * The span covering both segments along the first one's direction, and the gap
 * between them (negative when they overlap).
 */
function projectedSpan(base: Line, other: Line): { line: Line; gap: number } {
  const dx = base.x2 - base.x1;
  const dy = base.y2 - base.y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  const project = (x: number, y: number): number => (x - base.x1) * ux + (y - base.y1) * uy;

  const baseA = 0;
  const baseB = len;
  const otherA = project(other.x1, other.y1);
  const otherB = project(other.x2, other.y2);

  const baseLow = Math.min(baseA, baseB);
  const baseHigh = Math.max(baseA, baseB);
  const otherLow = Math.min(otherA, otherB);
  const otherHigh = Math.max(otherA, otherB);

  const gap = Math.max(otherLow - baseHigh, baseLow - otherHigh);

  const low = Math.min(baseLow, otherLow);
  const high = Math.max(baseHigh, otherHigh);

  return {
    gap,
    line: {
      x1: base.x1 + ux * low,
      y1: base.y1 + uy * low,
      x2: base.x1 + ux * high,
      y2: base.y1 + uy * high,
    },
  };
}

/**
 * Rotate segments onto the angles origami actually uses.
 *
 * Almost every crease pattern lives on a 22.5 degree lattice, which covers the
 * 45s and 90s of box pleating as well as the 22.5 system by name. A crease
 * measured at 44.3 degrees off a photograph is a 45 that the camera got
 * slightly wrong, and leaving it at 44.3 breaks Kawasaki at both of its ends.
 *
 * The tolerance is the safeguard: a crease that is nowhere near a lattice angle
 * is left exactly where it was found, because it might be a genuine one.
 */
export function snapAngles<T extends Line>(
  segments: readonly T[],
  options: { stepDegrees?: number; toleranceDegrees?: number } = {},
): T[] {
  const step = ((options.stepDegrees ?? 22.5) * Math.PI) / 180;
  const tolerance = ((options.toleranceDegrees ?? 4) * Math.PI) / 180;
  if (step <= 0) return [...segments];

  return segments.map((segment) => {
    const angle = angleOf(segment);
    const target = Math.round(angle / step) * step;
    if (angleDistance(angle, target) > tolerance) return segment;

    // Rotate about the midpoint so the crease stays where it was found rather
    // than swinging away from one end.
    const cx = (segment.x1 + segment.x2) / 2;
    const cy = (segment.y1 + segment.y2) / 2;
    const half = length(segment) / 2;
    const ux = Math.cos(target);
    const uy = Math.sin(target);

    return {
      ...segment,
      x1: cx - ux * half,
      y1: cy - uy * half,
      x2: cx + ux * half,
      y2: cy + uy * half,
    };
  });
}

/**
 * Pull coordinates onto an n-by-n lattice when they are already close to it.
 *
 * Applied after angle snapping, because a crease at the right angle whose ends
 * are a pixel off still fails to meet its neighbours, and a vertex that is four
 * creases meeting in one point rather than four creases nearly meeting is the
 * difference between a valid pattern and a pile of defects.
 */
export function snapToGrid<T extends Line>(
  segments: readonly T[],
  divisions: number,
  tolerance: number,
): T[] {
  if (divisions < 1) return [...segments];
  const cell = 1 / divisions;

  const snap = (value: number): number => {
    const target = Math.round(value / cell) * cell;
    return Math.abs(target - value) <= tolerance ? target : value;
  };

  return segments.map((segment) => ({
    ...segment,
    x1: snap(segment.x1),
    y1: snap(segment.y1),
    x2: snap(segment.x2),
    y2: snap(segment.y2),
  }));
}

/**
 * Which lattice explains the endpoints best.
 *
 * Scores each candidate by the share of coordinates that land near one of its
 * lines, with a penalty for finer lattices: a 32 grid contains every point a 16
 * grid does, so without the penalty the answer is always the finest candidate
 * and the snapping does nothing.
 */
export function inferGrid(
  segments: readonly Line[],
  candidates: readonly number[] = [4, 8, 12, 16, 24, 32],
  tolerance = 0.02,
): number | null {
  const values: number[] = [];
  for (const segment of segments) {
    values.push(segment.x1, segment.y1, segment.x2, segment.y2);
  }
  if (values.length === 0) return null;

  let best: number | null = null;
  let bestScore = 0;

  for (const divisions of candidates) {
    const cell = 1 / divisions;
    let hits = 0;
    for (const value of values) {
      const distance = Math.abs(value - Math.round(value / cell) * cell);
      if (distance <= tolerance) hits += 1;
    }
    const share = hits / values.length;
    // The penalty makes a coarse lattice that explains everything beat a fine
    // one that explains everything by having a line everywhere.
    const score = share - divisions / 512;
    if (share > 0.9 && score > bestScore) {
      bestScore = score;
      best = divisions;
    }
  }

  return best;
}

/**
 * Pull endpoints that are nearly on the paper edge exactly onto it, and drop
 * anything outside.
 *
 * Rectification puts the sheet in the unit square by construction, so a crease
 * that reaches the edge should end at 0 or 1 exactly. Measured, it ends at
 * 0.003, which leaves a dangling crease and a vertex the validator complains
 * about.
 */
export function snapToBorder<T extends Line>(segments: readonly T[], tolerance = 0.02): T[] {
  const clamp = (value: number): number => {
    if (Math.abs(value) <= tolerance) return 0;
    if (Math.abs(value - 1) <= tolerance) return 1;
    return Math.min(1, Math.max(0, value));
  };

  return segments.map((segment) => ({
    ...segment,
    x1: clamp(segment.x1),
    y1: clamp(segment.y1),
    x2: clamp(segment.x2),
    y2: clamp(segment.y2),
  }));
}

/**
 * Drop creases that lie along the paper edge.
 *
 * The sheet's own outline is the strongest set of lines in any photograph of
 * it, so Hough finds all four every time. They are the boundary, which the
 * caller adds itself as `B` edges, and keeping these too would double every
 * edge of the square.
 */
export function removeBorderDuplicates<T extends Line>(
  segments: readonly T[],
  tolerance = 0.02,
): T[] {
  return segments.filter((segment) => {
    const onLeft = segment.x1 <= tolerance && segment.x2 <= tolerance;
    const onRight = segment.x1 >= 1 - tolerance && segment.x2 >= 1 - tolerance;
    const onTop = segment.y1 <= tolerance && segment.y2 <= tolerance;
    const onBottom = segment.y1 >= 1 - tolerance && segment.y2 >= 1 - tolerance;
    return !(onLeft || onRight || onTop || onBottom);
  });
}

/** Drop anything shorter than `minimum`, in unit-square lengths. */
export function dropShort<T extends Line>(segments: readonly T[], minimum: number): T[] {
  return segments.filter((segment) => length(segment) >= minimum);
}
