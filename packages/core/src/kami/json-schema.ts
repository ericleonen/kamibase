import {
  FILE_CLASSES,
  FRAME_ATTRIBUTES,
  FRAME_CLASSES,
  KAMI_REF_PATTERN,
  SHA256_PATTERN,
  ULID_PATTERN,
} from "./schema.js";
import { EDGE_ASSIGNMENTS } from "../graph/types.js";

/**
 * The published JSON Schema for `.kami` (DESIGN.md §2.3, served at
 * `/docs/kami-format`).
 *
 * It is hand-written rather than generated so the published artefact reads
 * well and carries documentation. `test/json-schema.test.ts` runs this schema
 * and `kamiDocumentSchema` (zod) over the same corpus and asserts they agree
 * on every document — that conformance test is what makes "matching" a fact
 * rather than a claim.
 *
 * Enumerated `frame_classes` / `frame_attributes` / `file_classes` values are
 * documented but not enforced: FOLD lets files carry classes we have never
 * heard of, and rejecting them would break the interop §2.1 is built on.
 */
export const KAMI_SCHEMA_ID = "https://kamibase.org/schema/kami-0.1.schema.json";

const geometryProperties = {
  vertices_coords: {
    description: "Vertex positions. `.kami` requires 2D, normalized to [0,1]².",
    type: "array",
    items: { type: "array", items: { type: "number" } },
  },
  vertices_vertices: {
    type: "array",
    items: { type: "array", items: { type: "integer" } },
  },
  vertices_faces: {
    type: "array",
    items: { type: "array", items: { type: ["integer", "null"] } },
  },
  edges_vertices: {
    description: "Each edge as a pair of vertex indices.",
    type: "array",
    items: { type: "array", items: { type: "integer" } },
  },
  edges_assignment: {
    description: "Fold assignment per edge. No nulls (DESIGN.md §2.4.2).",
    type: "array",
    items: { type: "string", enum: [...EDGE_ASSIGNMENTS] },
  },
  edges_foldAngle: {
    description: "Fold angle per edge in degrees, in [-180, 180].",
    type: "array",
    items: { type: ["number", "null"] },
  },
  edges_length: { type: "array", items: { type: "number" } },
  faces_vertices: {
    description:
      "Face cycles, counter-clockwise. Computed at ingest by planar face-finding when absent.",
    type: "array",
    items: { type: "array", items: { type: "integer" } },
  },
  faces_edges: {
    type: "array",
    items: { type: "array", items: { type: "integer" } },
  },
  faceOrders: {
    type: "array",
    items: { type: "array", items: { type: ["integer", "null"] } },
  },
  edgeOrders: {
    type: "array",
    items: { type: "array", items: { type: ["integer", "null"] } },
  },
} as const;

const frameProperties = {
  frame_author: { type: "string" },
  frame_title: { type: "string" },
  frame_description: { type: "string" },
  frame_classes: {
    type: "array",
    items: { type: "string", examples: [...FRAME_CLASSES] },
  },
  frame_attributes: {
    type: "array",
    items: { type: "string", examples: [...FRAME_ATTRIBUTES] },
  },
  frame_unit: { type: "string" },
  frame_parent: { type: "integer", minimum: 0 },
  frame_inherit: { type: "boolean" },
} as const;

