import {
  COORD_EPSILON,
  distanceSq,
  type Vec2,
} from "../geometry/vec.js";
import {
  defaultFoldAngle,
  type CreaseGraph,
  type EdgeAssignment,
  type Segment,
} from "./types.js";

/**
 * Assignment precedence used when two coincident segments disagree. A boundary
 * declaration is the strongest claim a source can make; `U` is the weakest and
 * always loses (DESIGN.md §3.4: never overwrite a real assignment with a
 * guess, but do let a real assignment overwrite "unknown").
 */
const ASSIGNMENT_RANK: Record<EdgeAssignment, number> = {
  B: 6,
  C: 5,
  M: 4,
  V: 4,
  J: 3,
  F: 2,
  U: 1,
};

export interface BuildOptions {
  /** Vertices closer than this are merged. Defaults to `1e-9`. */
  readonly epsilon?: number;
}

export interface BuildResult {
  readonly graph: CreaseGraph;
  /** Non-fatal observations, e.g. dropped zero-length or duplicate segments. */
  readonly warnings: string[];
}

/**
 * A point set with epsilon-merge, backed by a uniform grid so ingest stays
 * near-linear instead of quadratic in the vertex count.
 */
export class VertexIndex {
  private readonly cells = new Map<string, number[]>();
  private readonly points: Vec2[] = [];
  private readonly cellSize: number;
  private readonly epsilonSq: number;

  constructor(private readonly epsilon: number = COORD_EPSILON) {
    this.cellSize = Math.max(epsilon, Number.MIN_VALUE) * 2;
    this.epsilonSq = epsilon * epsilon;
  }

  get vertices(): readonly Vec2[] {
    return this.points;
  }

  /** Index of an existing vertex within epsilon of `p`, or `undefined`. */
  find(p: Vec2): number | undefined {
    const cx = Math.floor(p[0] / this.cellSize);
    const cy = Math.floor(p[1] / this.cellSize);
    let best: number | undefined;
    let bestDist = Infinity;
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const bucket = this.cells.get(`${cx + dx}:${cy + dy}`);
        if (!bucket) continue;
        for (const id of bucket) {
          const d = distanceSq(p, this.points[id]!);
          if (d <= this.epsilonSq && d < bestDist) {
            best = id;
            bestDist = d;
          }
        }
      }
    }
    return best;
  }

  /** Index of `p`, inserting it if no vertex is within epsilon. */
  add(p: Vec2): number {
    const existing = this.find(p);
    if (existing !== undefined) return existing;
    const id = this.points.length;
    this.points.push(p);
    const key = `${Math.floor(p[0] / this.cellSize)}:${Math.floor(p[1] / this.cellSize)}`;
    const bucket = this.cells.get(key);
    if (bucket) bucket.push(id);
    else this.cells.set(key, [id]);
    return id;
  }
}

/**
 * Turn a flat list of typed segments, the normalized intermediate every
 * parser produces (DESIGN.md §3.2), into a {@link CreaseGraph}.
 *
 * Deduplicates vertices within epsilon, drops zero-length segments and merges
 * duplicate edges. It deliberately does *not* split crossings; that is
 * {@link planarize}'s job, so callers can validate raw input if they want to.
 */
export function graphFromSegments(
  segments: readonly Segment[],
  options: BuildOptions = {},
): BuildResult {
  const epsilon = options.epsilon ?? COORD_EPSILON;
  const index = new VertexIndex(epsilon);
  const warnings: string[] = [];

  const edgeMap = new Map<string, number>();
  const edges: [number, number][] = [];
  const assignments: EdgeAssignment[] = [];

  segments.forEach((segment, i) => {
    const a = index.add([segment.x1, segment.y1]);
    const b = index.add([segment.x2, segment.y2]);
    if (a === b) {
      warnings.push(`segment ${i}: dropped zero-length segment`);
      return;
    }
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const key = `${lo}:${hi}`;
    const existing = edgeMap.get(key);
    if (existing === undefined) {
      edgeMap.set(key, edges.length);
      edges.push([lo, hi]);
      assignments.push(segment.assignment);
      return;
    }
    const previous = assignments[existing]!;
    const next = segment.assignment;
    if (previous !== next) {
      warnings.push(
        `segment ${i}: duplicate edge with conflicting assignment ` +
          `(${previous} vs ${next}); kept ${
            ASSIGNMENT_RANK[next] > ASSIGNMENT_RANK[previous] ? next : previous
          }`,
      );
      if (ASSIGNMENT_RANK[next] > ASSIGNMENT_RANK[previous]) {
        assignments[existing] = next;
      }
    } else {
      warnings.push(`segment ${i}: dropped duplicate edge`);
    }
  });

  const graph: CreaseGraph = {
    vertices: index.vertices.map((v) => [v[0], v[1]] as Vec2),
    edges,
    assignments,
    foldAngles: assignments.map(defaultFoldAngle),
  };
  return { graph, warnings };
}

/** Segments for a graph, in edge order. Inverse of {@link graphFromSegments}. */
export function segmentsFromGraph(graph: CreaseGraph): Segment[] {
  return graph.edges.map((edge, i) => {
    const a = graph.vertices[edge[0]]!;
    const b = graph.vertices[edge[1]]!;
    return {
      x1: a[0],
      y1: a[1],
      x2: b[0],
      y2: b[1],
      assignment: graph.assignments[i] ?? "U",
    };
  });
}
