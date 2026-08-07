import {
  COORD_EPSILON,
  GEOM_EPSILON,
  boundingBox,
  distance,
  intersectSegments,
  pointInPolygon,
  projectOntoSegment,
  signedArea,
  type Vec2,
} from "../geometry/vec.js";
import { VertexIndex } from "../graph/build.js";
import { buildVertexEdges, type CreaseGraph } from "../graph/types.js";
import type { FoldDocument } from "../kami/schema.js";
import { MULTI_BOUNDARY_ATTRIBUTE } from "../kami/schema.js";
import { extractGraph } from "../kami/document.js";
import { toReport, type Defect, type ValidationReport } from "./defects.js";

export interface ValidateOptions {
  /** Vertex coincidence tolerance (DESIGN.md §2.4.5). Default `1e-9`. */
  readonly epsilon?: number;
  /** Predicate tolerance for crossings. Default `1e-9`. */
  readonly geomEpsilon?: number;
  /**
   * Tolerance for the `[0,1]²` bounds check. Coordinates are stored rounded to
   * 9 decimals, so the check has to be looser than the rounding. Default `1e-6`.
   */
  readonly normalizationTolerance?: number;
  /**
   * Allow several boundary loops even without the `multiBoundary` frame
   * attribute. Default `false`.
   */
  readonly allowMultiBoundary?: boolean;
  /**
   * Require coordinates to be normalized (§2.4.3). Turn off to validate a
   * pattern still in source units. Default `true`.
   */
  readonly requireNormalized?: boolean;
}

/**
 * Validate the geometric rules of DESIGN.md §2.4 (rules 3–6, plus face
 * consistency) against a {@link CreaseGraph}.
 *
 * Returns a typed defect list; it never throws on bad geometry. Crossing
 * detection is O(E²) — fine into the tens of thousands of edges, and a
 * sweepline is the upgrade path for dense tessellations.
 */
export function validateGraph(
  graph: CreaseGraph,
  options: ValidateOptions = {},
): ValidationReport {
  const epsilon = options.epsilon ?? COORD_EPSILON;
  const geomEpsilon = options.geomEpsilon ?? GEOM_EPSILON;
  const normTolerance = options.normalizationTolerance ?? 1e-6;
  const requireNormalized = options.requireNormalized ?? true;

  const defects: Defect[] = [];

  if (graph.assignments.length !== graph.edges.length) {
    defects.push({
      code: "array-length-mismatch",
      severity: "error",
      rule: "§2.4.1",
      message:
        `${graph.edges.length} edges but ${graph.assignments.length} assignments`,
    });
  }
  if (graph.foldAngles && graph.foldAngles.length !== graph.edges.length) {
    defects.push({
      code: "array-length-mismatch",
      severity: "error",
      rule: "§2.4.1",
      message:
        `${graph.edges.length} edges but ${graph.foldAngles.length} fold angles`,
    });
  }

  checkNormalization(graph, defects, requireNormalized, normTolerance);
  checkDegeneracies(graph, defects, epsilon);
  checkCrossings(graph, defects, geomEpsilon);
  checkBoundary(graph, defects, options.allowMultiBoundary ?? false, geomEpsilon);
  checkConnectivity(graph, defects);
  checkFaces(graph, defects);
  checkUnassigned(graph, defects);

  return toReport(defects);
}

function checkNormalization(
  graph: CreaseGraph,
  defects: Defect[],
  require: boolean,
  tolerance: number,
): void {
  if (!require || graph.vertices.length === 0) return;
  const outside: number[] = [];
  graph.vertices.forEach(([x, y], i) => {
    if (x < -tolerance || x > 1 + tolerance || y < -tolerance || y > 1 + tolerance) {
      outside.push(i);
    }
  });
  if (outside.length > 0) {
    defects.push({
      code: "coordinates-not-normalized",
      severity: "error",
      rule: "§2.4.3",
      message:
        `${outside.length} vertex/vertices lie outside the unit square; ` +
        "coordinates must be normalized to [0,1]² (scale belongs in kami:paper.recommendedSizeMm)",
      vertices: outside,
      ...(graph.vertices[outside[0]!] ? { at: graph.vertices[outside[0]!]! } : {}),
    });
    return;
  }
  const { min, max } = boundingBox(graph.vertices);
  const extent = Math.max(max[0] - min[0], max[1] - min[1]);
  if (Math.abs(extent - 1) > tolerance) {
    defects.push({
      code: "coordinates-not-normalized",
      severity: "error",
      rule: "§2.4.3",
      message:
        `the pattern's bounding box spans ${extent.toPrecision(6)} of the unit ` +
        "square; its longer side must span exactly [0,1]",
    });
  }
}

