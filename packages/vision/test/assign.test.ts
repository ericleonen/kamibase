import { describe, expect, it } from "vitest";
import {
  checkFlatFoldability,
  graphFromSegments,
  planarize,
  type EdgeAssignment,
  type Segment,
} from "@kamibase/core";
import { inferAssignments, invertAssignments } from "../src/assign.js";

/**
 * Can Maekawa's theorem alone work out which creases are mountains?
 *
 * This is the claim the whole feature rests on, so the tests here are about the
 * claim rather than the code: given only the geometry a photograph can
 * recover, does the constraint pin down an assignment, and does it admit when
 * it cannot?
 */

/** Build the graph the way the scanner does: segments, then planarize. */
function graphOf(segments: readonly Segment[]) {
  return planarize(graphFromSegments(segments).graph).graph;
}

const BORDER: Segment[] = [
  { x1: 0, y1: 0, x2: 1, y2: 0, assignment: "B" },
  { x1: 1, y1: 0, x2: 1, y2: 1, assignment: "B" },
  { x1: 1, y1: 1, x2: 0, y2: 1, assignment: "B" },
  { x1: 0, y1: 1, x2: 0, y2: 0, assignment: "B" },
];

function unassigned(lines: readonly { x1: number; y1: number; x2: number; y2: number }[]): Segment[] {
  return lines.map((line) => ({ ...line, assignment: "U" as EdgeAssignment }));
}

/** The classic degree-4 vertex: two diagonals crossing at the centre. */
const CROSS = graphOf([
  ...BORDER,
  ...unassigned([
    { x1: 0, y1: 0, x2: 1, y2: 1 },
    { x1: 1, y1: 0, x2: 0, y2: 1 },
  ]),
]);

