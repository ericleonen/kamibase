/**
 * The editor's reference grid.
 *
 * A grid in a crease pattern editor is not decoration and it is not a UI
 * preference. It is the coordinate system the design is stated in: "32 grid",
 * "16 by 24", "on the diagonal" are how origami designers describe where the
 * creases go, and a box-pleated design is *defined* by its lattice. So the grid
 * has to be whatever the designer says it is.
 *
 * It used to be one of five numbers, square, and orthogonal. That covers a
 * respectable fraction of designs and fails completely on the rest: a 12-by-18
 * layout on a rectangle, a 22.5-system pattern wanting a 45 degree lattice, a
 * 27 grid because the model wanted thirds of ninths. None of those are exotic,
 * and none of them were expressible.
 *
 * Three numbers, then: divisions across, divisions down, and an angle. Everything
 * else — where the lines are drawn, what a point snaps to — follows from them.
 */

export interface GridSpec {
  /** Divisions across the paper. 0 for no vertical lines. */
  readonly x: number;
  /** Divisions down the paper. 0 for no horizontal lines. */
  readonly y: number;
  /**
   * Rotation of the whole lattice about the paper's centre, in degrees.
   *
   * 0 and 45 are the two that get used, which is why they are one tap away,
   * but nothing here is limited to them: a pattern laid out on a 30 degree
   * lattice is a pattern laid out on a 30 degree lattice.
   */
  readonly angleDegrees: number;
}

