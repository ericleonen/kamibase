import { isEdgeAssignment } from "@kamibase/core";
import type { EditorDoc } from "@/lib/editor/model";

/**
 * Where a converted pattern waits while the browser navigates from `/upload`
 * to `/edit/import`.
 *
 * `sessionStorage` rather than a query parameter or a server round-trip: the
 * document is a few hundred segments, it belongs to this tab only, and the
 * whole point of converting client-side is that nothing is uploaded. It is
 * also why the key is per-session and read once.
 */
export const IMPORT_STORAGE_KEY = "kamibase:import";

export interface ImportPayload {
  readonly title: string;
  readonly slug: string;
  readonly doc: EditorDoc;
}

/**
 * Read and validate a handoff payload.
 *
 * Storage is user-writable and survives a reload, so this is parsed as
 * untrusted input: anything malformed reads as "nothing to import", which the
 * page turns into an honest message rather than a broken editor.
 */
export function readImportPayload(raw: string | null): ImportPayload | null {
  if (raw === null || raw === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const { title, slug, doc } = parsed as Record<string, unknown>;
  if (typeof title !== "string" || typeof slug !== "string" || !Array.isArray(doc)) {
    return null;
  }

  const segments = doc.filter(isSegment);
  if (segments.length === 0) return null;
  return { title, slug, doc: segments };
}

function isSegment(value: unknown): value is EditorDoc[number] {
  if (typeof value !== "object" || value === null) return false;
  const segment = value as Record<string, unknown>;
  return (
    ["x1", "y1", "x2", "y2"].every(
      (key) => typeof segment[key] === "number" && Number.isFinite(segment[key]),
    ) && isEdgeAssignment(segment["assignment"])
  );
}
