import { describe, expect, it } from "vitest";
import {
  boundingBox,
  compareLex,
  distanceToLine,
  intersectSegments,
  normalizeAngle,
  pointInPolygon,
  projectOntoSegment,
  roundCanonical,
  signedArea,
} from "../src/index.js";

describe("roundCanonical", () => {
  it("rounds to 9 decimal places", () => {
    expect(roundCanonical(0.1234567891234)).toBe(0.123456789);
    expect(roundCanonical(1 / 3)).toBe(0.333333333);
  });

  it("never produces negative zero", () => {
    expect(Object.is(roundCanonical(-1e-12), 0)).toBe(true);
    expect(Object.is(roundCanonical(-0), 0)).toBe(true);
  });

  it("leaves already-canonical values alone", () => {
    expect(roundCanonical(0.5)).toBe(0.5);
    expect(roundCanonical(1)).toBe(1);
  });
});

describe("intersectSegments", () => {
  it("finds a proper crossing", () => {
    const hit = intersectSegments([0, 0], [1, 1], [0, 1], [1, 0]);
    expect(hit.kind).toBe("point");
    if (hit.kind !== "point") throw new Error("unreachable");
    expect(hit.point[0]).toBeCloseTo(0.5, 12);
    expect(hit.point[1]).toBeCloseTo(0.5, 12);
    expect(hit.tA).toBeCloseTo(0.5, 12);
    expect(hit.tB).toBeCloseTo(0.5, 12);
  });

  it("reports a shared endpoint as a point hit at t = 0 or 1", () => {
    const hit = intersectSegments([0, 0], [1, 0], [1, 0], [1, 1]);
    expect(hit.kind).toBe("point");
    if (hit.kind !== "point") throw new Error("unreachable");
    expect(hit.tA).toBeCloseTo(1, 12);
    expect(hit.tB).toBeCloseTo(0, 12);
  });

  it("returns none for parallel, non-collinear segments", () => {
    expect(intersectSegments([0, 0], [1, 0], [0, 1], [1, 1]).kind).toBe("none");
  });

  it("returns none for segments that would cross beyond their ends", () => {
    expect(intersectSegments([0, 0], [0.4, 0.4], [0, 1], [1, 0]).kind).toBe("none");
  });

  it("detects a collinear overlap", () => {
    const hit = intersectSegments([0, 0], [1, 0], [0.5, 0], [1.5, 0]);
    expect(hit.kind).toBe("collinear");
    if (hit.kind !== "collinear") throw new Error("unreachable");
    expect(hit.tA0).toBeCloseTo(0.5, 12);
    expect(hit.tA1).toBeCloseTo(1, 12);
  });

  it("does not call touching collinear segments an overlap", () => {
    expect(intersectSegments([0, 0], [1, 0], [1, 0], [2, 0]).kind).toBe("none");
  });

  it("is scale-free: a near-parallel pair at large coordinates still crosses", () => {
    const hit = intersectSegments([0, 0], [1000, 1], [0, 1], [1000, 0]);
    expect(hit.kind).toBe("point");
  });

  it("returns none when a segment is degenerate", () => {
    expect(intersectSegments([0, 0], [0, 0], [0, 1], [1, 0]).kind).toBe("none");
  });
});

describe("point and polygon helpers", () => {
  it("computes signed area with sign following winding", () => {
    const ccw: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    expect(signedArea(ccw)).toBeCloseTo(1, 12);
    expect(signedArea([...ccw].reverse())).toBeCloseTo(-1, 12);
  });

  it("tests containment, counting the boundary as inside", () => {
    const square: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    expect(pointInPolygon([0.5, 0.5], square)).toBe(true);
    expect(pointInPolygon([0, 0.5], square)).toBe(true);
    expect(pointInPolygon([1.5, 0.5], square)).toBe(false);
    expect(pointInPolygon([-0.001, 0.5], square)).toBe(false);
  });

  it("projects onto a segment and clamps to its ends", () => {
    expect(projectOntoSegment([0.5, 1], [0, 0], [1, 0])).toEqual({ t: 0.5, distance: 1 });
    expect(projectOntoSegment([2, 0], [0, 0], [1, 0]).t).toBe(1);
  });

  it("measures distance to an infinite line", () => {
    expect(distanceToLine([0.5, 3], [0, 0], [1, 0])).toBeCloseTo(3, 12);
    expect(distanceToLine([5, 0], [0, 0], [1, 0])).toBeCloseTo(0, 12);
  });

  it("normalizes angles into [0, 2pi)", () => {
    expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2, 12);
    expect(normalizeAngle(0)).toBe(0);
  });

  it("orders lexicographically by x then y", () => {
    expect(compareLex([0, 1], [0, 2])).toBe(-1);
    expect(compareLex([1, 0], [0, 9])).toBe(1);
    expect(compareLex([1, 1], [1, 1])).toBe(0);
  });

  it("computes a bounding box, including for the empty set", () => {
    expect(boundingBox([[0, 1], [2, -1]])).toEqual({ min: [0, -1], max: [2, 1] });
    expect(boundingBox([])).toEqual({ min: [0, 0], max: [0, 0] });
  });
});
