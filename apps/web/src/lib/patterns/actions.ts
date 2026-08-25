"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readEditorDoc } from "@/lib/editor/model";
import { classifySupabaseError, reportedMessage, socialFailureMessage } from "@/lib/social/errors";
import { ensureProfile } from "@/lib/social/profiles";
import { socialClient } from "@/lib/social/supabase";
import { seededPatterns } from "./index";
import { ingestPattern, patternRow } from "./save";
import { takenSlugs } from "./supabase";
import { slugCandidates, validatePatternDraft } from "./validate";

/**
 * Saving a crease pattern (DESIGN.md §9, patterns in Postgres).
 *
 * The editor posts its segments, not a finished file. That matters: the server
 * runs the same `ingest` the seed script and the upload converter run, so the
 * document in the database is canonical, planarized, face-counted and graded by
 * the server rather than by whatever the browser felt like sending. A hostile
 * client can post any geometry it likes and still cannot post a document whose
 * hash disagrees with its own creases.
 */

export interface SaveState {
  readonly error?: string;
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * How much geometry one save may carry.
 *
 * Segments are about 60 bytes of JSON each, so this is roughly forty thousand
 * creases: past anything the editor can usefully draw and well under the 9MB
 * server action limit in next.config.ts.
 */
const MAX_GEOMETRY_BYTES = 2 * 1024 * 1024;

export async function savePatternAction(
  _previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const profile = await ensureProfile();
  if (!profile.ok) return { error: profile.message };

  const draft = validatePatternDraft({
    title: field(formData, "title"),
    designer: field(formData, "designer"),
    description: field(formData, "description"),
    license: field(formData, "license"),
    tags: field(formData, "tags"),
    difficulty: field(formData, "difficulty"),
  });
  if (!draft.ok) return { error: draft.error };

  const geometry = field(formData, "geometry");
  if (geometry.length > MAX_GEOMETRY_BYTES) {
    return { error: "That pattern is too large to save. Export it as a file instead." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(geometry);
  } catch {
    return { error: "The editor sent something unreadable. Reload the page and try again." };
  }

  const doc = readEditorDoc(parsed);
  if (!doc) return { error: "The editor sent something unreadable. Reload the page and try again." };
  if (doc.length === 0) return { error: "There is nothing drawn yet." };

  const result = ingestPattern({
    draft: draft.value,
    doc,
    savedBy: profile.data.displayName || profile.data.handle,
  });

  const supabase = await socialClient();
  if (!supabase) return { error: socialFailureMessage("unconfigured") };

  const seeded = new Set((await seededPatterns.list()).map((pattern) => pattern.id));
  const candidates = slugCandidates(draft.value.title).filter((slug) => !seeded.has(slug));
  const taken = await takenSlugs(supabase, candidates);
  const free = candidates.filter((slug) => !taken.has(slug));
  if (free.length === 0) {
    return { error: "That title is taken several times over. Try a more specific one." };
  }

  let saved: string | null = null;
  let failure: SaveState | null = null;

  // The check above narrows the field; this loop is what makes it correct.
  // Two people saving "Bird base" in the same second both see the same free
  // slug, and the unique index is the only thing that can actually settle it.
  for (const slug of free) {
    const { error } = await supabase
      .from("patterns")
      .insert(patternRow({ slug, authorId: profile.data.id, result }));

    if (!error) {
      saved = slug;
      break;
    }
    // 23505 is the unique violation on `slug`: somebody got there first.
    if (error.code !== "23505") {
      failure = {
        error: reportedMessage(
          error,
          classifySupabaseError(error),
          "Could not save that pattern.",
        ),
      };
      break;
    }
  }

  if (failure) return failure;
  if (!saved) return { error: "That title is taken several times over. Try a more specific one." };

  revalidatePath("/explore");
  revalidatePath("/");
  revalidatePath(`/p/${saved}`);
  redirect(`/p/${saved}`);
}