export interface GridLine {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export const NO_GRID: GridSpec = { x: 0, y: 0, angleDegrees: 0 };

/**
 * The ceiling on divisions.
 *
 * Not a limit anybody will meet — a 128 grid is four times the finest anyone
 * box-pleats on — but a typed field needs one, because the cost of drawing the
 * lattice is linear in it and a stray keystroke should not be able to ask for
 * a hundred thousand lines.
 */
export const MAX_DIVISIONS = 128;

/** What the preset chips offer. Square, orthogonal, and the usual counts. */
export const GRID_PRESETS: readonly { readonly label: string; readonly spec: GridSpec }[] = [
  { label: "None", spec: NO_GRID },
  { label: "8", spec: { x: 8, y: 8, angleDegrees: 0 } },
  { label: "16", spec: { x: 16, y: 16, angleDegrees: 0 } },
  { label: "22", spec: { x: 22, y: 22, angleDegrees: 0 } },
  { label: "32", spec: { x: 32, y: 32, angleDegrees: 0 } },
];

/** Angles worth one tap. Anything else is typed. */
export const ANGLE_PRESETS: readonly number[] = [0, 22.5, 30, 45, 60];

export function isGridVisible(grid: GridSpec): boolean {
  return grid.x >= 1 || grid.y >= 1;
}

/** Clamp a spec into the range the renderer and the snapper can honour. */
export function normalizeGrid(grid: GridSpec): GridSpec {
  const clamp = (value: number): number => {
    if (!Number.isFinite(value) || value < 1) return 0;
    return Math.min(MAX_DIVISIONS, Math.floor(value));
  };
  const angle = Number.isFinite(grid.angleDegrees) ? grid.angleDegrees : 0;
  return {
    x: clamp(grid.x),
    y: clamp(grid.y),
    // Folded into [0, 180): a lattice at 190 degrees is the lattice at 10.
    angleDegrees: ((angle % 180) + 180) % 180,
  };
}

/** A short description, for a label that has to say what the grid is. */
export function describeGrid(grid: GridSpec): string {
  if (!isGridVisible(grid)) return "No grid";
  const size = grid.x === grid.y ? `${grid.x}×${grid.x}` : `${grid.x || "–"}×${grid.y || "–"}`;
  return grid.angleDegrees === 0 ? size : `${size} at ${formatAngle(grid.angleDegrees)}°`;
}

export function formatAngle(degrees: number): string {
  return Number.isInteger(degrees) ? String(degrees) : degrees.toFixed(1);
}

/* -------------------------------------------------------------------------- */
/* The lattice as a coordinate system                                          */
/* -------------------------------------------------------------------------- */

/**
 * Paper coordinates to lattice coordinates and back.
 *
 * The lattice is the ordinary axis-aligned one, rotated about the paper's
 * centre. Rotating about the centre rather than a corner is what makes 45
 * degrees do the expected thing — the diagonal of the sheet is a lattice line —
 * and what makes the grid look the same whichever way the paper is turned.
 *
 * Anchoring at the *origin* rather than the centre matters just as much, and
 * only shows up on odd division counts: a 3 grid anchored at the centre puts
 * its lines at 1/6, 1/2 and 5/6, which is not a 3 grid. Anchored at the origin
 * they land at 0, 1/3, 2/3 and 1, which is.
 */
function toLattice(grid: GridSpec, x: number, y: number): [number, number] {
  const radians = (-grid.angleDegrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = x - 0.5;
  const dy = y - 0.5;
  return [0.5 + dx * cos - dy * sin, 0.5 + dx * sin + dy * cos];
}

function fromLattice(grid: GridSpec, x: number, y: number): [number, number] {
  const radians = (grid.angleDegrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = x - 0.5;
  const dy = y - 0.5;
  return [0.5 + dx * cos - dy * sin, 0.5 + dx * sin + dy * cos];
}

/**
 * The nearest lattice point, or null when the grid has nothing to snap to.
 *
 * Each axis snaps independently, so a grid with divisions across but none down
 * behaves as a set of parallel guides rather than as nothing at all. That is
 * how a pleated design is actually laid out.
 */
export function snapToGridSpec(
  point: readonly [number, number],
  grid: GridSpec,
): [number, number] | null {
  if (!isGridVisible(grid)) return null;

  const [u, v] = toLattice(grid, point[0], point[1]);
  const snapped: [number, number] = [
    grid.x >= 1 ? Math.round(u * grid.x) / grid.x : u,
    grid.y >= 1 ? Math.round(v * grid.y) / grid.y : v,
  ];
  return fromLattice(grid, snapped[0], snapped[1]);
}

/**
 * The lattice lines that cross the paper, clipped to it.
 *
 * Clipped rather than drawn long and masked, because the canvas pans and zooms
 * freely: there is no viewport to clip against, and a grid drawn past the edge
 * of the sheet reads as a grid on the table rather than on the paper.
 */
export function gridLines(grid: GridSpec): GridLine[] {
  if (!isGridVisible(grid)) return [];

  // The paper's corners in lattice coordinates, which is how far the lattice
  // has to reach. At 45 degrees that is meaningfully further than the sheet.
  const corners: [number, number][] = [
    toLattice(grid, 0, 0),
    toLattice(grid, 1, 0),
    toLattice(grid, 1, 1),
    toLattice(grid, 0, 1),
  ];
  const minU = Math.min(...corners.map((c) => c[0]));
  const maxU = Math.max(...corners.map((c) => c[0]));
  const minV = Math.min(...corners.map((c) => c[1]));
  const maxV = Math.max(...corners.map((c) => c[1]));

  const lines: GridLine[] = [];

  const emit = (a: [number, number], b: [number, number]): void => {
    const from = fromLattice(grid, a[0], a[1]);
    const to = fromLattice(grid, b[0], b[1]);
    const clipped = clipToPaper(from, to);
    if (clipped) lines.push(clipped);
  };

  if (grid.x >= 1) {
    for (let i = Math.floor(minU * grid.x); i <= Math.ceil(maxU * grid.x); i += 1) {
      const u = i / grid.x;
      emit([u, minV], [u, maxV]);
    }
  }
  if (grid.y >= 1) {
    for (let j = Math.floor(minV * grid.y); j <= Math.ceil(maxV * grid.y); j += 1) {
      const v = j / grid.y;
      emit([minU, v], [maxU, v]);
    }
  }

  return lines;
}

/**
 * Liang-Barsky against the unit square. Returns null when the segment misses.
 *
 * Parametric rather than the corner-cases-by-hand version: a rotated lattice
 * produces lines at every angle including exactly horizontal and exactly
 * vertical, and those are precisely where a hand-rolled clipper divides by
 * zero.
 */
function clipToPaper(
  from: readonly [number, number],
  to: readonly [number, number],
): GridLine | null {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];

  let enter = 0;
  let exit = 1;

  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-12) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > exit) return false;
      if (r > enter) enter = r;
    } else {
      if (r < enter) return false;
      if (r < exit) exit = r;
    }
    return true;
  };

  if (
    !clip(-dx, from[0]) ||
    !clip(dx, 1 - from[0]) ||
    !clip(-dy, from[1]) ||
    !clip(dy, 1 - from[1])
  ) {
    return null;
  }
  if (exit - enter < 1e-9) return null;

  return {
    x1: from[0] + dx * enter,
    y1: from[1] + dy * enter,
    x2: from[0] + dx * exit,
    y2: from[1] + dy * exit,
  };
}