function checkDegeneracies(
  graph: CreaseGraph,
  defects: Defect[],
  epsilon: number,
): void {
  const zeroLength: number[] = [];
  const duplicates: number[] = [];
  const seen = new Map<string, number>();

  graph.edges.forEach(([a, b], i) => {
    const pa = graph.vertices[a];
    const pb = graph.vertices[b];
    if (a === b || (pa && pb && distance(pa, pb) <= epsilon)) zeroLength.push(i);
    const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
    const first = seen.get(key);
    if (first === undefined) seen.set(key, i);
    else duplicates.push(i);
  });

  if (zeroLength.length > 0) {
    const edge = graph.edges[zeroLength[0]!];
    const at = edge ? graph.vertices[edge[0]] : undefined;
    defects.push({
      code: "zero-length-edge",
      severity: "error",
      rule: "§2.4.5",
      message: `${zeroLength.length} edge(s) have zero length`,
      edges: zeroLength,
      ...(at ? { at } : {}),
    });
  }
  if (duplicates.length > 0) {
    defects.push({
      code: "duplicate-edge",
      severity: "error",
      rule: "§2.4.5",
      message: `${duplicates.length} edge(s) duplicate an earlier edge`,
      edges: duplicates,
    });
  }

  // Vertices that should have been merged (§2.4.5, epsilon = 1e-9).
  const index = new VertexIndex(epsilon);
  const coincident: number[] = [];
  graph.vertices.forEach((v, i) => {
    const before = index.vertices.length;
    const id = index.add(v);
    if (index.vertices.length === before && id !== i) coincident.push(i);
  });
  if (coincident.length > 0) {
    defects.push({
      code: "coincident-vertices",
      severity: "error",
      rule: "§2.4.5",
      message:
        `${coincident.length} vertex/vertices duplicate another within ${epsilon}`,
      vertices: coincident,
      ...(graph.vertices[coincident[0]!] ? { at: graph.vertices[coincident[0]!]! } : {}),
    });
  }
}

