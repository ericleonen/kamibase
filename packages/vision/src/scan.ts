import {
  graphFromSegments,
  planarize,
  type EdgeAssignment,
  type Segment,
} from "@kamibase/core";
import { inferAssignments, type AssignmentResult } from "./assign.js";
import { detectEdges, type EdgeOptions } from "./edges.js";
import { detectSegments, type HoughOptions } from "./hough.js";
import {
  downscale,
  flattenIllumination,
  normalizeContrast,
  type GrayImage,
} from "./image.js";
import { warpToSquare, type Quad } from "./quad.js";
import {
  dropShort,
  inferGrid,
  mergeCollinear,
  removeBorderDuplicates,
  snapAngles,
  snapToBorder,
  snapToGrid,
  toUnitSquare,
  type Line,
} from "./segments.js";
import { priorForEdges, shadingPrior } from "./shading.js";

/**
 * The whole thing: a photograph of a creased sheet in, a crease pattern out.
 *
 * This is DESIGN.md §3.2's pipeline with a camera on the front:
 *
 *   rectify -> flatten the lighting -> find edges -> find lines ->
 *   clean up -> snap -> planarize -> infer mountain and valley
 *
 * Every stage is a pure function over plain arrays, which is why the tests can
 * draw a crease pattern into a buffer, add a lighting gradient and some noise,
 * and check that the same pattern comes back out. There is no canvas, no wasm
 * and no native dependency anywhere in it.
 *
 * The output is explicitly a *draft*. §3.3 is clear that raster imports are
 * best-effort with a human in the loop, and the caller's job is to open this in
 * the editor rather than to publish it.
 */

export interface ScanOptions {
  /** Corners of the paper in the source photo. Defaults to the whole frame. */
  readonly quad?: Quad;
  /** Side of the rectified square, in pixels. */
  readonly workingSize?: number;
  readonly edges?: EdgeOptions;
  readonly hough?: HoughOptions;
  /** Lattice to snap to. `"auto"` infers one, `null` snaps to nothing. */
  readonly grid?: number | "auto" | null;
  /** Snap crease angles to this many degrees. 0 disables it. */
  readonly angleStepDegrees?: number;
  /** Shortest crease to keep, as a fraction of the paper's width. */
  readonly minLengthFraction?: number;
  /** Seed for the assignment search, so a photo gives a repeatable answer. */
  readonly seed?: number;
}

export interface ScannedCrease {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly assignment: EdgeAssignment;
  /** 0 to 1. Below about 0.5 the assignment is a guess worth checking. */
  readonly confidence: number;
}

export interface ScanResult {
  /** Creases in the unit square, boundary included, ready for the editor. */
  readonly creases: readonly ScannedCrease[];
  /** The rectified, lighting-flattened square the detection ran on. */
  readonly rectified: GrayImage;
  /** What came straight out of Hough, before snapping. For the preview. */
  readonly rawSegments: readonly Line[];
  /** The lattice that was snapped to, if any. */
  readonly grid: number | null;
  readonly assignment: AssignmentResult;
  /** A single number for the upload funnel, per DESIGN.md §3.4. */
  readonly confidence: number;
  /** Everything the caller should say out loud before publishing. */
  readonly notes: readonly string[];
}

const BORDER: readonly Line[] = [
  { x1: 0, y1: 0, x2: 1, y2: 0 },
  { x1: 1, y1: 0, x2: 1, y2: 1 },
  { x1: 1, y1: 1, x2: 0, y2: 1 },
  { x1: 0, y1: 1, x2: 0, y2: 0 },
];

