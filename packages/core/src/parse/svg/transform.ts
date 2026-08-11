/**
 * The `transform` attribute, reduced to a 2x3 affine matrix.
 *
 * Nothing else in the SVG converter is allowed to care where an element sits
 * in the group tree: geometry is pushed through the accumulated matrix as it
 * is read, so a crease inside three nested translated groups comes out in the
 * same coordinate space as one drawn at the root.
 */

/** Column-major `[a, b, c, d, e, f]`, the same order as SVG's `matrix()`. */
export type Matrix = readonly [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** `m` applied after `n`: the matrix for a child `n` inside a parent `m`. */
export function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Mean scale factor, used to keep curve flattening tolerance in user units. */
export function meanScale(m: Matrix): number {
  const sx = Math.hypot(m[0], m[1]);
  const sy = Math.hypot(m[2], m[3]);
  const scale = (sx + sy) / 2;
  return scale > 0 ? scale : 1;
}

const FUNCTION = /([a-zA-Z]+)\s*\(([^)]*)\)/g;

/**
 * Parse a transform list. Unknown functions are skipped rather than treated as
 * identity-plus-error: an SVG that uses something exotic still has readable
 * geometry everywhere else.
 */
export function parseTransform(value: string): Matrix {
  let result = IDENTITY;
  FUNCTION.lastIndex = 0;
  let match = FUNCTION.exec(value);
  while (match !== null) {
    const name = match[1]!.toLowerCase();
    const args = match[2]!
      .split(/[\s,]+/)
      .map((part) => Number.parseFloat(part))
      .filter((number) => Number.isFinite(number));
    const step = toMatrix(name, args);
    if (step) result = multiply(result, step);
    match = FUNCTION.exec(value);
  }
  return result;
}

function toMatrix(name: string, args: readonly number[]): Matrix | null {
  const radians = (degrees: number): number => (degrees * Math.PI) / 180;
  switch (name) {
    case "matrix":
      return args.length >= 6
        ? [args[0]!, args[1]!, args[2]!, args[3]!, args[4]!, args[5]!]
        : null;
    case "translate":
      return args.length >= 1 ? [1, 0, 0, 1, args[0]!, args[1] ?? 0] : null;
    case "scale":
      return args.length >= 1 ? [args[0]!, 0, 0, args[1] ?? args[0]!, 0, 0] : null;
    case "rotate": {
      if (args.length < 1) return null;
      const theta = radians(args[0]!);
      const rotation: Matrix = [
        Math.cos(theta),
        Math.sin(theta),
        -Math.sin(theta),
        Math.cos(theta),
        0,
        0,
      ];
      if (args.length < 3) return rotation;
      // rotate(a, cx, cy) is translate(c) · rotate(a) · translate(-c).
      const cx = args[1]!;
      const cy = args[2]!;
      return multiply(
        multiply([1, 0, 0, 1, cx, cy], rotation),
        [1, 0, 0, 1, -cx, -cy],
      );
    }
    case "skewx":
      return args.length >= 1 ? [1, 0, Math.tan(radians(args[0]!)), 1, 0, 0] : null;
    case "skewy":
      return args.length >= 1 ? [1, Math.tan(radians(args[0]!)), 0, 1, 0, 0] : null;
    default:
      return null;
  }
}
