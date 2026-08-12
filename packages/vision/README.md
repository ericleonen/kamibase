# `@kamibase/vision`

A photograph of a creased sheet of paper, turned into a crease pattern. The
raster half of [DESIGN.md §3](../../DESIGN.md#3-the-converter-kamiconv), and the
hardest thing in Kamibase.

Pure TypeScript over `Float32Array`. No canvas, no OpenCV, no wasm, no native
build step, no API key. That is partly about deploying it to a browser and
mostly about being able to test it.

```ts
import { scanCreasePattern, guessPaperQuad, fromRgba } from "@kamibase/vision";

const image = fromRgba(imageData.data, imageData.width, imageData.height);
const result = scanCreasePattern(image, { quad: guessPaperQuad(image) });

result.creases;    // unit-square segments with M / V / B / U and a confidence
result.confidence; // one number for the upload funnel (DESIGN.md §3.4)
result.notes;      // what to say out loud before anybody publishes this
```

## The pipeline

| Module | |
|---|---|
| `image.ts` | Gray images, blurs, illumination flattening, downscaling, sharpness |
| `quad.ts` | Otsu, paper detection, homography, rectification |
| `edges.ts` | Sobel, non-maximum suppression, hysteresis, adaptive thresholds |
| `hough.ts` | Line accumulator and segment extraction |
| `segments.ts` | Merging, subsumption, angle and lattice snapping |
| `shading.ts` | The photograph's weak opinion about mountain versus valley |
| `assign.ts` | Maekawa's theorem as a constraint solver |
| `scan.ts` | All of it, in order |

Three decisions worth knowing about.

**Hough votes are restricted by gradient.** A pixel on a crease already knows
which way the crease runs, because the gradient points across it. Voting for
every angle anyway wastes most of the work and smears the accumulator with votes
the pixel had no business casting. Restricting each pixel to a window around its
own gradient direction is an order of magnitude faster and, more importantly,
sharpens the peaks.

**Thresholds are adaptive *and* floored.** Photographs vary by orders of
magnitude in contrast, so a fixed gradient threshold serves none of them; but a
percentile alone always finds edges, including in a photograph of a blank sheet.
So the edge threshold is the higher of a percentile and a multiple of the
image's own median gradient. The floor is the only thing standing between paper
texture and a confident pile of imaginary creases.

**Mountain and valley come from the geometry.** A flattened sheet does not
record which way its creases went, so Maekawa's theorem is asked instead: at
every interior vertex the mountains and valleys differ by exactly two. Where
several assignments fit equally well, one is offered and its confidence says how
many others fitted just as well. See
[apps/web/SCANNING.md](../../apps/web/SCANNING.md) for the whole argument.

## Testing

`test/synthetic.ts` manufactures photographs: creases as soft ridges, an uneven
lighting gradient, reproducible noise, and an optional perspective transform.
Every one of those was added because it broke an earlier version of the
pipeline.

That lets the tests be about the claim rather than the code. They assert that a
lit, noisy photo of the basic fold gives back exactly four creases; that a blank
sheet gives back none; that a dense grid survives; that rectification restores
45° angles, with a control test proving they are wrong without it; and that the
assignment the solver produces passes `checkFlatFoldability` from
`@kamibase/core`.

```sh
pnpm --filter @kamibase/vision test
```

## Performance

About a second for an 1800px photograph reduced to a 900px working square, on a
laptop. The web app runs it in a Web Worker with a main-thread fallback.

The costs, in order: Hough accumulation, then the segment extraction that walks
the pixel list once per peak, then the assignment search. Everything before them
is linear in pixels.

## Limits

Straight creases only, no colour, and a candidate rather than a proof: Maekawa
is a necessary condition, not a sufficient one. The result is meant to be opened
in an editor by the person who folded the thing.
