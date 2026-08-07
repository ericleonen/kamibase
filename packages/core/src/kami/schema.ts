import { z } from "zod";
import { EDGE_ASSIGNMENTS } from "../graph/types.js";

/**
 * Zod schemas for FOLD and for the `.kami` profile of it (DESIGN.md §2.3).
 *
 * These describe *document shape* only. The geometric rules of §2.4 — mutually
 * consistent array lengths, a closed `B` boundary, no crossings without a
 * vertex — live in `validateStructure`, because no JSON Schema can express
 * them. A document can therefore satisfy `kamiDocumentSchema` and still be
 * graded L0.
 *
 * Unknown keys are preserved everywhere (`.passthrough()`): FOLD blesses
 * `prefix:name` extension keys and a hub that silently dropped another tool's
 * extension would be a bad citizen.
 */

export const CURRENT_KAMI_VERSION = "0.1";

/** ULID, as used by `kami:id` (Crockford base32, 26 chars). */
export const ULID_PATTERN = "^[0-9A-HJKMNP-TV-Z]{26}$";
/** Lowercase hex SHA-256, as used by `kami:contentHash`. */
export const SHA256_PATTERN = "^[0-9a-f]{64}$";
/** A `kami:` reference to another pattern, as used by `derivedFrom`. */
export const KAMI_REF_PATTERN = "^kami:[0-9A-HJKMNP-TV-Z]{26}$";

export const edgeAssignmentSchema = z.enum(EDGE_ASSIGNMENTS);

export const FRAME_CLASSES = [
  "creasePattern",
  "foldedForm",
  "graph",
  "linkage",
] as const;

export const FILE_CLASSES = [
  "singleModel",
  "multiModel",
  "animation",
  "diagrams",
] as const;

/**
 * FOLD `frame_attributes`, plus `multiBoundary`: our declaration that a
 * pattern's several boundary loops are intentional rather than a hole in the
 * border (DESIGN.md §2.4.4).
 */
export const FRAME_ATTRIBUTES = [
  "2D",
  "3D",
  "abstract",
  "manifold",
  "nonManifold",
  "orientable",
  "nonOrientable",
  "selfTouching",
  "nonSelfTouching",
  "selfIntersecting",
  "nonSelfIntersecting",
  "multiBoundary",
] as const;

/** The attribute that makes a multi-loop boundary legal (DESIGN.md §2.4.4). */
export const MULTI_BOUNDARY_ATTRIBUTE = "multiBoundary";

const coordinateSchema = z.array(z.number().finite());

/** Geometry keys, shared by the key frame and by any `file_frames` entry. */
const geometrySchema = z.object({
  vertices_coords: z.array(coordinateSchema).optional(),
  vertices_vertices: z.array(z.array(z.number().int())).optional(),
  vertices_faces: z.array(z.array(z.number().int().nullable())).optional(),
  edges_vertices: z.array(z.array(z.number().int())).optional(),
  edges_assignment: z.array(edgeAssignmentSchema).optional(),
  edges_foldAngle: z.array(z.number().nullable()).optional(),
  edges_length: z.array(z.number()).optional(),
  faces_vertices: z.array(z.array(z.number().int())).optional(),
  faces_edges: z.array(z.array(z.number().int())).optional(),
  faceOrders: z.array(z.array(z.number().int().nullable())).optional(),
  edgeOrders: z.array(z.array(z.number().int().nullable())).optional(),
});

const frameMetadataSchema = z.object({
  frame_author: z.string().optional(),
  frame_title: z.string().optional(),
  frame_description: z.string().optional(),
  frame_classes: z.array(z.string()).optional(),
  frame_attributes: z.array(z.string()).optional(),
  frame_unit: z.string().optional(),
  frame_parent: z.number().int().nonnegative().optional(),
  frame_inherit: z.boolean().optional(),
});

export const foldFrameSchema = frameMetadataSchema
  .merge(geometrySchema)
  .passthrough();

const fileMetadataSchema = z.object({
  file_spec: z.number().optional(),
  file_creator: z.string().optional(),
  file_author: z.string().optional(),
  file_title: z.string().optional(),
  file_description: z.string().optional(),
  file_classes: z.array(z.string()).optional(),
  file_frames: z.array(foldFrameSchema).optional(),
});

/**
 * A FOLD document: everything optional, unknown keys kept. This is what the
 * parsers emit and what L0 ("valid JSON/FOLD, geometry present") means.
 */
export const foldDocumentSchema = fileMetadataSchema
  .merge(frameMetadataSchema)
  .merge(geometrySchema)
  .passthrough();

export const kamiPaperSchema = z
  .object({
    shape: z.enum(["square", "rectangle", "hexagon", "triangle", "circle", "custom"]),
    gridSystem: z
      .enum(["none", "square", "box-pleat", "22.5", "hex", "arbitrary"])
      .optional(),
    gridDivisions: z.number().int().positive().nullable().optional(),
    recommendedSizeMm: z.number().positive().optional(),
    recommendedPaper: z.string().optional(),
  })
  .passthrough();

