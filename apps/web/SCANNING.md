# Reading a crease pattern off a picture

Hand Kamibase a picture of a crease pattern and get an editable one back.
DESIGN.md §3.3 calls this "a research-grade problem" and treats it as
best-effort with a human in the loop, which is exactly what this is.

It runs entirely in the browser. Nothing is uploaded, no account is needed, and
there is no API key anywhere in it.

## Two kinds of picture

A **photograph** of an unfolded, creased sheet is the hard case. There is no
colour to read, the creases are shallow ridges in a lit surface, the sheet is
seen at an angle, and the paper does not remember which way each crease went.

A **published drawing** (a PNG off a designer's website, a screenshot, an
export from Oriedita or ORIPA) is a different problem with a different shape.
The lines are hairline-thin and exact. There is a reference grid underneath
that is not a crease. Some strokes are dashed. The paper's edge is somewhere
inside a margin. And the answer is written in it: a red line means mountain.

Sending a drawing down the photograph's pipeline works, and that is what
Kamibase used to do. It also throws away the colour, flattens the lighting out
of an image that has none, finds two edges down either side of every stroke,
and rounds angles a designer chose onto a 22.5° lattice they were not using.

So there are two pipelines. Kamibase looks at the image and picks, from three
numbers taken off the picture itself: how much of it is one flat colour, how
much of what is not, and above all whether the departures from the paper are
*bimodal*. A drawn stroke is a step: a pixel is either ink or paper, with one
pixel of ramp between, so most of what is not paper is fully ink. A crease in a
photograph is a shallow ridge: everything that is not paper is only slightly
not paper. Drawings measure around 0.6 on that, photographs around 0.1.

Getting it wrong is asymmetric, so the test leans towards "photograph": a
drawing read as a photograph still works and merely loses the colour, while a
photograph read as a drawing finds nothing at all.

## Using it

**New → Upload** in the header, or the `/upload` URL. Pick a photo, a video or
a picture of a crease pattern and the editor opens on the result. There is no
step in between.

There used to be two: confirm the paper's corners, then read a review panel of
grades and confidences. Both are gone. The corners are guessed, at least for a
photograph; a drawing has no perspective to undo and finds its paper from where
the ink is. The detector runs on its defaults, and instead of describing what
it found, the picture itself is laid under the drawing canvas at low opacity. A
missed crease is then a line you can see and draw, which is a better answer to
"did it read this right" than any score. The opacity slider in the editor's
panel fades it out when you are done with it.

A video is treated as a burst of stills rather than as footage: Kamibase
samples nine frames, scores each by the variance of its Laplacian, and uses the
sharpest. Handheld shots are usually blurred in half their frames and sharp in
one or two, and a sharp frame is worth more to a line detector than any amount
of averaging.

### Taking a photo it can read

- **Flatten the sheet.** A curled corner is a curved crease, and only straight
  ones are detected.
- **Light it from one side.** A lamp low and off to the left throws a shadow
  into every crease. A flash straight on erases all of them.
- **Fill the frame, square on.** Rectification corrects a tilt; it cannot
  recover detail that was never in the picture.
- **Use a dark surface.** The corners are found by separating paper from
  background, and that is easiest when they do not look alike.

Corners still decide everything downstream: they define the homography, the
homography defines every angle, and Kawasaki's theorem is a statement about
angles. A guess ten pixels out is a pattern that fails its own validation for
reasons that have nothing to do with how it was folded. Which is the other
argument for the backdrop: when the guess is off, the creases visibly do not
sit on the photograph.

### Picking a drawing it can read

Much less to say, which is the point.

- **Give it the file, not a photo of the file.** A screenshot is fine; a phone
  picture of a monitor is a photograph again.
- **Crop is optional.** The paper is found from where the ink is, so a margin,
  a caption or a watermark off to one side costs nothing.
- **Bigger is better up to about 1300px on the long side.** Beyond that it is
  scaled down, and below it a hairline stroke starts to break up.
- **Transparency is fine.** A PNG with no background is composited onto white,
  which is what the person who exported it was looking at.

## What it does with a photograph

`@kamibase/vision`, in order:

| Step | What and why |
|---|---|
| **Rectify** | Four corners give a homography onto a square. Without it every angle is wrong. |
| **Flatten** | Subtract a heavy blur. Lighting varies slowly across a sheet, creases vary over a few pixels, so subtracting the slow part leaves the creases. |
| **Edges** | Canny, thresholded from the image's own histogram *and* held above its own noise. |
| **Lines** | Hough, with each pixel voting only for angles its gradient allows. |
| **Clean** | Merge fragments of one crease, drop duplicates, snap to 22.5° and to a lattice. |
| **Assign** | Maekawa decides mountain and valley. The photo only advises. |

Then it goes through `graphFromSegments` and `planarize` from
`@kamibase/core`, which is the same code that reads a `.cp` file. From that
point on a scan and an imported file are the same object.

## What it does with a drawing

