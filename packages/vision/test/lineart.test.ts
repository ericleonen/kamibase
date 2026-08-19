import { describe, expect, it } from "vitest";
import { extractInk } from "../src/ink.js";
import { profileRaster, rgbFromRgba, type RgbImage } from "../src/raster.js";
import { readCreasePattern } from "../src/read.js";
import { scanLineArt } from "../src/lineart.js";
import { blankPaper, addLighting, addNoise, drawPattern } from "./synthetic.js";
import { renderPattern, type Pattern, type RenderOptions } from "./drawing.js";
import {
  asymmetric,
  basicFold,
  boxPleat,
  miura,
  treeBase,
  twentyTwoHalf,
  waterbomb,
  wideMiura,
  withLattice,
} from "./corpus.js";
import { danglingEnds, measure, type Found } from "./metrics.js";

/**
 * Does a published crease pattern come back as that crease pattern?
 *
 * Every test renders creases it chose in the style real CPs are drawn in, then
 * asks for them back and measures three things: how much of what was drawn was
 * found, how much of what was found was assigned the way it was drawn, and how
 * much was found that nobody drew. Those are the only questions worth asking,
 * and a suite of unit tests on the individual filters would answer none of
 * them.
 */

function scan(pattern: Pattern, options: RenderOptions = {}): Found[] {
  const result = scanLineArt(renderPattern(pattern, options), { seed: 1 });
  return result.creases.map((crease) => ({
    x1: crease.x1,
    y1: crease.y1,
    x2: crease.x2,
    y2: crease.y2,
    assignment: crease.assignment,
  }));
}

/** How a pattern's own coordinates map onto the paper the scanner reports. */
function creasesOf(pattern: Pattern): Pattern["creases"] {
  return pattern.creases;
}

describe("telling a drawing from a photograph", () => {
  it("calls a rendered crease pattern line art", () => {
    const profile = profileRaster(renderPattern(basicFold));
    expect(profile.lineArt).toBe(true);
    expect(profile.backgroundShare).toBeGreaterThan(0.8);
  });

  it("still calls it line art after compression artefacts and a rotation", () => {
    const profile = profileRaster(
      renderPattern(waterbomb(8), { noise: 0.012, rotateDegrees: 1.5 }),
    );
    expect(profile.lineArt).toBe(true);
  });

  it("calls a photograph of creased paper a photograph", () => {
    const size = 500;
    const image = drawPattern(
      size,
      basicFold.creases.map((line) => ({ line })),
      { contrast: 0.16, width: 1.6 },
    );
    addLighting(image, 0.32);
    addNoise(image, 0.012);

    expect(profileRaster(grayToRgb(image)).lineArt).toBe(false);
  });

  it("declines to call a blank sheet either kind of crease pattern", () => {
    const blank = blankPaper(300, 0.95);
    addNoise(blank, 0.004);
    const profile = profileRaster(grayToRgb(blank));
    expect(profile.paletteSize).toBe(0);
  });

  it("routes each kind to the pipeline that suits it", () => {
    expect(readCreasePattern(renderPattern(basicFold)).kind).toBe("line-art");

    const photo = drawPattern(
      400,
      basicFold.creases.map((line) => ({ line })),
      { contrast: 0.16, width: 1.6 },
    );
    addLighting(photo, 0.3);
    addNoise(photo, 0.012);
    expect(readCreasePattern(grayToRgb(photo)).kind).toBe("photo");
  });
});

