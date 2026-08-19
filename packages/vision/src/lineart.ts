import {
  graphFromSegments,
  planarize,
  type EdgeAssignment,
  type Segment,
} from "@kamibase/core";
import { inferAssignments, type AssignmentResult } from "./assign.js";
import { detectSegments, type HoughOptions } from "./hough.js";
import { extractInk, type InkLayer, type InkOptions } from "./ink.js";
import { createGray, type GrayImage } from "./image.js";
import { downscaleRgb, profileRaster, toGray, type RgbImage } from "./raster.js";
import {
  dominantAngles,
  inferGridAxes,
  length as lengthOf,
  mergeCollinear,
  snapToAngles,
  snapToAxes,
  type GridAxes,
  type Line,
} from "./segments.js";
import { edgeMapFromInk } from "./skeleton.js";
import { healGeometry, snapToPaper } from "./weld.js";

/**
 * Reading a crease pattern that was *drawn* rather than folded.
 *
 * The photograph pipeline in `scan.ts` starts from the premise that the picture
 * is evidence about a physical sheet: uneven light, soft ridges, no colour, and
 * an assignment that has to be inferred because the paper does not remember it.
 * Every stage of it is shaped by that premise, and every one of those shapes is
 * wrong for a PNG off a designer's website.
 *
 * A published crease pattern is a drawing. There is no lighting to flatten;
 * flattening it eats the strokes. There is no ridge to find the peak of; a
 * stroke is already an edge, and running an edge detector over it finds two.
 * The angles were not measured, they were chosen, so rounding them to 22.5
 * degrees corrupts rather than repairs. And the assignment is not a mystery: it
 * is written in the colour of every line.
 *
 * So this is a second pipeline, sharing the parts that genuinely generalise
 * (the Hough transform, the segment merge, the graph, the solver) and replacing
 * the parts that do not:
 *
 *   1. separate  split the drawing into the colours it was drawn with
 *   2. discard   throw away the reference grid, which is not a crease
 *   3. thin      reduce each stroke to its centre line
 *   4. detect    Hough, per colour, so crossings never confuse a layer
 *   5. snap      to the pattern's own angles and its own lattice
 *   6. heal      make ends that nearly meet actually meet
 *   7. fill      Maekawa for the creases whose colour said nothing
 *
 * The result keeps what the file said and infers only what it did not.
 */

export interface LineArtOptions {
  /** Side of the working image, in pixels. */
  readonly workingSize?: number;
  readonly ink?: InkOptions;
  readonly hough?: HoughOptions;
  /**
   * Shortest crease to keep, as a fraction of the paper's longer side.
   *
   * An order of magnitude below the photograph path's, and it has to be. A
   * single-cell crease in a 32-grid box-pleated design is 3% of the paper, and
   * a floor at 8% throws away most of the pattern while reporting no errors.
   */
  readonly minLengthFraction?: number;
  /** Lattice to snap to, per axis. `"auto"` infers one, `null` snaps to none. */
  readonly grid?: GridAxes | "auto" | null;
  /** Angles to snap to. `"auto"` reads them off the drawing. */
  readonly angles?: readonly number[] | "auto" | null;
  /** How far a point may move to close a junction, as a fraction of the paper. */
  readonly weldTolerance?: number;
  readonly seed?: number;
}

/** What one ink colour turned out to be, for the import notes. */
export interface LayerSummary {
  readonly colour: { readonly r: number; readonly g: number; readonly b: number };
  readonly assignment: EdgeAssignment;
  readonly role: InkLayer["role"];
  readonly reason: string;
  readonly dashed: boolean;
  readonly creases: number;
}

export interface LineArtResult {
  readonly creases: readonly {
    readonly x1: number;
    readonly y1: number;
    readonly x2: number;
    readonly y2: number;
    readonly assignment: EdgeAssignment;
    readonly confidence: number;
  }[];
  /**
   * The drawing itself, in grey, cropped to the paper.
   *
   * Cropped rather than whole, so that it lines up with the creases: the
   * editor draws it under the pattern at exactly the paper's extent, and a
   * backdrop including the file's margin would sit a few percent off and
   * quietly mislead every line traced against it.
   */
  readonly rectified: GrayImage;
  /** Detected creases before snapping and healing. For a preview. */
  readonly rawSegments: readonly Line[];
  readonly grid: GridAxes;
  /** The paper, in the same unit coordinates as the creases. */
  readonly paper: { readonly width: number; readonly height: number };
  readonly layers: readonly LayerSummary[];
  readonly assignment: AssignmentResult;
  readonly confidence: number;
  readonly notes: readonly string[];
}

