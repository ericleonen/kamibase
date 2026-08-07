import { angleOf, normalizeAngle } from "../geometry/vec.js";
import {
  buildVertexEdges,
  otherEnd,
  type CreaseGraph,
  type EdgeAssignment,
} from "../graph/types.js";
import { analyzeBoundary } from "./structural.js";

export type CheckOutcome = "pass" | "fail" | "indeterminate";

export interface VertexFlatFoldCheck {
  readonly vertex: number;
  /** False for vertices on the paper boundary; the theorems are local to interior vertices. */
  readonly interior: boolean;
  /** Number of folded creases at the vertex (`F` creases are not folds). */
  readonly degree: number;
  readonly mountains: number;
  readonly valleys: number;
  /** Maekawa: `|M - V| = 2` at every flat-foldable interior vertex. */
  readonly maekawa: CheckOutcome;
  /** Kawasaki: alternate sector angles sum to π. */
  readonly kawasaki: CheckOutcome;
  /**
   * Big-Little-Big: the creases bounding a strict local-minimum sector must
   * have opposite assignments. Reported for the repair panel; not part of the
   * L3 gate (see {@link checkFlatFoldability}).
   */
  readonly bigLittleBig: CheckOutcome;
  /** `|Σ odd sectors − Σ even sectors|` in radians; 0 when Kawasaki holds. */
  readonly kawasakiResidual: number;
  /** Why a check came back indeterminate. */
  readonly note?: string;
}

export interface FlatFoldReport {
  readonly vertices: readonly VertexFlatFoldCheck[];
  /** True when Maekawa and Kawasaki pass at *every* interior vertex. */
  readonly flatFoldable: boolean;
  /** Interior vertices where Maekawa or Kawasaki failed. */
  readonly failures: readonly VertexFlatFoldCheck[];
  /** Interior vertices whose assignment left the checks undecidable. */
  readonly indeterminate: readonly VertexFlatFoldCheck[];
  /** Interior vertices flagged only by Big-Little-Big. */
  readonly bigLittleBigFailures: readonly VertexFlatFoldCheck[];
}

export interface FlatFoldOptions {
  /** Angle tolerance in radians for Kawasaki. Default `1e-6`. */
  readonly angleTolerance?: number;
}

/**
 * Local flat-foldability checks at every interior vertex (DESIGN.md §2.6, L3).
 *
 * The L3 gate is Maekawa **and** Kawasaki at every interior vertex.
 * Big-Little-Big is computed and reported alongside but does not gate the
 * grade: it is a condition on the *sector angles* whose standard statement
 * needs a crimp to be foldable, and treating it as a hard gate rejects
 * patterns the other two accept. §2.6 is explicit that L3 says "this is
 * locally consistent", not "this is good".
 *
 * These are necessary local conditions, not sufficient global ones — a pattern
 * can pass at every vertex and still not fold flat globally (layer ordering is
 * NP-hard). That is what the L2 simulator run is for.
 */
