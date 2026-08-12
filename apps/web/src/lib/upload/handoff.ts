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
  /**
   * Where it came from. `/edit/import` uses it for the back link and for how
   * loudly to caveat what it is showing.
   */
  readonly source?: "convert" | "scan";
  /**
   * What the producer was unsure about, in plain language. The converter is
   * mostly certain; a scan of a photograph is not, and saying so next to the
   * geometry is the whole of DESIGN.md §3.4's "never guess silently".
   */
  readonly notes?: readonly string[];
  /** 0 to 1, as §3.4 defines it. */
  readonly confidence?: number;
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

  const { source, notes, confidence } = parsed as Record<string, unknown>;
  return {
    title,
    slug,
    doc: segments,
    ...(source === "scan" || source === "convert" ? { source } : {}),
    ...(Array.isArray(notes)
      ? { notes: notes.filter((note): note is string => typeof note === "string") }
      : {}),
    ...(typeof confidence === "number" && Number.isFinite(confidence)
      ? { confidence }
      : {}),
  };
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