export function scanLineArt(image: RgbImage, options: LineArtOptions = {}): LineArtResult {
  const workingSize = options.workingSize ?? 1300;
  const notes: string[] = [];

  const work = downscaleRgb(image, workingSize);
  const { layers } = extractInk(work, options.ink ?? {});
  const creaseLayers = layers.filter((layer) => layer.role === "crease");
  const guides = layers.filter((layer) => layer.role === "guide");

  const paperBox = inkBounds(creaseLayers, work.width, work.height);
  const span = Math.max(paperBox.width, paperBox.height);
  const paper = { width: paperBox.width / span, height: paperBox.height / span };

  /*
   * Pixels to paper coordinates, with y flipped.
   *
   * Flipped because a crease pattern is drawn in maths convention, y upwards,
   * and an image is stored with y downwards, and every consumer of this result
   * (the editor canvas, the SVG renderer, `.fold` export) assumes the former.
   * Leaving it alone costs nothing on a symmetric pattern and mirrors every
   * asymmetric one, which is the kind of bug that survives a long time because
   * the output always looks like a plausible crease pattern.
   */
  const toPaper = (x: number, y: number): { x: number; y: number } => ({
    x: (x - paperBox.x) / span,
    y: paper.height - (y - paperBox.y) / span,
  });

  const minLengthFraction = options.minLengthFraction ?? 0.02;
  const minLengthPx = Math.max(6, span * minLengthFraction);

  const found: { line: Line; assignment: EdgeAssignment; layer: number }[] = [];

  creaseLayers.forEach((layer, index) => {
    const edges = edgeMapFromInk(layer.ink, {
      // Dotted strokes are bridged before thinning; solid ones are not, because
      // closing a solid pattern also closes the gap between two creases that
      // genuinely pass close to each other.
      bridge: layer.dashed ? 2 : 0,
      /*
       * Small, and it matters. The direction at a pixel is averaged over this
       * window, so where two creases of the same colour cross, every pixel
       * within it sees both and reports an orientation that is neither. That
       * blind spot is a hole in the middle of both creases, and if it is wider
       * than `maxGap` below, every crossing in the pattern splits both creases
       * in two and leaves four ends floating around a vertex that should have
       * been one point.
       */
      orientationRadius: layer.dashed ? 4 : 2,
    });

    const detected = detectSegments(edges, {
      // Finer than the photograph path, and it can afford to be: a drawn line
      // is straight to the pixel, so a sharper accumulator buys precision
      // instead of merely splitting one crease's votes across two bins.
      thetaStepDegrees: 0.35,
      gradientWindowDegrees: 9,
      minLength: minLengthPx,
      // Comfortably wider than the blind spot a crossing leaves, so a crease
      // that passes through one is found once instead of twice.
      maxGap: Math.max(6, span * (layer.dashed ? 0.04 : 0.022)),
      // A box-pleated design really does have thousands of creases, and a cap
      // that silently truncates them is the worst possible failure: the result
      // looks like a crease pattern and is missing a third of one.
      maxLines: 6000,
      ...options.hough,
    });

    const merged = mergeCollinear(detected, {
      angleToleranceDegrees: 2,
      offsetTolerance: Math.max(1.5, span * 0.004),
      gapTolerance: Math.max(4, span * (layer.dashed ? 0.035 : 0.012)),
    });

    for (const segment of merged) {
      const a = toPaper(segment.x1, segment.y1);
      const b = toPaper(segment.x2, segment.y2);
      found.push({
        line: { x1: a.x, y1: a.y, x2: b.x, y2: b.y },
        assignment: layer.assignment,
        layer: index,
      });
    }
  });

  const rawSegments = found.map((entry) => entry.line);

  // Angles first: a crease at the right angle whose ends are out by a pixel can
  // be pulled onto the lattice, but no amount of moving ends fixes an angle.
  const requestedAngles = options.angles ?? "auto";
  const angles =
    requestedAngles === null
      ? []
      : requestedAngles === "auto"
        ? dominantAngles(rawSegments)
        : [...requestedAngles];
  let lines: Line[] = snapToAngles(rawSegments, angles, 1.5);

  const weldTolerance = options.weldTolerance ?? Math.max(0.004, 6 / span);
  const extent = { x: paper.width, y: paper.height };

  /*
   * The lattice, and how far a coordinate may be moved to reach it.
   *
   * The tolerance is a *measurement* tolerance, the few pixels a detected
   * endpoint can be out by, and not a fraction of the cell. Scaling it to the
   * cell was the first attempt and it is a trap: on a coarse lattice a
   * generous fraction of a large cell is an enormous distance, so a 22.5
   * degree pattern that half-fits a 2-grid has every 0.414 dragged to 0.5 and
   * comes back as a different design. Nothing here may move a crease further
   * than the drawing could plausibly have been misread by.
   */
  const requestedGrid = options.grid ?? "auto";
  const grid: GridAxes =
    requestedGrid === null
      ? { x: null, y: null }
      : requestedGrid === "auto"
        ? inferGridAxes(lines, { extent, tolerance: weldTolerance })
        : requestedGrid;
  if (grid.x || grid.y) lines = snapToAxes(lines, grid, weldTolerance, extent);
  lines = snapToPaper(lines, paper, weldTolerance * 2);

  /*
   * A second merge, in paper coordinates, after the snapping.
   *
   * The first merge ran per layer in pixels, before anything had been
   * straightened. Two fragments of one crease separated by the blot where four
   * other creases cross it are not collinear until the angle snapping has made
   * them so: measured, they differ by a degree and a half and sit two pixels
   * apart, which is under no tolerance that is also safe to apply to a raw
   * detection. Afterwards they are exactly collinear and join cleanly.
   *
   * Grouped by assignment, which is both what keeps a mountain from absorbing
   * the valley it happens to lie along and what lets the assignments survive a
   * pass that does not otherwise carry them.
   */
  const withAssignments = joinByAssignment(
    lines.map((line, i) => ({ line, assignment: found[i]?.assignment ?? "U" })),
    weldTolerance,
  );

  /*
   * Heal against the paper's outline as well as against the other creases.
   *
   * Without it, a crease that stops eight pixels short of the sheet's edge has
   * nothing to be pulled onto, because the outline is not added until after this
   * point, so it stays hanging, `planarize` gives it a vertex of degree one,
   * and the validator reports a defect that is entirely an artefact of the
   * order these passes run in. The outline is passed as anchored, so it guides
   * without being moved.
   */
  const border = paperRectangle(paper);
  const anchored = [
    ...withAssignments.map(() => false),
    ...border.map(() => true),
  ];
  const healed = healGeometry(
    [
      ...withAssignments.map((entry) => ({ ...entry.line, assignment: entry.assignment })),
      ...border.map((line) => ({ ...line, assignment: "B" as EdgeAssignment })),
    ],
    weldTolerance,
    anchored,
  );

  const kept = healed
    .slice(0, withAssignments.length)
    .map((line) => ({ line: line as Line, assignment: line.assignment }))
    .filter(
      (entry) =>
        lengthOf(entry.line) >= minLengthFraction * 0.4 &&
        !onRectangle(entry.line, paper, weldTolerance * 2),
    );

  const segments: Segment[] = [
    ...border.map((line) => ({ ...line, assignment: "B" as EdgeAssignment })),
    ...kept.map((entry) => ({
      x1: entry.line.x1,
      y1: entry.line.y1,
      x2: entry.line.x2,
      y2: entry.line.y2,
      assignment: entry.assignment,
    })),
  ];

  const epsilon = weldTolerance * 0.4;
  const planar = trimWhiskers(
    planarize(graphFromSegments(segments, { epsilon }).graph, { epsilon }),
    // A whisker is at most as long as the blob that produced it, and the blob
    // is a few times the tolerance everything else is measured against. Tying
    // it to that rather than picking a number keeps it scaling with the image.
    Math.max(minLengthFraction, weldTolerance * 6),
    epsilon,
  );

  /*
   * The colours are facts, so they are pinned rather than inferred. The solver
   * still runs, for two reasons: some patterns are drawn in a colour with no
   * convention attached, and even when none are, its report of where Maekawa
   * holds is the honest measure of whether this reading is any good.
   */
  const fixed = planar.graph.assignments.map((value) =>
    value === "M" || value === "V" ? value : null,
  );
  const assignment = inferAssignments(planar.graph, {
    fixed,
    ...(options.seed === undefined ? {} : { seed: options.seed }),
  });

  const creases = planar.graph.edges.flatMap((edge, i) => {
    const a = planar.graph.vertices[edge[0]];
    const b = planar.graph.vertices[edge[1]];
    if (!a || !b) return [];
    const stated = planar.graph.assignments[i];
    return [
      {
        x1: a[0],
        y1: a[1],
        x2: b[0],
        y2: b[1],
        assignment: stated === "B" ? ("B" as EdgeAssignment) : (assignment.assignments[i] ?? "U"),
        confidence:
          stated === "B" || stated === "M" || stated === "V"
            ? 1
            : (assignment.confidence[i] ?? 0),
      },
    ];
  });

  const summaries: LayerSummary[] = creaseLayers.map((layer, index) => ({
    colour: layer.colour,
    assignment: layer.assignment,
    role: layer.role,
    reason: layer.reason,
    dashed: layer.dashed,
    // Counted at detection rather than after planarizing, because what a
    // person wants to know from this line is "how much did that colour
    // contribute", not how many pieces the crossings cut it into.
    creases: found.filter((entry) => entry.layer === index).length,
  }));

  notes.push(...describe(summaries, guides, grid, paper, assignment));

  return {
    creases,
    rectified: cropToPaper(toGray(work), paperBox),
    rawSegments,
    grid,
    paper,
    layers: summaries,
    assignment,
    confidence: score(summaries, assignment, creases.length),
    notes,
  };
}

