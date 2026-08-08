import type { CreaseGraph } from "../graph/types.js";
import { extractGraph } from "../kami/document.js";
import type { FoldDocument } from "../kami/schema.js";
import type { ValidationReport } from "./defects.js";
import {
  checkFlatFoldability,
  type FlatFoldOptions,
  type FlatFoldReport,
} from "./flatfold.js";
import { validateGraph, validateStructure, type ValidateOptions } from "./structural.js";

/**
 * Upload grades from DESIGN.md §2.6. `invalid` is not in that table: it is
 * files that do not even reach L0 (no geometry at all), which the table
 * assumes away but an upload funnel cannot.
 */
export const VALIDATION_LEVELS = ["invalid", "L0", "L1", "L2", "L3"] as const;

export type ValidationLevel = (typeof VALIDATION_LEVELS)[number];

export interface SimulationEvidence {
  /** Did the headless simulator reach a stable folded state? (§2.6, L2) */
  readonly verified?: boolean;
  readonly maxStrain?: number;
}

export interface GradeOptions extends ValidateOptions, FlatFoldOptions {
  /**
   * Result of a headless simulator run. `@kamibase/core` is headless and does
   * not simulate, so L2 evidence has to come from the caller: the worker queue
   * at ingest, or `kami:simulation` on a document that has already been through
   * it. Without evidence a document is capped at L1.
   */
  readonly simulation?: SimulationEvidence;
  /** Skip the flat-foldability pass (it is O(V log V) but not free). */
  readonly skipFlatFoldCheck?: boolean;
}

export interface GradeResult {
  readonly level: ValidationLevel;
  readonly structural: ValidationReport;
  /** `null` when the document had no readable geometry. */
  readonly flatFold: FlatFoldReport | null;
  /** Why the grade is not higher, one line per blocked level. */
  readonly reasons: readonly string[];
  readonly graph: CreaseGraph | null;
}

/** Grade a `.kami` / FOLD document (DESIGN.md §2.6). */
export function grade(doc: FoldDocument, options: GradeOptions = {}): GradeResult {
  const { graph } = extractGraph(doc);
  const structural = validateStructure(doc, options);
  const simulation = options.simulation ?? readSimulationEvidence(doc);
  return gradeFrom(graph, structural, simulation, options);
}

/** Grade a bare graph, using the geometric rules only. */
export function gradeGraph(
  graph: CreaseGraph,
  options: GradeOptions = {},
): GradeResult {
  return gradeFrom(graph, validateGraph(graph, options), options.simulation, options);
}

function gradeFrom(
  graph: CreaseGraph | null,
  structural: ValidationReport,
  simulation: SimulationEvidence | undefined,
  options: GradeOptions,
): GradeResult {
  const reasons: string[] = [];

  const hasGeometry =
    graph !== null && graph.vertices.length > 0 && graph.edges.length > 0;
  if (!hasGeometry) {
    return {
      level: "invalid",
      structural,
      flatFold: null,
      reasons: ["no readable geometry: vertices_coords / edges_vertices are absent or empty"],
      graph,
    };
  }

  if (!structural.ok) {
    reasons.push(
      `L1 blocked by ${structural.errors.length} structural defect(s): ` +
        summarize(structural),
    );
    return { level: "L0", structural, flatFold: null, reasons, graph };
  }

  const flatFold = options.skipFlatFoldCheck ? null : checkFlatFoldability(graph, options);

  if (simulation?.verified !== true) {
    reasons.push(
      simulation === undefined
        ? "L2 needs a headless simulator run; no simulation evidence was supplied"
        : "L2 blocked: the simulator did not reach a stable folded state",
    );
    return { level: "L1", structural, flatFold, reasons, graph };
  }

  if (!flatFold) {
    reasons.push("L3 not evaluated: the flat-foldability check was skipped");
    return { level: "L2", structural, flatFold, reasons, graph };
  }

  if (!flatFold.flatFoldable) {
    const failing = flatFold.failures.length;
    const unclear = flatFold.indeterminate.length;
    reasons.push(
      "L3 blocked: " +
        [
          failing > 0
            ? `Maekawa/Kawasaki fail at ${failing} interior vertex/vertices ` +
              `(${flatFold.failures
                .slice(0, 5)
                .map(
                  (v) =>
                    `v${v.vertex}: ${v.maekawa === "fail" ? "Maekawa" : "Kawasaki"}`,
                )
                .join(", ")})`
            : null,
          unclear > 0
            ? `${unclear} interior vertex/vertices are undecidable (unassigned creases)`
            : null,
        ]
          .filter(Boolean)
          .join("; "),
    );
    return { level: "L2", structural, flatFold, reasons, graph };
  }

  return { level: "L3", structural, flatFold, reasons, graph };
}

function readSimulationEvidence(doc: FoldDocument): SimulationEvidence | undefined {
  const block = (doc as Record<string, unknown>)["kami:simulation"];
  if (block === null || typeof block !== "object") return undefined;
  const record = block as Record<string, unknown>;
  const verified = record["verified"];
  const maxStrain = record["maxStrain"];
  return {
    ...(typeof verified === "boolean" ? { verified } : {}),
    ...(typeof maxStrain === "number" ? { maxStrain } : {}),
  };
}

function summarize(report: ValidationReport): string {
  const counts = new Map<string, number>();
  for (const defect of report.errors) {
    counts.set(defect.code, (counts.get(defect.code) ?? 0) + 1);
  }
  return [...counts].map(([code, n]) => (n > 1 ? `${code}×${n}` : code)).join(", ");
}

/** Ordering helper: is `a` at least as good as `b`? */
export function atLeast(a: ValidationLevel, b: ValidationLevel): boolean {
  return VALIDATION_LEVELS.indexOf(a) >= VALIDATION_LEVELS.indexOf(b);
}
