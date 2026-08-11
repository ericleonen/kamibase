/**
 * `<path d="…">` flattened to polylines.
 *
 * Crease patterns are straight lines, so in the common case this walks a
 * string of `M`/`L`/`Z` and hands back exactly the segments that were written.
 * Curves are still supported and flattened, because curved-fold patterns exist
 * and because plenty of exporters emit a two-point cubic where a line would do.
 * Every flattened curve is counted so the parser can warn about it: the result
 * is an approximation, and DESIGN.md §3.4 asks us to say so rather than pass it
 * off as the designer's geometry.
 */

import type { Vec2 } from "../../geometry/vec.js";

export interface Subpath {
  readonly points: readonly Vec2[];
  /** `Z` was given, so the last point joins back to the first. */
  readonly closed: boolean;
}

export interface FlattenResult {
  readonly subpaths: readonly Subpath[];
  /** Number of curve commands approximated by line segments. */
  readonly curves: number;
  readonly warnings: readonly string[];
}

/** Deepest recursion in the de Casteljau subdivision: 2^10 segments of curve. */
const MAX_DEPTH = 10;

/**
 * Flatten path data into subpaths.
 *
 * `tolerance` is the maximum distance in the path's own user units between the
 * true curve and the polyline that replaces it.
 */
export function flattenPath(d: string, tolerance: number): FlattenResult {
  const scanner = new Scanner(d);
  const warnings: string[] = [];
  const subpaths: Subpath[] = [];

  let points: Vec2[] = [];
  let current: Vec2 = [0, 0];
  let start: Vec2 = [0, 0];
  /** Reflection point for `S`/`T`, per the SVG smooth-curve rules. */
  let lastCubicControl: Vec2 | null = null;
  let lastQuadraticControl: Vec2 | null = null;
  let curves = 0;
  let command = "";

  const flush = (closed: boolean): void => {
    if (points.length >= 2) subpaths.push({ points, closed });
    points = [];
  };
  const lineTo = (point: Vec2): void => {
    points.push(point);
    current = point;
  };

  for (;;) {
    scanner.skipSeparators();
    if (scanner.done) break;

    const next = scanner.peekCommand();
    if (next !== null) {
      command = next;
      scanner.advance();
    } else if (command === "") {
      warnings.push(`path data starts with "${scanner.rest(8)}" rather than a command`);
      break;
    } else if (command === "M" || command === "m") {
      // A repeated moveto argument pair is an implicit lineto (SVG 1.1 §8.3.2).
      command = command === "M" ? "L" : "l";
    }

    const relative = command === command.toLowerCase();
    const upper = command.toUpperCase();
    const absolute = (x: number, y: number): Vec2 =>
      relative ? [current[0] + x, current[1] + y] : [x, y];

    switch (upper) {
      case "M": {
        const args = scanner.numbers(2);
        if (!args) return finish(`ran out of arguments for "${command}"`);
        flush(false);
        current = absolute(args[0]!, args[1]!);
        start = current;
        points = [current];
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }
      case "L": {
        const args = scanner.numbers(2);
        if (!args) return finish(`ran out of arguments for "${command}"`);
        lineTo(absolute(args[0]!, args[1]!));
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }
      case "H": {
        const args = scanner.numbers(1);
        if (!args) return finish(`ran out of arguments for "${command}"`);
        lineTo([relative ? current[0] + args[0]! : args[0]!, current[1]]);
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }
      case "V": {
        const args = scanner.numbers(1);
        if (!args) return finish(`ran out of arguments for "${command}"`);
        lineTo([current[0], relative ? current[1] + args[0]! : args[0]!]);
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }
      case "C":
      case "S": {
        const args = scanner.numbers(upper === "C" ? 6 : 4);
        if (!args) return finish(`ran out of arguments for "${command}"`);
        const control1 =
          upper === "C"
            ? absolute(args[0]!, args[1]!)
            : reflect(lastCubicControl, current);
        const rest = upper === "C" ? args.slice(2) : args;
        const control2 = absolute(rest[0]!, rest[1]!);
        const end = absolute(rest[2]!, rest[3]!);
        if (points.length === 0) points.push(current);
        flattenCubic(current, control1, control2, end, tolerance, points);
        current = end;
        lastCubicControl = control2;
        lastQuadraticControl = null;
        curves += 1;
        break;
      }
      case "Q":
      case "T": {
        const args = scanner.numbers(upper === "Q" ? 4 : 2);
        if (!args) return finish(`ran out of arguments for "${command}"`);
        const control: Vec2 =
          upper === "Q"
            ? absolute(args[0]!, args[1]!)
            : reflect(lastQuadraticControl, current);
        const rest = upper === "Q" ? args.slice(2) : args;
        const end = absolute(rest[0]!, rest[1]!);
        if (points.length === 0) points.push(current);
        // A quadratic is the cubic with controls a third of the way in.
        flattenCubic(
          current,
          lerp(current, control, 2 / 3),
          lerp(end, control, 2 / 3),
          end,
          tolerance,
          points,
        );
        current = end;
        lastQuadraticControl = control;
        lastCubicControl = null;
        curves += 1;
        break;
      }
      case "A": {
        const args = scanner.arcArguments();
        if (!args) return finish(`ran out of arguments for "${command}"`);
        const end = absolute(args[5]!, args[6]!);
        if (points.length === 0) points.push(current);
        flattenArc(
          current,
          end,
          args[0]!,
          args[1]!,
          args[2]!,
          args[3]! !== 0,
          args[4]! !== 0,
          tolerance,
          points,
        );
        current = end;
        lastCubicControl = null;
        lastQuadraticControl = null;
        curves += 1;
        break;
      }
      case "Z": {
        flush(true);
        current = start;
        points = [current];
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }
      default:
        return finish(`unsupported path command "${command}"`);
    }
  }

  flush(false);
  return { subpaths, curves, warnings };

  function finish(message: string): FlattenResult {
    warnings.push(message);
    flush(false);
    return { subpaths, curves, warnings };
  }
}

