/**
 * A scratch harness for tuning, run by hand rather than by vitest:
 *
 *   pnpm --filter @kamibase/vision exec vitest run test/report.test.ts
 *
 * It prints the numbers the thresholds in `raster.ts`, `ink.ts` and
 * `lineart.ts` are set against. Keeping it in the repository is deliberate:
 * the alternative is re-deriving them from scratch the next time a real file
 * reads badly.
 */
import { extractInk } from "../src/ink.js";
import { colourDistance, profileRaster, rgbFromRgba, type RgbImage } from "../src/raster.js";
import { scanLineArt } from "../src/lineart.js";
import { addLighting, addNoise, drawPattern } from "./synthetic.js";
import { renderPattern, type Pattern, type RenderOptions } from "./drawing.js";
import {
  asymmetric,
  basicFold,
  boxPleat,
  miura,
  treeBase,
  twentyTwoHalf,
  waterbomb,
  withLattice,
} from "./corpus.js";
import { danglingEnds, measure, type Found } from "./metrics.js";

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

function stats(label: string, image: RgbImage): void {
  const profile = profileRaster(image);
  const pixels = image.width * image.height;

  const distances: number[] = [];
  const bins = new Map<number, number>();
  for (let i = 0, p = 0; i < pixels; i += 1, p += 3) {
    const r = image.data[p] ?? 0;
    const g = image.data[p + 1] ?? 0;
    const b = image.data[p + 2] ?? 0;
    const d = colourDistance({ r, g, b }, profile.background);
    if (d > 20) distances.push(d);
    if (d > 110) {
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      bins.set(key, (bins.get(key) ?? 0) + 1);
    }
  }
  distances.sort((a, b) => a - b);
  const p99 = distances[Math.floor(distances.length * 0.99)] ?? 0;
  const strong = distances.filter((d) => d > p99 * 0.6).length;
  let inkTotal = 0;
  for (const count of bins.values()) inkTotal += count;
  const top = [...bins.values()].sort((a, b) => b - a).slice(0, 8);
  const concentration = inkTotal === 0 ? 0 : top.reduce((s, n) => s + n, 0) / inkTotal;

  console.log(
    [
      label.padEnd(22),
      `lineArt=${profile.lineArt ? "Y" : "n"}`,
      `bg=${profile.backgroundShare.toFixed(3)}`,
      `flat=${profile.flatShare.toFixed(3)}`,
      `chroma=${profile.chromaShare.toFixed(3)}`,
      `palette=${profile.paletteSize}`,
      `inkShare=${(inkTotal / pixels).toFixed(4)}`,
      `conc=${concentration.toFixed(3)}`,
      `strongOfNonBg=${distances.length === 0 ? 0 : (strong / distances.length).toFixed(3)}`,
    ].join("  "),
  );
}

function report(pattern: Pattern, options: RenderOptions = {}): void {
  const image = renderPattern(pattern, options);
  const started = Date.now();
  const result = scanLineArt(image, { seed: 1 });
  const elapsed = Date.now() - started;

  const found: Found[] = result.creases.map((c) => ({
    x1: c.x1,
    y1: c.y1,
    x2: c.x2,
    y2: c.y2,
    assignment: c.assignment,
  }));
  const quality = measure(found, pattern.creases);

  console.log(
    [
      pattern.name.padEnd(20),
      `${image.width}x${image.height}`,
      `edges=${String(found.length).padStart(5)}`,
      `cover=${quality.coverage.toFixed(3)}`,
      `assign=${quality.assignment.toFixed(3)}`,
      `spurious=${quality.spurious.toFixed(3)}`,
      `dangling=${danglingEnds(found)}`,
      `grid=${result.grid.x}x${result.grid.y}`,
      `paper=${result.paper.width.toFixed(2)}x${result.paper.height.toFixed(2)}`,
      `conf=${result.confidence.toFixed(2)}`,
      `${elapsed}ms`,
    ].join("  "),
  );
  if (quality.worst && quality.worst.coverage < 0.9) {
    const w = quality.worst.crease;
    console.log(
      `    worst ${w.assignment} (${w.x1.toFixed(3)},${w.y1.toFixed(3)})-` +
        `(${w.x2.toFixed(3)},${w.y2.toFixed(3)}) at ${quality.worst.coverage.toFixed(3)}`,
    );
  }
  // RAW=1 prints what Hough gave before any snapping; DUMP=1 prints the final
  // creases. Between them they answer "was it detected wrong or cleaned up
  // wrong", which is the first question every time something reads badly.
  if (process.env.RAW) {
    for (const c of result.rawSegments) {
      console.log(
        `    raw (${c.x1.toFixed(4)},${c.y1.toFixed(4)})-` +
          `(${c.x2.toFixed(4)},${c.y2.toFixed(4)}) ` +
          `len=${Math.hypot(c.x2 - c.x1, c.y2 - c.y1).toFixed(4)} ` +
          `ang=${((Math.atan2(c.y2 - c.y1, c.x2 - c.x1) * 180) / Math.PI).toFixed(2)}`,
      );
    }
  }
  if (process.env.DUMP) {
    for (const c of found) {
      console.log(
        `    ${c.assignment} (${c.x1.toFixed(4)},${c.y1.toFixed(4)})-` +
          `(${c.x2.toFixed(4)},${c.y2.toFixed(4)}) ` +
          `len=${Math.hypot(c.x2 - c.x1, c.y2 - c.y1).toFixed(4)}`,
      );
    }
  }
  for (const layer of result.layers) {
    console.log(
      `    layer rgb(${layer.colour.r.toFixed(0)},${layer.colour.g.toFixed(0)},` +
        `${layer.colour.b.toFixed(0)}) -> ${layer.assignment} ` +
        `${layer.dashed ? "dashed " : ""}creases=${layer.creases}`,
    );
  }
}

console.log("--- what kind of picture is it ---");
stats("rendered CP", renderPattern(basicFold));
stats("rendered + grid", renderPattern(boxPleat(8), { showGrid: true }));
stats("rendered + jpeg", renderPattern(waterbomb(8), { noise: 0.012, rotateDegrees: 1.5 }));

const photo = drawPattern(
  500,
  basicFold.creases.map((line) => ({ line })),
  { contrast: 0.16, width: 1.6 },
);
addLighting(photo, 0.32);
addNoise(photo, 0.012);
stats("photo of creases", grayToRgb(photo));

const dim = drawPattern(
  500,
  basicFold.creases.map((line) => ({ line })),
  { contrast: 0.1, width: 2.4 },
);
addLighting(dim, 0.5);
addNoise(dim, 0.03);
stats("photo, poor light", grayToRgb(dim));

console.log("\n--- reading patterns back ---");
report(basicFold);
report(basicFold, { margin: 0.18 });
report(twentyTwoHalf, { size: 1100 });
report(miura(6, 4), { size: 1100 });
report(boxPleat(16), { size: 1200 });
report(waterbomb(8), { size: 1200, showGrid: true });
report(withLattice(boxPleat(4), 32), { size: 1200, showGrid: true });
report(treeBase, { size: 1100 });
report(asymmetric, { size: 1000, noise: 0.012 });
report(boxPleat(32), { size: 1600 });
