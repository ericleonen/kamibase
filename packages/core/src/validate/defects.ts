import type { Vec2 } from "../geometry/vec.js";

/**
 * Every way a file can fail the `.kami` rules, as a closed set.
 *
 * The validator returns these rather than throwing (DESIGN.md §4, "Repair
 * panel: the validator's defect list, each item clickable to zoom to the
 * problem"): a defect list is a work queue, an exception is a dead end.
 */
export const DEFECT_CODES = [
  // §2.4.1 presence and mutual consistency
  "missing-geometry",
  "array-length-mismatch",
  "vertex-index-out-of-range",
  "degenerate-edge-record",
  // §2.4.2 assignments
  "invalid-assignment",
  // §2.4.3 coordinates
  "non-2d-coordinates",
  "coordinates-not-normalized",
  // §2.4.4 boundary
  "boundary-missing",
  "boundary-not-closed",
  "boundary-multiple-loops",
  "boundary-not-enclosing",
  // §2.4.5 degeneracies
  "duplicate-edge",
  "zero-length-edge",
  "coincident-vertices",
  // §2.4.6 crossings
  "crossing-without-vertex",
  "vertex-on-edge-interior",
  "overlapping-edges",
  // §2.4.7 required metadata
  "missing-required-metadata",
  // faces, when supplied
  "face-not-a-cycle",
  // informational
  "unassigned-edge",
  "dangling-edge",
  "isolated-vertex",
] as const;

export type DefectCode = (typeof DEFECT_CODES)[number];

export type DefectSeverity = "error" | "warning";

/**
 * A single validation finding.
 *
 * `error` blocks L1; `warning` is informational and does not. Index lists are
 * what the editor's repair panel needs to highlight the offending geometry.
 */
export interface Defect {
  readonly code: DefectCode;
  readonly severity: DefectSeverity;
  /** The DESIGN.md rule this comes from, e.g. `"§2.4.6"`. */
  readonly rule: string;
  readonly message: string;
  readonly vertices?: readonly number[];
  readonly edges?: readonly number[];
  readonly faces?: readonly number[];
  /** Where to zoom to, when the defect has a location. */
  readonly at?: Vec2;
}

export interface ValidationReport {
  /** True when there are no `error`-severity defects. */
  readonly ok: boolean;
  readonly defects: readonly Defect[];
  readonly errors: readonly Defect[];
  readonly warnings: readonly Defect[];
}

/** Group a flat defect list into a {@link ValidationReport}. */
export function toReport(defects: readonly Defect[]): ValidationReport {
  const errors = defects.filter((d) => d.severity === "error");
  const warnings = defects.filter((d) => d.severity === "warning");
  return { ok: errors.length === 0, defects, errors, warnings };
}

/** Merge several reports, preserving defect order. */
export function mergeReports(
  ...reports: readonly ValidationReport[]
): ValidationReport {
  return toReport(reports.flatMap((r) => [...r.defects]));
}

export function hasDefect(
  report: ValidationReport,
  code: DefectCode,
): boolean {
  return report.defects.some((d) => d.code === code);
}
