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
 * The heavier weight, for the letter set as a glyph.
 *
 * In the tile the K is one thing on a sheet of paper and reads at a weight a
 * crease would have. Standing in for a letter — in the wordmark, or alone in a
 * browser tab — it has to read as type: a black sans carries stems at roughly a
 * fifth of its cap height, which over the letter's seven grid units is about
 * 1.5. Twice the tile's weight, which is what "thicker" means here.
 */
export const LOGO_GLYPH_STROKE = 1.5;

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

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * The same lattice, trimmed to a rectangle.
 *
 * The glyph version of the mark has no paper to bound the grid, and its own
 * `overflow: visible` (which is what lets the stroke caps hang over the
 * baseline) means nothing gets clipped for free. Trimming the lines
 * arithmetically avoids the alternative, a `clipPath`, which would need a
 * unique id and therefore `useId`, and therefore a client component, to draw
 * some grey lines.
 *
 * Whole lines only: a lattice cut off mid-cell reads as a rendering bug, so a
 * line outside the rectangle is dropped rather than shortened past its
 * neighbours.
 */
export function logoGridLinesIn(size: number, rect: Rect): readonly string[] {
  const unit = size / LOGO_GRID;
  const lines: string[] = [];
  const fix = (value: number): string => value.toFixed(2);

  for (let i = 1; i < LOGO_GRID; i += 1) {
    const at = i * unit;
    if (at > rect.left && at < rect.right) {
      lines.push(`M${fix(at)} ${fix(rect.top)}V${fix(rect.bottom)}`);
    }
    if (at > rect.top && at < rect.bottom) {
      lines.push(`M${fix(rect.left)} ${fix(at)}H${fix(rect.right)}`);
    }
  }
  return lines;
}

/**
 * The letter's ink box at a given stroke weight, in a `size` box, y down.
 *
 * "Ink" rather than "stem": the round caps on the stem's ends and the arm's
 * tips stick out half a stroke past the geometry, and a box drawn to the
 * geometry clips them. `KamiK` deliberately wants the *stem* box instead, so
 * the stem's end lands on the text baseline — see the note there.
 */
export function logoInkBox(size: number, strokeUnits: number): Rect {
  const unit = size / LOGO_GRID;
  const half = (strokeUnits * unit) / 2;
  const { stemX, stemBottom, stemTop, armX } = LOGO_LETTER;
  return {
    left: stemX * unit - half,
    top: (LOGO_GRID - stemTop) * unit - half,
    right: armX * unit + half,
    bottom: (LOGO_GRID - stemBottom) * unit + half,
  };
}

/**
 * The favicon, as an SVG document.
 *
 * A tab icon is sixteen pixels of somebody's peripheral vision, so it is the
 * glyph rather than the tile: cropped to the letter's own ink, at the glyph's
 * heavier weight, scaled until it nearly fills the square. The tile version
 * that used to be here spent a third of its width on the paper's margin and a
 * quarter of its weight on a border, and what survived to sixteen pixels was a
 * grey box with something in it.
 *
 * What stays from the tile is the sheet: a rounded white card, so the mark has
 * a shape of its own against a dark tab strip as well as a light one, and the
 * ruled grid, which costs nothing and is the reason the letter looks like it
 * came from this site. Both are fixed colours rather than themed — a favicon
 * has no page to take a theme from.
 *
 * Generated rather than drawn so the letter cannot drift from `LOGO_LETTER`;
 * `test/logo.test.ts` holds the checked-in `icon.svg` to this output.
 */
export function logoFaviconSvg(): string {
  const BOX = 32;
  /** White around the letter, so it is a mark on a card and not a full bleed. */
  const PADDING = 3.2;
  const RADIUS = BOX * 0.18;

  // Draw in a 100-unit space and scale the whole thing down, so the numbers
  // below are the same ones `KamiMark` works in.
  const DRAW = 100;
  const ink = logoInkBox(DRAW, LOGO_GLYPH_STROKE);
  const width = ink.right - ink.left;
  const height = ink.bottom - ink.top;

  const scale = (BOX - 2 * PADDING) / Math.max(width, height);
  const dx = (BOX - width * scale) / 2 - ink.left * scale;
  const dy = (BOX - height * scale) / 2 - ink.top * scale;

  const stroke = (LOGO_GLYPH_STROKE * DRAW) / LOGO_GRID;
  const paths = logoPaths(DRAW);
  const fix = (value: number): string => Number(value.toFixed(3)).toString();
  const grid = logoGridLinesIn(DRAW, ink).join(" ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOX} ${BOX}">
  <rect width="${BOX}" height="${BOX}" rx="${fix(RADIUS)}" fill="${PAPER}"/>
  <g transform="translate(${fix(dx)} ${fix(dy)}) scale(${fix(scale)})" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path stroke="${PAPER_LINE}" stroke-width="${fix(stroke * 0.16)}" d="${grid}"/>
    <path stroke="${MOUNTAIN}" stroke-width="${fix(stroke)}" d="${paths.stem}"/>
    <path stroke="${VALLEY}" stroke-width="${fix(stroke)}" d="${paths.wedge}"/>
  </g>
</svg>
`;
}

/*
 * The favicon's palette, spelled out.
 *
 * `KAMIBASE_DISPLAY_PALETTE` lives in `@kamibase/core` and these are its
 * mountain and valley; they are repeated as literals because this function is
 * run by a build script as well as by the app, and dragging the core package
 * into a script that writes one file is not a trade worth making. The test
 * pins them to the palette so a change there is not silently ignored here.
 */
const MOUNTAIN = "#d93b30";
const VALLEY = "#2b62d9";
const PAPER = "#ffffff";
const PAPER_LINE = "#e6e5e1";
