import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import {
  boundingBox,
  compareLex,
  roundCanonical,
  type Vec2,
} from "../geometry/vec.js";
import type { CreaseGraph, EdgeAssignment } from "../graph/types.js";
import { KAMI_KEY_ORDER, withGeometry } from "../kami/document.js";
import type { FoldDocument } from "../kami/schema.js";

export interface CanonicalizeOptions {
  /**
   * Translate and uniformly scale the pattern into `[0,1]²` (DESIGN.md §2.4.3
   * and §2.5). Default `true`.
   */
  readonly normalize?: boolean;
}

/**
 * Canonicalize a crease pattern (DESIGN.md §2.5).
 *
 * - coordinates normalized to `[0,1]²` and rounded to 9 decimal places
 * - vertices merged when they land on the same rounded coordinate, then sorted
 *   lexicographically by `(x, y)`; edges re-indexed to match
 * - every edge stored with `v0 < v1`; the edge list sorted lexicographically
 * - faces rotated to start at their lowest vertex index, then sorted
 *
 * Scaling is *uniform* — the larger bounding-box side maps to `[0,1]` and the
 * other keeps its aspect ratio. §2.5 says "normalized to `[0,1]²`" while §2.4.3
 * says "the paper's bounding box for non-square paper"; stretching each axis
 * independently would deform non-square paper and silently change the pattern's
 * angles, which would break every flat-foldability check downstream.
 *
 * Degenerate edges (zero length, duplicates) are *kept*: canonicalization is a
 * re-representation, not a repair, and hiding a defect from the validator would
 * make the L1 grade a lie.
 */
export function canonicalizeGraph(
  graph: CreaseGraph,
  options: CanonicalizeOptions = {},
): CreaseGraph {
  const normalize = options.normalize ?? true;

  let points: Vec2[] = graph.vertices.map((v) => [v[0], v[1]]);
  if (normalize && points.length > 0) {
    const { min, max } = boundingBox(points);
    const extent = Math.max(max[0] - min[0], max[1] - min[1]);
    const scale = extent > 0 ? 1 / extent : 1;
    points = points.map(([x, y]) => [(x - min[0]) * scale, (y - min[1]) * scale]);
  }
  points = points.map(([x, y]) => [roundCanonical(x), roundCanonical(y)]);

  // Merge vertices that share a rounded coordinate; 9 decimal places is the
  // 1e-9 dedup epsilon of §2.4.5 expressed as a grid.
  const canonicalIdOf = new Map<string, number>();
  const oldToNew = new Array<number>(points.length);
  const merged: Vec2[] = [];
  points.forEach((p, i) => {
    const key = `${p[0]},${p[1]}`;
    const existing = canonicalIdOf.get(key);
    if (existing !== undefined) {
      oldToNew[i] = existing;
      return;
    }
    const id = merged.length;
    canonicalIdOf.set(key, id);
    merged.push(p);
    oldToNew[i] = id;
  });

  // Sort lexicographically, then build the merged-id -> canonical-id map.
  const order = merged.map((_, i) => i);
  order.sort((a, b) => compareLex(merged[a]!, merged[b]!) || a - b);
  const finalId = new Array<number>(merged.length);
  order.forEach((mergedId, position) => {
    finalId[mergedId] = position;
  });
  const vertices: Vec2[] = order.map((mergedId) => merged[mergedId]!);

  interface EdgeRecord {
    a: number;
    b: number;
    assignment: EdgeAssignment;
    foldAngle: number | null;
  }
  const records: EdgeRecord[] = graph.edges.map((edge, i) => {
    const a = finalId[oldToNew[edge[0]] ?? 0] ?? 0;
    const b = finalId[oldToNew[edge[1]] ?? 0] ?? 0;
    return {
      a: Math.min(a, b),
      b: Math.max(a, b),
      assignment: graph.assignments[i] ?? "U",
      foldAngle: graph.foldAngles?.[i] ?? null,
    };
  });
  records.sort(
    (x, y) =>
      x.a - y.a ||
      x.b - y.b ||
      (x.assignment < y.assignment ? -1 : x.assignment > y.assignment ? 1 : 0),
  );

  const canonical: CreaseGraph = {
    vertices,
    edges: records.map((r) => [r.a, r.b] as const),
    assignments: records.map((r) => r.assignment),
    foldAngles: records.map((r) => r.foldAngle),
  };

  if (!graph.faces) return canonical;

  const faces = graph.faces
    .map((face) => {
      const remapped = face.map((v) => finalId[oldToNew[v] ?? 0] ?? 0);
      return rotateToLowest(remapped);
    })
    .sort(compareIndexLists);
  return { ...canonical, faces };
}