function reflect(control: Vec2 | null, current: Vec2): Vec2 {
  if (!control) return current;
  return [2 * current[0] - control[0], 2 * current[1] - control[1]];
}

function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Recursive de Casteljau subdivision; appends every point but `p0`. */
function flattenCubic(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  tolerance: number,
  out: Vec2[],
  depth = 0,
): void {
  if (depth >= MAX_DEPTH || isFlat(p0, p1, p2, p3, tolerance)) {
    out.push(p3);
    return;
  }
  const p01 = lerp(p0, p1, 0.5);
  const p12 = lerp(p1, p2, 0.5);
  const p23 = lerp(p2, p3, 0.5);
  const p012 = lerp(p01, p12, 0.5);
  const p123 = lerp(p12, p23, 0.5);
  const mid = lerp(p012, p123, 0.5);
  flattenCubic(p0, p01, p012, mid, tolerance, out, depth + 1);
  flattenCubic(mid, p123, p23, p3, tolerance, out, depth + 1);
}

/** Both control points within `tolerance` of the chord. */
function isFlat(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, tolerance: number): boolean {
  const dx = p3[0] - p0[0];
  const dy = p3[1] - p0[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return (
      Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) <= tolerance &&
      Math.hypot(p2[0] - p0[0], p2[1] - p0[1]) <= tolerance
    );
  }
  const distance = (p: Vec2): number =>
    Math.abs(dx * (p0[1] - p[1]) - dy * (p0[0] - p[0])) / length;
  return distance(p1) <= tolerance && distance(p2) <= tolerance;
}

/**
 * Elliptical arc, via the endpoint-to-centre conversion of SVG 1.1 §F.6.5,
 * then sampled at an angle step whose sagitta stays inside `tolerance`.
 */
