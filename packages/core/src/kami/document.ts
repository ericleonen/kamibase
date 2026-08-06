import { COORD_EPSILON, type Vec2 } from "../geometry/vec.js";
import {
  assignmentFromFoldAngle,
  defaultFoldAngle,
  isEdgeAssignment,
  type CreaseGraph,
  type EdgeAssignment,
} from "../graph/types.js";
import type { Defect } from "../validate/defects.js";
import { CURRENT_KAMI_VERSION, type FoldDocument, type KamiDocument } from "./schema.js";

export interface GeometryExtraction {
  /** `null` when the document has no usable geometry at all. */
  readonly graph: CreaseGraph | null;
  /** Defects found while reading the arrays (§2.4.1–2.4.3). */
  readonly defects: Defect[];
}

/**
 * Read the FOLD geometry arrays into a {@link CreaseGraph}.
 *
 * Tolerant on purpose: a file that is merely *wrong* should still produce a
 * graph plus a defect list, because L0 means "geometry present" and the editor
 * has to be able to show a broken file so someone can fix it.
 */
export function extractGraph(doc: FoldDocument): GeometryExtraction {
  const defects: Defect[] = [];
  const rawVertices = doc.vertices_coords;
  const rawEdges = doc.edges_vertices;

  if (!Array.isArray(rawVertices) || !Array.isArray(rawEdges)) {
    defects.push({
      code: "missing-geometry",
      severity: "error",
      rule: "§2.4.1",
      message:
        "vertices_coords and edges_vertices are both required; " +
        `saw vertices_coords=${describe(rawVertices)}, edges_vertices=${describe(rawEdges)}`,
    });
    return { graph: null, defects };
  }

  const vertices: Vec2[] = [];
  const badDimension: number[] = [];
  const nonPlanar: number[] = [];
  rawVertices.forEach((coords, i) => {
    const x = coords[0] ?? 0;
    const y = coords[1] ?? 0;
    const z = coords[2] ?? 0;
    if (coords.length < 2) badDimension.push(i);
    if (coords.length > 2 && Math.abs(z) > COORD_EPSILON) nonPlanar.push(i);
    vertices.push([x, y]);
  });

  if (badDimension.length > 0) {
    defects.push({
      code: "non-2d-coordinates",
      severity: "error",
      rule: "§2.4.3",
      message: `${badDimension.length} vertex/vertices have fewer than 2 coordinates`,
      vertices: badDimension,
    });
  }
  if (nonPlanar.length > 0) {
    defects.push({
      code: "non-2d-coordinates",
      severity: "error",
      rule: "§2.4.3",
      message:
        `${nonPlanar.length} vertex/vertices have a non-zero z coordinate; ` +
        "a crease pattern frame must be 2D (the z component was dropped)",
      vertices: nonPlanar,
    });
  }

  const rawAssignments = doc.edges_assignment;
  const rawAngles = doc.edges_foldAngle;

  const edges: [number, number][] = [];
  const assignments: EdgeAssignment[] = [];
  const foldAngles: (number | null)[] = [];
  const malformedEdges: number[] = [];
  const outOfRange: number[] = [];
  const invalidAssignments: number[] = [];

  rawEdges.forEach((pair, i) => {
    const a = pair[0];
    const b = pair[1];
    if (typeof a !== "number" || typeof b !== "number" || pair.length !== 2) {
      malformedEdges.push(i);
      return;
    }
    if (
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      a < 0 ||
      b < 0 ||
      a >= vertices.length ||
      b >= vertices.length
    ) {
      outOfRange.push(i);
      return;
    }
    const rawAssignment = rawAssignments?.[i];
    let assignment: EdgeAssignment;
    if (rawAssignments === undefined) {
      // No assignments at all: fall back to fold angles, else unassigned.
      assignment = assignmentFromFoldAngle(rawAngles?.[i]);
    } else if (isEdgeAssignment(rawAssignment)) {
      assignment = rawAssignment;
    } else {
      invalidAssignments.push(i);
      assignment = "U";
    }
    edges.push([a, b]);
    assignments.push(assignment);
    const angle = rawAngles?.[i];
    foldAngles.push(angle === undefined ? defaultFoldAngle(assignment) : angle);
  });

  if (malformedEdges.length > 0) {
    defects.push({
      code: "degenerate-edge-record",
      severity: "error",
      rule: "§2.4.1",
      message: `${malformedEdges.length} edges_vertices entries are not a pair of numbers`,
      edges: malformedEdges,
    });
  }
  if (outOfRange.length > 0) {
    defects.push({
      code: "vertex-index-out-of-range",
      severity: "error",
      rule: "§2.4.1",
      message:
        `${outOfRange.length} edges reference a vertex index outside ` +
        `0..${vertices.length - 1}`,
      edges: outOfRange,
    });
  }
  if (invalidAssignments.length > 0) {
    defects.push({
      code: "invalid-assignment",
      severity: "error",
      rule: "§2.4.2",
      message:
        `${invalidAssignments.length} edges have an assignment outside ` +
        "B M V F U C J (read as U)",
      edges: invalidAssignments,
    });
  }

  if (rawAssignments !== undefined && rawAssignments.length !== rawEdges.length) {
    defects.push({
      code: "array-length-mismatch",
      severity: "error",
      rule: "§2.4.1",
      message:
        `edges_assignment has ${rawAssignments.length} entries but ` +
        `edges_vertices has ${rawEdges.length}`,
    });
  }
  if (rawAngles !== undefined && rawAngles.length !== rawEdges.length) {
    defects.push({
      code: "array-length-mismatch",
      severity: "error",
      rule: "§2.4.1",
      message:
        `edges_foldAngle has ${rawAngles.length} entries but ` +
        `edges_vertices has ${rawEdges.length}`,
    });
  }
  if (rawAssignments === undefined) {
    defects.push({
      code: "missing-geometry",
      severity: "error",
      rule: "§2.4.1",
      message: "edges_assignment is required",
    });
  }

  const faces = doc.faces_vertices?.map((face) => [...face]);
  const graph: CreaseGraph = {
    vertices,
    edges,
    assignments,
    foldAngles,
    ...(faces ? { faces } : {}),
  };
  return { graph, defects };
}

