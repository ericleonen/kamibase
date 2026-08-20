import { describe, expect, it } from "vitest";
import {
  PAPER_ANGLE_PRESETS,
  normalizePaperAngle,
  paperTransform,
  rotatedExtent,
  rotatedOffset,
  toPaperPoint,
} from "@/lib/editor/paper";

/**
 * Turning the sheet on screen.
 *
 * The interesting property is a round trip: draw a paper point through the
 * transform the canvas uses, then read it back through the one the pointer
 * uses, and get the same point. Nothing else catches a sign error, and a sign
 * error here means every crease drawn on a turned sheet lands somewhere else.
 */

/** The forward transform, applied by hand exactly as SVG would apply it. */
function draw(point: readonly [number, number], degrees: number): { x: number; y: number } {
  // Paper is y-up, SVG is y-down.
  const x = point[0];
  const y = 1 - point[1];
  // `rotate(-degrees, 0.5, 0.5)` in SVG's y-down frame.
  const radians = (-degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = x - 0.5;
  const dy = y - 0.5;
  const offset = rotatedOffset(degrees);
  return {
    x: offset + 0.5 + dx * cos - dy * sin,
    y: offset + 0.5 + dx * sin + dy * cos,
  };
}

const CORNERS: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
  [0.25, 0.75],
  [0.5, 0.5],
];

describe("toPaperPoint", () => {
  it("undoes exactly what the canvas draws, at every angle", () => {
    for (const degrees of [0, 12, 22.5, 45, 90, 137, 180, 270, 359.5]) {
      for (const corner of CORNERS) {
        const [x, y] = toPaperPoint(draw(corner, degrees), degrees);
        expect(x).toBeCloseTo(corner[0], 10);
        expect(y).toBeCloseTo(corner[1], 10);
      }
    }
  });

  it("is the plain y flip when the sheet is not turned", () => {
    // The behaviour every other part of the editor was written against, so a
    // regression here would be invisible until somebody turned the paper.
    expect(toPaperPoint({ x: 0.3, y: 0.25 }, 0)).toEqual([0.3, 0.75]);
  });

  it("turns the sheet anticlockwise, the way a hand does", () => {
    /*
     * A quarter turn walks each corner one place anticlockwise on screen: the
     * paper's top-right corner ends up at the top-left, and its top-left ends
     * up at the bottom-left. Clockwise would be arithmetically just as
     * consistent and would feel backwards to anyone who has turned a sheet of
     * paper, which is a bug no round-trip test can see.
     */
    const topRight = draw([1, 1], 90);
    expect(topRight.x).toBeCloseTo(0, 10);
    expect(topRight.y).toBeCloseTo(0, 10);

    const topLeft = draw([0, 1], 90);
    expect(topLeft.x).toBeCloseTo(0, 10);
    expect(topLeft.y).toBeCloseTo(1, 10);
  });
});

describe("rotatedExtent", () => {
  it("is 1 at the quarter turns and √2 on the diagonals", () => {
    for (const degrees of [0, 90, 180, 270, 360]) {
      expect(rotatedExtent(degrees)).toBeCloseTo(1, 12);
    }
    for (const degrees of [45, 135, 225, 315]) {
      expect(rotatedExtent(degrees)).toBeCloseTo(Math.SQRT2, 12);
    }
  });

  it("bounds the drawn sheet, which is what the fit depends on", () => {
    // If this ever undershoots, fitting the canvas crops the corners off.
    for (const degrees of [0, 17, 45, 63, 90, 118, 200, 310]) {
      const extent = rotatedExtent(degrees);
      for (const corner of [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][]) {
        const screen = draw(corner, degrees);
        expect(screen.x).toBeGreaterThanOrEqual(-1e-9);
        expect(screen.y).toBeGreaterThanOrEqual(-1e-9);
        expect(screen.x).toBeLessThanOrEqual(extent + 1e-9);
        expect(screen.y).toBeLessThanOrEqual(extent + 1e-9);
      }
    }
  });
});

describe("normalizePaperAngle", () => {
  it("folds any angle into one turn", () => {
    expect(normalizePaperAngle(0)).toBe(0);
    expect(normalizePaperAngle(360)).toBe(0);
    expect(normalizePaperAngle(-90)).toBe(270);
    expect(normalizePaperAngle(450)).toBe(90);
  });

  it("treats a non-number as no rotation rather than as NaN", () => {
    expect(normalizePaperAngle(Number.NaN)).toBe(0);
    expect(normalizePaperAngle(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("paperTransform", () => {
  it("says nothing but a translate of zero when the sheet is square on", () => {
    expect(paperTransform(0)).toBe("translate(0 0) rotate(0 0.5 0.5)");
  });

  it("negates the angle, because SVG's y axis points the other way", () => {
    expect(paperTransform(45)).toContain("rotate(-45 0.5 0.5)");
  });
});

describe("PAPER_ANGLE_PRESETS", () => {
  it("offers the quarter turns and the diagonal", () => {
    expect(PAPER_ANGLE_PRESETS).toContain(0);
    expect(PAPER_ANGLE_PRESETS).toContain(45);
    expect(PAPER_ANGLE_PRESETS).toContain(90);
    // Every preset has to survive normalisation unchanged, or tapping one
    // would leave no chip looking selected.
    for (const angle of PAPER_ANGLE_PRESETS) {
      expect(normalizePaperAngle(angle)).toBe(angle);
    }
  });
});
