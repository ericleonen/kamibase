/**
 * Small 2D geometry kernel shared by the topology, validation and render
 * layers. Everything here is pure and allocation-light; the graph code calls
 * these in O(n^2) loops on ingest.
 */

/** A 2D point in normalized paper coordinates. */
export type Vec2 = readonly [number, number];

/**
 * Coordinate epsilon from DESIGN.md §2.4.5. Vertices closer than this in
 * normalized units are the same vertex.
 */
export const COORD_EPSILON = 1e-9;

/**
 * Working tolerance for intersection / collinearity predicates. Deliberately
 * looser than {@link COORD_EPSILON}: floating point error accumulates through
 * cross products, and a crossing test that is tighter than the arithmetic
 * noise reports phantom defects.
 */
export const GEOM_EPSILON = 1e-9;

/** Decimal places retained by the canonicalizer (DESIGN.md §2.5). */
export const CANONICAL_DECIMALS = 9;

const ROUND_FACTOR = 10 ** CANONICAL_DECIMALS;

/**
 * Round to the canonical 9 decimal places, mapping -0 to 0 so canonical JSON
 * never emits a negative zero.
 */
export function roundCanonical(value: number): number {
  if (!Number.isFinite(value)) return value;
  const rounded = Math.round(value * ROUND_FACTOR) / ROUND_FACTOR;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function roundPoint(p: Vec2): Vec2 {
  return [roundCanonical(p[0]), roundCanonical(p[1])];
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return [a[0] - b[0], a[1] - b[1]];
}

export function cross(a: Vec2, b: Vec2): number {
  return a[0] * b[1] - a[1] * b[0];
}

export function dot(a: Vec2, b: Vec2): number {
  return a[0] * b[0] + a[1] * b[1];
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function distanceSq(a: Vec2, b: Vec2): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

/** Angle of the vector b - a, in (-pi, pi]. */
export function angleOf(a: Vec2, b: Vec2): number {
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
}

/** Normalize an angle into [0, 2pi). */
export function normalizeAngle(theta: number): number {
  const twoPi = Math.PI * 2;
  const t = theta % twoPi;
  return t < 0 ? t + twoPi : t;
}

/** Lexicographic (x, then y) comparison: the canonical vertex order. */
export function compareLex(a: Vec2, b: Vec2): number {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
  return 0;
}

/** Squared distance from `p` to the segment `a`–`b`, plus the parameter t. */
export function projectOntoSegment(
  p: Vec2,
  a: Vec2,
  b: Vec2,
): { t: number; distance: number } {
  const ab = sub(b, a);
  const lenSq = dot(ab, ab);
  if (lenSq === 0) return { t: 0, distance: distance(p, a) };
  const raw = dot(sub(p, a), ab) / lenSq;
  const t = Math.min(1, Math.max(0, raw));
  const closest: Vec2 = [a[0] + ab[0] * t, a[1] + ab[1] * t];
  return { t, distance: distance(p, closest) };
}

/** Perpendicular distance from `p` to the infinite line through `a` and `b`. */
export function distanceToLine(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const len = Math.hypot(ab[0], ab[1]);
  if (len === 0) return distance(p, a);
  return Math.abs(cross(ab, sub(p, a))) / len;
}

export type SegmentIntersection =
  | { kind: "none" }
  /** Segments cross or touch at exactly one point. */
  | { kind: "point"; point: Vec2; tA: number; tB: number }
  /** Segments are collinear and their overlap has positive length. */
  | { kind: "collinear"; tA0: number; tA1: number };

/**
 * Intersect segments a0–a1 and b0–b1.
 *
 * Returns parametric positions along each segment so callers can decide
 * whether a hit is interior (a defect / a split point) or an endpoint touch
 * (normal in a well-formed crease pattern).
 */
export function intersectSegments(
  a0: Vec2,
  a1: Vec2,
  b0: Vec2,
  b1: Vec2,
  epsilon = GEOM_EPSILON,
): SegmentIntersection {
  const r = sub(a1, a0);
  const s = sub(b1, b0);
  const denom = cross(r, s);
  const qp = sub(b0, a0);

  const rLen = Math.hypot(r[0], r[1]);
  const sLen = Math.hypot(s[0], s[1]);
  if (rLen === 0 || sLen === 0) return { kind: "none" };

  // Scale-free parallelism test: |sin(angle)| below epsilon.
  if (Math.abs(denom) <= epsilon * rLen * sLen) {
    // Parallel. Collinear only if b0 lies on the line through a0/a1.
    if (distanceToLine(b0, a0, a1) > epsilon) return { kind: "none" };
    const rr = dot(r, r);
    const t0 = dot(qp, r) / rr;
    const t1 = dot(sub(b1, a0), r) / rr;
    const lo = Math.min(t0, t1);
    const hi = Math.max(t0, t1);
    const start = Math.max(0, lo);
    const end = Math.min(1, hi);
    if (end - start <= epsilon / rLen) return { kind: "none" };
    return { kind: "collinear", tA0: start, tA1: end };
  }

  const tA = cross(qp, s) / denom;
  const tB = cross(qp, r) / denom;
  // Convert the epsilon from world units to parameter units per segment.
  const padA = epsilon / rLen;
  const padB = epsilon / sLen;
  if (tA < -padA || tA > 1 + padA) return { kind: "none" };
  if (tB < -padB || tB > 1 + padB) return { kind: "none" };
  const point: Vec2 = [a0[0] + r[0] * tA, a0[1] + r[1] * tA];
  return { kind: "point", point, tA, tB };
}

/** Signed area of a simple polygon; positive when wound counter-clockwise. */
export function signedArea(points: readonly Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

/** True when `p` is inside the polygon or within `epsilon` of its boundary. */
export function pointInPolygon(
  p: Vec2,
  polygon: readonly Vec2[],
  epsilon = GEOM_EPSILON,
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (projectOntoSegment(p, a, b).distance <= epsilon) return true;
    const straddles = a[1] > p[1] !== b[1] > p[1];
    if (straddles) {
      const x = ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0];
      if (p[0] < x) inside = !inside;
    }
  }
  return inside;
}

/** Axis-aligned bounding box of a point set. */
export function boundingBox(points: readonly Vec2[]): {
  min: Vec2;
  max: Vec2;
} {
  if (points.length === 0) {
    return { min: [0, 0], max: [0, 0] };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { min: [minX, minY], max: [maxX, maxY] };
}