function describe(value: unknown): string {
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `array(${value.length})`;
  return typeof value;
}

/** Geometry keys a frame owns, in canonical order. */
export const GEOMETRY_KEYS = [
  "vertices_coords",
  "edges_vertices",
  "edges_assignment",
  "edges_foldAngle",
  "faces_vertices",
] as const;

/**
 * Canonical key order for a serialized `.kami` document (DESIGN.md §2.5,
 * "JSON keys emitted in a fixed order"). Keys not listed here keep their
 * relative order and are emitted after these, sorted, so unknown extensions
 * still serialize deterministically.
 */
export const KAMI_KEY_ORDER: readonly string[] = [
  "file_spec",
  "file_creator",
  "file_author",
  "file_title",
  "file_description",
  "file_classes",
  "frame_author",
  "frame_title",
  "frame_description",
  "frame_classes",
  "frame_attributes",
  "frame_unit",
  "frame_parent",
  "frame_inherit",
  ...GEOMETRY_KEYS,
  "vertices_vertices",
  "vertices_faces",
  "edges_length",
  "faces_edges",
  "faceOrders",
  "edgeOrders",
  "kami:version",
  "kami:id",
  "kami:contentHash",
  "kami:paper",
  "kami:difficulty",
  "kami:taxonomy",
  "kami:provenance",
  "kami:license",
  "kami:folding",
  "kami:media",
  "kami:simulation",
  "file_frames",
];

/** Write a graph's arrays into a document, replacing any existing geometry. */
export function withGeometry<T extends FoldDocument>(
  doc: T,
  graph: CreaseGraph,
): T {
  const next: Record<string, unknown> = { ...doc };
  next["vertices_coords"] = graph.vertices.map((v) => [v[0], v[1]]);
  next["edges_vertices"] = graph.edges.map(([a, b]) => [a, b]);
  next["edges_assignment"] = [...graph.assignments];
  next["edges_foldAngle"] = graph.foldAngles
    ? [...graph.foldAngles]
    : graph.assignments.map(defaultFoldAngle);
  if (graph.faces) next["faces_vertices"] = graph.faces.map((f) => [...f]);
  else delete next["faces_vertices"];
  // Derived arrays would go stale against the new indices.
  delete next["vertices_vertices"];
  delete next["vertices_faces"];
  delete next["faces_edges"];
  delete next["edges_length"];
  return next as T;
}

export interface DocumentMetadata {
  readonly title?: string;
  readonly author?: string;
  readonly creator?: string;
  readonly paperShape?: KamiDocument["kami:paper"]["shape"];
  readonly license?: KamiDocument["kami:license"];
  readonly extra?: Readonly<Record<string, unknown>>;
}

/**
 * Build a minimally-valid `.kami` document around a graph.
 *
 * Metadata that the format requires but a geometry-only source cannot know
 * gets a conservative default: `paper.shape` "square" and an all-rights-
 * reserved license, both of which the upload flow (DESIGN.md §8.2) prompts the
 * user to confirm.
 */
export function documentFromGraph(
  graph: CreaseGraph,
  metadata: DocumentMetadata = {},
): KamiDocument {
  const doc: Record<string, unknown> = {
    file_spec: 1.2,
    file_creator: metadata.creator ?? "@kamibase/core 0.1",
    ...(metadata.author === undefined ? {} : { file_author: metadata.author }),
    ...(metadata.title === undefined ? {} : { file_title: metadata.title }),
    file_classes: ["singleModel"],
    frame_classes: ["creasePattern"],
    frame_attributes: ["2D"],
    frame_unit: "unit",
    "kami:version": CURRENT_KAMI_VERSION,
    "kami:paper": { shape: metadata.paperShape ?? "square" },
    "kami:license": metadata.license ?? {
      spdx: "LicenseRef-All-Rights-Reserved",
      redistribution: "none",
    },
    ...metadata.extra,
  };
  return withGeometry(doc as unknown as KamiDocument, graph);
}
