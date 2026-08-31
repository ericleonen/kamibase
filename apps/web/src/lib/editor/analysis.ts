import {
  canonicalizeGraph,
  checkFlatFoldability,
  findFaces,
  planarize,
  validateGraph,
  type CreaseGraph,
  type Defect,
  type Vec2,
} from "@kamibase/core";
import { graphFromDoc, type EditorDoc } from "./model";

/**
 * Which rule a vertex fell foul of, so the panel can say so by name.
 *
 * `"unknown"` is not a failure of either rule but an absence of the assignments
 * needed to decide, which is an ordinary state for a pattern half-drawn and
 * deserves to be worded as one.
 */
export type VertexVerdict = "ok" | "maekawa" | "kawasaki" | "unknown";

export interface VertexMark {
  /** Where to draw the dot, in unit coordinates. */
  readonly at: Vec2;
  readonly ok: boolean;
  readonly verdict: VertexVerdict;
  /** Why it is marked, for the tooltip. */
  readonly reason: string;
}

export interface EditorAnalysis {
  /** The cleaned graph, with crossings split and faces computed. */
  readonly graph: CreaseGraph;
  readonly defects: readonly Defect[];
  readonly errorCount: number;
  readonly warningCount: number;
  /** Interior vertices that fail Maekawa or Kawasaki, plus the ones that pass. */
  readonly vertexMarks: readonly VertexMark[];
  readonly flatFoldable: boolean;
  readonly faceCount: number;
  /** True when the pattern was too big to analyse live. */
  readonly skipped: boolean;
}

/**
 * Above this many creases the live pass is skipped.
 *
 * Planarization and crossing detection are O(E²) (see packages/core's README).
 * A few hundred creases is instant; a dense tessellation would stall the main
 * thread on every stroke. DESIGN.md §4 wants live checks, and a live check that
 * janks the canvas is worse than one that admits it stepped aside.
 */
export const LIVE_ANALYSIS_EDGE_LIMIT = 600;

const EMPTY: EditorAnalysis = {
  graph: { vertices: [], edges: [], assignments: [] },
  defects: [],
  errorCount: 0,
  warningCount: 0,
  vertexMarks: [],
  flatFoldable: false,
  faceCount: 0,
  skipped: false,
};

/**
 * Run the real validator over the editor's current state.
 *
 * This is DESIGN.md §9's whole argument made concrete: the editor's rules are
 * not a reimplementation, they are `@kamibase/core` running in the browser:
 * the same planarize, the same §2.4 checks, the same Maekawa and Kawasaki as
 * the server applies on ingest. There is nothing to drift.
 */
export function analyse(doc: EditorDoc): EditorAnalysis {
  if (doc.length === 0) return EMPTY;
  if (doc.length > LIVE_ANALYSIS_EDGE_LIMIT) {
    return { ...EMPTY, skipped: true };
  }

  const raw = graphFromDoc(doc);
  // Normalizing here would rescale the paper as soon as a crease strayed
  // outside it, yanking the drawing out from under the person drawing it. The
  // editor works in unit coordinates already, so only the topology needs
  // cleaning.
  const planar = planarize(raw);
  const withFaces: CreaseGraph = {
    ...planar.graph,
    faces: findFaces(planar.graph).faces,
  };
  const graph = canonicalizeGraph(withFaces, { normalize: false });

  const report = validateGraph(graph, { requireNormalized: false });
  const flat = checkFlatFoldability(graph);

  const vertexMarks: VertexMark[] = flat.vertices
    .filter((vertex) => vertex.interior && vertex.degree > 0)
    .map((vertex) => {
      const at = graph.vertices[vertex.vertex] ?? ([0, 0] as Vec2);
      if (vertex.maekawa === "fail") {
        return {
          at,
          ok: false,
          verdict: "maekawa",
          reason:
            `Maekawa: ${vertex.mountains}M / ${vertex.valleys}V. A flat-foldable ` +
            "vertex needs the counts to differ by exactly 2",
        };
      }
      if (vertex.kawasaki === "fail") {
        return {
          at,
          ok: false,
          verdict: "kawasaki",
          reason: "Kawasaki: alternate angles around this vertex do not sum to 180°",
        };
      }
      if (vertex.maekawa === "indeterminate" || vertex.kawasaki === "indeterminate") {
        return {
          at,
          ok: false,
          verdict: "unknown",
          reason: vertex.note ?? "Undecidable, because some creases here are unassigned",
        };
      }
      return { at, ok: true, verdict: "ok", reason: "Maekawa and Kawasaki both hold here" };
    });

  return {
    graph,
    defects: report.defects,
    errorCount: report.errors.length,
    warningCount: report.warnings.length,
    vertexMarks,
    flatFoldable: flat.flatFoldable,
    faceCount: graph.faces?.length ?? 0,
    skipped: false,
  };
}
