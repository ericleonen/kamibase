import { graphFromSegments } from "../graph/build.js";
import type { EdgeAssignment, Segment } from "../graph/types.js";
import { ParseError } from "./errors.js";
import type { ParsedPattern } from "./types.js";

/**
 * ORIPA / Lang `.cp` line types (DESIGN.md §3.1: "1=contour/border,
 * 2=mountain, 3=valley").
 *
 * 0 and 4 are not in that list but are written by ORIPA and Oriedita: 0 for an
 * undeclared line, 4 for an auxiliary construction line. We accept them rather
 * than reject files that are otherwise perfectly good.
 */
export const CP_LINE_TYPES: Readonly<Record<number, EdgeAssignment>> = {
  0: "U",
  1: "B",
  2: "M",
  3: "V",
  4: "F",
};

export interface ParseCpOptions {
  /**
   * Assignment for unrecognized line types. Default `"U"`, per DESIGN.md §3.4:
   * "ambiguous edges are marked U rather than guessed silently".
   */
  readonly unknownTypeAssignment?: EdgeAssignment;
}

/**
 * Parse an ASCII `.cp` file: one crease per line, `<type> <x1> <y1> <x2> <y2>`.
 *
 * Blank lines, `#` comments and `//` comments are skipped. Fields may be
 * separated by any run of whitespace, commas or tabs. Trailing fields beyond
 * the fifth are ignored with a warning, since some editors append colour or
 * layer data there.
 */
export function parseCp(text: string, options: ParseCpOptions = {}): ParsedPattern {
  const unknownAssignment = options.unknownTypeAssignment ?? "U";
  const warnings: string[] = [];
  const segments: Segment[] = [];

  const lines = text.split(/\r\n|\r|\n/);
  lines.forEach((raw, i) => {
    const lineNumber = i + 1;
    const stripped = raw.replace(/(^|\s)(#|\/\/).*$/, "").trim();
    if (stripped === "") return;

    const fields = stripped.split(/[\s,]+/);
    if (fields.length < 5) {
      warnings.push(
        `line ${lineNumber}: expected 5 fields "<type> <x1> <y1> <x2> <y2>", ` +
          `got ${fields.length}; skipped`,
      );
      return;
    }
    if (fields.length > 5) {
      warnings.push(
        `line ${lineNumber}: ignored ${fields.length - 5} trailing field(s)`,
      );
    }

    const numbers = fields.slice(0, 5).map((field) => Number(field));
    if (numbers.some((n) => !Number.isFinite(n))) {
      warnings.push(`line ${lineNumber}: non-numeric field; skipped`);
      return;
    }

    const [type, x1, y1, x2, y2] = numbers as [number, number, number, number, number];
    let assignment = CP_LINE_TYPES[type];
    if (assignment === undefined) {
      warnings.push(
        `line ${lineNumber}: unknown line type ${type}; assigned ${unknownAssignment}`,
      );
      assignment = unknownAssignment;
    }
    segments.push({ x1, y1, x2, y2, assignment });
  });

  if (segments.length === 0) {
    throw new ParseError("cp", "no usable crease lines found");
  }

  const { graph, warnings: buildWarnings } = graphFromSegments(segments);
  warnings.push(...buildWarnings);

  return { format: "cp", graph, document: null, metadata: {}, warnings };
}

/** Serialize a graph back to `.cp`. Useful for round-trip tests and export. */
export function toCp(pattern: ParsedPattern | { graph: ParsedPattern["graph"] }): string {
  const typeOf: Readonly<Record<EdgeAssignment, number>> = {
    U: 0,
    B: 1,
    M: 2,
    V: 3,
    F: 4,
    C: 0,
    J: 0,
  };
  const { graph } = pattern;
  return (
    graph.edges
      .map((edge, i) => {
        const a = graph.vertices[edge[0]]!;
        const b = graph.vertices[edge[1]]!;
        const type = typeOf[graph.assignments[i] ?? "U"];
        return `${type} ${a[0]} ${a[1]} ${b[0]} ${b[1]}`;
      })
      .join("\n") + "\n"
  );
}
