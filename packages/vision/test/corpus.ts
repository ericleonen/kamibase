import type { EdgeAssignment } from "@kamibase/core";
import type { Crease, Pattern } from "./drawing.js";

/**
 * The patterns the line-art suite is tested on.
 *
 * Chosen to span what published crease patterns actually are, because the
 * pipeline fails in a different way on each:
 *
 *   basicFold        four creases. If this fails nothing else matters.
 *   twentyTwoHalf    the 22.5 system: many lines through one point.
 *   miura            a non-square lattice, and no 45s anywhere.
 *   boxPleat         density. Thirty parallel creases 3% of the paper apart.
 *   waterbomb        diagonals crossing a grid at every cell.
 *   treeBase         angles that are not a fraction of anything.
 *   asymmetric       nothing symmetric, so a mirrored result is visibly wrong.
 *
 * They are all patterns anyone may draw, which is why they are here rather
 * than a folder of other people's files.
 */

function m(x1: number, y1: number, x2: number, y2: number): Crease {
  return { x1, y1, x2, y2, assignment: "M" };
}

function v(x1: number, y1: number, x2: number, y2: number): Crease {
  return { x1, y1, x2, y2, assignment: "V" };
}

function crease(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  assignment: EdgeAssignment,
): Crease {
  return { x1, y1, x2, y2, assignment };
}

/** Both diagonals and both midlines: the first thing anybody folds. */
export const basicFold: Pattern = {
  name: "basic fold",
  width: 1,
  height: 1,
  creases: [
    m(0, 0, 1, 1),
    m(1, 0, 0, 1),
    v(0.5, 0, 0.5, 1),
    v(0, 0.5, 1, 0.5),
  ],
};

/**
 * The 22.5 degree system, as a bird base is drawn.
 *
 * Ten creases through the centre plus the inner square. The hard part is not
 * the angles, it is that eight of them meet at one point: thinning a junction
 * where eight strokes overlap leaves a blob, and a detector that treats the
 * blob as evidence reports a crease across it.
 */
export const twentyTwoHalf: Pattern = (() => {
  const creases: Crease[] = [
    m(0, 0, 1, 1),
    m(1, 0, 0, 1),
    v(0.5, 0, 0.5, 1),
    v(0, 0.5, 1, 0.5),
  ];

  // The inner square, at 45 degrees, through the four edge midpoints.
  creases.push(
    v(0.5, 0, 1, 0.5),
    v(1, 0.5, 0.5, 1),
    v(0.5, 1, 0, 0.5),
    v(0, 0.5, 0.5, 0),
  );

  // Corner creases at 22.5 degrees either side of each diagonal, stopping
  // where they reach the inner square.
  const tan = Math.tan(Math.PI / 8);
  creases.push(
    m(0, 0, 1, tan),
    m(0, 0, tan, 1),
    m(1, 0, 0, tan),
    m(1, 0, 1 - tan, 1),
    m(1, 1, 0, 1 - tan),
    m(1, 1, 1 - tan, 0),
    m(0, 1, 1, 1 - tan),
    m(0, 1, tan, 0),
  );

  return { name: "22.5 degree base", width: 1, height: 1, creases };
})();

/**
 * Miura-ori on a non-square lattice.
 *
 * The zigzag is the point. Its creases are at an angle that is not 45 and not
 * a multiple of 22.5, so anything that snaps to a fixed lattice destroys it,
 * and its two axes carry different numbers of divisions, so anything that
 * infers one grid for both gets one of them wrong.
 */
export function miura(cols: number, rows: number): Pattern {
  // The zigzag offsets the interior columns only, so the pattern stays on its
  // paper: a Miura drawn running off the right-hand edge would test the
  // scanner's idea of where the sheet is rather than its idea of creases.
  const shift = 0.5 / cols;
  const at = (i: number, j: number): [number, number] => [
    i / cols + (j % 2 === 1 && i > 0 && i < cols ? shift : 0),
    j / rows,
  ];

  const creases: Crease[] = [];
  for (let j = 0; j <= rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      if (j === 0 || j === rows) continue;
      const a = at(i, j);
      const b = at(i + 1, j);
      creases.push(crease(a[0], a[1], b[0], b[1], j % 2 === 0 ? "M" : "V"));
    }
  }
  for (let i = 1; i < cols; i += 1) {
    for (let j = 0; j < rows; j += 1) {
      const a = at(i, j);
      const b = at(i, j + 1);
      creases.push(crease(a[0], a[1], b[0], b[1], i % 2 === 0 ? "V" : "M"));
    }
  }

  return {
    name: `miura ${cols}x${rows}`,
    width: 1,
    height: 1,
    creases,
    grid: { x: cols * 2, y: rows },
  };
}

/**
 * A box-pleated grid: every line of an n by n lattice, alternating.
 *
 * The density test. At 32 divisions two neighbouring creases are three percent
 * of the paper apart, which at the working size is about forty pixels — and
 * every tolerance in the pipeline has to be well under that while still being
 * big enough to close a junction.
 */
