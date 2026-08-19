# `@kamibase/vision`

A picture of a crease pattern, turned into a crease pattern. The raster half of
[DESIGN.md §3](../../DESIGN.md#3-the-converter-kamiconv), and the hardest thing
in Kamibase.

Two kinds of picture, two pipelines. A **photograph** of a creased sheet has
uneven light, soft ridges, no colour, and an assignment that has to be inferred
because flat paper does not remember which way it went. A **published drawing**
— a PNG off a designer's site, an export from Oriedita or ORIPA — has none of
those problems and a different set: hairline strokes, a reference grid that is
not a crease, dashes, and a paper edge somewhere inside a margin. It also has
the answer written in it, because a red line means mountain.

`readCreasePattern` looks at the image and picks.

Pure TypeScript over `Float32Array`. No canvas, no OpenCV, no wasm, no native
build step, no API key. That is partly about deploying it to a browser and
mostly about being able to test it.

```ts
import { readCreasePattern, rgbFromRgba } from "@kamibase/vision";

const image = rgbFromRgba(imageData.data, imageData.width, imageData.height);
const result = readCreasePattern(image);

result.kind;       // "line-art" or "photo", and why in result.profile
result.creases;    // segments with M / V / B / U and a confidence
result.paper;      // the sheet's extent; not always square
result.layers;     // the ink colours found, and what each was taken to mean
result.confidence; // one number for the upload funnel (DESIGN.md §3.4)
result.notes;      // what to say out loud before anybody publishes this
```

## The pipeline

| Module | |
|---|---|
| `image.ts` | Gray images, blurs, illumination flattening, downscaling, sharpness |
| `raster.ts` | Colour, and deciding which kind of picture this is |
| `quad.ts` | Otsu, paper detection, homography, rectification |
| `edges.ts` | Sobel, non-maximum suppression, hysteresis, adaptive thresholds |
| `ink.ts` | Splitting a drawing into the colours it was drawn with |
| `skeleton.ts` | Morphology, Zhang-Suen thinning, stroke orientation |
| `hough.ts` | Line accumulator and segment extraction |
| `segments.ts` | Merging, subsumption, angle and lattice snapping |
| `weld.ts` | Making the ends of creases actually meet |
| `shading.ts` | The photograph's weak opinion about mountain versus valley |
| `assign.ts` | Maekawa's theorem as a constraint solver |
| `scan.ts` | The photograph pipeline, in order |
| `lineart.ts` | The drawing pipeline, in order |
| `read.ts` | One door onto both |

Six decisions worth knowing about.

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

**Mountain and valley come from the geometry — unless the picture says.** A
flattened sheet does not record which way its creases went, so Maekawa's theorem
is asked instead: at every interior vertex the mountains and valleys differ by
exactly two. Where several assignments fit equally well, one is offered and its
confidence says how many others fitted just as well. See
[apps/web/SCANNING.md](../../apps/web/SCANNING.md) for the whole argument.

A *drawing* is different, and the difference is the single biggest win here. A
red line is not evidence about mountain, it is a designer saying "mountain".
Those are pinned, the solver fills in only what no convention covered, and —
because pinning breaks the symmetry Maekawa is blind to — the answer is not
merely correct up to being inside out.

**A drawing is separated by colour before anything else looks at it.** That
answers the assignment outright, removes every crossing between differently
coloured creases, and lets the pale grey reference lattice under a box-pleated
design be thrown away instead of folded. The unmixing is the subtle part: a
stroke is anti-aliased, so pixels near it are blends of paper and ink in unknown
proportion. The palette is built from stroke *cores* — pixels where the
departure from the paper is a local maximum — and everything else is then
explained as some fraction of one of those. Histogramming all the pixels
instead, which is the obvious thing, invents an ink colour in the middle of
every skirt and files half of each crease under a colour nobody drew with.

**Drawn strokes skip Canny entirely.** A drawn line already *is* an edge, and
running an edge detector over it finds two, one down each side. Instead the ink
layer is thinned to a one-pixel skeleton and handed to the same Hough transform,
with each pixel's direction taken from the structure tensor — which is blind to
sign, so the two flanks of a stroke reinforce instead of cancelling.

**The ends are made to meet.** This is the defect everyone notices and nobody
can name: the lines are all there, all correct to within a pixel, and a pixel is
a thousandth of the paper, so four creases that meet at a vertex arrive as four
creases that pass within a thousandth of each other. That pattern renders
perfectly and is wrong in every way that matters — no vertex, nothing for
Maekawa to constrain, a pile of dangling creases, and a simulator that tears the
sheet. `weld.ts` closes them, moving nothing further than the tolerance and
never changing a crease's direction.

## Testing

Two manufacturers of input, because there are two kinds of input.

`test/synthetic.ts` makes photographs: creases as soft ridges, an uneven
lighting gradient, reproducible noise, and an optional perspective transform.

`test/drawing.ts` makes published crease patterns: anti-aliased strokes one to
three pixels wide, a pale grey reference lattice, red and blue and sometimes
neither, dashes, a margin around the paper, JPEG ringing, and a degree or two of
rotation for the screenshots-of-screenshots case. `test/corpus.ts` holds the
patterns drawn with it — a basic fold, a 22.5 degree base, Miura-ori on a
non-square lattice, box pleats up to 32 divisions, a waterbomb tessellation, a
tree base whose angles are no fraction of anything, and one deliberately
asymmetric pattern so that a mirrored result is visibly wrong.

We would rather test on the real thing. The patterns this is modelled on belong
to their designers and a test suite is not a licence to redistribute them, so
what is reproduced is every property of theirs that makes them hard to read.

`test/metrics.ts` is how a reading is scored, and it is deliberately not a
count. `planarize` splits every crease at every crossing, so one line across a
16-grid comes back as sixteen edges and counting segments rewards the wrong
thing. Everything is measured in length: how much of what was drawn was found,
how much of what was found carries the assignment it was drawn with, how much
was found that nobody drew, and how many endpoints failed to meet anything.

```sh
pnpm --filter @kamibase/vision test

# the same corpus, printed rather than asserted: coverage, spurious length,
# dangling ends, inferred grid and timings, for tuning against
pnpm --filter @kamibase/vision exec vitest run test/report.test.ts
```

### Trying it on a real file

The corpus is synthetic on purpose, and synthetic input is not proof. To check
a reading against a file you have locally, decode it to `ImageData` and hand it
to `readCreasePattern`; the printed layer table says which colour was taken for
what, which is the first thing to disagree with when a result looks wrong.

## Performance

About a second for an 1800px photograph reduced to a 900px working square, and
about two for a 32-by-32 box-pleated drawing at 1600px yielding two thousand
edges. The web app runs both in a Web Worker with a main-thread fallback.

The costs, in order: Hough accumulation, then the segment extraction, then the
assignment search. Everything before them is linear in pixels. Both the
accumulation and the extraction bucket pixels by the direction their own
gradient points, which is what keeps a dense pattern from being quadratic in the
number of creases.

## Limits

Straight creases only. A photograph's assignment is a candidate rather than a
proof, because Maekawa is a necessary condition and not a sufficient one. A
drawing in a colour scheme nobody has a convention for is read as geometry with
the assignments left to the solver — the layer table says so, and the intended
answer is to let the person remap it rather than to guess harder. Either way the
result is meant to be opened in an editor by the person who drew or folded the
thing.