export const kamiDifficultySchema = z
  .object({
    rating: z.number().int().min(1).max(10).optional(),
    communityRating: z.number().min(1).max(10).optional(),
    estimatedMinutes: z.number().int().positive().optional(),
  })
  .passthrough();

export const kamiTaxonomySchema = z
  .object({
    subject: z.array(z.string()).optional(),
    techniques: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough();

export const kamiConvertedFromSchema = z
  .object({
    format: z.string(),
    converter: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    reviewedByHuman: z.boolean().optional(),
  })
  .passthrough();

export const kamiProvenanceSchema = z
  .object({
    designer: z.string().optional(),
    designedOn: z.string().date().optional(),
    derivedFrom: z.array(z.string().regex(new RegExp(KAMI_REF_PATTERN))).optional(),
    originalSourceUrl: z.string().url().optional(),
    convertedFrom: kamiConvertedFromSchema.optional(),
  })
  .passthrough();

export const kamiLicenseSchema = z
  .object({
    spdx: z.string().min(1),
    foldingAllowed: z.enum(["personal", "commercial", "any"]).optional(),
    redistribution: z.enum(["none", "with-attribution", "any"]).optional(),
  })
  .passthrough();

export const kamiFoldingStepSchema = z
  .object({
    label: z.string(),
    edges: z.array(z.number().int().nonnegative()).optional(),
  })
  .passthrough();

export const kamiFoldingSchema = z
  .object({
    collapseNotes: z.string().optional(),
    shapingNotes: z.string().optional(),
    steps: z.array(kamiFoldingStepSchema).optional(),
  })
  .passthrough();

export const kamiMediaItemSchema = z
  .object({
    role: z.enum(["cp", "folded", "process", "thumbnail", "other"]),
    src: z.string().min(1),
    credit: z.string().optional(),
  })
  .passthrough();

export const kamiSimulationSchema = z
  .object({
    verified: z.boolean().optional(),
    flatFoldable: z.boolean().optional(),
    maxStrain: z.number().nonnegative().optional(),
    simulatedOn: z.string().datetime({ offset: true }).optional(),
  })
  .passthrough();

/** The `kami:` extension block, all of it optional at this level. */
const kamiExtensionShape = {
  "kami:version": z.string().min(1),
  "kami:id": z.string().regex(new RegExp(ULID_PATTERN)).optional(),
  "kami:contentHash": z.string().regex(new RegExp(SHA256_PATTERN)).optional(),
  "kami:paper": kamiPaperSchema,
  "kami:difficulty": kamiDifficultySchema.optional(),
  "kami:taxonomy": kamiTaxonomySchema.optional(),
  "kami:provenance": kamiProvenanceSchema.optional(),
  "kami:license": kamiLicenseSchema,
  "kami:folding": kamiFoldingSchema.optional(),
  "kami:media": z.array(kamiMediaItemSchema).optional(),
  "kami:simulation": kamiSimulationSchema.optional(),
} as const;

/**
 * A `.kami` document.
 *
 * Required beyond FOLD, per DESIGN.md §2.4: the three geometry arrays
 * (§2.4.1), and `kami:version`, `kami:license`, `kami:paper.shape` (§2.4.7).
 */
export const kamiDocumentSchema = foldDocumentSchema
  .extend({
    vertices_coords: z.array(coordinateSchema),
    edges_vertices: z.array(z.array(z.number().int())),
    edges_assignment: z.array(edgeAssignmentSchema),
    ...kamiExtensionShape,
  })
  .passthrough();

export type FoldFrame = z.infer<typeof foldFrameSchema>;
export type FoldDocument = z.infer<typeof foldDocumentSchema>;
export type KamiDocument = z.infer<typeof kamiDocumentSchema>;
export type KamiPaper = z.infer<typeof kamiPaperSchema>;
export type KamiLicense = z.infer<typeof kamiLicenseSchema>;
export type KamiProvenance = z.infer<typeof kamiProvenanceSchema>;
export type KamiSimulation = z.infer<typeof kamiSimulationSchema>;
export type KamiMediaItem = z.infer<typeof kamiMediaItemSchema>;

export interface SchemaCheckResult<T> {
  readonly ok: boolean;
  readonly data?: T;
  /** Human-readable `path: message` strings, one per schema violation. */
  readonly errors: string[];
}

function toResult<T>(parsed: z.SafeParseReturnType<unknown, T>): SchemaCheckResult<T> {
  if (parsed.success) return { ok: true, data: parsed.data, errors: [] };
  return {
    ok: false,
    errors: parsed.error.errors.map(
      (issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`,
    ),
  };
}

/** Validate a parsed JSON value against the `.kami` schema. */
export function checkKamiDocument(value: unknown): SchemaCheckResult<KamiDocument> {
  return toResult(kamiDocumentSchema.safeParse(value));
}

/** Validate a parsed JSON value against the permissive FOLD schema. */
export function checkFoldDocument(value: unknown): SchemaCheckResult<FoldDocument> {
  return toResult(foldDocumentSchema.safeParse(value));
}
