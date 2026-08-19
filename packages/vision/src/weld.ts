import type { Line } from "./segments.js";

/**
 * Making the ends of creases actually meet.
 *
 * This is the single loudest failure of every crease pattern read off a
 * picture, and it is not a failure of detection. The lines are all there and
 * all correct to within a pixel; it is that a pixel, at the working size, is
 * about a thousandth of the paper, and four creases that meet at a vertex come
 * back as four creases that pass within a thousandth of each other. That
 * pattern renders indistinguishably from the right one and is wrong in every
 * way that matters: `planarize` splits nothing, the vertex has degree zero,
 * Maekawa has nothing to constrain, the validator reports four dangling
 * creases, and the simulator tears the paper.
 *
 * Three operations fix it, and the order they run in is the whole design.
 *
 *   1. `weldEndpoints`: ends that nearly coincide become one point.
 *   2. `healJunctions`: an end that nearly touches another crease's body is
 *      moved onto it, at the exact intersection of the two lines.
 *   3. `weldEndpoints` again, because step 2 creates new coincidences.
 *
 * Every one of them repairs a measurement rather than inventing geometry.
 * Nothing moves further than the tolerance, no crease is created, none is
 * deleted, and, this matters more than it sounds, no crease changes
 * direction, because `healJunctions` slides an endpoint *along its own line* to
 * the intersection rather than pulling it sideways onto its neighbour.
 */

/** How far a point may move, as a fraction of the paper. */
export const DEFAULT_WELD_TOLERANCE = 0.006;

interface Endpoint {
  readonly line: number;
  /** 0 for the first end, 1 for the second. */
  readonly end: 0 | 1;
  x: number;
  y: number;
}

/**
 * Merge endpoints that lie within `tolerance` of each other onto their mean.
 *
 * Clustered transitively through a spatial hash, so a chain of five ends each
 * a third of a tolerance from the next becomes one vertex rather than five
 * pairwise compromises. Transitivity is the right call here because the input
 * really is one vertex measured five times; the tolerance is small enough that
 * a chain long enough to drift somewhere wrong cannot form.
 */
export function weldEndpoints<T extends Line>(
  lines: readonly T[],
  tolerance = DEFAULT_WELD_TOLERANCE,
  anchored: readonly boolean[] = [],
): T[] {
  if (lines.length === 0 || tolerance <= 0) return [...lines];

  const points: Endpoint[] = [];
  lines.forEach((line, index) => {
    points.push({ line: index, end: 0, x: line.x1, y: line.y1 });
    points.push({ line: index, end: 1, x: line.x2, y: line.y2 });
  });

  const parent = points.map((_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root]!;
    let walk = i;
    while (parent[walk] !== root) {
      const next = parent[walk]!;
      parent[walk] = root;
      walk = next;
    }
    return root;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const cells = new Map<string, number[]>();
  const key = (x: number, y: number): string =>
    `${Math.floor(x / tolerance)},${Math.floor(y / tolerance)}`;
  points.forEach((point, index) => {
    const k = key(point.x, point.y);
    const bucket = cells.get(k);
    if (bucket) bucket.push(index);
    else cells.set(k, [index]);
  });

  points.forEach((point, index) => {
    const cx = Math.floor(point.x / tolerance);
    const cy = Math.floor(point.y / tolerance);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        for (const other of cells.get(`${cx + dx},${cy + dy}`) ?? []) {
          if (other <= index) continue;
          const candidate = points[other]!;
          if (Math.hypot(candidate.x - point.x, candidate.y - point.y) <= tolerance) {
            union(index, other);
          }
        }
      }
    }
  });

  /*
   * Where each cluster settles.
   *
   * The mean of its points, except that an anchored point wins outright. The
   * paper's outline is exact geometry the caller supplied rather than a
   * measurement, so a crease tip near a corner should move *to* the corner,
   * averaging the two would drag the corner of the sheet inwards by half the
   * tip's error, which is both wrong and impossible to notice.
   */
  const sums = new Map<number, { x: number; y: number; n: number; anchored: boolean }>();
  points.forEach((point, index) => {
    const root = find(index);
    const fixed = anchored[point.line] === true;
    const sum = sums.get(root);
    if (!sum) {
      sums.set(root, { x: point.x, y: point.y, n: 1, anchored: fixed });
      return;
    }
    if (sum.anchored && !fixed) return;
    if (fixed && !sum.anchored) {
      sum.x = point.x;
      sum.y = point.y;
      sum.n = 1;
      sum.anchored = true;
      return;
    }
    sum.x += point.x;
    sum.y += point.y;
    sum.n += 1;
  });

  const moved = lines.map((line) => ({ ...line }));
  points.forEach((point, index) => {
    const sum = sums.get(find(index))!;
    const x = sum.x / sum.n;
    const y = sum.y / sum.n;
    const target = moved[point.line]! as { x1: number; y1: number; x2: number; y2: number };
    if (point.end === 0) {
      target.x1 = x;
      target.y1 = y;
    } else {
      target.x2 = x;
      target.y2 = y;
    }
  });

  return moved;
}

