import { describe, expect, it } from "vitest";
import { flattenIllumination, normalizeContrast } from "../src/image.js";
import { detectEdges } from "../src/edges.js";
import { detectSegments } from "../src/hough.js";
import {
  applyHomography,
  guessPaperQuad,
  homography,
  orderCorners,
  otsuThreshold,
  warpToSquare,
  type Point,
  type Quad,
} from "../src/quad.js";
import { mergeCollinear, toUnitSquare, type Line } from "../src/segments.js";
import { addLighting, addNoise, drawPattern, photograph, recallOf } from "./synthetic.js";

describe("orderCorners", () => {
  const expected: Quad = [
    { x: 10, y: 10 },
    { x: 90, y: 20 },
    { x: 80, y: 95 },
    { x: 5, y: 85 },
  ];

  it("puts corners clockwise from the top left whatever order they arrive in", () => {
    const shuffled = [expected[2], expected[0], expected[3], expected[1]];
    expect(orderCorners(shuffled)).toEqual(expected);
  });

  it("is idempotent", () => {
    expect(orderCorners(orderCorners(expected))).toEqual(expected);
  });

  it("untangles a quad whose handles were dragged past each other", () => {
    // Two corners swapped is a bow tie, and warping one produces a folded mess.
    const crossed = [expected[0], expected[2], expected[1], expected[3]];
    expect(orderCorners(crossed)).toEqual(expected);
  });
});

describe("homography", () => {
  const unit: Quad = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];

  it("maps each corner onto its counterpart exactly", () => {
    const target: Quad = [
      { x: 30, y: 12 },
      { x: 210, y: 40 },
      { x: 190, y: 230 },
      { x: 12, y: 190 },
    ];
    const h = homography(unit, target);

    unit.forEach((corner, i) => {
      const mapped = applyHomography(h, corner);
      expect(mapped.x).toBeCloseTo(target[i]!.x, 6);
      expect(mapped.y).toBeCloseTo(target[i]!.y, 6);
    });
  });

  it("inverts: mapping there and back is the identity", () => {
    const target: Quad = [
      { x: 30, y: 12 },
      { x: 210, y: 40 },
      { x: 190, y: 230 },
      { x: 12, y: 190 },
    ];
    const there = homography(unit, target);
    const back = homography(target, unit);

    const point: Point = { x: 0.37, y: 0.62 };
    const roundTrip = applyHomography(back, applyHomography(there, point));
    expect(roundTrip.x).toBeCloseTo(point.x, 6);
    expect(roundTrip.y).toBeCloseTo(point.y, 6);
  });

  it("handles a genuine perspective, not just an affine one", () => {
    // Converging edges: the far side of the sheet is shorter than the near one,
    // which is the case an affine transform cannot represent at all.
    const keystone: Quad = [
      { x: 60, y: 10 },
      { x: 160, y: 10 },
      { x: 220, y: 200 },
      { x: 0, y: 200 },
    ];
    const h = homography(unit, keystone);
    const centre = applyHomography(h, { x: 0.5, y: 0.5 });
    // The centre of the sheet appears above the midpoint of the frame, because
    // the near half occupies more of the image.
    expect(centre.y).toBeLessThan(105);
    expect(centre.x).toBeCloseTo(110, 0);
  });
});

describe("otsuThreshold", () => {
  it("lands between two clearly separated brightnesses", () => {
    const image = drawPattern(60, [], {});
    image.data.fill(0.2);
    for (let i = 0; i < image.data.length / 2; i += 1) image.data[i] = 0.8;

    const threshold = otsuThreshold(image);
    expect(threshold).toBeGreaterThan(0.2);
    expect(threshold).toBeLessThan(0.8);
  });
});

