import { extractGraph } from "../kami/document.js";
import { checkFoldDocument, type FoldDocument, type FoldFrame } from "../kami/schema.js";
import { ParseError } from "./errors.js";
import type { ParsedMetadata, ParsedPattern } from "./types.js";

export interface ParseFoldOptions {
  /**
   * Which frame to read when the key frame carries no geometry. Default:
   * the first frame whose `frame_classes` contains `creasePattern`, else the
   * first frame with geometry.
   */
  readonly frame?: number;
}

/**
 * Parse a `.fold` (or `.kami`, which is a profile of it) document.
 *
 * "Import from `.fold` is validation + metadata prompts" (DESIGN.md §2.1), so
 * this parser is deliberately permissive: anything that is a JSON object with
 * readable geometry gets through, and the schema's complaints ride along as
 * warnings for the validator and the review UI to act on.
 */
export function parseFold(
  text: string | unknown,
  options: ParseFoldOptions = {},
): ParsedPattern {
  let value: unknown;
  if (typeof text === "string") {
    try {
      value = JSON.parse(text) as unknown;
    } catch (error) {
      throw new ParseError(
        "fold",
        `not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else {
    value = text;
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ParseError("fold", "the document root must be a JSON object");
  }

  const doc = value as FoldDocument;
  const warnings: string[] = [];

  const schemaCheck = checkFoldDocument(doc);
  if (!schemaCheck.ok) {
    warnings.push(
      ...schemaCheck.errors.map((message) => `schema: ${message}`),
    );
  }

  const source = resolveFrame(doc, options.frame, warnings);
  const { graph, defects } = extractGraph(source);
  if (!graph) {
    throw new ParseError(
      "fold",
      defects[0]?.message ?? "no vertices_coords / edges_vertices in any frame",
    );
  }
  for (const defect of defects) {
    warnings.push(`${defect.rule} ${defect.code}: ${defect.message}`);
  }

  const metadata: ParsedMetadata = {
    ...(typeof doc.file_title === "string" ? { title: doc.file_title } : {}),
    ...(typeof doc.file_author === "string" ? { author: doc.file_author } : {}),
    ...(typeof doc.file_creator === "string" ? { creator: doc.file_creator } : {}),
  };

  return {
    format: hasKamiExtension(doc) ? "kami" : "fold",
    graph,
    document: doc,
    metadata,
    warnings,
  };
}

function hasKamiExtension(doc: FoldDocument): boolean {
  return Object.keys(doc).some((key) => key.startsWith("kami:"));
}

/**
 * FOLD lets the key frame be metadata-only and put geometry in `file_frames`.
 * Resolve to a frame that actually has geometry, honouring `frame_inherit`.
 */
function resolveFrame(
  doc: FoldDocument,
  requested: number | undefined,
  warnings: string[],
): FoldDocument {
  const frames = Array.isArray(doc.file_frames) ? doc.file_frames : [];

  if (requested !== undefined) {
    const frame = frames[requested];
    if (!frame) {
      throw new ParseError("fold", `file_frames[${requested}] does not exist`);
    }
    return inherit(doc, frame);
  }

  if (Array.isArray(doc.vertices_coords) && Array.isArray(doc.edges_vertices)) {
    return doc;
  }
  if (frames.length === 0) return doc;

  const index = frames.findIndex(
    (frame) =>
      Array.isArray(frame.vertices_coords) &&
      Array.isArray(frame.edges_vertices) &&
      (frame.frame_classes ?? []).includes("creasePattern"),
  );
  const fallback =
    index >= 0
      ? index
      : frames.findIndex(
          (frame) =>
            Array.isArray(frame.vertices_coords) && Array.isArray(frame.edges_vertices),
        );
  if (fallback < 0) return doc;
  warnings.push(
    `the key frame has no geometry; read it from file_frames[${fallback}]`,
  );
  return inherit(doc, frames[fallback]!);
}

/** Merge a child frame over its parent when `frame_inherit` is set. */
function inherit(parent: FoldDocument, frame: FoldFrame): FoldDocument {
  if (frame.frame_inherit !== true) return frame as FoldDocument;
  const merged: Record<string, unknown> = { ...parent };
  delete merged["file_frames"];
  for (const [key, entry] of Object.entries(frame)) {
    if (entry !== undefined) merged[key] = entry;
  }
  return merged as FoldDocument;
}