Different at every step where the difference matters, and the same code
wherever it does not:

| Step | What and why |
|---|---|
| **Separate** | Split the image into the colours it was drawn with. Every crossing between two differently coloured creases disappears, because the two are never in the same layer. |
| **Discard** | Drop the pale grey lattice. It is the drawing's scaffolding, and reading it as creases produces a 32-by-32 waffle on top of the pattern, which is worse than finding nothing, because it looks right. |
| **Thin** | Reduce each stroke to its centre line, and take its direction from the structure tensor. No Canny: a drawn line already *is* an edge, and an edge detector finds two of them. |
| **Detect** | Hough, per colour. |
| **Snap** | To the pattern's *own* angles, read off a length-weighted histogram, and to a lattice inferred per axis. |
| **Heal** | Weld endpoints that nearly coincide, slide ends that nearly touch a crease onto the exact intersection, trim the whiskers left where several creases converge. |
| **Fill** | The colours are pinned; Maekawa is asked only about creases whose colour carried no convention. |

### Un-mixing the anti-aliasing

The one subtle part. A stroke's edges are blends of paper and ink in some
proportion nobody recorded, so a pixel near a red crease is pink, and pink is
not a colour anybody drew with.

The palette is therefore built from stroke *cores*, the pixels where the departure
from the paper is a local maximum, and every other inked pixel is then
explained as some fraction of one of those, by projecting its departure onto
each candidate ink's. The projection length is how much ink is there; the
residual says whether that ink explains the pixel at all, and a pixel no ink
explains is dropped rather than filed under the nearest.

Building the palette from every inked pixel instead, which is the obvious
thing, grows a peak in the middle of every skirt, promotes it to "an ink
colour", and files half of each crease under a colour nobody used. The pattern
comes back doubled and fragmented, with a phantom layer in the import notes.

Separating cores from skirts is also what distinguishes a pale grey reference
grid from a black paper outline, whose skirts overlap completely and whose
cores do not.

### Making the ends meet

This is the defect everyone notices on a scanned pattern and nobody can name.
The lines are all there and all correct to within a pixel, and a pixel, at the
working size, is about a thousandth of the paper. So four creases that meet at
a vertex come back as four creases that pass within a thousandth of each other.

That pattern renders indistinguishably from the right one and is wrong in every
way that matters. `planarize` splits nothing, the vertex has degree zero,
Maekawa has nothing to constrain, the validator reports four dangling creases,
and the simulator tears the paper.

`weld.ts` closes them, and the constraints on it are what make it safe: nothing
moves further than the tolerance, no crease is created or deleted, and no
crease changes direction: an end is slid *along its own line* to where it
meets its neighbour, never pulled sideways onto it. An end that is nowhere near
anything is left hanging, because extending that would be inventing a vertex,
and the result would validate perfectly while being wrong.

### Two thresholds that matter

A percentile threshold on gradient strength *always* finds edges, because "the
top 6% of gradients" exists in a photograph of a blank sheet too. So the edge
detector also requires a gradient to be several times the image's own median
before it counts. Without that floor, a photo of uncreased paper comes back
with a couple of hundred confident creases in it, which is a worse failure than
finding none.

Similarly, contrast normalisation is capped. Stretching the histogram of a flat
image to fill the range turns sensor noise into vivid texture, and every stage
downstream is happy to interpret it.

## Mountains and valleys

This is the interesting part, and the honest framing is that **a photograph
cannot answer it.** A sheet that has been opened out again is flat. Which way
each crease went is recorded in a fraction of a millimetre of paper memory that
survives neither the flattening nor the camera.

A *drawing* can, and does. A red line is not evidence about mountain; it is the
designer saying "mountain". Those assignments are **pinned** rather than
inferred, which changes the problem twice over: the search is only over the
creases nobody labelled, and, because a pinned crease is a fact about which
side of the paper this is, the answer is no longer merely correct up to being
inside out. What follows is about the photograph's case, and about the creases
in a drawing that carried no convention.

So the geometry answers instead. Maekawa's theorem: at every interior vertex of
a flat-foldable crease pattern, the number of mountains and the number of
valleys differ by exactly two. That is a hard constraint linking every crease to
its neighbours, and for a real pattern it has very few solutions.

Finding one is a search. `inferAssignments` runs a local search over the
assignment, costing each vertex by how far it is from Maekawa, flipping the
crease that helps most and kicking itself out of local minima. A flip only
affects the two vertices its crease touches, so each step is O(1) rather than a
full re-evaluation.

Three things it is careful about:

- **Several solutions usually fit.** Four creases meeting symmetrically can be
  three mountains and one valley with *any* of the four playing the valley.
  Kamibase runs the search repeatedly, compares the solutions it finds, and
  scores each crease by how many of them agreed. A crease everything agrees on
  is drawn solid; one that the alternatives split over is drawn dashed and
  counted as uncertain. DESIGN.md §3.4 asks that nothing be guessed silently,
  and this is that, without falling back to marking every crease unknown and
  helping nobody.
