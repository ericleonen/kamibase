import { describe, expect, it } from "vitest";
import { detectEdges } from "../src/edges.js";
import { detectSegments } from "../src/hough.js";
import { flattenIllumination, normalizeContrast } from "../src/image.js";
import { mergeCollinear, toUnitSquare, type Line } from "../src/segments.js";
import { scanCreasePattern } from "../src/scan.js";
import { addLighting, addNoise, drawPattern, recallOf } from "./synthetic.js";

/**
 * Does a photograph of a crease pattern come back as that crease pattern?
 *
 * Every test here renders creases it chose, degrades the render the way a
 * camera and a lamp would, and then asks for them back. That is the only
 * question about this package worth asking, and it is the one a pile of
 * unit tests on individual filters would not answer.
 */

/** The classic first fold: both diagonals and both midlines. */
const BASIC: Line[] = [
  { x1: 0, y1: 0, x2: 1, y2: 1 },
  { x1: 1, y1: 0, x2: 0, y2: 1 },
  { x1: 0.5, y1: 0, x2: 0.5, y2: 1 },
  { x1: 0, y1: 0.5, x2: 1, y2: 0.5 },
];

/** A 4x4 grid of pleats, which is what a Miura or a box pleat looks like. */
function gridPattern(divisions: number): Line[] {
  const lines: Line[] = [];
  for (let i = 1; i < divisions; i += 1) {
    const t = i / divisions;
    lines.push({ x1: t, y1: 0, x2: t, y2: 1 });
    lines.push({ x1: 0, y1: t, x2: 1, y2: t });
  }
  return lines;
}

function photoOf(lines: readonly Line[], size = 600): ReturnType<typeof drawPattern> {
  const image = drawPattern(
    size,
    lines.map((line) => ({ line })),
    { contrast: 0.16, width: 1.6 },
  );
  addLighting(image, 0.32);
  addNoise(image, 0.012);
  return image;
}

/** The detection half only, so a failure points at the detector not the graph. */
function findLines(image: ReturnType<typeof drawPattern>, size: number): Line[] {
  const flattened = normalizeContrast(flattenIllumination(image));
  const edges = detectEdges(flattened);
  const segments = detectSegments(edges, { minLength: size * 0.1, maxGap: size * 0.03 });
  return toUnitSquare(mergeCollinear(segments), size);
}

describe("finding creases in a photograph", () => {
  it("recovers both diagonals and both midlines through lighting and noise", () => {
    const size = 600;
    const found = findLines(photoOf(BASIC, size), size);
    // Tolerance is 4% of the paper: this is a measurement of a photograph, not
    // a parse of a file, and endpoints land a few pixels short.
    expect(recallOf(found, BASIC, 0.04)).toBe(BASIC.length);
  });

  it("survives a lighting gradient strong enough to defeat a global threshold", () => {
    const size = 600;
    const image = drawPattern(size, BASIC.map((line) => ({ line })), { contrast: 0.16 });
    // Hard enough that the darkest paper is darker than the brightest crease,
    // which is exactly the case a fixed threshold cannot handle.
    addLighting(image, 0.55);
    addNoise(image, 0.012);
    expect(recallOf(findLines(image, size), BASIC, 0.04)).toBe(BASIC.length);
  });

  it("does not invent creases in a blank sheet", () => {
    const size = 400;
    const image = drawPattern(size, [], {});
    addLighting(image, 0.35);
    addNoise(image, 0.015);
    expect(findLines(image, size)).toHaveLength(0);
  });

  it("finds a dense grid without merging neighbouring pleats into one", () => {
    const size = 700;
    const grid = gridPattern(4);
    const found = findLines(photoOf(grid, size), size);
    expect(recallOf(found, grid, 0.04)).toBe(grid.length);
  });

  it("reports one segment per crease rather than one per edge of it", () => {
    // A crease is a ridge two or three pixels wide. Without non-maximum
    // suppression and peak merging each one arrives two or three times.
    const size = 600;
    const found = findLines(photoOf(BASIC, size), size);
    expect(found.length).toBeLessThanOrEqual(BASIC.length + 1);
  });
});

describe("scanCreasePattern", () => {
  it("turns a photograph into a graph with a boundary and interior creases", () => {
    const result = scanCreasePattern(photoOf(BASIC, 600), { workingSize: 600 });

    const border = result.creases.filter((crease) => crease.assignment === "B");
    const folds = result.creases.filter((crease) => crease.assignment !== "B");

    // Planarization splits the four boundary lines at wherever creases meet
    // them, so there are at least four.
    expect(border.length).toBeGreaterThanOrEqual(4);
    expect(folds.length).toBeGreaterThan(0);
  });

  it("puts every crease inside the unit square", () => {
    const result = scanCreasePattern(photoOf(BASIC, 600), { workingSize: 600 });
    for (const crease of result.creases) {
      for (const value of [crease.x1, crease.y1, crease.x2, crease.y2]) {
        expect(value).toBeGreaterThanOrEqual(-1e-9);
        expect(value).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it("snaps the four creases of the basic fold onto the 22.5 degree lattice", () => {
    const result = scanCreasePattern(photoOf(BASIC, 600), { workingSize: 600 });
    const step = Math.PI / 8;

    for (const crease of result.creases) {
      const angle = Math.atan2(crease.y2 - crease.y1, crease.x2 - crease.x1);
      const folded = ((angle % Math.PI) + Math.PI) % Math.PI;
      const offset = Math.abs(folded - Math.round(folded / step) * step);
      expect(Math.min(offset, step - offset)).toBeLessThan(0.02);
    }
  });

  it("never claims a photograph is auto-publishable", () => {
    // DESIGN.md 3.4 puts auto-publish at 0.95 and 3.3 requires human review of
    // every raster import. A scan that scored itself past the line would walk
    // straight through the funnel.
    const result = scanCreasePattern(photoOf(BASIC, 600), { workingSize: 600 });
    expect(result.confidence).toBeLessThan(0.95);
    expect(result.notes.join(" ")).toMatch(/inside out|invert/i);
  });

  it("says so rather than throwing when there is nothing to find", () => {
    const blank = drawPattern(400, [], {});
    addLighting(blank, 0.3);
    const result = scanCreasePattern(blank, { workingSize: 400 });

    expect(result.creases.every((crease) => crease.assignment === "B")).toBe(true);
    expect(result.notes.join(" ")).toMatch(/No creases were found/i);
  });

  it("is deterministic, so the same photo twice gives the same answer", () => {
    const first = scanCreasePattern(photoOf(BASIC, 600), { workingSize: 600, seed: 3 });
    const second = scanCreasePattern(photoOf(BASIC, 600), { workingSize: 600, seed: 3 });
    expect(second.creases).toEqual(first.creases);
  });
});
