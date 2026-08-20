import { describe, expect, it } from "vitest";
import {
  MAX_DIVISIONS,
  NO_GRID,
  describeGrid,
  gridLines,
  isGridVisible,
  normalizeGrid,
  snapToGridSpec,
  type GridSpec,
} from "@/lib/editor/grid";

/**
 * The grid is the coordinate system a crease pattern is stated in, so what is
 * tested here is not "does it draw lines" but "does it mean what a designer
 * means": a 3 grid has lines at thirds, a 12 by 18 grid has both, and a 45
 * degree grid runs corner to corner.
 */

const square = (x: number, angleDegrees = 0): GridSpec => ({ x, y: x, angleDegrees });

function near(a: number, b: number, epsilon = 1e-9): boolean {
  return Math.abs(a - b) < epsilon;
}

describe("snapping to a grid", () => {
  it("snaps to the nearest lattice point", () => {
    expect(snapToGridSpec([0.26, 0.24], square(4))).toEqual([0.25, 0.25]);
  });

  it("puts an odd grid's lines at thirds, not sixths", () => {
    // Anchored at the origin rather than at the centre. A 3 grid centred on
    // the paper has lines at 1/6, 1/2 and 5/6, which is not a 3 grid.
    const snapped = snapToGridSpec([0.34, 0.66], square(3));
    expect(near(snapped![0], 1 / 3)).toBe(true);
    expect(near(snapped![1], 2 / 3)).toBe(true);
  });

  it("uses each axis's own divisions", () => {
    const snapped = snapToGridSpec([0.3, 0.3], { x: 2, y: 10, angleDegrees: 0 });
    expect(snapped![0]).toBeCloseTo(0.5, 9);
    expect(snapped![1]).toBeCloseTo(0.3, 9);
  });

  it("snaps along one axis when the other has no divisions", () => {
    // A pleated layout is guides in one direction and nothing in the other.
    const snapped = snapToGridSpec([0.27, 0.61], { x: 4, y: 0, angleDegrees: 0 });
    expect(snapped![0]).toBeCloseTo(0.25, 9);
    expect(snapped![1]).toBeCloseTo(0.61, 9);
  });

  it("snaps onto a rotated lattice", () => {
    // At 45 degrees the paper's centre is still a lattice point, and the
    // corners of a 2 grid land on the corners of the sheet.
    const snapped = snapToGridSpec([0.52, 0.48], square(2, 45));
    expect(snapped![0]).toBeCloseTo(0.5, 9);
    expect(snapped![1]).toBeCloseTo(0.5, 9);
  });

  it("has nothing to snap to with the grid off", () => {
    expect(snapToGridSpec([0.37, 0.61], NO_GRID)).toBeNull();
  });
});

describe("drawing a grid", () => {
  it("draws the interior lines and the paper's own edges", () => {
    const lines = gridLines(square(4));
    // Five verticals and five horizontals, edges included.
    expect(lines).toHaveLength(10);
    for (const line of lines) {
      for (const value of [line.x1, line.y1, line.x2, line.y2]) {
        expect(value).toBeGreaterThanOrEqual(-1e-9);
        expect(value).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it("counts each axis separately", () => {
    const lines = gridLines({ x: 4, y: 10, angleDegrees: 0 });
    expect(lines).toHaveLength(5 + 11);
  });

  it("runs a 45 degree grid corner to corner", () => {
    const lines = gridLines(square(2, 45));
    const diagonal = lines.find(
      (line) =>
        (near(line.x1, 0) && near(line.y1, 0) && near(line.x2, 1) && near(line.y2, 1)) ||
        (near(line.x1, 1) && near(line.y1, 1) && near(line.x2, 0) && near(line.y2, 0)),
    );
    expect(diagonal).toBeDefined();
  });

  it("clips every line to the paper at any angle", () => {
    for (const angle of [0, 17, 30, 45, 90, 133.5]) {
      for (const line of gridLines(square(8, angle))) {
        for (const value of [line.x1, line.y1, line.x2, line.y2]) {
          expect(value).toBeGreaterThanOrEqual(-1e-6);
          expect(value).toBeLessThanOrEqual(1 + 1e-6);
        }
      }
    }
  });

  it("draws nothing when the grid is off", () => {
    expect(gridLines(NO_GRID)).toEqual([]);
  });
});

describe("keeping a typed grid usable", () => {
  it("treats anything under one division as no divisions", () => {
    expect(normalizeGrid({ x: 0.4, y: -3, angleDegrees: 0 })).toEqual({
      x: 0,
      y: 0,
      angleDegrees: 0,
    });
  });

  it("caps divisions rather than trying to draw a hundred thousand lines", () => {
    expect(normalizeGrid({ x: 1e6, y: 8, angleDegrees: 0 }).x).toBe(MAX_DIVISIONS);
  });

  it("folds an angle into half a turn, since a lattice has no far side", () => {
    expect(normalizeGrid({ x: 8, y: 8, angleDegrees: 190 }).angleDegrees).toBeCloseTo(10, 9);
    expect(normalizeGrid({ x: 8, y: 8, angleDegrees: -45 }).angleDegrees).toBeCloseTo(135, 9);
  });

  it("survives a field being cleared to NaN", () => {
    expect(normalizeGrid({ x: Number.NaN, y: 8, angleDegrees: Number.NaN })).toEqual({
      x: 0,
      y: 8,
      angleDegrees: 0,
    });
  });

  it("says what the grid is", () => {
    expect(describeGrid(NO_GRID)).toBe("No grid");
    expect(describeGrid(square(16))).toBe("16×16");
    expect(describeGrid({ x: 12, y: 18, angleDegrees: 0 })).toBe("12×18");
    expect(describeGrid(square(8, 22.5))).toBe("8×8 at 22.5°");
  });

  it("knows when there is a grid at all", () => {
    expect(isGridVisible(NO_GRID)).toBe(false);
    expect(isGridVisible({ x: 0, y: 6, angleDegrees: 0 })).toBe(true);
  });
});