describe("reading the colours a pattern was drawn with", () => {
  it("takes red for mountain and blue for valley", () => {
    const { layers } = extractInk(renderPattern(basicFold));
    const creases = layers.filter((layer) => layer.role === "crease");

    expect(creases.some((layer) => layer.assignment === "M")).toBe(true);
    expect(creases.some((layer) => layer.assignment === "V")).toBe(true);
    expect(creases.some((layer) => layer.assignment === "B")).toBe(true);
  });

  it("throws the reference grid away instead of folding it", () => {
    // A coarse pattern over a fine lattice, which is how a box-pleated design
    // is actually published: most of the grey lines are not creases.
    const image = renderPattern(withLattice(boxPleat(4), 16), {
      showGrid: true,
      size: 1000,
    });
    const { layers } = extractInk(image);

    expect(layers.some((layer) => layer.role === "guide")).toBe(true);
  });

  it("does not report the lattice as creases", () => {
    const pattern = withLattice(boxPleat(4), 16);
    const quality = measure(
      scan(pattern, { size: 1100, showGrid: true }),
      pattern.creases,
    );

    expect(quality.coverage).toBeGreaterThan(0.9);
    // If the grey lattice had been kept, twelve of its sixteen lines lie
    // where no crease was drawn, and this would be most of the length found.
    expect(quality.spurious).toBeLessThan(0.15);
  });

  it("does not mistake a pale drawing for a grid", () => {
    // The whole pattern drawn faintly. Nothing here is scaffolding, so nothing
    // should be dropped: the test that separates "pale" from "pale and grey".
    const image = renderPattern(basicFold, {
      palette: {
        M: { r: 236, g: 170, b: 172 },
        V: { r: 172, g: 186, b: 232 },
        B: { r: 120, g: 120, b: 120 },
      },
    });
    const { layers } = extractInk(image);
    const creases = layers.filter((layer) => layer.role === "crease");

    expect(creases.some((layer) => layer.assignment === "M")).toBe(true);
    expect(creases.some((layer) => layer.assignment === "V")).toBe(true);
  });

  it("reads a two-colour pattern with no blue in it as mountain and valley", () => {
    const image = renderPattern(basicFold, {
      palette: { M: { r: 214, g: 32, b: 40 }, V: { r: 32, g: 150, b: 60 } },
    });
    const { layers } = extractInk(image);
    const creases = layers.filter((layer) => layer.role === "crease");

    expect(creases.some((layer) => layer.assignment === "M")).toBe(true);
    expect(creases.some((layer) => layer.assignment === "V")).toBe(true);
  });

  it("notices a dotted stroke", () => {
    const image = renderPattern(basicFold, { dashed: ["V"], size: 900 });
    const { layers } = extractInk(image);
    const valley = layers.find((layer) => layer.assignment === "V");

    expect(valley?.dashed).toBe(true);
  });
});

describe("reading a published crease pattern back", () => {
  it("recovers the basic fold with its assignments", () => {
    const found = scan(basicFold);
    const quality = measure(found, creasesOf(basicFold));

    expect(quality.coverage).toBeGreaterThan(0.9);
    expect(quality.assignment).toBeGreaterThan(0.95);
    expect(quality.spurious).toBeLessThan(0.1);
  });

  it("recovers a 22.5 degree base, eight creases through one point and all", () => {
    const found = scan(twentyTwoHalf, { size: 1100 });
    const quality = measure(found, creasesOf(twentyTwoHalf));

    expect(quality.coverage).toBeGreaterThan(0.85);
    expect(quality.assignment).toBeGreaterThan(0.9);
  });

  it("recovers a dense box-pleated grid without merging neighbouring pleats", () => {
    const found = scan(boxPleat(16), { size: 1200, showGrid: false });
    const quality = measure(boxPleat(16).creases.length ? found : [], boxPleat(16).creases, {
      tolerance: 0.008,
    });

    expect(quality.coverage).toBeGreaterThan(0.9);
    expect(quality.assignment).toBeGreaterThan(0.9);
    expect(quality.spurious).toBeLessThan(0.1);
  });

  it("keeps the pattern and drops the lattice when both are drawn", () => {
    const pattern = waterbomb(8);
    const withGrid = measure(
      scan(pattern, { size: 1200, showGrid: true }),
      pattern.creases,
    );

    expect(withGrid.coverage).toBeGreaterThan(0.85);
    // The reference lattice runs along the pattern's own grid creases here, so
    // the test that it was dropped is that nothing extra appeared, not that
    // coverage fell.
    expect(withGrid.spurious).toBeLessThan(0.12);
  });

  it("recovers a Miura-ori, whose creases are at no standard angle", () => {
    const pattern = miura(6, 4);
    const quality = measure(scan(pattern, { size: 1100 }), pattern.creases);

    expect(quality.coverage).toBeGreaterThan(0.85);
    expect(quality.assignment).toBeGreaterThan(0.9);
  });

  it("leaves a tree base's circle-packing angles where the designer put them", () => {
    const quality = measure(scan(treeBase, { size: 1100 }), treeBase.creases, {
      // A tight angular tolerance is the assertion: a pipeline that snapped
      // these to 22.5 degrees would miss them entirely at 1.5 degrees.
      angleToleranceDegrees: 1.5,
    });

    expect(quality.coverage).toBeGreaterThan(0.85);
  });

  it("survives compression artefacts and a crooked screenshot", () => {
    const pattern = twentyTwoHalf;
    const quality = measure(
      scan(pattern, { size: 1200, noise: 0.01, strokeWidth: 1.4 }),
      pattern.creases,
    );

    expect(quality.coverage).toBeGreaterThan(0.8);
    expect(quality.assignment).toBeGreaterThan(0.85);
  });

  it("reads dotted creases as creases", () => {
    const quality = measure(
      scan(twentyTwoHalf, { size: 1200, dashed: ["V"] }),
      twentyTwoHalf.creases,
    );

    expect(quality.coverage).toBeGreaterThan(0.75);
  });

  it("finds the paper inside a margin rather than the edge of the file", () => {
    const generous = scan(basicFold, { margin: 0.18 });
    const quality = measure(generous, basicFold.creases);

    expect(quality.coverage).toBeGreaterThan(0.9);
  });

  it("keeps a wide sheet wide", () => {
    const pattern = wideMiura();
    const result = scanLineArt(renderPattern(pattern, { size: 1100 }));

    expect(result.paper.width).toBeCloseTo(1, 1);
    expect(result.paper.height).toBeCloseTo(0.5, 1);
  });

  it("does not turn an asymmetric pattern upside down", () => {
    const found = scan(asymmetric, { size: 1000 });
    const upright = measure(found, asymmetric.creases);
    const mirrored = measure(
      found,
      asymmetric.creases.map((line) => ({ ...line, y1: 1 - line.y1, y2: 1 - line.y2 })),
    );

    expect(upright.coverage).toBeGreaterThan(0.85);
    expect(upright.coverage).toBeGreaterThan(mirrored.coverage + 0.3);
  });
});

