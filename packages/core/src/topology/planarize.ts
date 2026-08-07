import {
  COORD_EPSILON,
  GEOM_EPSILON,
  intersectSegments,
  projectOntoSegment,
  type Vec2,
} from "../geometry/vec.js";
import { graphFromSegments, type BuildResult } from "../graph/build.js";
import type { CreaseGraph, Segment } from "../graph/types.js";

export interface PlanarizeOptions {
  /** Vertex merge tolerance. Defaults to `1e-9`. */
  readonly epsilon?: number;
  /** Predicate tolerance for crossings. Defaults to `1e-9`. */
  readonly geomEpsilon?: number;
}

/**
 * Resolve every crossing into a vertex — DESIGN.md §2.4.6, "the single most
 * common defect in converted files and the main thing that breaks simulation".
 *
 * Splits edges at
 *  - proper crossings with other edges,
 *  - the endpoints of collinear overlaps (the duplicated span then merges in
 *    {@link graphFromSegments}),
 *  - existing vertices that lie in an edge's interior (T-junctions).
 *
 * O(E^2 + V*E). Crease patterns in the tens of thousands of edges are fine;
 * a sweepline is the upgrade path if dense tessellations get slow.
 */
export function planarize(
  graph: CreaseGraph,
  options: PlanarizeOptions = {},
): BuildResult {
  const epsilon = options.epsilon ?? COORD_EPSILON;
  const geomEpsilon = options.geomEpsilon ?? GEOM_EPSILON;

  const ends: { a: Vec2; b: Vec2 }[] = graph.edges.map((edge) => ({
    a: graph.vertices[edge[0]]!,
    b: graph.vertices[edge[1]]!,
  }));
  const splits: number[][] = graph.edges.map(() => []);

  const addSplit = (edgeId: number, t: number): void => {
    const { a, b } = ends[edgeId]!;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length === 0) return;
    const pad = geomEpsilon / length;
    if (t <= pad || t >= 1 - pad) return;
    splits[edgeId]!.push(t);
  };

  for (let i = 0; i < ends.length; i += 1) {
    const ei = ends[i]!;
    for (let j = i + 1; j < ends.length; j += 1) {
      const ej = ends[j]!;
      const hit = intersectSegments(ei.a, ei.b, ej.a, ej.b, geomEpsilon);
      if (hit.kind === "point") {
        addSplit(i, hit.tA);
        addSplit(j, hit.tB);
      } else if (hit.kind === "collinear") {
        addSplit(i, hit.tA0);
        addSplit(i, hit.tA1);
        const back = intersectSegments(ej.a, ej.b, ei.a, ei.b, geomEpsilon);
        if (back.kind === "collinear") {
          addSplit(j, back.tA0);
          addSplit(j, back.tA1);
        }
      }
    }
  }

  // T-junctions: a vertex sitting on another edge without splitting it.
  graph.vertices.forEach((vertex, vertexId) => {
    ends.forEach(({ a, b }, edgeId) => {
      const edge = graph.edges[edgeId]!;
      if (edge[0] === vertexId || edge[1] === vertexId) return;
      const { t, distance } = projectOntoSegment(vertex, a, b);
      if (distance <= geomEpsilon) addSplit(edgeId, t);
    });
  });

  const segments: Segment[] = [];
  ends.forEach(({ a, b }, edgeId) => {
    const assignment = graph.assignments[edgeId] ?? "U";
    const ts = [...new Set(splits[edgeId])].sort((x, y) => x - y);
    let previous: Vec2 = a;
    const pointAt = (t: number): Vec2 => [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
    ];
    for (const t of ts) {
      const point = pointAt(t);
      segments.push({
        x1: previous[0],
        y1: previous[1],
        x2: point[0],
        y2: point[1],
        assignment,
      });
      previous = point;
    }
    segments.push({
      x1: previous[0],
      y1: previous[1],
      x2: b[0],
      y2: b[1],
      assignment,
    });
  });

  return graphFromSegments(segments, { epsilon });
}