export function scanCreasePattern(image: GrayImage, options: ScanOptions = {}): ScanResult {
  const workingSize = options.workingSize ?? 900;
  const notes: string[] = [];

  // 1. Rectify. Without this every angle in the pattern is wrong, and Kawasaki
  //    is a statement about angles.
  const quad: Quad = options.quad ?? [
    { x: 0, y: 0 },
    { x: image.width, y: 0 },
    { x: image.width, y: image.height },
    { x: 0, y: image.height },
  ];
  const square = warpToSquare(downscale(image, workingSize * 2), scaleQuad(quad, image, workingSize * 2), workingSize);

  // 2. Take the lighting out and stretch what is left.
  const flattened = normalizeContrast(flattenIllumination(square));

  // 3. Edges, then lines.
  const edgeMap = detectEdges(flattened, options.edges ?? {});
  const minLengthFraction = options.minLengthFraction ?? 0.08;
  const detected = detectSegments(edgeMap, {
    minLength: workingSize * minLengthFraction,
    maxGap: workingSize * 0.03,
    ...options.hough,
  });

  // 4. Clean up in pixel space, where the tolerances are in pixels and mean
  //    something, then move to the unit square.
  /*
   * The offset tolerance is set against the finest lattice worth supporting.
   * Two lines of a 32-grid sit 3% of the paper apart, so anything under about
   * 1% is safely below "these are different creases" and comfortably above
   * "the same crease found twice, a few pixels apart".
   */
  const merged = mergeCollinear(detected, {
    offsetTolerance: Math.max(4, workingSize * 0.008),
    gapTolerance: Math.max(6, workingSize * 0.02),
  });

  const rawSegments = toUnitSquare(merged, workingSize);
  const prior = shadingPrior(flattened, merged);

  // 5. Snap. Angles first: a crease at the right angle whose ends are a pixel
  //    out can be pulled onto the lattice, but a crease at the wrong angle
  //    cannot be fixed by moving its ends.
  const angleStep = options.angleStepDegrees ?? 22.5;
  let cleaned: Line[] = angleStep > 0
    ? snapAngles(rawSegments, { stepDegrees: angleStep })
    : [...rawSegments];

  cleaned = snapToBorder(cleaned);

  const requested = options.grid ?? "auto";
  const grid =
    requested === null
      ? null
      : requested === "auto"
        ? inferGrid(cleaned)
        : requested;
  if (grid) cleaned = snapToGrid(cleaned, grid, 0.6 / grid);

  cleaned = removeBorderDuplicates(cleaned);
  cleaned = dropShort(cleaned, minLengthFraction * 0.5);

  /*
   * Reported here rather than at detection, because the question a person
   * actually has is "did it find my creases", and a photo can yield plenty of
   * raw segments that all turn out to be the paper's own edge. What survives
   * the cleanup is the honest answer.
   */
  if (cleaned.length === 0) {
    notes.push(
      "No creases were found. Try a flatter light across the paper, or check " +
        "that the corners are on the sheet.",
    );
  } else if (grid) {
    notes.push(`Snapped to a ${grid} by ${grid} grid.`);
  }

  // 6. Into the shared geometry. From here on this is the same code that reads
  //    a .cp file, which is the point of having one implementation.
  const withBorder: Segment[] = [
    ...BORDER.map((line) => ({ ...line, assignment: "B" as EdgeAssignment })),
    ...cleaned.map((line) => ({
      x1: line.x1,
      y1: line.y1,
      x2: line.x2,
      y2: line.y2,
      assignment: "U" as EdgeAssignment,
    })),
  ];

  const built = graphFromSegments(withBorder);
  const planar = planarize(built.graph);

  // 7. Mountain and valley, from the geometry with the photograph advising.
  const edgePrior = priorForEdges(
    planar.graph.edges,
    planar.graph.vertices,
    cleaned,
    prior,
  );
  const assignment = inferAssignments(planar.graph, {
    prior: edgePrior,
    ...(options.seed === undefined ? {} : { seed: options.seed }),
  });

  const creases: ScannedCrease[] = planar.graph.edges.flatMap((edge, i) => {
    const a = planar.graph.vertices[edge[0]];
    const b = planar.graph.vertices[edge[1]];
    if (!a || !b) return [];
    return [
      {
        x1: a[0],
        y1: a[1],
        x2: b[0],
        y2: b[1],
        assignment: assignment.assignments[i] ?? "U",
        confidence:
          planar.graph.assignments[i] === "B" ? 1 : (assignment.confidence[i] ?? 0),
      },
    ];
  });

  if (assignment.oddVertices.length > 0) {
    notes.push(
      `${assignment.oddVertices.length} vertex/vertices have an odd number of ` +
        "creases, which no flat-foldable pattern does. Something was missed or " +
        "detected twice near them.",
    );
  }
  if (assignment.ambiguous > 0) {
    notes.push(
      `${assignment.ambiguous} crease(s) could go either way without breaking ` +
        "Maekawa. They are assigned, but shown as uncertain: check those first.",
    );
  }
  if (!assignment.consistent && assignment.total > 0) {
    notes.push(
      `Maekawa holds at ${assignment.satisfied} of ${assignment.total} interior ` +
        "vertices. Where it does not, the creases around them are probably " +
        "misplaced rather than mislabelled.",
    );
  }
  notes.push(
    "Mountains and valleys are inferred from the geometry, and the whole " +
      "pattern may be inside out. Check one crease you remember and invert if " +
      "it is backwards.",
  );

  return {
    creases,
    rectified: flattened,
    rawSegments,
    grid,
    assignment,
    confidence: scoreConfidence(assignment, creases.length),
    notes,
  };
}

/**
 * One number for the funnel in DESIGN.md §3.4.
 *
 * Deliberately pessimistic. §3.4 puts the auto-publish line at 0.95, and a
 * photograph should never reach it: the whole point of the raster path is that
 * a person confirms it in the editor first.
 */
function scoreConfidence(assignment: AssignmentResult, creases: number): number {
  if (creases === 0) return 0;
  const maekawa = assignment.total === 0 ? 0.5 : assignment.satisfied / assignment.total;
  const decided =
    assignment.assignments.length === 0
      ? 0
      : 1 - assignment.ambiguous / Math.max(1, assignment.assignments.length);
  const odd = assignment.oddVertices.length > 0 ? 0.7 : 1;
  return Math.min(0.9, maekawa * 0.6 + decided * 0.4) * odd;
}

/** Move a quad from source-photo coordinates into the downscaled copy. */
function scaleQuad(quad: Quad, image: GrayImage, maxEdge: number): Quad {
  const longest = Math.max(image.width, image.height);
  if (longest <= maxEdge) return quad;
  const scale = maxEdge / longest;
  return quad.map((point) => ({ x: point.x * scale, y: point.y * scale })) as unknown as Quad;
}