/** Rotate a cycle so it starts at its lowest index, preserving direction. */
function rotateToLowest(cycle: readonly number[]): number[] {
  if (cycle.length === 0) return [];
  let best = 0;
  for (let i = 1; i < cycle.length; i += 1) {
    if (cycle[i]! < cycle[best]!) best = i;
  }
  return [...cycle.slice(best), ...cycle.slice(0, best)];
}

function compareIndexLists(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    if (a[i] !== b[i]) return a[i]! - b[i]!;
  }
  return a.length - b.length;
}

/**
 * The exact byte sequence hashed by {@link contentHash}: the canonical
 * geometry arrays and nothing else.
 *
 * Faces and fold angles are excluded as well as metadata. Faces are derived
 * from the vertices and edges by face-finding, and fold angles are derived from
 * the assignments for a flat-folded pattern; including either would make the
 * same pattern hash differently depending on how far through ingest it had
 * got, which defeats the dedup this hash exists for.
 */
export function canonicalGeometryPayload(graph: CreaseGraph): string {
  const canonical = isCanonical(graph) ? graph : canonicalizeGraph(graph);
  const parts = [
    `"vertices_coords":${JSON.stringify(canonical.vertices.map((v) => [v[0], v[1]]))}`,
    `"edges_vertices":${JSON.stringify(canonical.edges.map(([a, b]) => [a, b]))}`,
    `"edges_assignment":${JSON.stringify(canonical.assignments)}`,
  ];
  return `{${parts.join(",")}}`;
}

/**
 * `kami:contentHash` — SHA-256 over the canonical geometry arrays only, so the
 * same pattern uploaded with different tags is recognized as the same pattern
 * (DESIGN.md §2.5).
 */
export function contentHash(graph: CreaseGraph): string {
  const payload = canonicalGeometryPayload(graph);
  return bytesToHex(sha256(new TextEncoder().encode(payload)));
}

/** Cheap check that a graph is already in canonical form. */
export function isCanonical(graph: CreaseGraph): boolean {
  for (let i = 1; i < graph.vertices.length; i += 1) {
    if (compareLex(graph.vertices[i - 1]!, graph.vertices[i]!) >= 0) return false;
  }
  for (const [a, b] of graph.edges) {
    if (a > b) return false;
  }
  for (let i = 1; i < graph.edges.length; i += 1) {
    const p = graph.edges[i - 1]!;
    const q = graph.edges[i]!;
    if (p[0] > q[0] || (p[0] === q[0] && p[1] > q[1])) return false;
  }
  for (const v of graph.vertices) {
    if (roundCanonical(v[0]) !== v[0] || roundCanonical(v[1]) !== v[1]) return false;
  }
  return true;
}

const KEY_RANK = new Map(KAMI_KEY_ORDER.map((key, i) => [key, i]));

function orderedKeys(object: Record<string, unknown>): string[] {
  return Object.keys(object).sort((a, b) => {
    const ra = KEY_RANK.get(a);
    const rb = KEY_RANK.get(b);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/**
 * Serialize with keys in a fixed order and no insignificant whitespace
 * (DESIGN.md §2.5). Keys the spec names come first in spec order; anything
 * else — including other tools' `prefix:name` extensions — follows in
 * alphabetical order so unknown data still round-trips deterministically.
 */
export function serializeCanonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeCanonical(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of orderedKeys(record)) {
    const entry = record[key];
    if (entry === undefined) continue;
    parts.push(`${JSON.stringify(key)}:${serializeCanonical(entry)}`);
  }
  return `{${parts.join(",")}}`;
}

export interface CanonicalizedDocument<T extends FoldDocument> {
  readonly document: T;
  readonly graph: CreaseGraph;
  readonly contentHash: string;
  readonly json: string;
}

/**
 * Canonicalize a whole document: rewrite its geometry in canonical form, stamp
 * `kami:contentHash`, and emit the canonical JSON bytes.
 */
export function canonicalizeDocument<T extends FoldDocument>(
  doc: T,
  graph: CreaseGraph,
  options: CanonicalizeOptions = {},
): CanonicalizedDocument<T> {
  const canonical = canonicalizeGraph(graph, options);
  const hash = contentHash(canonical);
  const withArrays = withGeometry(doc, canonical) as Record<string, unknown>;
  withArrays["kami:contentHash"] = hash;
  const document = withArrays as T;
  return {
    document,
    graph: canonical,
    contentHash: hash,
    json: serializeCanonical(document),
  };
}