/* -------------------------------------------------------------------------- */

/** True when the picture is a drawing rather than a photograph. */
export function isLineArt(image: RgbImage): boolean {
  return profileRaster(image).lineArt;
}

/**
 * The paper's extent, as the bounding box of every crease-coloured pixel.
 *
 * A published pattern is nearly always drawn with a margin, and sometimes with
 * a caption. Taking the box of the ink rather than of the file is what makes
 * the paper edge land at 0 and 1 instead of at 0.06 and 0.94, and everything
 * afterwards, the lattice above all, is stated as a fraction of the paper.
 */
function inkBounds(
  layers: readonly InkLayer[],
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (const layer of layers) {
    const { data } = layer.ink;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if ((data[y * width + x] ?? 0) < 0.5) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return { x: 0, y: 0, width, height };
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

/**
 * Remove short creases hanging by one end.
 *
 * Where several creases converge on a corner, the ink is a blob for a few
 * pixels in every direction and no stroke has an orientation there. Each of
 * them therefore starts a little way in, and the scrap between the blob and
 * the crease proper survives the healing as a whisker: a two-percent stub with
 * one end at the corner and the other attached to nothing.
 *
 * It is not a crease, and it is not harmless. `planarize` gives it a vertex of
 * degree one, the validator reports a defect, Maekawa cannot be evaluated at
 * that vertex, and the simulator has a flap of paper attached along a line
 * that stops in mid-air.
 *
 * Only short ones, and only ones that hang. A long crease with a free end is
 * either real or a mistake worth *seeing*, and silently deleting it would hide
 * the very thing a person opening this in the editor needs to fix. Repeated,
 * because removing a whisker can leave the crease it hung off hanging too.
 */
function trimWhiskers(
  built: ReturnType<typeof planarize>,
  maxLength: number,
  epsilon: number,
): ReturnType<typeof planarize> {
  let current = built;

  for (let pass = 0; pass < 4; pass += 1) {
    const graph = current.graph;
    const degree = new Int32Array(graph.vertices.length);
    for (const edge of graph.edges) {
      degree[edge[0]] = (degree[edge[0]] ?? 0) + 1;
      degree[edge[1]] = (degree[edge[1]] ?? 0) + 1;
    }

    const survivors: Segment[] = [];
    let dropped = 0;

    graph.edges.forEach((edge, i) => {
      const a = graph.vertices[edge[0]];
      const b = graph.vertices[edge[1]];
      if (!a || !b) return;
      const hanging = degree[edge[0]] === 1 || degree[edge[1]] === 1;
      if (hanging && Math.hypot(b[0] - a[0], b[1] - a[1]) < maxLength) {
        dropped += 1;
        return;
      }
      survivors.push({
        x1: a[0],
        y1: a[1],
        x2: b[0],
        y2: b[1],
        assignment: graph.assignments[i] ?? "U",
      });
    });

    if (dropped === 0) return current;
    current = planarize(graphFromSegments(survivors, { epsilon }).graph, { epsilon });
  }

  return current;
}

/**
 * Join fragments of one crease back together, one assignment at a time.
 *
 * `mergeCollinear` wants the strength and support a Hough peak carries, which
 * these no longer have, since they have been snapped and moved. Both are used
 * only to weight the merged result, so passing a constant is not a fudge: it
 * says these fragments are equally trustworthy, which after the snapping they
 * are.
 */
function joinByAssignment(
  entries: readonly { line: Line; assignment: EdgeAssignment }[],
  tolerance: number,
): { line: Line; assignment: EdgeAssignment }[] {
  const groups = new Map<EdgeAssignment, Line[]>();
  for (const entry of entries) {
    const bucket = groups.get(entry.assignment);
    if (bucket) bucket.push(entry.line);
    else groups.set(entry.assignment, [entry.line]);
  }

  const out: { line: Line; assignment: EdgeAssignment }[] = [];
  for (const [assignment, lines] of groups) {
    const merged = mergeCollinear(
      lines.map((line) => ({ ...line, strength: 1, support: 1 })),
      {
        angleToleranceDegrees: 0.75,
        offsetTolerance: tolerance,
        gapTolerance: tolerance * 4,
      },
    );
    for (const line of merged) out.push({ line, assignment });
  }
  return out;
}

/** The paper's own pixels, so a backdrop lines up with the creases exactly. */
function cropToPaper(
  image: GrayImage,
  box: { x: number; y: number; width: number; height: number },
): GrayImage {
  const width = Math.max(1, Math.round(box.width) + 1);
  const height = Math.max(1, Math.round(box.height) + 1);
  const out = createGray(width, height);

  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(image.height - 1, Math.max(0, Math.round(box.y) + y));
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(image.width - 1, Math.max(0, Math.round(box.x) + x));
      out.data[y * width + x] = image.data[sy * image.width + sx] ?? 1;
    }
  }
  return out;
}