function checkCrossings(
  graph: CreaseGraph,
  defects: Defect[],
  geomEpsilon: number,
): void {
  const ends = graph.edges.map((edge) => ({
    a: graph.vertices[edge[0]],
    b: graph.vertices[edge[1]],
  }));

  const crossings: [number, number][] = [];
  const overlaps: [number, number][] = [];
  let firstCrossingAt: Vec2 | undefined;

  for (let i = 0; i < ends.length; i += 1) {
    const ei = ends[i]!;
    if (!ei.a || !ei.b) continue;
    const lenI = distance(ei.a, ei.b);
    if (lenI === 0) continue;
    for (let j = i + 1; j < ends.length; j += 1) {
      const ej = ends[j]!;
      if (!ej.a || !ej.b) continue;
      const lenJ = distance(ej.a, ej.b);
      if (lenJ === 0) continue;
      const hit = intersectSegments(ei.a, ei.b, ej.a, ej.b, geomEpsilon);
      if (hit.kind === "collinear") {
        overlaps.push([i, j]);
        continue;
      }
      if (hit.kind !== "point") continue;
      const padI = geomEpsilon / lenI;
      const padJ = geomEpsilon / lenJ;
      const interiorI = hit.tA > padI && hit.tA < 1 - padI;
      const interiorJ = hit.tB > padJ && hit.tB < 1 - padJ;
      // A shared endpoint is normal; a hit in the interior of either edge is
      // a crossing that was never resolved into a vertex.
      if (interiorI || interiorJ) {
        crossings.push([i, j]);
        firstCrossingAt ??= hit.point;
      }
    }
  }

  if (crossings.length > 0) {
    defects.push({
      code: "crossing-without-vertex",
      severity: "error",
      rule: "§2.4.6",
      message:
        `${crossings.length} pair(s) of edges cross without a vertex at the ` +
        "crossing; split them (this is the defect that most often breaks simulation)",
      edges: [...new Set(crossings.flat())],
      ...(firstCrossingAt ? { at: firstCrossingAt } : {}),
    });
  }
  if (overlaps.length > 0) {
    defects.push({
      code: "overlapping-edges",
      severity: "error",
      rule: "§2.4.6",
      message: `${overlaps.length} pair(s) of edges are collinear and overlap`,
      edges: [...new Set(overlaps.flat())],
    });
  }

  // T-junctions: a vertex lying in an edge's interior without splitting it.
  const tJunctionEdges: number[] = [];
  const tJunctionVertices: number[] = [];
  graph.vertices.forEach((vertex, vertexId) => {
    ends.forEach(({ a, b }, edgeId) => {
      if (!a || !b) return;
      const edge = graph.edges[edgeId]!;
      if (edge[0] === vertexId || edge[1] === vertexId) return;
      const length = distance(a, b);
      if (length === 0) return;
      const { t, distance: gap } = projectOntoSegment(vertex, a, b);
      const pad = geomEpsilon / length;
      if (gap <= geomEpsilon && t > pad && t < 1 - pad) {
        tJunctionEdges.push(edgeId);
        tJunctionVertices.push(vertexId);
      }
    });
  });
  if (tJunctionEdges.length > 0) {
    defects.push({
      code: "vertex-on-edge-interior",
      severity: "error",
      rule: "§2.4.6",
      message:
        `${tJunctionEdges.length} vertex/edge T-junction(s): a vertex lies on ` +
        "an edge that was not split there",
      edges: [...new Set(tJunctionEdges)],
      vertices: [...new Set(tJunctionVertices)],
      ...(graph.vertices[tJunctionVertices[0]!]
        ? { at: graph.vertices[tJunctionVertices[0]!]! }
        : {}),
    });
  }
}

/** Trace the `B` subgraph; used by the boundary rule and by the grader. */
export interface BoundaryAnalysis {
  /** Closed loops of boundary vertices, each in traversal order. */
  readonly loops: number[][];
  /** Vertices whose boundary degree is not exactly 2. */
  readonly brokenVertices: number[];
  /** Vertex ids that touch at least one `B` edge. */
  readonly boundaryVertices: ReadonlySet<number>;
  readonly boundaryEdgeCount: number;
}

export function analyzeBoundary(graph: CreaseGraph): BoundaryAnalysis {
  const adjacency = new Map<number, { to: number; edge: number }[]>();
  const boundaryVertices = new Set<number>();
  let boundaryEdgeCount = 0;

  graph.edges.forEach((edge, edgeId) => {
    if (graph.assignments[edgeId] !== "B") return;
    boundaryEdgeCount += 1;
    const [a, b] = edge;
    boundaryVertices.add(a);
    boundaryVertices.add(b);
    if (!adjacency.has(a)) adjacency.set(a, []);
    if (!adjacency.has(b)) adjacency.set(b, []);
    adjacency.get(a)!.push({ to: b, edge: edgeId });
    adjacency.get(b)!.push({ to: a, edge: edgeId });
  });

  const brokenVertices: number[] = [];
  for (const [vertex, links] of adjacency) {
    if (links.length !== 2) brokenVertices.push(vertex);
  }

  const loops: number[][] = [];
  const usedEdges = new Set<number>();
  for (const [start, links] of adjacency) {
    if (links.length !== 2) continue;
    for (const first of links) {
      if (usedEdges.has(first.edge)) continue;
      const loop = [start];
      let previousEdge = first.edge;
      let current = first.to;
      usedEdges.add(first.edge);
      let closed = false;
      while (current !== start) {
        loop.push(current);
        const next = adjacency
          .get(current)
          ?.find((link) => link.edge !== previousEdge && !usedEdges.has(link.edge));
        if (!next) break;
        usedEdges.add(next.edge);
        previousEdge = next.edge;
        current = next.to;
      }
      if (current === start) closed = true;
      if (closed && loop.length >= 3) loops.push(loop);
    }
  }

  return {
    loops,
    brokenVertices: brokenVertices.sort((a, b) => a - b),
    boundaryVertices,
    boundaryEdgeCount,
  };
}

