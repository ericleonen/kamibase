import { describe, expect, it } from "vitest";
import {
  clipToUnitSquare,
  directionsAt,
  perpendicularBisector,
  snapToBisector,
} from "@/lib/editor/bisect";
import { emptyPaper, type EditorDoc } from "@/lib/editor/model";

const DEGREE = Math.PI / 180;

/** A sheet with two creases meeting at the centre, at 0° and 90°. */
const CORNER: EditorDoc = [
  ...emptyPaper(),
  { x1: 0.5, y1: 0.5, x2: 1, y2: 0.5, assignment: "M" },
  { x1: 0.5, y1: 0.5, x2: 0.5, y2: 1, assignment: "M" },
];

describe("directionsAt", () => {
  it("finds every crease leaving a point, whichever end it is stored at", () => {
    const doc: EditorDoc = [
      { x1: 0.5, y1: 0.5, x2: 1, y2: 0.5, assignment: "M" },
      { x1: 0.5, y1: 1, x2: 0.5, y2: 0.5, assignment: "V" },
    ];
    const directions = directionsAt(doc, [0.5, 0.5]).map((r) => Math.round(r / DEGREE));
    expect(directions.sort((a, b) => a - b)).toEqual([0, 90]);
  });

  it("says nothing about a point no crease touches", () => {
    expect(directionsAt(CORNER, [0.25, 0.25])).toEqual([]);
  });
});

describe("snapToBisector", () => {
  it("pulls a near-45° drag onto the bisector of a right angle", () => {
    const hit = snapToBisector([0.5, 0.5], [0.8, 0.79], CORNER);
    expect(hit).not.toBeNull();
    expect(Math.round((hit?.direction ?? 0) / DEGREE)).toBe(45);
  });

  it("keeps the length the pointer asked for", () => {
    const hit = snapToBisector([0.5, 0.5], [0.8, 0.79], CORNER);
    const asked = Math.hypot(0.8 - 0.5, 0.79 - 0.5);
    const got = Math.hypot((hit?.point[0] ?? 0) - 0.5, (hit?.point[1] ?? 0) - 0.5);
    expect(got).toBeCloseTo(asked, 6);
  });

  it("leaves a deliberate angle alone", () => {
    // 20° away from the 45° bisector is a choice, not a near miss.
    expect(snapToBisector([0.5, 0.5], [0.9, 0.5 + 0.4 * Math.tan(25 * DEGREE)], CORNER)).toBeNull();
  });

  it("does nothing at a point with fewer than two creases", () => {
    const doc: EditorDoc = [{ x1: 0.5, y1: 0.5, x2: 1, y2: 0.5, assignment: "M" }];
    expect(snapToBisector([0.5, 0.5], [0.8, 0.79], doc)).toBeNull();
  });

  it("reports the pair it bisected, so the canvas can mark it", () => {
    const hit = snapToBisector([0.5, 0.5], [0.8, 0.79], CORNER);
    const between = (hit?.between ?? []).map((r) => Math.round(r / DEGREE)).sort((a, b) => a - b);
    expect(between).toEqual([0, 90]);
  });
});

describe("perpendicularBisector", () => {
  it("halves a horizontal segment with a vertical crease", () => {
    const crease = perpendicularBisector([0.2, 0.5], [0.8, 0.5]);
    expect(crease).not.toBeNull();
    expect(crease?.x1).toBeCloseTo(0.5, 6);
    expect(crease?.x2).toBeCloseTo(0.5, 6);
    // Clipped to the sheet, so it runs the full height.
    expect(Math.min(crease?.y1 ?? 0, crease?.y2 ?? 0)).toBeCloseTo(0, 6);
    expect(Math.max(crease?.y1 ?? 0, crease?.y2 ?? 0)).toBeCloseTo(1, 6);
  });

  it("passes through the midpoint of a diagonal pair", () => {
    const crease = perpendicularBisector([0, 0], [1, 1]);
    expect(crease).not.toBeNull();
    // The midpoint (0.5, 0.5) is on the line, so the two ends straddle it.
    const midX = ((crease?.x1 ?? 0) + (crease?.x2 ?? 0)) / 2;
    const midY = ((crease?.y1 ?? 0) + (crease?.y2 ?? 0)) / 2;
    expect(midX).toBeCloseTo(0.5, 6);
    expect(midY).toBeCloseTo(0.5, 6);
  });

  it("refuses two points that are the same point", () => {
    expect(perpendicularBisector([0.5, 0.5], [0.5, 0.5])).toBeNull();
  });

  it("stays inside the sheet", () => {
    const crease = perpendicularBisector([0.1, 0.2], [0.7, 0.9]);
    for (const value of [crease?.x1, crease?.y1, crease?.x2, crease?.y2]) {
      expect(value).toBeGreaterThanOrEqual(-1e-9);
      expect(value).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});

describe("clipToUnitSquare", () => {
  it("cuts a diagonal to the corners", () => {
    const segment = clipToUnitSquare([0.5, 0.5], [1, 1]);
    expect(segment).not.toBeNull();
    expect(Math.min(segment?.x1 ?? 1, segment?.x2 ?? 1)).toBeCloseTo(0, 6);
    expect(Math.max(segment?.x1 ?? 0, segment?.x2 ?? 0)).toBeCloseTo(1, 6);
  });

  it("returns nothing for a line that misses the sheet", () => {
    expect(clipToUnitSquare([2, 2], [1, 0])).toBeNull();
  });

  it("returns nothing for a line that only grazes a corner", () => {
    expect(clipToUnitSquare([0, 0], [1, -1])).toBeNull();
  });
});
