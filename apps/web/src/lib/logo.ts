/**
 * The mark: a K drawn on the editor's gridded paper.
 *
 * It is a drawing, and it is worth saying why, because the obvious idea — make
 * the logo an actual foldable crease pattern — was tried first and does not
 * work.
 *
 * A letter K cannot fold flat. Kawasaki's theorem says the alternate angles
 * around an interior vertex must each sum to 180°, and a stem with an arm and a
 * leg meeting it gives four creases whose alternate angles come to 90° and
 * 270°. It is not a matter of picking better angles: solving the condition for
 * a four-crease K asks the arm to be 360° from itself. Six creases can be made
 * to work, and exactly two families do — a pair pointing away behind the stem,
 * or a straight line through the vertex between the arm and the leg. Both were
 * built and photographed at 20, 32, 48 and 120 pixels. The first turns the mark
 * into an asterisk; the second puts a bar through the letter's counter, which is
 * the one piece of white space a K needs to be a K.
 *
 * So the mark shows what the editor shows: a sheet of paper ruled with the
 * reference grid, and a shape drawn on it. The grid is the same lattice
 * `EditorCanvas` draws in `--paper-line`, and the two colours are the two that
 * matter, mountain red and valley blue. What it is not is a pattern that folds,
 * and it does not claim to be one.
 */

/** Divisions of the reference grid behind the letter. */
export const LOGO_GRID = 8;

/**
 * The letter, in grid units, origin bottom-left.
 *
 * On the lattice, to the half cell. The stem's ends and the arm's tips are
 * inset half a cell from the paper's edge so the letter sits *on* the sheet
 * rather than running off it, which is what a drawn stroke's round cap wants.
 */
export const LOGO_LETTER = {
  /** The stem's column, and how far up and down it runs. */
  stemX: 2,
  stemBottom: 0.5,
  stemTop: 7.5,
  /** Where the arm and leg meet the stem. */
  junctionY: 4,
  /**
   * Where they reach, mirrored about the junction.
   *
   * Level with the stem's ends, so the arm and the leg carry the letter's full
   * cap height rather than stopping short of it. That is what stops a K from
   * reading as a bar with a small chevron beside it.
   */
  armX: 7,
  armY: 7.5,
} as const;

/** Stroke weight, in grid units. Bold enough to read at twenty pixels. */
export const LOGO_STROKE = 0.78;

/**
 * The letter as two SVG paths, in a box `size` across with y down.
 *
 * Two rather than four, because the arm and the leg are one polyline through
 * the junction: drawn as separate strokes their round caps stack up at the
 * meeting point and thicken it.
 */
export function logoPaths(size: number): { stem: string; wedge: string } {
  const unit = size / LOGO_GRID;
  const x = (u: number): string => (u * unit).toFixed(2);
  const y = (u: number): string => ((LOGO_GRID - u) * unit).toFixed(2);
  const { stemX, stemBottom, stemTop, junctionY, armX, armY } = LOGO_LETTER;

  return {
    stem: `M${x(stemX)} ${y(stemBottom)}L${x(stemX)} ${y(stemTop)}`,
    wedge:
      `M${x(armX)} ${y(armY)}` +
      `L${x(stemX)} ${y(junctionY)}` +
      `L${x(armX)} ${y(2 * junctionY - armY)}`,
  };
}

/** The reference grid's lines, in a box `size` across. */
export function logoGridLines(size: number): readonly string[] {
  const unit = size / LOGO_GRID;
  const lines: string[] = [];
  for (let i = 1; i < LOGO_GRID; i += 1) {
    const at = (i * unit).toFixed(2);
    lines.push(`M${at} 0V${size}`, `M0 ${at}H${size}`);
  }
  return lines;
}