/**
 * Slide endpoints that nearly touch another crease onto it, exactly.
 *
 * The two cases this covers look different on screen and are the same
 * arithmetic. A crease that stops a pixel short of the one it should meet is a
 * T-junction the topology misses; a crease that runs a pixel past it leaves a
 * whisker hanging off the far side, which `planarize` faithfully turns into a
 * degree-one vertex and the validator faithfully reports. Moving the end to
 * where the two infinite lines cross fixes both, and moves it along its own
 * direction, so the crease keeps the angle it was measured at.
 *
 * Deliberately *not* covered: an end that is nowhere near anything. Extending
 * that to the nearest crease would be inventing a vertex, the result would
 * validate perfectly, and it would be wrong.
 */
export function healJunctions<T extends Line>(
  lines: readonly T[],
  tolerance = DEFAULT_WELD_TOLERANCE,
  anchored: readonly boolean[] = [],
): T[] {
  if (tolerance <= 0) return [...lines];
  const out = lines.map((line) => ({ ...line }));

  for (let i = 0; i < out.length; i += 1) {
    // An anchored line is a target, never a subject: it is exact already.
    if (anchored[i] === true) continue;
    const line = out[i]! as { x1: number; y1: number; x2: number; y2: number };
    for (const end of [0, 1] as const) {
      const px = end === 0 ? line.x1 : line.x2;
      const py = end === 0 ? line.y1 : line.y2;

      let bestX = px;
      let bestY = py;
      let bestDistance = tolerance;

      for (let j = 0; j < out.length; j += 1) {
        if (j === i) continue;
        const other = out[j]!;

        const distance = distanceToSegment(other, px, py);
        // Already on it, or too far to be a measurement error. The lower bound
        // keeps the pass idempotent: a second run finds nothing to do.
        if (distance <= 1e-9 || distance > tolerance) continue;

        const crossing = intersect(line, other);
        if (!crossing) continue;

        const travel = Math.hypot(crossing.x - px, crossing.y - py);
        if (travel > tolerance || travel >= bestDistance) continue;
        // The crossing has to be on the other crease, not somewhere off the
        // end of it. A little slack, because the far crease's own end is
        // measured too.
        if (!within(other, crossing.x, crossing.y, tolerance)) continue;

        bestDistance = travel;
        bestX = crossing.x;
        bestY = crossing.y;
      }

      if (end === 0) {
        line.x1 = bestX;
        line.y1 = bestY;
      } else {
        line.x2 = bestX;
        line.y2 = bestY;
      }
    }
  }

  return out;
}

/**
 * Weld, heal, weld. The order the comment at the top of this file explains.
 *
 * `anchored` marks lines that are known rather than measured. In practice the
 * paper's outline. They take part as targets and never move, so creases land
 * exactly on the sheet's edge instead of pulling it about.
 */
export function healGeometry<T extends Line>(
  lines: readonly T[],
  tolerance = DEFAULT_WELD_TOLERANCE,
  anchored: readonly boolean[] = [],
): T[] {
  return weldEndpoints(
    healJunctions(weldEndpoints(lines, tolerance, anchored), tolerance, anchored),
    tolerance,
    anchored,
  );
}