function checkBoundary(
  graph: CreaseGraph,
  defects: Defect[],
  allowMultiBoundary: boolean,
  geomEpsilon: number,
): void {
  if (graph.edges.length === 0) return;
  const analysis = analyzeBoundary(graph);

  if (analysis.boundaryEdgeCount === 0) {
    defects.push({
      code: "boundary-missing",
      severity: "error",
      rule: "§2.4.4",
      message: "no edges are assigned B; the paper boundary is undeclared",
    });
    return;
  }

  if (analysis.brokenVertices.length > 0) {
    const first = analysis.brokenVertices[0]!;
    defects.push({
      code: "boundary-not-closed",
      severity: "error",
      rule: "§2.4.4",
      message:
        `${analysis.brokenVertices.length} boundary vertex/vertices have a B-degree ` +
        "other than 2; the boundary must be a closed loop",
      vertices: analysis.brokenVertices,
      ...(graph.vertices[first] ? { at: graph.vertices[first]! } : {}),
    });
    return;
  }

  if (analysis.loops.length === 0) {
    defects.push({
      code: "boundary-not-closed",
      severity: "error",
      rule: "§2.4.4",
      message: "the B edges do not form a closed loop",
    });
    return;
  }

  if (analysis.loops.length > 1) {
    defects.push({
      code: "boundary-multiple-loops",
      severity: allowMultiBoundary ? "warning" : "error",
      rule: "§2.4.4",
      message:
        `the boundary is ${analysis.loops.length} separate loops (a hole in the ` +
        `border); declare it by adding "${MULTI_BOUNDARY_ATTRIBUTE}" to ` +
        "frame_attributes if it is intentional",
    });
  }

  // The outermost loop must enclose everything else.
  const polygons = analysis.loops.map((loop) =>
    loop.map((v) => graph.vertices[v]!).filter(Boolean),
  );
  let outer = polygons[0]!;
  let outerArea = Math.abs(signedArea(outer));
  for (const polygon of polygons.slice(1)) {
    const area = Math.abs(signedArea(polygon));
    if (area > outerArea) {
      outer = polygon;
      outerArea = area;
    }
  }
  const strays: number[] = [];
  graph.vertices.forEach((vertex, i) => {
    if (!pointInPolygon(vertex, outer, geomEpsilon)) strays.push(i);
  });
  if (strays.length > 0) {
    defects.push({
      code: "boundary-not-enclosing",
      severity: "error",
      rule: "§2.4.4",
      message:
        `${strays.length} vertex/vertices lie outside the boundary loop; the ` +
        "boundary must enclose the whole pattern",
      vertices: strays,
      ...(graph.vertices[strays[0]!] ? { at: graph.vertices[strays[0]!]! } : {}),
    });
  }
}

function checkConnectivity(graph: CreaseGraph, defects: Defect[]): void {
  const incident = buildVertexEdges(graph);
  const isolated: number[] = [];
  const dangling: number[] = [];
  incident.forEach((edges, vertexId) => {
    if (edges.length === 0) isolated.push(vertexId);
    else if (edges.length === 1) dangling.push(vertexId);
  });
  if (isolated.length > 0) {
    defects.push({
      code: "isolated-vertex",
      severity: "warning",
      rule: "§2.4",
      message: `${isolated.length} vertex/vertices have no incident edges`,
      vertices: isolated,
    });
  }
  if (dangling.length > 0) {
    defects.push({
      code: "dangling-edge",
      severity: "warning",
      rule: "§2.4",
      message:
        `${dangling.length} vertex/vertices have exactly one incident edge; ` +
        "a crease that stops in the middle of the paper cannot fold",
      vertices: dangling,
      ...(graph.vertices[dangling[0]!] ? { at: graph.vertices[dangling[0]!]! } : {}),
    });
  }
}

