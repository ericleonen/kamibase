# Reading a crease pattern off a photograph

Photograph an unfolded, creased sheet of paper and get an editable crease
pattern. DESIGN.md §3.3 calls this "a research-grade problem" and treats it as
best-effort with a human in the loop, which is exactly what this is.

It runs entirely in the browser. Nothing is uploaded, no account is needed, and
there is no API key anywhere in it.

## Using it

**New → Upload** in the header, or the `/upload` URL. Pick a photo or a video
and the editor opens on the result. There is no step in between.

There used to be two: confirm the paper's corners, then read a review panel of
grades and confidences. Both are gone. The corners are guessed and the detector
runs on its defaults, and instead of describing what it found, the flattened
photograph is laid under the drawing canvas at low opacity. A missed crease is
then a line you can see and draw, which is a better answer to "did it read this
right" than any score. The opacity slider in the editor's panel fades it out
when you are done with it.

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

## What it does

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

This is the interesting part, and the honest framing is that **the photograph
cannot answer it.** A sheet that has been opened out again is flat. Which way
each crease went is recorded in a fraction of a millimetre of paper memory that
survives neither the flattening nor the camera.

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

```sh
pnpm --filter @kamibase/vision test
```

## Limits

- **A photograph never auto-publishes.** The confidence score is capped below
  §3.4's 0.95 line by construction, and the flow ends in the editor.
- **Curved creases are invisible.** Hough finds straight lines. A curved-fold
  pattern will come back as nothing, or as a polygon.
- **Very fine tessellations lose their smallest creases.** The working size is
  900px square, so a 64-grid has 14 pixels per cell and its creases fall below
  the detector's minimum length. The missing ones are drawn by hand over the
  backdrop.
- **Coloured pen is not read as colour.** The image goes to grayscale
  immediately, because the target is bare creases on white paper. A printed
  crease pattern with red and blue lines does better uploaded as an SVG, where
  the colour convention of §3.3 applies.
- **Maekawa is necessary, not sufficient.** A pattern satisfying it everywhere
  can still fail to fold flat, since layer ordering is NP-hard. The result is a
  candidate, and the L2 simulator run is what would settle it.