describe("guessPaperQuad", () => {
  it("finds a bright sheet on a dark surface, near enough for a handle to start from", () => {
    const frame = 320;
    const square = drawPattern(200, [], {});
    const corners: Quad = [
      { x: 60, y: 40 },
      { x: 268, y: 62 },
      { x: 250, y: 272 },
      { x: 44, y: 250 },
    ];
    const photo = photograph(square, frame, corners, 0.15);

    const guess = guessPaperQuad(photo);
    guess.forEach((point, i) => {
      // Within 6% of the frame. This only has to seed a draggable handle.
      expect(Math.hypot(point.x - corners[i]!.x, point.y - corners[i]!.y)).toBeLessThan(
        frame * 0.06,
      );
    });
  });

  it("falls back to most of the frame when nothing stands out", () => {
    const flat = drawPattern(200, [], {});
    flat.data.fill(0.5);
    const guess = guessPaperQuad(flat);
    // Any four corners spanning most of the image will do; what matters is that
    // it returns something usable instead of collapsing to a point.
    const width = Math.abs(guess[1]!.x - guess[0]!.x);
    expect(width).toBeGreaterThan(150);
  });
});

describe("rectifying a photograph taken at an angle", () => {
  /** The basic fold, whose angles are 45 and 90 when seen square on. */
  const BASIC: Line[] = [
    { x1: 0, y1: 0, x2: 1, y2: 1 },
    { x1: 1, y1: 0, x2: 0, y2: 1 },
    { x1: 0.5, y1: 0, x2: 0.5, y2: 1 },
    { x1: 0, y1: 0.5, x2: 1, y2: 0.5 },
  ];

  const corners: Quad = [
    { x: 150, y: 90 },
    { x: 640, y: 150 },
    { x: 610, y: 640 },
    { x: 110, y: 590 },
  ];

  function angledPhoto() {
    const square = drawPattern(500, BASIC.map((line) => ({ line })), { contrast: 0.18 });
    const photo = photograph(square, 760, corners, 0.2);
    addLighting(photo, 0.28);
    addNoise(photo, 0.01);
    return photo;
  }

  it("recovers the creases once the corners are given", () => {
    const rectified = warpToSquare(angledPhoto(), corners, 500);
    const flattened = normalizeContrast(flattenIllumination(rectified));
    const found = toUnitSquare(
      mergeCollinear(
        detectSegments(detectEdges(flattened), { minLength: 50, maxGap: 20 }),
        { offsetTolerance: 6 },
      ),
      500,
    );

    expect(recallOf(found, BASIC, 0.06)).toBe(BASIC.length);
  });

  it("restores the right angles, which is what Kawasaki is a statement about", () => {
    const rectified = warpToSquare(angledPhoto(), corners, 500);
    const flattened = normalizeContrast(flattenIllumination(rectified));
    const found = toUnitSquare(
      mergeCollinear(
        detectSegments(detectEdges(flattened), { minLength: 50, maxGap: 20 }),
        { offsetTolerance: 6 },
      ),
      500,
    );

    // Every crease in this pattern is a multiple of 45 degrees. Off an
    // uncorrected photograph none of them would be.
    for (const line of found) {
      const angle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1);
      const folded = ((angle % Math.PI) + Math.PI) % Math.PI;
      const step = Math.PI / 4;
      const offset = Math.abs(folded - Math.round(folded / step) * step);
      expect(Math.min(offset, step - offset)).toBeLessThan(0.05);
    }
  });

  it("without correcting, the same photo gives angles that are simply wrong", () => {
    // The control for the test above. If this ever passes, the rectification is
    // not doing anything and the test above is proving nothing.
    const photo = angledPhoto();
    const flattened = normalizeContrast(flattenIllumination(photo));
    const found = toUnitSquare(
      mergeCollinear(detectSegments(detectEdges(flattened), { minLength: 60, maxGap: 20 }), {
        offsetTolerance: 6,
      }),
      760,
    );

    const offAxis = found.filter((line) => {
      const angle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1);
      const folded = ((angle % Math.PI) + Math.PI) % Math.PI;
      const step = Math.PI / 4;
      const offset = Math.abs(folded - Math.round(folded / step) * step);
      return Math.min(offset, step - offset) > 0.05;
    });

    expect(offAxis.length).toBeGreaterThan(0);
  });
});