describe("inferAssignments", () => {
  it("satisfies Maekawa at a degree-4 vertex with no help from the photograph", () => {
    const result = inferAssignments(CROSS);

    expect(result.total).toBe(1);
    expect(result.satisfied).toBe(1);
    expect(result.consistent).toBe(true);

    const folds = result.assignments.filter((value) => value !== "B");
    const mountains = folds.filter((value) => value === "M").length;
    const valleys = folds.filter((value) => value === "V").length;
    // Four creases meet at the centre, so Maekawa wants three of one and one
    // of the other.
    expect(Math.abs(mountains - valleys)).toBe(2);
  });

  it("produces an assignment the core validator agrees is flat-foldable", () => {
    // The real check: hand the answer back to the same Maekawa and Kawasaki
    // implementation the rest of Kamibase uses, and see whether it passes.
    const result = inferAssignments(CROSS);
    const graph = { ...CROSS, assignments: result.assignments };
    const report = checkFlatFoldability(graph);

    expect(report.failures).toHaveLength(0);
    expect(report.flatFoldable).toBe(true);
  });

  it("leaves boundary creases alone", () => {
    const result = inferAssignments(CROSS);
    CROSS.assignments.forEach((original, i) => {
      if (original === "B") expect(result.assignments[i]).toBe("B");
    });
  });

  it("follows a confident prior when the geometry allows either answer", () => {
    // Both solutions satisfy Maekawa equally: the pattern can be turned over.
    // The prior is the only thing that can say which side we are looking at.
    const foldable = CROSS.assignments
      .map((value, i) => (value === "B" ? -1 : i))
      .filter((i) => i >= 0);

    const prior = new Array<number>(CROSS.edges.length).fill(0);
    for (const edge of foldable) prior[edge] = 1;

    const mostlyMountains = inferAssignments(CROSS, { prior });
    const asMountains = mostlyMountains.assignments.filter((v) => v === "M").length;

    const flipped = prior.map((value) => -value);
    const mostlyValleys = inferAssignments(CROSS, { prior: flipped });
    const asValleys = mostlyValleys.assignments.filter((v) => v === "V").length;

    expect(asMountains).toBeGreaterThan(1);
    expect(asValleys).toBeGreaterThan(1);
  });

  it("reports vertices with an odd number of creases instead of forcing them", () => {
    // Three creases into one interior point. |M - V| = 2 with M + V = 3 has no
    // integer solution, so this is unsatisfiable rather than merely hard, and
    // saying so is more useful than returning a best effort.
    const odd = graphOf([
      ...BORDER,
      ...unassigned([
        { x1: 0.5, y1: 0.5, x2: 0, y2: 0 },
        { x1: 0.5, y1: 0.5, x2: 1, y2: 0 },
        { x1: 0.5, y1: 0.5, x2: 0.5, y2: 1 },
      ]),
    ]);

    const result = inferAssignments(odd);
    expect(result.oddVertices.length).toBeGreaterThan(0);
    expect(result.consistent).toBe(false);
  });

  it("is deterministic for a given seed", () => {
    const a = inferAssignments(CROSS, { seed: 42 });
    const b = inferAssignments(CROSS, { seed: 42 });
    expect(b.assignments).toEqual(a.assignments);
  });

  it("says nothing at all rather than guessing when there is nothing to constrain", () => {
    // A single crease across the paper has no interior vertex, so Maekawa has
    // no opinion about it. DESIGN.md 3.4: mark it U and let a person decide.
    const single = graphOf([
      ...BORDER,
      ...unassigned([{ x1: 0, y1: 0.5, x2: 1, y2: 0.5 }]),
    ]);

    const result = inferAssignments(single);
    const folds = result.assignments.filter((value) => value !== "B");
    expect(folds.every((value) => value === "U")).toBe(true);
    expect(result.ambiguous).toBe(folds.length);
  });

  it("scores a symmetric vertex as uncertain rather than pretending to know", () => {
    /*
     * Four creases meeting at the centre of the square: three mountains and one
     * valley satisfies Maekawa, and so does the same with any of the four
     * playing the valley. Nothing in the geometry prefers one, so a valid
     * assignment is offered and every crease in it is marked uncertain.
     */
    const result = inferAssignments(CROSS);
    expect(result.ambiguous).toBeGreaterThan(0);

    const folds = result.assignments
      .map((value, i) => ({ value, confidence: result.confidence[i] ?? 0 }))
      .filter((entry) => entry.value !== "B");

    expect(folds.every((entry) => entry.confidence < 1)).toBe(true);
    expect(folds.every((entry) => entry.confidence > 0)).toBe(true);
  });

  it("solves a bird base, which is where a hand assignment gets hard", () => {
    // Diagonals, midlines and the four 22.5 degree creases of a preliminary
    // fold: enough interlocking vertices that the constraint does real work.
    const r = (Math.SQRT2 - 1) / 2;
    const bird = graphOf([
      ...BORDER,
      ...unassigned([
        { x1: 0, y1: 0, x2: 1, y2: 1 },
        { x1: 1, y1: 0, x2: 0, y2: 1 },
        { x1: 0.5, y1: 0, x2: 0.5, y2: 1 },
        { x1: 0, y1: 0.5, x2: 1, y2: 0.5 },
        { x1: 0.5 - r, y1: 0, x2: 0.5, y2: 0.5 },
        { x1: 0.5 + r, y1: 0, x2: 0.5, y2: 0.5 },
        { x1: 0.5 - r, y1: 1, x2: 0.5, y2: 0.5 },
        { x1: 0.5 + r, y1: 1, x2: 0.5, y2: 0.5 },
      ]),
    ]);

    const result = inferAssignments(bird, { restarts: 24 });
    // Not every vertex of this drawing is flat-foldable, but the search should
    // get most of the way there rather than stalling at a random assignment.
    expect(result.satisfied / result.total).toBeGreaterThan(0.5);
  });
});

describe("invertAssignments", () => {
  it("swaps mountains and valleys and leaves everything else", () => {
    expect(invertAssignments(["M", "V", "B", "U", "F"])).toEqual(["V", "M", "B", "U", "F"]);
  });

  it("is its own inverse", () => {
    const original: EdgeAssignment[] = ["M", "V", "B", "U"];
    expect(invertAssignments(invertAssignments(original))).toEqual(original);
  });

  it("keeps Maekawa satisfied, because the sheet is the same seen from behind", () => {
    const result = inferAssignments(CROSS);
    const flipped = { ...CROSS, assignments: invertAssignments(result.assignments) };
    expect(checkFlatFoldability(flipped).failures).toHaveLength(0);
  });
});