export function boxPleat(divisions: number): Pattern {
  const creases: Crease[] = [];
  for (let i = 1; i < divisions; i += 1) {
    const t = i / divisions;
    const assignment: EdgeAssignment = i % 2 === 0 ? "M" : "V";
    creases.push(crease(t, 0, t, 1, assignment));
    creases.push(crease(0, t, 1, t, assignment));
  }
  return {
    name: `box pleat ${divisions}`,
    width: 1,
    height: 1,
    creases,
    grid: { x: divisions, y: divisions },
  };
}

/** A waterbomb tessellation: the grid, plus a diagonal through every cell. */
export function waterbomb(divisions: number): Pattern {
  const creases: Crease[] = [];
  const step = 1 / divisions;

  for (let i = 1; i < divisions; i += 1) {
    const t = i * step;
    creases.push(v(t, 0, t, 1));
    creases.push(v(0, t, 1, t));
  }
  for (let j = 0; j < divisions; j += 1) {
    for (let i = 0; i < divisions; i += 1) {
      const x = i * step;
      const y = j * step;
      if ((i + j) % 2 === 0) creases.push(m(x, y, x + step, y + step));
      else creases.push(m(x + step, y, x, y + step));
    }
  }

  return {
    name: `waterbomb ${divisions}`,
    width: 1,
    height: 1,
    creases,
    grid: { x: divisions, y: divisions },
  };
}

/**
 * A tree-theory base, with the angles that come out of circle packing.
 *
 * Nothing here is on a lattice and nothing is at a nice angle, which is exactly
 * the case where snapping to 22.5 degrees — the right thing to do to a
 * photograph — quietly ruins a design. Reading the angles off the drawing
 * instead has to leave these alone.
 */
export const treeBase: Pattern = (() => {
  const hub: [number, number] = [0.46, 0.53];
  const leaves: [number, number][] = [
    [0, 0.17],
    [0.31, 0],
    [0.86, 0],
    [1, 0.44],
    [1, 0.88],
    [0.58, 1],
    [0.07, 1],
    [0, 0.72],
  ];

  const creases: Crease[] = leaves.map((leaf, index) =>
    crease(hub[0], hub[1], leaf[0], leaf[1], index % 2 === 0 ? "M" : "V"),
  );

  // Ridge creases between neighbouring flaps, at a third of the way out.
  leaves.forEach((leaf, index) => {
    const next = leaves[(index + 1) % leaves.length]!;
    const a: [number, number] = [
      hub[0] + (leaf[0] - hub[0]) * 0.42,
      hub[1] + (leaf[1] - hub[1]) * 0.42,
    ];
    const b: [number, number] = [
      hub[0] + (next[0] - hub[0]) * 0.42,
      hub[1] + (next[1] - hub[1]) * 0.42,
    ];
    creases.push(crease(a[0], a[1], b[0], b[1], index % 2 === 0 ? "V" : "M"));
  });

  return { name: "tree base", width: 1, height: 1, creases };
})();

/**
 * Deliberately unsymmetric, in both axes.
 *
 * A crease pattern read upside down is still a crease pattern, still validates,
 * and is still wrong. Nothing else in this corpus would notice, because a
 * mirrored bird base is a bird base.
 */
export const asymmetric: Pattern = {
  name: "asymmetric",
  width: 1,
  height: 1,
  creases: [
    m(0, 0.82, 0.34, 0.82),
    m(0.34, 0.82, 0.34, 1),
    v(0.12, 0.9, 0.12, 1),
    m(0.62, 0, 0.62, 0.28),
    m(0.62, 0.28, 1, 0.28),
    v(0.8, 0, 0.8, 0.16),
    m(0, 0.1, 0.2, 0.3),
    v(0.72, 0.62, 0.95, 0.85),
  ],
};

/**
 * The same pattern drawn over a finer reference lattice than it uses.
 *
 * The real case, and the one that matters: a published box-pleated design
 * shows the 32-grid it was laid out on, in pale grey, under a pattern that
 * uses a fraction of it. A scanner that keeps the lattice comes back with a
 * waffle nobody folded.
 */
export function withLattice(pattern: Pattern, x: number, y = x): Pattern {
  return { ...pattern, grid: { x, y } };
}

/** A wide sheet, so the non-square paper path is exercised. */
export function wideMiura(): Pattern {
  const base = miura(8, 4);
  return {
    ...base,
    name: "wide miura",
    height: 0.5,
    creases: base.creases.map((line) => ({ ...line, y1: line.y1 * 0.5, y2: line.y2 * 0.5 })),
  };
}

export const CORPUS: readonly Pattern[] = [
  basicFold,
  twentyTwoHalf,
  miura(6, 4),
  boxPleat(16),
  waterbomb(8),
  treeBase,
  asymmetric,
];