/** Deep-frozen so consumers cannot mutate the published schema in place. */
export const kamiJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: KAMI_SCHEMA_ID,
  title: ".kami crease pattern",
  description:
    "A strict, opinionated profile of the FOLD file format (DESIGN.md §2.3). " +
    "Every .kami document is a valid FOLD document; the kami: namespace carries " +
    "everything FOLD has no opinion about.",
  type: "object",
  required: [
    "vertices_coords",
    "edges_vertices",
    "edges_assignment",
    "kami:version",
    "kami:license",
    "kami:paper",
  ],
  properties: {
    file_spec: { type: "number" },
    file_creator: { type: "string" },
    file_author: { type: "string" },
    file_title: { type: "string" },
    file_description: { type: "string" },
    file_classes: {
      type: "array",
      items: { type: "string", examples: [...FILE_CLASSES] },
    },
    file_frames: {
      description:
        "Extra FOLD frames: folded states, step snapshots (DESIGN.md §2.3).",
      type: "array",
      items: {
        type: "object",
        properties: { ...frameProperties, ...geometryProperties },
        additionalProperties: true,
      },
    },
    ...frameProperties,
    ...geometryProperties,

    "kami:version": {
      description: "Version of the kami: extension this document conforms to.",
      type: "string",
      minLength: 1,
    },
    "kami:id": {
      description: "ULID identifying this pattern on Kamibase.",
      type: "string",
      pattern: ULID_PATTERN,
    },
    "kami:contentHash": {
      description:
        "SHA-256 over the canonical geometry arrays only, metadata excluded (DESIGN.md §2.5).",
      type: "string",
      pattern: SHA256_PATTERN,
    },
    "kami:paper": {
      type: "object",
      required: ["shape"],
      properties: {
        shape: {
          type: "string",
          enum: ["square", "rectangle", "hexagon", "triangle", "circle", "custom"],
        },
        gridSystem: {
          type: "string",
          enum: ["none", "square", "box-pleat", "22.5", "hex", "arbitrary"],
        },
        gridDivisions: {
          description: "n for an n×n reference grid; null if none.",
          type: ["integer", "null"],
          exclusiveMinimum: 0,
        },
        recommendedSizeMm: { type: "number", exclusiveMinimum: 0 },
        recommendedPaper: { type: "string" },
      },
      additionalProperties: true,
    },
    "kami:difficulty": {
      type: "object",
      properties: {
        rating: {
          description: "1–10, author-declared.",
          type: "integer",
          minimum: 1,
          maximum: 10,
        },
        communityRating: {
          description: "Server-computed; read-only in the file.",
          type: "number",
          minimum: 1,
          maximum: 10,
        },
        estimatedMinutes: { type: "integer", exclusiveMinimum: 0 },
      },
      additionalProperties: true,
    },
    "kami:taxonomy": {
      type: "object",
      properties: {
        subject: { type: "array", items: { type: "string" } },
        techniques: { type: "array", items: { type: "string" } },
        tags: { type: "array", items: { type: "string" } },
      },
      additionalProperties: true,
    },
    "kami:provenance": {
      type: "object",
      properties: {
        designer: { type: "string" },
        designedOn: { type: "string", format: "date" },
        derivedFrom: {
          description: "Remix lineage, by kami:id.",
          type: "array",
          items: { type: "string", pattern: KAMI_REF_PATTERN },
        },
        originalSourceUrl: { type: "string", format: "uri" },
        convertedFrom: {
          type: "object",
          required: ["format"],
          properties: {
            format: { type: "string" },
            converter: { type: "string" },
            confidence: {
              description: "0–1 (DESIGN.md §3.4).",
              type: "number",
              minimum: 0,
              maximum: 1,
            },
            reviewedByHuman: { type: "boolean" },
          },
          additionalProperties: true,
        },
      },
      additionalProperties: true,
    },
    "kami:license": {
      type: "object",
      required: ["spdx"],
      properties: {
        spdx: { type: "string", minLength: 1 },
        foldingAllowed: {
          type: "string",
          enum: ["personal", "commercial", "any"],
        },
        redistribution: {
          type: "string",
          enum: ["none", "with-attribution", "any"],
        },
      },
      additionalProperties: true,
    },
    "kami:folding": {
      type: "object",
      properties: {
        collapseNotes: { type: "string" },
        shapingNotes: { type: "string" },
        steps: {
          type: "array",
          items: {
            type: "object",
            required: ["label"],
            properties: {
              label: { type: "string" },
              edges: { type: "array", items: { type: "integer", minimum: 0 } },
            },
            additionalProperties: true,
          },
        },
      },
      additionalProperties: true,
    },
    "kami:media": {
      type: "array",
      items: {
        type: "object",
        required: ["role", "src"],
        properties: {
          role: {
            type: "string",
            enum: ["cp", "folded", "process", "thumbnail", "other"],
          },
          src: { type: "string", minLength: 1 },
          credit: { type: "string" },
        },
        additionalProperties: true,
      },
    },
    "kami:simulation": {
      type: "object",
      properties: {
        verified: { type: "boolean" },
        flatFoldable: { type: "boolean" },
        maxStrain: { type: "number", minimum: 0 },
        simulatedOn: { type: "string", format: "date-time" },
      },
      additionalProperties: true,
    },
  },
  additionalProperties: true,
} as const;

export type KamiJsonSchema = typeof kamiJsonSchema;
