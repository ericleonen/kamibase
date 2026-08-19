/**
 * Turning the paper.
 *
 * Not the grid, and not the drawing: the sheet itself, on screen. Origami is a
 * physical thing and people turn the paper constantly while folding: a design
 * laid out on the diagonal is easier to read with the diagonal upright, and a
 * pleat is easier to draw along than across.
 *
 * So this is a *view* rotation. Nothing it does reaches the document: a crease
 * from corner to corner is stored as a crease from corner to corner whatever
 * angle the sheet is being looked at. That is the difference between this and
 * the grid angle, which is part of the design.
 *
 * Two things follow from that, and both live here so the canvas and the
 * viewport cannot disagree about them:
 *
 *   - A turned square needs a bigger box. At 45 degrees the unit square spans
 *     √2, so a fit that assumed 1 would crop the corners off.
 *   - The pointer arrives in screen coordinates and has to be turned back.
 */

/** Angles worth one tap: the quarter turns, and the diagonals. */
export const PAPER_ANGLE_PRESETS: readonly number[] = [0, 45, 90, 135];

export function normalizePaperAngle(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0;
  return ((degrees % 360) + 360) % 360;
}

/**
 * The side of the axis-aligned box a turned unit square fills.
 *
 * 1 at every quarter turn, √2 on the diagonals, and the smooth thing between.
 */
export function rotatedExtent(degrees: number): number {
  const radians = (degrees * Math.PI) / 180;
  return Math.abs(Math.cos(radians)) + Math.abs(Math.sin(radians));
}

/**
 * How far to shift the turned sheet so its box starts at the origin.
 *
 * Rotation is about the sheet's centre, which leaves the box centred on
 * (0.5, 0.5) and hanging off two sides. The viewport fits a box that starts at
 * the origin, so the drawing moves to meet it rather than the fit growing a
 * special case.
 */
export function rotatedOffset(degrees: number): number {
  return (rotatedExtent(degrees) - 1) / 2;
}

/**
 * The SVG transform that draws the sheet turned.
 *
 * Negated, because SVG's y axis points down: a positive angle there turns
 * clockwise on screen, and turning the paper anticlockwise is what "45
 * degrees" means to everyone who has held a sheet of it.
 */
export function paperTransform(degrees: number): string {
  const offset = rotatedOffset(degrees);
  return `translate(${offset} ${offset}) rotate(${-degrees} 0.5 0.5)`;
}

/**
 * A point in the viewport's coordinates, back to paper coordinates.
 *
 * Exactly the inverse of `paperTransform`, plus the y flip every other part of
 * the editor already does: crease patterns are y-up and SVG is y-down, and
 * getting that backwards mirrors the drawing against its own thumbnail.
 */
export function toPaperPoint(
  point: { readonly x: number; readonly y: number },
  degrees: number,
): [number, number] {
  const offset = rotatedOffset(degrees);
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - offset - 0.5;
  const dy = point.y - offset - 0.5;
  return [0.5 + dx * cos - dy * sin, 1 - (0.5 + dx * sin + dy * cos)];
}