- **The whole pattern can be inside out.** Flipping every crease at once
  satisfies Maekawa just as well, because it is the same sheet seen from the
  other side. The shading prior breaks the tie when it can; when it cannot, the
  answer is right up to one global inversion and the notes say so.
- **Odd vertices are unsatisfiable, not merely hard.** |M − V| = 2 with an odd
  number of creases has no integer solution. Those vertices are reported rather
  than being allowed to drag every solution's score down: an odd vertex means a
  crease was missed or found twice nearby, which is a detection problem, not an
  assignment one.

### The shading prior

Each crease is sampled across its width and scored by how much brighter or
darker its centre is than the paper beside it. This is a weak signal and it is
used weakly: it seeds the first search and settles the global flip. It is never
allowed to overrule a constraint.

It carries no label of its own. Whether bright means mountain depends on where
the lamp was, which nothing here knows. What it carries is *separation*, and
Maekawa supplies the rest.

### Where a model would go

DESIGN.md §3.3 wants a vision model in the proposing seat: "the model proposes,
Maekawa and Kawasaki dispose." The seat is empty and the interface is already
the right shape. `inferAssignments` takes a `prior` array of one number per
crease, −1 for valley through +1 for mountain, and a model's per-crease opinion
drops straight into it with no other change. Today that array comes from the
shading; the solver does not care which.

## Testing it

The pipeline is pure functions over `Float32Array`, with no canvas and no
native dependency, so the tests manufacture their own photographs:
`test/synthetic.ts` draws creases as soft ridges, adds a lighting gradient
strong enough to defeat a global threshold, adds reproducible noise, and can
photograph the result through a perspective transform.

That makes the tests about the claim rather than about the code. They assert
that both diagonals and both midlines come back from a lit, noisy photo; that a
blank sheet yields nothing; that a dense grid does not collapse into a few
lines; that rectification restores 45° angles, *with a control test proving
they are wrong without it*; and that the solver's output passes the same
`checkFlatFoldability` the rest of Kamibase uses.

`test/drawing.ts` does the same for published crease patterns: anti-aliased
strokes one to three pixels wide, a pale grey reference lattice, red and blue
and sometimes neither, dashes, a margin, JPEG ringing, and a degree or two of
rotation for the screenshot-of-a-screenshot case. The corpus it draws spans a
basic fold, a 22.5° base, Miura-ori on a non-square lattice, box pleats up to
32 divisions, a waterbomb tessellation, a tree base whose angles are no
fraction of anything, and one deliberately asymmetric pattern, because a
mirrored bird base is still a bird base, and nothing else would catch a scan
coming back upside down.

We would rather test on the real files. The patterns this is modelled on belong
to their designers and a test suite is not a licence to redistribute them, so
what is reproduced is every property of theirs that makes them hard to read.

Readings are scored by *length*, never by segment count: `planarize` splits
every crease at every crossing, so one line across a 16-grid comes back as
sixteen edges and counting segments would reward the wrong thing. What is
measured is how much of what was drawn was found, how much of what was found
carries the assignment it was drawn with, how much was found that nobody drew,
and how many endpoints failed to meet anything.

```sh
pnpm --filter @kamibase/vision test

# the same corpus printed rather than asserted, for tuning against
pnpm --filter @kamibase/vision exec vitest run test/report.test.ts
```

## Limits

- **Nothing auto-publishes.** The confidence score is capped below §3.4's 0.95
  line by construction for both pipelines, and the flow ends in the editor. A
  drawing scores higher than a photograph because it states its assignments
  rather than having them guessed, but the geometry was still read off pixels.
- **Curved creases are invisible.** Hough finds straight lines. A curved-fold
  pattern will come back as nothing, or as a polygon.
- **Very fine tessellations lose their smallest creases.** A photograph works
  at 900px square, so a 64-grid has 14 pixels per cell and its creases fall
  below the detector's minimum length. A drawing works at 1300px and keeps
  creases an order of magnitude shorter, because a single cell of a 32-grid is
  3% of the paper and the photograph's floor would throw the pattern away. The
  missing ones are drawn by hand over the backdrop.
- **A drawing in an unconventional palette is read as geometry only.** Red is
  mountain and blue is valley; a second colour with no standard meaning is
  promoted to the missing family when there is exactly one, and otherwise left
  unassigned for the solver. The import notes say which colour was taken for
  what, and disagreeing with them is the intended response.
- **A pale grey lattice that is exactly neutral, under a black outline, is
  ambiguous.** Grey ink and the anti-aliased skirt of a black line can be the
  same colour, and one pixel cannot tell them apart. In practice published
  grids are faintly tinted, and thinning handles the rest.
- **Maekawa is necessary, not sufficient.** A pattern satisfying it everywhere
  can still fail to fold flat, since layer ordering is NP-hard. The result is a
  candidate, and the L2 simulator run is what would settle it.
