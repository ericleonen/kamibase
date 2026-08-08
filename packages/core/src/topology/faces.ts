import {
  angleOf,
  normalizeAngle,
  signedArea,
  type Vec2,
} from "../geometry/vec.js";
import { buildVertexEdges, otherEnd, type CreaseGraph } from "../graph/types.js";

/** Neighbours of each vertex, sorted counter-clockwise by outgoing angle. */
export interface RotationSystem {
  /** `neighbours[v]` = target vertex ids around `v`, CCW from angle 0. */
  readonly neighbours: readonly (readonly number[])[];
  /** `edgeIds[v][k]` = edge id of `neighbours[v][k]`. */
  readonly edgeIds: readonly (readonly number[])[];
}

/**
 * Build the planar rotation system: the cyclic CCW order of edges around each
 * vertex. This is the combinatorial embedding face-finding walks.
 */
export function buildRotationSystem(graph: CreaseGraph): RotationSystem {
  const incident = buildVertexEdges(graph);
  const neighbours: number[][] = [];
  const edgeIds: number[][] = [];

  incident.forEach((edges, vertexId) => {
    const origin = graph.vertices[vertexId]!;
    const entries = edges
      .map((edgeId) => {
        const target = otherEnd(graph.edges[edgeId]!, vertexId);
        const point = graph.vertices[target]!;
        return {
          edgeId,
          target,
          angle: normalizeAngle(angleOf(origin, point)),
        };
      })
      .sort((a, b) => a.angle - b.angle || a.edgeId - b.edgeId);
    neighbours.push(entries.map((e) => e.target));
    edgeIds.push(entries.map((e) => e.edgeId));
  });

  return { neighbours, edgeIds };
}

export interface FaceFindingResult {
  /** Interior faces as counter-clockwise vertex loops. */
  readonly faces: number[][];
  /** The clockwise outer loop(s), one per connected component. */
  readonly outerLoops: number[][];
}

/**
 * Planar face-finding.
 *
 * DESIGN.md §2.4 requires this: "Faces are not required on upload. We compute
 * them via planar face-finding during ingest, because most sources don't
 * provide them."
 *
 * Walks every directed half-edge exactly once. The successor of `u -> v` is
 * `v -> w`, where `w` is the neighbour of `v` immediately clockwise from `u`;
 * that traversal encloses interior faces counter-clockwise (positive signed
 * area) and outer boundaries clockwise, which is how the two are told apart.
 *
 * The graph must already be planar. Run {@link planarize} first, or the faces
 * will be nonsense in the neighbourhood of any unresolved crossing.
 */
export function findFaces(graph: CreaseGraph): FaceFindingResult {
  const { neighbours, edgeIds } = buildRotationSystem(graph);

  // Position of each directed edge (v, k) within its origin's CCW order.
  const slotOf = new Map<string, number>();
  neighbours.forEach((targets, vertexId) => {
    targets.forEach((target, k) => {
      slotOf.set(`${vertexId}>${target}:${edgeIds[vertexId]![k]}`, k);
    });
  });

  const visited = new Set<string>();
  const faces: number[][] = [];
  const outerLoops: number[][] = [];

  const walk = (startFrom: number, startTo: number, startEdge: number): void => {
    const loop: number[] = [];
    let from = startFrom;
    let to = startTo;
    let edgeId = startEdge;

    for (;;) {
      const key = `${from}->${to}:${edgeId}`;
      if (visited.has(key)) break;
      visited.add(key);
      loop.push(from);

      const around = neighbours[to]!;
      const slot = slotOf.get(`${to}>${from}:${edgeId}`);
      if (slot === undefined) break;
      // One step clockwise from the edge we arrived on.
      const nextSlot = (slot - 1 + around.length) % around.length;
      const nextTo = around[nextSlot]!;
      const nextEdge = edgeIds[to]![nextSlot]!;
      from = to;
      to = nextTo;
      edgeId = nextEdge;
      if (from === startFrom && to === startTo && edgeId === startEdge) break;
    }

    if (loop.length < 3) return;
    const points: Vec2[] = loop.map((v) => graph.vertices[v]!);
    const area = signedArea(points);
    if (area > 0) faces.push(loop);
    else outerLoops.push(loop);
  };

  graph.edges.forEach((edge, edgeId) => {
    walk(edge[0], edge[1], edgeId);
    walk(edge[1], edge[0], edgeId);
  });

  return { faces, outerLoops };
}

/** Convenience: return `graph` with `faces` populated by {@link findFaces}. */
export function withFaces(graph: CreaseGraph): CreaseGraph {
  const { faces } = findFaces(graph);
  return { ...graph, faces };
}
