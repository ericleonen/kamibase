/**
 * Generators for the seeded crease patterns.
 *
 * Each returns `.cp` text — the same ASCII format the converter accepts — so a
 * seed is human-readable, reviewable, and goes through exactly the parser an
 * upload would. Nothing here hand-writes a `.kami` file.
 *
 * Line types: 1 = border, 2 = mountain, 3 = valley.
 */

export type CpLine = readonly [type: number, x1: number, y1: number, x2: number, y2: number];

export const BORDER = 1;
export const MOUNTAIN = 2;
export const VALLEY = 3;

/** Round away binary noise so generated `.cp` text is stable across runs. */
function fmt(value: number): string {
  const rounded = Number(value.toFixed(9));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

export function toCpText(lines: readonly CpLine[], header: string): string {
  const body = lines
    .map(([type, x1, y1, x2, y2]) =>
      [type, fmt(x1), fmt(y1), fmt(x2), fmt(y2)].join(" "),
    )
    .join("\n");
  const comment = header
    .trim()
    .split("\n")
    .map((line) => `# ${line}`.trimEnd())
    .join("\n");
  return `${comment}\n\n${body}\n`;
}

/** The four edges of the unit square, as border lines. */
export function unitSquareBorder(): CpLine[] {
  return [
    [BORDER, 0, 0, 1, 0],
    [BORDER, 1, 0, 1, 1],
    [BORDER, 1, 1, 0, 1],
    [BORDER, 0, 1, 0, 0],
  ];
}

/**
 * Bird base — the base the traditional crane is folded from.
 *
 * Both diagonals, both book folds, and the eight 22.5 degree petal-fold
 * creases from the corners. `r = (sqrt(2) - 1) / 2` is where a 22.5 degree
 * crease from a corner meets a book fold.
 *
 * The assignment is not 4-fold symmetric and cannot be: Maekawa forbids a
 * degree-8 vertex with four mountains and four valleys, so one crease at the
 * centre runs the other way.
 */
export function birdBase(): CpLine[] {
  const r = (Math.SQRT2 - 1) / 2;
  const s = 1 - r;
  return [
    ...unitSquareBorder(),

    // Diagonals, as four rays from the centre.
    [MOUNTAIN, 0.5, 0.5, 1, 1],
    [MOUNTAIN, 0.5, 0.5, 0, 1],
    [MOUNTAIN, 0.5, 0.5, 1, 0],
    [VALLEY, 0.5, 0.5, 0, 0],

    // Book folds: outer halves mountain, inner halves valley.
    [MOUNTAIN, 0.5, 0, 0.5, r],
    [MOUNTAIN, 0.5, 1, 0.5, s],
    [MOUNTAIN, 0, 0.5, r, 0.5],
    [MOUNTAIN, 1, 0.5, s, 0.5],
    [VALLEY, 0.5, r, 0.5, 0.5],
    [VALLEY, 0.5, s, 0.5, 0.5],
    [VALLEY, r, 0.5, 0.5, 0.5],
    [VALLEY, s, 0.5, 0.5, 0.5],

    // Petal-fold creases, two from each corner.
    [MOUNTAIN, 0, 0, 0.5, r],
    [MOUNTAIN, 0, 0, r, 0.5],
    [MOUNTAIN, 1, 0, 0.5, r],
    [MOUNTAIN, 1, 0, s, 0.5],
    [MOUNTAIN, 1, 1, 0.5, s],
    [MOUNTAIN, 1, 1, s, 0.5],
    [MOUNTAIN, 0, 1, 0.5, s],
    [MOUNTAIN, 0, 1, r, 0.5],
  ];
}

/**
 * Waterbomb base — the eight-crease pattern as it is normally drawn: both
 * diagonals valley, both book folds mountain.
 *
 * As drawn this is structurally clean but not locally flat-foldable: the
 * centre is a degree-8 vertex with four mountains and four valleys.
 */
export function waterbombBase(): CpLine[] {
  return [
    ...unitSquareBorder(),
    [VALLEY, 0, 0, 1, 1],
    [VALLEY, 1, 0, 0, 1],
    [MOUNTAIN, 0.5, 0, 0.5, 1],
    [MOUNTAIN, 0, 0.5, 1, 0.5],
  ];
}

/**
 * Blintz base — the four corners folded to the centre. The crease pattern is
 * the square joining the four edge midpoints; every vertex is on the paper
 * edge, so there is no interior vertex to check.
 */
export function blintzBase(): CpLine[] {
  return [
    ...unitSquareBorder(),
    [VALLEY, 0.5, 0, 1, 0.5],
    [VALLEY, 1, 0.5, 0.5, 1],
    [VALLEY, 0.5, 1, 0, 0.5],
    [VALLEY, 0, 0.5, 0.5, 0],
  ];
}

/**
 * Kite base — one diagonal, with the two edges next to it folded in to meet
 * it. The two 22.5 degree creases run from a corner to the opposite edges.
 */
export function kiteBase(): CpLine[] {
  const t = Math.SQRT2 - 1; // tan(22.5 degrees)
  return [
    ...unitSquareBorder(),
    [VALLEY, 0, 0, 1, 1],
    [MOUNTAIN, 0, 0, 1, t],
    [MOUNTAIN, 0, 0, t, 1],
  ];
}

/**
 * Miura-ori on a `columns` x `bands` grid.
 *
 * Straight vertical creases; horizontal creases zigzag, sitting `offset`
 * higher on odd columns. Each zigzag line keeps one assignment along its whole
 * length and every vertical crease switches type where it crosses one — which
 * is what puts three of one and one of the other at each interior vertex.
 */
export function miuraOri(columns: number, bands: number, offset = 0.25): CpLine[] {
  const lines: CpLine[] = [...unitSquareBorder()];
  const x = (i: number): number => i / columns;
  const bandHeight = 1 / bands;
  const shift = bandHeight * offset;
  // Interior row j sits at j/bands, raised by `shift` on odd columns.
  const y = (i: number, j: number): number =>
    j === 0 ? 0 : j === bands ? 1 : j * bandHeight + (i % 2 === 1 ? shift : 0);

  for (let j = 1; j < bands; j += 1) {
    const assignment = j % 2 === 1 ? MOUNTAIN : VALLEY;
    for (let i = 0; i < columns; i += 1) {
      lines.push([assignment, x(i), y(i, j), x(i + 1), y(i + 1, j)]);
    }
  }

  for (let i = 1; i < columns; i += 1) {
    for (let band = 0; band < bands; band += 1) {
      const assignment = band % 2 === 0 ? MOUNTAIN : VALLEY;
      lines.push([assignment, x(i), y(i, band), x(i), y(i, band + 1)]);
    }
  }

  return lines;
}

/**
 * An accordion pleat of `folds` creases running the full width of the paper.
 * Every crease reaches the paper edge at both ends, so there are no interior
 * vertices.
 */
export function accordion(folds: number, vertical = false): CpLine[] {
  const lines: CpLine[] = [...unitSquareBorder()];
  for (let i = 1; i <= folds; i += 1) {
    const t = i / (folds + 1);
    const assignment = i % 2 === 1 ? MOUNTAIN : VALLEY;
    lines.push(vertical ? [assignment, t, 0, t, 1] : [assignment, 0, t, 1, t]);
  }
  return lines;
}

/**
 * Diagonal (harlequin) pleat: an accordion in each direction. The crossings
 * are resolved into vertices at ingest, giving a grid of degree-4 interior
 * vertices — a reference grid rather than a foldable model, so its creases are
 * a mix that the flat-foldability checks will have opinions about.
 */
export function gridPleat(divisions: number): CpLine[] {
  const lines: CpLine[] = [...unitSquareBorder()];
  for (let i = 1; i < divisions; i += 1) {
    const t = i / divisions;
    const assignment = i % 2 === 1 ? MOUNTAIN : VALLEY;
    lines.push([assignment, 0, t, 1, t]);
    lines.push([assignment, t, 0, t, 1]);
  }
  return lines;
}