describe("making the ends meet", () => {
  it("leaves no crease dangling in mid-paper", () => {
    const found = scan(twentyTwoHalf, { size: 1100 });
    // Every edge of a planarized pattern shares both ends with a neighbour.
    // Anything else is a junction that did not close, which is the defect this
    // whole exercise is about.
    expect(danglingEnds(found)).toBe(0);
  });

  it("infers the two axes of a lattice independently", () => {
    const result = scanLineArt(renderPattern(miura(6, 4), { size: 1100 }));
    expect(result.grid.y).toBe(4);
    expect(result.grid.x).not.toBe(4);
  });

  it("is deterministic, so the same drawing twice gives the same answer", () => {
    const image = renderPattern(waterbomb(6), { size: 900 });
    const first = scanLineArt(image, { seed: 3 });
    const second = scanLineArt(image, { seed: 3 });

    expect(second.creases).toEqual(first.creases);
  });

  it("never claims a reading is auto-publishable", () => {
    // DESIGN.md §3.4 puts that line at 0.95. A drawing states its assignments,
    // so it earns more confidence than a photograph — but the geometry was
    // still read off pixels, and a person should still look at it.
    const result = scanLineArt(renderPattern(basicFold));
    expect(result.confidence).toBeLessThan(0.95);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("says which colour it took for what", () => {
    const result = scanLineArt(renderPattern(basicFold));
    expect(result.notes.join(" ")).toMatch(/→ M/);
    expect(result.notes.join(" ")).toMatch(/→ V/);
  });
});

/** A grey test image as RGB, so the profiler can look at a photograph. */
function grayToRgb(image: { width: number; height: number; data: Float32Array }): RgbImage {
  const rgba = new Uint8ClampedArray(image.width * image.height * 4);
  for (let i = 0, p = 0; i < image.data.length; i += 1, p += 4) {
    const value = Math.round(Math.min(1, Math.max(0, image.data[i] ?? 0)) * 255);
    rgba[p] = value;
    rgba[p + 1] = value;
    rgba[p + 2] = value;
    rgba[p + 3] = 255;
  }
  return rgbFromRgba(rgba, image.width, image.height);
}