/**
 * Pull endpoints that are nearly on the paper's edge exactly onto it.
 *
 * The paper's outline is added by the caller as exact geometry, and a crease
 * that reaches the edge has to *land* on it, not stop a thousandth short. It
 * matters most at the corners, where the two ends of a diagonal and the two
 * ends of two boundary edges all want to be the same point: miss by a pixel
 * and the corner becomes a T-junction with a whisker, which is a defect the
 * validator reports and the simulator tears at.
 *
 * Clamped as well as snapped, because a stroke's outer anti-aliased edge can
 * put a measured endpoint a hair outside the sheet.
 */
export function snapToPaper<T extends Line>(
  lines: readonly T[],
  paper: { readonly width: number; readonly height: number },
  tolerance = DEFAULT_WELD_TOLERANCE,
): T[] {
  const clamp = (value: number, extent: number): number => {
    if (Math.abs(value) <= tolerance) return 0;
    if (Math.abs(value - extent) <= tolerance) return extent;
    return Math.min(extent, Math.max(0, value));
  };

  return lines.map((line) => ({
    ...line,
    x1: clamp(line.x1, paper.width),
    y1: clamp(line.y1, paper.height),
    x2: clamp(line.x2, paper.width),
    y2: clamp(line.y2, paper.height),
  }));
}

/** Drop segments shorter than `minimum` and pairs that describe the same crease. */
export function dropDegenerate<T extends Line>(lines: readonly T[], minimum: number): T[] {
  const kept: T[] = [];
  for (const line of lines) {
    if (Math.hypot(line.x2 - line.x1, line.y2 - line.y1) < minimum) continue;
    if (kept.some((existing) => sameSegment(existing, line, minimum / 2))) continue;
    kept.push(line);
  }
  return kept;
}

function sameSegment(a: Line, b: Line, tolerance: number): boolean {
  const forward =
    Math.hypot(a.x1 - b.x1, a.y1 - b.y1) <= tolerance &&
    Math.hypot(a.x2 - b.x2, a.y2 - b.y2) <= tolerance;
  const reversed =
    Math.hypot(a.x1 - b.x2, a.y1 - b.y2) <= tolerance &&
    Math.hypot(a.x2 - b.x1, a.y2 - b.y1) <= tolerance;
  return forward || reversed;
}

/** Where the two infinite lines cross, or null when they are near parallel. */
function intersect(a: Line, b: Line): { x: number; y: number } | null {
  const ax = a.x2 - a.x1;
  const ay = a.y2 - a.y1;
  const bx = b.x2 - b.x1;
  const by = b.y2 - b.y1;

  const denominator = ax * by - ay * bx;
  const scale = Math.hypot(ax, ay) * Math.hypot(bx, by);
  // Relative rather than absolute: two short creases at a decent angle have a
  // small cross product and are not parallel, and an absolute epsilon would
  // decline to heal exactly the fiddly junctions that most need it.
  if (scale < 1e-12 || Math.abs(denominator) < scale * 1e-6) return null;

  const t = ((b.x1 - a.x1) * by - (b.y1 - a.y1) * bx) / denominator;
  return { x: a.x1 + ax * t, y: a.y1 + ay * t };
}

/** Is the point within the segment's span, allowing `slack` past each end? */
function within(line: Line, x: number, y: number, slack: number): boolean {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < 1e-18) return false;
  const t = ((x - line.x1) * dx + (y - line.y1) * dy) / lengthSq;
  const margin = slack / Math.sqrt(lengthSq);
  return t >= -margin && t <= 1 + margin;
}

function distanceToSegment(line: Line, x: number, y: number): number {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < 1e-18) return Math.hypot(x - line.x1, y - line.y1);
  const t = Math.min(1, Math.max(0, ((x - line.x1) * dx + (y - line.y1) * dy) / lengthSq));
  return Math.hypot(x - (line.x1 + t * dx), y - (line.y1 + t * dy));
}