function flattenArc(
  from: Vec2,
  to: Vec2,
  rxInput: number,
  ryInput: number,
  rotationDegrees: number,
  largeArc: boolean,
  sweep: boolean,
  tolerance: number,
  out: Vec2[],
): void {
  let rx = Math.abs(rxInput);
  let ry = Math.abs(ryInput);
  if (rx === 0 || ry === 0) {
    out.push(to);
    return;
  }

  const phi = (rotationDegrees * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx2 = (from[0] - to[0]) / 2;
  const dy2 = (from[1] - to[1]) / 2;
  const x1 = cosPhi * dx2 + sinPhi * dy2;
  const y1 = -sinPhi * dx2 + cosPhi * dy2;

  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    const scale = Math.sqrt(lambda);
    rx *= scale;
    ry *= scale;
  }

  const numerator = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const factor =
    denominator === 0
      ? 0
      : (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator));
  const cx1 = (factor * rx * y1) / ry;
  const cy1 = (-factor * ry * x1) / rx;
  const cx = cosPhi * cx1 - sinPhi * cy1 + (from[0] + to[0]) / 2;
  const cy = sinPhi * cx1 + cosPhi * cy1 + (from[1] + to[1]) / 2;

  const angleOf = (x: number, y: number): number => Math.atan2((y - cy1) / ry, (x - cx1) / rx);
  const theta1 = angleOf(x1, y1);
  let delta = angleOf(-x1, -y1) - theta1;
  const twoPi = Math.PI * 2;
  if (!sweep && delta > 0) delta -= twoPi;
  if (sweep && delta < 0) delta += twoPi;

  const radius = Math.max(rx, ry);
  const step =
    tolerance >= radius ? Math.PI / 2 : 2 * Math.acos(Math.max(-1, 1 - tolerance / radius));
  const count = Math.min(256, Math.max(2, Math.ceil(Math.abs(delta) / step)));
  for (let i = 1; i <= count; i += 1) {
    const theta = theta1 + (delta * i) / count;
    const px = rx * Math.cos(theta);
    const py = ry * Math.sin(theta);
    out.push([cosPhi * px - sinPhi * py + cx, sinPhi * px + cosPhi * py + cy]);
  }
}

/**
 * A character scanner rather than a regex split, because arc flags may be
 * written without separators: `a1 1 0 011 1` is seven arguments, not five.
 */
class Scanner {
  private index = 0;

  constructor(private readonly text: string) {}

  get done(): boolean {
    return this.index >= this.text.length;
  }

  rest(length: number): string {
    return this.text.slice(this.index, this.index + length);
  }

  advance(): void {
    this.index += 1;
  }

  skipSeparators(): void {
    while (this.index < this.text.length && /[\s,]/.test(this.text[this.index]!)) {
      this.index += 1;
    }
  }

  /** The command letter at the cursor, or `null` if a number comes next. */
  peekCommand(): string | null {
    const character = this.text[this.index];
    return character !== undefined && /[a-zA-Z]/.test(character) ? character : null;
  }

  numbers(count: number): number[] | null {
    const values: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const value = this.number();
      if (value === null) return null;
      values.push(value);
    }
    return values;
  }

  /** `rx ry rotation large-arc-flag sweep-flag x y`, with flags as digits. */
  arcArguments(): number[] | null {
    const head = this.numbers(3);
    if (!head) return null;
    const largeArc = this.flag();
    const sweep = this.flag();
    if (largeArc === null || sweep === null) return null;
    const tail = this.numbers(2);
    if (!tail) return null;
    return [...head, largeArc, sweep, ...tail];
  }

  private flag(): number | null {
    this.skipSeparators();
    const character = this.text[this.index];
    if (character !== "0" && character !== "1") return null;
    this.index += 1;
    return character === "0" ? 0 : 1;
  }

  private number(): number | null {
    this.skipSeparators();
    const match = /^[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/.exec(
      this.text.slice(this.index),
    );
    if (!match || match[0] === "") return null;
    const value = Number.parseFloat(match[0]);
    if (!Number.isFinite(value)) return null;
    this.index += match[0].length;
    return value;
  }
}
