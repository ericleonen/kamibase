import { serializeCanonical } from "../canonical/index.js";
import type { FoldDocument, KamiDocument } from "../kami/schema.js";

export interface ToFoldOptions {
  /**
   * Also drop other tools' `prefix:name` extension blocks. Default `false`:
   * those keys are spec-legal FOLD and dropping someone else's data on the way
   * through would make us a worse hub, not a better one (DESIGN.md §2.1).
   */
  readonly stripAllExtensions?: boolean;
  /** Keep specific `kami:` keys, e.g. `["kami:id"]` for round-trip provenance. */
  readonly keep?: readonly string[];
  /** Overwrite `file_creator`. Default: leave whatever the document has. */
  readonly creator?: string;
}

/**
 * Export a `.kami` document as plain `.fold`.
 *
 * "Export to `.fold` is a key-filter" (DESIGN.md §2.1) — and that is all this
 * is. The geometry is already FOLD; the only thing that leaves is the `kami:`
 * namespace, recursively, including inside `file_frames`.
 */
export function toFold(
  doc: KamiDocument | FoldDocument,
  options: ToFoldOptions = {},
): FoldDocument {
  const keep = new Set(options.keep ?? []);
  const filtered = filterKeys(doc as Record<string, unknown>, keep, options);
  if (options.creator !== undefined) filtered["file_creator"] = options.creator;
  return filtered as FoldDocument;
}

function filterKeys(
  source: Record<string, unknown>,
  keep: ReadonlySet<string>,
  options: ToFoldOptions,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (!keep.has(key) && isExtensionKey(key, options.stripAllExtensions ?? false)) {
      continue;
    }
    if (key === "file_frames" && Array.isArray(value)) {
      output[key] = value.map((frame) =>
        frame !== null && typeof frame === "object" && !Array.isArray(frame)
          ? filterKeys(frame as Record<string, unknown>, keep, options)
          : frame,
      );
      continue;
    }
    output[key] = value;
  }
  return output;
}

function isExtensionKey(key: string, stripAll: boolean): boolean {
  if (key.startsWith("kami:")) return true;
  return stripAll && key.includes(":");
}

/** Export as `.fold` JSON text. */
export function toFoldJson(
  doc: KamiDocument | FoldDocument,
  options: ToFoldOptions & { readonly pretty?: boolean } = {},
): string {
  const fold = toFold(doc, options);
  if (options.pretty === false) return serializeCanonical(fold);
  return JSON.stringify(JSON.parse(serializeCanonical(fold)), null, 2) + "\n";
}
