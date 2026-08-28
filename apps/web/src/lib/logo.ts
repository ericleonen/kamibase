import type { EditorSegment } from "@/lib/editor/model";

/**
 * The mark: a crease pattern that folds, and reads as a K.
 *
 * It is a real pattern, not a drawing of one, which is the whole point of a
 * logo for this site. Three things had to be true at once, and the geometry is
 * what is left after all three.
 *
 * **It has to fold.** Flat-foldability is a condition on interior vertices, and
 * this pattern has exactly one, where the arm and the leg meet the stem. A
 * letter K on its own can never fold: Kawasaki's theorem says the alternate
 * angles around a vertex must each sum to 180°, and a stem with two arms gives
 * four creases whose alternate angles come to 90° and 270°. Worse, no
 * four-crease K works at any angle at all — the algebra comes out as "the arm
 * would have to be 360° from itself". So the letter needs a fifth and sixth
 * crease, and there are only two families that work: a pair pointing away
 * behind the stem, or one straight line passing through the vertex between the
 * arm and the leg. This is the second. Both were drawn; the pair behind the
 * stem turns the mark into an asterisk at sixteen pixels, and a single line
 * does not.
 *
 * **It has to have mountains and valleys.** Maekawa says they differ by two at
 * every flat-foldable vertex. Six creases, so four of one and two of the other,
 * which is exactly the split the letter suggests: the K is four creases, and
 * the line that makes it foldable is two.
 *
 * **It has to read as a K.** Which is why the stem is at 0.26 rather than on a
 * strict 2×2 lattice at 0.5. Centred, the mark is symmetrical and reads as an
 * emblem; pushed left, with the arm and leg reaching across, it reads as a
 * letter. That is the one place where the eye won an argument against the grid.
 *
 * Coordinates are the unit square, y up, the same convention as everything else
 * in the editor. `test/logo.test.ts` runs it through the real validator, so
 * this comment cannot quietly stop being true.
 */

/** Where the stem stands, and where the arm and leg reach the right edge. */
const STEM_X = 0.26;
const ARM_Y = 0.9;

export const LOGO_CREASES: readonly EditorSegment[] = [
  // The paper.
  { x1: 0, y1: 0, x2: 1, y2: 0, assignment: "B" },
  { x1: 1, y1: 0, x2: 1, y2: 1, assignment: "B" },
  { x1: 1, y1: 1, x2: 0, y2: 1, assignment: "B" },
  { x1: 0, y1: 1, x2: 0, y2: 0, assignment: "B" },

  // The letter: a stem, an arm and a leg. Mountains, all four.
  { x1: STEM_X, y1: 0, x2: STEM_X, y2: 0.5, assignment: "M" },
  { x1: STEM_X, y1: 0.5, x2: STEM_X, y2: 1, assignment: "M" },
  { x1: STEM_X, y1: 0.5, x2: 1, y2: ARM_Y, assignment: "M" },
  { x1: STEM_X, y1: 0.5, x2: 1, y2: 1 - ARM_Y, assignment: "M" },

  // What makes it fold: one line through the vertex, valleys both halves.
  { x1: 0, y1: 0.5, x2: STEM_X, y2: 0.5, assignment: "V" },
  { x1: STEM_X, y1: 0.5, x2: 1, y2: 0.5, assignment: "V" },
];

/**
 * The same thing as SVG path data, in a 24-unit box with y down.
 *
 * Hand-built rather than run through `renderSvg`, because the mark is drawn at
 * twenty pixels in a header and wants stroke widths and line caps chosen for
 * that, not the viewer's. The geometry is the geometry above, mirrored in y.
 */
export interface LogoStroke {
  readonly d: string;
  readonly kind: "boundary" | "mountain" | "valley";
}

const BOX = 24;

function toBox(x: number, y: number): string {
  return `${(x * BOX).toFixed(2)} ${((1 - y) * BOX).toFixed(2)}`;
}

export const LOGO_STROKES: readonly LogoStroke[] = LOGO_CREASES.map((crease) => ({
  d: `M${toBox(crease.x1, crease.y1)}L${toBox(crease.x2, crease.y2)}`,
  kind:
    crease.assignment === "M" ? "mountain" : crease.assignment === "V" ? "valley" : "boundary",
}));