export function checkFlatFoldability(
  graph: CreaseGraph,
  options: FlatFoldOptions = {},
): FlatFoldReport {
  const tolerance = options.angleTolerance ?? 1e-6;
  const incident = buildVertexEdges(graph);
  const { boundaryVertices } = analyzeBoundary(graph);

  const vertices: VertexFlatFoldCheck[] = graph.vertices.map((origin, vertexId) => {
    const interior = !boundaryVertices.has(vertexId);
    const edges = incident[vertexId] ?? [];

    const spokes = edges
      .map((edgeId) => {
        const target = otherEnd(graph.edges[edgeId]!, vertexId);
        const point = graph.vertices[target]!;
        return {
          edgeId,
          assignment: graph.assignments[edgeId] ?? "U",
          angle: normalizeAngle(angleOf(origin, point)),
        };
      })
      .sort((a, b) => a.angle - b.angle || a.edgeId - b.edgeId);

    // `F` creases are creased but unfolded: they do not count as folds, and the
    // sectors they separate merge. Dropping them before the sector walk is the
    // whole of that treatment.
    const folded = spokes.filter((s) => s.assignment !== "F");

    const mountains = folded.filter((s) => s.assignment === "M").length;
    const valleys = folded.filter((s) => s.assignment === "V").length;
    const unclear = folded.filter(
      (s) => s.assignment !== "M" && s.assignment !== "V" && s.assignment !== "B",
    );

    const base = {
      vertex: vertexId,
      interior,
      degree: folded.length,
      mountains,
      valleys,
      kawasakiResidual: 0,
    };

    if (!interior) {
      return {
        ...base,
        maekawa: "indeterminate",
        kawasaki: "indeterminate",
        bigLittleBig: "indeterminate",
        note: "boundary vertex; flat-foldability theorems apply to interior vertices",
      } satisfies VertexFlatFoldCheck;
    }
    if (folded.length === 0) {
      return {
        ...base,
        maekawa: "indeterminate",
        kawasaki: "indeterminate",
        bigLittleBig: "indeterminate",
        note: "no folded creases at this vertex",
      } satisfies VertexFlatFoldCheck;
    }
    if (unclear.length > 0) {
      return {
        ...base,
        maekawa: "indeterminate",
        kawasaki: "indeterminate",
        bigLittleBig: "indeterminate",
        note: `${unclear.length} crease(s) are not M or V (${unclear
          .map((s) => s.assignment)
          .join(", ")})`,
      } satisfies VertexFlatFoldCheck;
    }

    const sectors: number[] = [];
    for (let i = 0; i < folded.length; i += 1) {
      const here = folded[i]!.angle;
      const next = folded[(i + 1) % folded.length]!.angle;
      sectors.push(
        folded.length === 1 ? Math.PI * 2 : normalizeAngle(next - here),
      );
    }

    const oddDegree = folded.length % 2 !== 0;
    let evenSum = 0;
    let oddSum = 0;
    sectors.forEach((angle, i) => {
      if (i % 2 === 0) evenSum += angle;
      else oddSum += angle;
    });
    const residual = Math.abs(evenSum - oddSum);

    const maekawa: CheckOutcome = Math.abs(mountains - valleys) === 2 ? "pass" : "fail";
    const kawasaki: CheckOutcome = oddDegree
      ? "fail"
      : residual <= tolerance
        ? "pass"
        : "fail";

    return {
      ...base,
      maekawa,
      kawasaki,
      bigLittleBig: checkBigLittleBig(sectors, folded, tolerance),
      kawasakiResidual: oddDegree ? Math.PI : residual,
      ...(oddDegree ? { note: "odd number of creases; Kawasaki cannot hold" } : {}),
    } satisfies VertexFlatFoldCheck;
  });

  const interior = vertices.filter((v) => v.interior && v.degree > 0);
  const failures = interior.filter(
    (v) => v.maekawa === "fail" || v.kawasaki === "fail",
  );
  const indeterminate = interior.filter(
    (v) => v.maekawa === "indeterminate" || v.kawasaki === "indeterminate",
  );
  const bigLittleBigFailures = interior.filter((v) => v.bigLittleBig === "fail");

  return {
    vertices,
    flatFoldable: failures.length === 0 && indeterminate.length === 0,
    failures,
    indeterminate,
    bigLittleBigFailures,
  };
}

/**
 * Big-Little-Big: if a sector is strictly smaller than both its neighbours,
 * the two creases bounding it must have opposite assignments.
 */
function checkBigLittleBig(
  sectors: readonly number[],
  spokes: readonly { assignment: EdgeAssignment }[],
  tolerance: number,
): CheckOutcome {
  const n = sectors.length;
  if (n < 3) return "indeterminate";
  let sawMinimum = false;
  for (let i = 0; i < n; i += 1) {
    const previous = sectors[(i - 1 + n) % n]!;
    const here = sectors[i]!;
    const next = sectors[(i + 1) % n]!;
    if (here < previous - tolerance && here < next - tolerance) {
      sawMinimum = true;
      // Sector i is bounded by spoke i and spoke i+1.
      const a = spokes[i]!.assignment;
      const b = spokes[(i + 1) % n]!.assignment;
      if (a === b) return "fail";
    }
  }
  return sawMinimum ? "pass" : "indeterminate";
}
