import type { Vec2 } from "../geometry/vec.js";

/**
 * FOLD `edges_assignment` values (FOLD spec 1.2, restated in DESIGN.md §2.4.2):
 *
 * - `B` boundary of the paper
 * - `M` mountain fold
 * - `V` valley fold
 * - `F` flat (creased but unfolded)
 * - `U` unassigned / unknown
 * - `C` cut
 * - `J` join (two pieces of paper joined along this edge)
 */
export const EDGE_ASSIGNMENTS = ["B", "M", "V", "F", "U", "C", "J"] as const;

export type EdgeAssignment = (typeof EDGE_ASSIGNMENTS)[number];

const ASSIGNMENT_SET: ReadonlySet<string> = new Set(EDGE_ASSIGNMENTS);

export function isEdgeAssignment(value: unknown): value is EdgeAssignment {
  return typeof value === "string" && ASSIGNMENT_SET.has(value);
}

/** An undirected edge as a pair of vertex indices. */
export type Edge = readonly [number, number];

/**
 * The in-memory crease pattern.
 *
 * This is the one geometry type shared by the parsers, the canonicalizer, the
 * validator, the renderer and (later) the editor — DESIGN.md §9 calls out that
 * a second implementation of this graph is the thing most likely to drift.
 *
 * `faces` is optional because most sources do not supply it; ingest computes
 * it with {@link findFaces} (DESIGN.md §2.4, "Faces are not required on
 * upload").
 */
export interface CreaseGraph {
  /** Vertex positions, indexed by vertex id. */
  readonly vertices: readonly Vec2[];
  /** Undirected edges as `[v0, v1]` index pairs. */
  readonly edges: readonly Edge[];
  /** Assignment per edge; `assignments[i]` describes `edges[i]`. */
  readonly assignments: readonly EdgeAssignment[];
  /** Fold angle in degrees per edge, or `null` where unknown. */
  readonly foldAngles?: readonly (number | null)[];
  /** Face cycles as vertex-index loops, counter-clockwise. */
  readonly faces?: readonly (readonly number[])[];
}

/** A mutable builder-shaped counterpart of {@link CreaseGraph}. */
export interface MutableCreaseGraph {
  vertices: Vec2[];
  edges: [number, number][];
  assignments: EdgeAssignment[];
  foldAngles?: (number | null)[];
  faces?: number[][];
}

/** An untyped input segment, as produced by the `.cp` and `.opx` parsers. */
export interface Segment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly assignment: EdgeAssignment;
  /** 0–1 confidence in the assignment (DESIGN.md §3.4). */
  readonly confidence?: number;
}

/**
 * Default fold angles implied by an assignment, used when a source gives
 * assignments but no `edges_foldAngle`. Flat-folded creases are ±180.
 */
export function defaultFoldAngle(assignment: EdgeAssignment): number | null {
  switch (assignment) {
    case "M":
      return -180;
    case "V":
      return 180;
    case "B":
    case "F":
      return 0;
    default:
      return null;
  }
}

/** Assignment implied by a fold angle, used when a source gives only angles. */
export function assignmentFromFoldAngle(
  angle: number | null | undefined,
): EdgeAssignment {
  if (angle == null) return "U";
  if (angle > 0) return "V";
  if (angle < 0) return "M";
  return "F";
}

/** Adjacency: for each vertex, the ids of the edges incident to it. */
export function buildVertexEdges(graph: CreaseGraph): number[][] {
  const incident: number[][] = Array.from(
    { length: graph.vertices.length },
    () => [],
  );
  graph.edges.forEach(([a, b], edgeId) => {
    incident[a]?.push(edgeId);
    if (b !== a) incident[b]?.push(edgeId);
  });
  return incident;
}

/** The endpoint of `edge` that is not `vertex`. */
export function otherEnd(edge: Edge, vertex: number): number {
  return edge[0] === vertex ? edge[1] : edge[0];
}

export function edgeLength(graph: CreaseGraph, edgeId: number): number {
  const edge = graph.edges[edgeId];
  if (!edge) return 0;
  const a = graph.vertices[edge[0]];
  const b = graph.vertices[edge[1]];
  if (!a || !b) return 0;
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
