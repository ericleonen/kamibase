import { describe, expect, it } from "vitest";
import {
  clamp,
  fitScale,
  fitViewport,
  panViewport,
  readWheel,
  recentreViewport,
  toBox,
  toWorld,
  zoomViewport,
  type Size,
  type Viewport,
} from "@/lib/viewport/pan-zoom";

const BOX: Size = { width: 800, height: 400 };
const CONTENT: Size = { width: 100, height: 100 };

function wheel(overrides: Partial<Parameters<typeof readWheel>[0]> = {}) {
  return {
    deltaX: 0,
    deltaY: 0,
    deltaMode: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...overrides,
  };
}

describe("fit", () => {
  it("scales to the tighter axis and centres what is left", () => {
    const view = fitViewport(CONTENT, BOX);
    expect(view.scale).toBe(4); // 400 / 100, not 800 / 100
    expect(view.x).toBe(200); // (800 - 400) / 2
    expect(view.y).toBe(0);
  });

  it("keeps padding on both sides", () => {
    expect(fitScale(CONTENT, BOX, 50)).toBe(3); // (400 - 100) / 100
  });

  it("never divides by a zero-sized box", () => {
    expect(Number.isFinite(fitScale(CONTENT, { width: 0, height: 0 }, 40))).toBe(true);
  });

  it("fits into what floating chrome leaves of the box", () => {
    // A 96px dock along the bottom and a 300px panel on the right.
    const view = fitViewport(CONTENT, BOX, { top: 24, right: 300, bottom: 96, left: 24 });
    expect(view.scale).toBe(2.8); // (400 - 24 - 96) / 100, the tighter axis
    // Centred in the visible strip, not in the box: 24 … 500 across.
    expect(view.x).toBe(24 + (476 - 280) / 2);
    expect(view.y).toBe(24);
    // And the paper clears the chrome on every side.
    expect(view.x).toBeGreaterThanOrEqual(24);
    expect(view.x + 100 * view.scale).toBeLessThanOrEqual(BOX.width - 300);
    expect(view.y + 100 * view.scale).toBeLessThanOrEqual(BOX.height - 96);
  });
});

describe("zoomViewport", () => {
  const view: Viewport = { x: 10, y: 20, scale: 2 };

  it("holds the world point under the anchor still", () => {
    const anchor = { x: 300, y: 150 };
    const before = toWorld(view, anchor);
    const zoomed = zoomViewport(view, anchor, 1.6, 0.1, 100);
    const after = toWorld(zoomed, anchor);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it("still holds it when the zoom is clamped", () => {
    const anchor = { x: 640, y: 80 };
    const before = toWorld(view, anchor);
    const zoomed = zoomViewport(view, anchor, 1000, 0.1, 3);
    expect(zoomed.scale).toBe(3);
    const after = toWorld(zoomed, anchor);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it("is reversible, so a scroll up and back down lands where it started", () => {
    const anchor = { x: 123, y: 456 };
    const there = zoomViewport(view, anchor, 1.4, 0.01, 1000);
    const back = zoomViewport(there, anchor, 1 / 1.4, 0.01, 1000);
    expect(back.scale).toBeCloseTo(view.scale, 10);
    expect(back.x).toBeCloseTo(view.x, 8);
    expect(back.y).toBeCloseTo(view.y, 8);
  });
});

describe("coordinates", () => {
  it("round-trips box and world space", () => {
    const view: Viewport = { x: -40, y: 12.5, scale: 3.25 };
    const point = { x: 17, y: -3 };
    const round = toWorld(view, toBox(view, point));
    expect(round.x).toBeCloseTo(point.x, 10);
    expect(round.y).toBeCloseTo(point.y, 10);
  });

  it("pans in box pixels", () => {
    expect(panViewport({ x: 1, y: 2, scale: 5 }, 10, -4)).toEqual({ x: 11, y: -2, scale: 5 });
  });

  it("keeps the centre centred when the box resizes", () => {
    const view: Viewport = { x: 0, y: 0, scale: 1 };
    const grown = recentreViewport(view, BOX, { width: 1000, height: 500 });
    // The world point at the old centre (400, 200) is at the new one (500, 250).
    expect(toBox(grown, toWorld(view, { x: 400, y: 200 }))).toEqual({ x: 500, y: 250 });
  });
});

describe("readWheel", () => {
  const capture = { capturePlainWheel: true, box: BOX };
  const embedded = { capturePlainWheel: false, box: BOX };

  it("leaves a plain scroll to the page when embedded", () => {
    expect(readWheel(wheel({ deltaY: 120 }), embedded)).toEqual({ kind: "none" });
  });

  it("zooms on ctrl+wheel even when embedded, so pinch works in a page", () => {
    const intent = readWheel(wheel({ deltaY: -10, ctrlKey: true }), embedded);
    expect(intent.kind).toBe("zoom");
    if (intent.kind === "zoom") expect(intent.factor).toBeGreaterThan(1);
  });

  it("zooms out on a downward ctrl+wheel", () => {
    const intent = readWheel(wheel({ deltaY: 10, ctrlKey: true }), capture);
    expect(intent.kind).toBe("zoom");
    if (intent.kind === "zoom") expect(intent.factor).toBeLessThan(1);
  });

  it("pans opposite the scroll when the canvas owns the wheel", () => {
    expect(readWheel(wheel({ deltaX: 30, deltaY: 120 }), capture)).toEqual({
      kind: "pan",
      dx: -30,
      dy: -120,
    });
  });

  it("turns shift+wheel into a horizontal pan", () => {
    expect(readWheel(wheel({ deltaY: 100, shiftKey: true }), capture)).toEqual({
      kind: "pan",
      dx: -100,
      dy: 0,
    });
  });

  it("scales line and page deltas into pixels", () => {
    expect(readWheel(wheel({ deltaY: 3, deltaMode: 1 }), capture)).toEqual({
      kind: "pan",
      dx: -0,
      dy: -48,
    });
    expect(readWheel(wheel({ deltaY: 1, deltaMode: 2 }), capture)).toEqual({
      kind: "pan",
      dx: -0,
      dy: -400,
    });
  });

  it("ignores an empty wheel event", () => {
    expect(readWheel(wheel(), capture)).toEqual({ kind: "none" });
  });
});

describe("clamp", () => {
  it("bounds both ways", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
    expect(clamp(1.5, 0, 3)).toBe(1.5);
  });
});