function paperRectangle(paper: { width: number; height: number }): Line[] {
  const { width: w, height: h } = paper;
  return [
    { x1: 0, y1: 0, x2: w, y2: 0 },
    { x1: w, y1: 0, x2: w, y2: h },
    { x1: w, y1: h, x2: 0, y2: h },
    { x1: 0, y1: h, x2: 0, y2: 0 },
  ];
}

/**
 * Does this crease lie along the paper's edge?
 *
 * The outline is the strongest thing in the drawing and it is found every time.
 * It is the boundary, which the caller adds itself as `B`, and keeping the
 * detected copy too doubles every side of the paper.
 */
function onRectangle(
  line: Line,
  paper: { width: number; height: number },
  tolerance: number,
): boolean {
  const near = (value: number, target: number): boolean => Math.abs(value - target) <= tolerance;
  return (
    (near(line.x1, 0) && near(line.x2, 0)) ||
    (near(line.x1, paper.width) && near(line.x2, paper.width)) ||
    (near(line.y1, 0) && near(line.y2, 0)) ||
    (near(line.y1, paper.height) && near(line.y2, paper.height))
  );
}

/** What to say out loud about this reading, in the order a person cares. */
function describe(
  layers: readonly LayerSummary[],
  guides: readonly InkLayer[],
  grid: GridAxes,
  paper: { width: number; height: number },
  assignment: AssignmentResult,
): string[] {
  const notes: string[] = [];
  const total = layers.reduce((sum, layer) => sum + layer.creases, 0);

  if (total === 0) {
    notes.push("No creases found. The drawing may be too faint or too small.");
    return notes;
  }

  const named = layers
    .filter((layer) => layer.creases > 0)
    .map(
      (layer) =>
        `${describeColour(layer.colour)} → ${layer.assignment}${layer.dashed ? " (dashed)" : ""}`,
    );
  if (named.length > 0) notes.push(`Read the colours as ${named.join(", ")}.`);

  if (guides.length > 0) {
    notes.push(
      guides.length === 1
        ? "One pale colour was treated as a reference grid and left out."
        : `${guides.length} pale colours were treated as reference grids and left out.`,
    );
  }

  if (grid.x && grid.y) {
    notes.push(
      grid.x === grid.y
        ? `Snapped to a ${grid.x} by ${grid.x} grid.`
        : `Snapped to a ${grid.x} by ${grid.y} grid.`,
    );
  }

  const ratio = paper.width / paper.height;
  if (Math.abs(ratio - 1) > 0.02) {
    notes.push(`The paper is not square: about ${ratio.toFixed(2)} to 1.`);
  }

  const unassigned = layers
    .filter((layer) => layer.assignment === "U" && layer.creases > 0)
    .reduce((sum, layer) => sum + layer.creases, 0);
  if (unassigned > 0) {
    notes.push(
      `${unassigned} creases had no colour convention; Maekawa was asked instead.`,
    );
  }

  if (assignment.oddVertices.length > 0) {
    const n = assignment.oddVertices.length;
    notes.push(
      `${n} vertex${n === 1 ? "" : "es"} with an odd number of creases: ` +
        "something was missed or found twice there.",
    );
  }
  if (assignment.total > 0 && assignment.satisfied < assignment.total) {
    notes.push(`Maekawa holds at ${assignment.satisfied} of ${assignment.total} vertices.`);
  }

  return notes;
}