function checkFaces(graph: CreaseGraph, defects: Defect[]): void {
  if (!graph.faces) return;
  const edgeKeys = new Set(
    graph.edges.map(([a, b]) => `${Math.min(a, b)}:${Math.max(a, b)}`),
  );
  const broken: number[] = [];
  graph.faces.forEach((face, faceId) => {
    if (face.length < 3) {
      broken.push(faceId);
      return;
    }
    for (let i = 0; i < face.length; i += 1) {
      const a = face[i]!;
      const b = face[(i + 1) % face.length]!;
      if (
        a < 0 ||
        b < 0 ||
        a >= graph.vertices.length ||
        b >= graph.vertices.length ||
        !edgeKeys.has(`${Math.min(a, b)}:${Math.max(a, b)}`)
      ) {
        broken.push(faceId);
        return;
      }
    }
  });
  if (broken.length > 0) {
    defects.push({
      code: "face-not-a-cycle",
      severity: "error",
      rule: "§2.4",
      message:
        `${broken.length} face(s) in faces_vertices are not closed cycles of ` +
        "existing edges",
      faces: broken,
    });
  }
}

function checkUnassigned(graph: CreaseGraph, defects: Defect[]): void {
  const unassigned: number[] = [];
  graph.assignments.forEach((assignment, i) => {
    if (assignment === "U") unassigned.push(i);
  });
  if (unassigned.length > 0) {
    defects.push({
      code: "unassigned-edge",
      severity: "warning",
      rule: "§3.4",
      message:
        `${unassigned.length} edge(s) are unassigned (U); the pattern renders ` +
        "but cannot be driven by the simulator",
      edges: unassigned,
    });
  }
}

/** Required `kami:` metadata, per DESIGN.md §2.4.7. */
function checkRequiredMetadata(doc: FoldDocument, defects: Defect[]): void {
  const record = doc as Record<string, unknown>;
  const missing: string[] = [];
  if (typeof record["kami:version"] !== "string") missing.push("kami:version");
  const license = record["kami:license"];
  if (license === null || typeof license !== "object") missing.push("kami:license");
  const paper = record["kami:paper"];
  if (paper === null || typeof paper !== "object") {
    missing.push("kami:paper.shape");
  } else if (typeof (paper as Record<string, unknown>)["shape"] !== "string") {
    missing.push("kami:paper.shape");
  }
  if (missing.length > 0) {
    defects.push({
      code: "missing-required-metadata",
      severity: "error",
      rule: "§2.4.7",
      message: `missing required field(s): ${missing.join(", ")}`,
    });
  }
}

/**
 * Validate a whole document against DESIGN.md §2.4.
 *
 * Reads the geometry arrays (rules 1–3), then applies the geometric rules and
 * the required-metadata rule. Never throws: a document that is not even shaped
 * like FOLD comes back as a `missing-geometry` defect.
 */
export function validateStructure(
  doc: FoldDocument,
  options: ValidateOptions = {},
): ValidationReport {
  const { graph, defects } = extractGraph(doc);
  const all = [...defects];
  checkRequiredMetadata(doc, all);
  if (graph) {
    const attributes = Array.isArray(doc.frame_attributes)
      ? doc.frame_attributes
      : [];
    const allowMultiBoundary =
      options.allowMultiBoundary ?? attributes.includes(MULTI_BOUNDARY_ATTRIBUTE);
    all.push(
      ...validateGraph(graph, { ...options, allowMultiBoundary }).defects,
    );
  }
  return toReport(all);
}

/** Convenience: validate and return the extracted graph alongside the report. */
export function validateDocument(
  doc: FoldDocument,
  options: ValidateOptions = {},
): { report: ValidationReport; graph: CreaseGraph | null } {
  const { graph } = extractGraph(doc);
  return { report: validateStructure(doc, options), graph };
}
