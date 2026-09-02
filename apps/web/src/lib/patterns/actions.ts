"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readEditorDoc } from "@/lib/editor/model";
import { classifySupabaseError, reportedMessage, socialFailureMessage } from "@/lib/social/errors";
import { ensureProfile } from "@/lib/social/profiles";
import { socialClient } from "@/lib/social/supabase";
import { seededPatterns } from "./index";
import { getOwnedPattern } from "./owner";
import { ingestPattern, patternMetadataRow, patternRow, withMetadata } from "./save";
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
  /**
   * Set by the actions that return rather than redirect.
   *
   * The initial state and a successful one are otherwise the same empty
   * object, and a form cannot say "Saved." if it cannot tell the difference
   * between having saved and not having been used yet.
   */
  readonly saved?: true;
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

/**
 * Unsaving one.
 *
 * The row goes and nothing else does. Two things reference a pattern by slug
 * rather than by key — folds and comments — and the difference between them is
 * whose work they are. A fold is somebody's photograph of paper they folded,
 * with their caption on it, and deleting a pattern is not permission to delete
 * that; it keeps its page and falls back to showing the slug where the title
 * was. Comments were written *about* the pattern and become unreachable with
 * it, which is the same as gone without needing a policy that lets one person
 * delete another's writing.
 *
 * Ownership is checked twice on purpose. The `author_id` filter is what makes
 * the intent legible here, and the "a user deletes their own patterns" policy
 * in 0002_patterns.sql is what actually enforces it — a filter in application
 * code is a comment as far as the database is concerned.
 *
 * The seeded library has no rows, so there is nothing here that can delete a
 * `.kami` file committed to the repository, whoever asks.
 */
export async function deletePatternAction(
  _previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const slug = field(formData, "slug");
  if (slug === "") return { error: "No pattern was named." };

  const profile = await ensureProfile();
  if (!profile.ok) return { error: profile.message };

  const supabase = await socialClient();
  if (!supabase) return { error: socialFailureMessage("unconfigured") };

  const { data, error } = await supabase
    .from("patterns")
    .delete()
    .eq("slug", slug)
    .eq("author_id", profile.data.id)
    .select("slug");

  if (error) {
    return {
      error: reportedMessage(
        error,
        classifySupabaseError(error),
        "Could not delete that pattern.",
      ),
    };
  }
  // No error and no row means the pattern is not theirs, or is a seeded file,
  // or was deleted a moment ago in another tab. All three are the same answer.
  if (!data || data.length === 0) {
    return { error: "That pattern is not yours to delete." };
  }

  revalidatePath("/explore");
  revalidatePath("/");
  revalidatePath(`/p/${slug}`);
  revalidatePath(`/u/${profile.data.handle}`);
  redirect(`/u/${profile.data.handle}`);
}

/**
 * Editing everything about a pattern except its creases.
 *
 * The name, who designed it, what it is, what anybody may do with it, how hard
 * it is and what it is filed under. Not the geometry, which is the editor's,
 * and not the slug, which is a promise: `folds.pattern_id` references it, and
 * so does every link anybody has sent. A pattern that renamed its own URL would
 * break both, so the title changes and the address does not.
 *
 * Both copies are written. The columns are what a listing sorts and filters on;
 * the document is what the page renders from and what the `.kami` download
 * hands over. `withMetadata` explains why writing only one is worse than
 * writing neither.
 */
export async function updatePatternAction(
  _previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const slug = field(formData, "slug");
  if (slug === "") return { error: "No pattern was named." };

  const draft = validatePatternDraft({
    title: field(formData, "title"),
    designer: field(formData, "designer"),
    description: field(formData, "description"),
    license: field(formData, "license"),
    tags: field(formData, "tags"),
    difficulty: field(formData, "difficulty"),
  });
  if (!draft.ok) return { error: draft.error };

  // Read it as its owner first. This is what turns "somebody else's slug" and
  // "a seeded file" into the same refusal as "no such pattern", before any
  // write is attempted.
  const existing = await getOwnedPattern(slug);
  if (!existing) return { error: "That pattern is not yours to edit." };

  const supabase = await socialClient();
  if (!supabase) return { error: socialFailureMessage("unconfigured") };

  const { error } = await supabase
    .from("patterns")
    .update({
      ...patternMetadataRow(draft.value),
      document: withMetadata(existing.document, draft.value),
    })
    .eq("slug", slug);

  if (error) {
    return {
      error: reportedMessage(error, classifySupabaseError(error), "Could not save those changes."),
    };
  }

  revalidatePath("/explore");
  revalidatePath("/");
  revalidatePath(`/p/${slug}`);
  revalidatePath(`/p/${slug}/settings`);
  return { saved: true };
}

/**
 * Taking a pattern off the site, or putting it back.
 *
 * One column, and the select policy in 0004 does the rest: private means the
 * author and nobody else, everywhere at once, including the listings that read
 * with the anonymous key and never learn that the row exists.
 *
 * What it does not do is unsay anything. Folds and comments made while it was
 * public stay where they are — they are other people's, and a pattern going
 * quiet is not a reason to delete somebody else's photograph of it. Their links
 * back to the pattern lead to a 404 until it is public again, which is the
 * honest rendering of "the author has taken this down for now".
 */
export async function setPatternPrivacyAction(
  _previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const slug = field(formData, "slug");
  if (slug === "") return { error: "No pattern was named." };
  const isPrivate = field(formData, "private") === "true";

  const profile = await ensureProfile();
  if (!profile.ok) return { error: profile.message };

  const supabase = await socialClient();
  if (!supabase) return { error: socialFailureMessage("unconfigured") };

  const { data, error } = await supabase
    .from("patterns")
    .update({ is_private: isPrivate })
    .eq("slug", slug)
    .eq("author_id", profile.data.id)
    .select("slug");

  if (error) {
    return {
      error: reportedMessage(
        error,
        classifySupabaseError(error),
        "Could not change who can see that pattern.",
      ),
    };
  }
  if (!data || data.length === 0) return { error: "That pattern is not yours to change." };

  revalidatePath("/explore");
  revalidatePath("/");
  revalidatePath(`/p/${slug}`);
  revalidatePath(`/p/${slug}/settings`);
  revalidatePath(`/u/${profile.data.handle}`);
  return { saved: true };
}
