import type { CreaseGraph } from "../graph/types.js";
import type { FoldDocument } from "../kami/schema.js";

export const SOURCE_FORMATS = ["kami", "fold", "cp", "opx"] as const;

export type SourceFormat = (typeof SOURCE_FORMATS)[number];

/** Metadata a source format can carry, mapped onto FOLD/`kami:` fields. */
export interface ParsedMetadata {
  readonly title?: string;
  readonly author?: string;
  readonly creator?: string;
  /** Paper size in the source file's own units, when it states one. */
  readonly paperSize?: number;
}

/**
 * The output of every parser: a graph in the source file's own coordinates,
 * plus whatever metadata came with it.
 *
 * Coordinates are deliberately *not* normalized here — `ingest()` owns
 * canonicalization, so a caller that wants to inspect the raw file can.
 */
export interface ParsedPattern {
  readonly format: SourceFormat;
  readonly graph: CreaseGraph;
  /** The original document, for formats that are already FOLD-shaped. */
  readonly document: FoldDocument | null;
  readonly metadata: ParsedMetadata;
  /** Recoverable problems: unknown line types, dropped duplicates, and so on. */
  readonly warnings: string[];
}