function describeColour(colour: { r: number; g: number; b: number }): string {
  const hex = (value: number): string =>
    Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0");
  return `#${hex(colour.r)}${hex(colour.g)}${hex(colour.b)}`;
}

/**
 * One number for the upload funnel.
 *
 * Allowed higher than a photograph's, because it answers a different question.
 * A photograph's confidence is mostly "did we guess the assignments right", and
 * the honest answer is never better than "probably". A drawing *states* them,
 * so what is left to doubt is whether the lines were read faithfully.
 *
 * Two things speak to that. How much of the pattern's assignment came from the
 * drawing rather than from the solver; and whether the topology came out sane,
 * measured by interior vertices with an odd number of creases, which no
 * crease pattern has, so every one of them is a crease this reading missed or
 * found twice.
 *
 * Deliberately *not* included: whether Maekawa holds. It is tempting, and it
 * is wrong. Plenty of published crease patterns are bases with regions left
 * unfolded, or are simply not flat-foldable, and marking a faithful reading of
 * one down for a property of the design rather than of the reading would make
 * the number mean nothing.
 *
 * Capped below DESIGN.md §3.4's 0.95 auto-publish line either way. The geometry
 * was still read off pixels, and somebody should still look at it.
 */
function score(
  layers: readonly LayerSummary[],
  assignment: AssignmentResult,
  creases: number,
): number {
  if (creases === 0) return 0;

  const drawn = layers.reduce((sum, layer) => sum + layer.creases, 0);
  const stated = layers
    .filter((layer) => layer.assignment === "M" || layer.assignment === "V")
    .reduce((sum, layer) => sum + layer.creases, 0);
  const fromColour = drawn === 0 ? 0 : stated / drawn;

  const interior = assignment.total + assignment.oddVertices.length;
  const clean = interior === 0 ? 0.5 : 1 - assignment.oddVertices.length / interior;

  return Math.min(0.9, 0.45 + 0.3 * fromColour + 0.15 * clean);
}
