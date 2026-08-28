"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { classifySupabaseError, reportedMessage, socialFailureMessage } from "./errors";
import { getFold } from "./folds";
import { notifyComment, notifyFollowed, notifyNewFold } from "./notify";
import { ensureProfile, getProfileById, listFollowerIds } from "./profiles";
import { socialClient } from "./supabase";
import {
  AVATAR_MAX_BYTES,
  FOLD_PHOTO_MAX_BYTES,
  objectPath,
  validateCommentBody,
  validateFoldDraft,
  validateImageUpload,
  validateProfileDraft,
} from "./validate";

/**
 * Every write in the social layer.
 *
 * Uploads go through here rather than straight from the browser to Supabase
 * Storage. That keeps the site's Content-Security-Policy tight (the page never
 * opens a connection to another origin), puts a second size and type check
 * between a phone camera and the bucket, and means a fold row and its photo are
 * created by the same request rather than two that can disagree.
 */

export interface ActionState {
  readonly error?: string;
  readonly notice?: string;
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function updateProfileAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await ensureProfile();
  if (!profile.ok) return { error: profile.message };

  const draft = validateProfileDraft({
    handle: field(formData, "handle"),
    displayName: field(formData, "displayName"),
    bio: field(formData, "bio"),
    website: field(formData, "website"),
  });
  if (!draft.ok) return { error: draft.error };

  const supabase = await socialClient();
  if (!supabase) return { error: socialFailureMessage("unconfigured") };

  const patch: Record<string, string | null> = {
    handle: draft.value.handle,
    display_name: draft.value.displayName,
    bio: draft.value.bio,
    website: draft.value.website ?? null,
  };

  // An avatar is optional on every save: leaving the file input empty keeps
  // whatever is already there.
  const photo = formData.get("avatar");
  if (photo instanceof File && photo.size > 0) {
    const uploaded = await uploadImage({
      file: photo,
      bucket: "avatars",
      userId: profile.data.id,
      maxBytes: AVATAR_MAX_BYTES,
    });
    if (!uploaded.ok) return { error: uploaded.error };
    patch["avatar_url"] = uploaded.url;
    patch["avatar_path"] = uploaded.path;
    if (profile.data.avatarPath && profile.data.avatarPath !== uploaded.path) {
      await supabase.storage.from("avatars").remove([profile.data.avatarPath]);
    }
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", profile.data.id);
  if (error) {
    // The only constraint a person can trip from this form is the unique
    // handle, and "taken" is more useful than the raw message.
    if (error.code === "23505") {
      return { error: `The handle "${draft.value.handle}" is taken. Try another.` };
    }
    return {
      error: reportedMessage(
        error,
        classifySupabaseError(error),
        "Could not save your profile.",
      ),
    };
  }

  revalidatePath("/settings/profile");
  revalidatePath(`/u/${draft.value.handle}`);
  revalidatePath("/", "layout");
  return { notice: "Profile saved." };
}

// ---------------------------------------------------------------------------
// Folds
// ---------------------------------------------------------------------------

export async function createFoldAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await ensureProfile();
  if (!profile.ok) return { error: profile.message };

  const patternId = field(formData, "patternId");
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(patternId)) {
    return { error: "That pattern does not look right. Start again from its page." };
  }

  const draft = validateFoldDraft({
    caption: field(formData, "caption"),
    paper: field(formData, "paper"),
    sizeMm: field(formData, "sizeMm"),
    minutes: field(formData, "minutes"),
    difficulty: field(formData, "difficulty"),
  });
  if (!draft.ok) return { error: draft.error };

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { error: "Add a photo of your fold." };
  }

  const uploaded = await uploadImage({
    file: photo,
    bucket: "fold-photos",
    userId: profile.data.id,
    maxBytes: FOLD_PHOTO_MAX_BYTES,
  });
  if (!uploaded.ok) return { error: uploaded.error };

  const supabase = await socialClient();
  if (!supabase) return { error: socialFailureMessage("unconfigured") };

  const { data, error } = await supabase
    .from("folds")
    .insert({
      author_id: profile.data.id,
      pattern_id: patternId,
      photo_url: uploaded.url,
      photo_path: uploaded.path,
      caption: draft.value.caption,
      paper: draft.value.paper ?? null,
      size_mm: draft.value.sizeMm ?? null,
      minutes: draft.value.minutes ?? null,
      difficulty: draft.value.difficulty ?? null,
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !data) {
    // The row failed, so the photo is now an orphan in the bucket. Take it back
    // out rather than leaving storage to accumulate files nothing references.
    await supabase.storage.from("fold-photos").remove([uploaded.path]);
    return {
      error: reportedMessage(
        error,
        classifySupabaseError(error),
        "Could not post that fold.",
      ),
    };
  }

  // Everyone who asked to hear about this person's folds. Fired off rather
  // than awaited: the fold is posted, and the redirect below should not wait on
  // a mail provider.
  notifyNewFold(await listFollowerIds(profile.data.id), profile.data, data.id, patternId);

  revalidatePath(`/p/${patternId}`);
  revalidatePath(`/p/${patternId}/folds`);
  revalidatePath(`/u/${profile.data.handle}`);
  revalidatePath("/feed");
  redirect(`/f/${data.id}`);
}

export async function deleteFoldAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const id = field(formData, "foldId");
  const fold = await getFold(id);
  if (!fold.ok || !fold.data) return;
  // Row-level security would refuse this anyway. Checking here means somebody
  // else's fold sends them back to the page rather than to a silent no-op.
  if (fold.data.author.id !== user.id) return;

  const supabase = await socialClient();
  if (!supabase) return;

  const { error } = await supabase.from("folds").delete().eq("id", id);
  if (error) return;

  await supabase.storage.from("fold-photos").remove([fold.data.photoPath]);

  revalidatePath(`/p/${fold.data.patternId}`);
  revalidatePath(`/p/${fold.data.patternId}/folds`);
  revalidatePath(`/u/${fold.data.author.handle}`);
  revalidatePath("/feed");
  redirect(`/p/${fold.data.patternId}`);
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function createCommentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await ensureProfile();
  if (!profile.ok) return { error: profile.message };

  const body = validateCommentBody(field(formData, "body"));
  if (!body.ok) return { error: body.error };

  const patternId = field(formData, "patternId");
  const foldId = field(formData, "foldId");
  if ((patternId === "") === (foldId === "")) {
    return { error: "That comment had nowhere to go. Reload the page and try again." };
  }

  const supabase = await socialClient();
  if (!supabase) return { error: socialFailureMessage("unconfigured") };

  const { error } = await supabase.from("comments").insert({
    author_id: profile.data.id,
    body: body.value,
    pattern_id: patternId === "" ? null : patternId,
    fold_id: foldId === "" ? null : foldId,
  });

  if (error) {
    return {
      error: reportedMessage(
        error,
        classifySupabaseError(error),
        "Could not post that comment.",
      ),
    };
  }

  // A comment on a fold reaches whoever posted the fold. A comment on a pattern
  // reaches nobody: the seeded library has no author with an inbox, and
  // emailing every previous commenter would be a mailing list nobody joined.
  if (foldId !== "") {
    const fold = await getFold(foldId);
    if (fold.ok && fold.data) {
      notifyComment(
        fold.data.author.id,
        profile.data,
        "your fold",
        `/f/${foldId}`,
        body.value,
      );
    }
  }

  revalidatePath(patternId === "" ? `/f/${foldId}` : `/p/${patternId}`);
  return {};
}

export async function deleteCommentAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const supabase = await socialClient();
  if (!supabase) return;

  const id = field(formData, "commentId");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;

  // Scoped to the author as well as the id: without the second filter this
  // would lean entirely on row-level security, and a policy is easier to get
  // wrong than a where clause is to read.
  await supabase.from("comments").delete().eq("id", id).eq("author_id", user.id);

  const patternId = field(formData, "patternId");
  const foldId = field(formData, "foldId");
  revalidatePath(patternId === "" ? `/f/${foldId}` : `/p/${patternId}`);
}

// ---------------------------------------------------------------------------
// Following
// ---------------------------------------------------------------------------

export async function toggleFollowAction(formData: FormData): Promise<void> {
  const profile = await ensureProfile();
  if (!profile.ok) return;

  const targetId = field(formData, "profileId");
  if (!/^[0-9a-f-]{36}$/i.test(targetId) || targetId === profile.data.id) return;

  const supabase = await socialClient();
  if (!supabase) return;

  const target = await getProfileById(targetId);
  if (!target.ok || !target.data) return;

  if (field(formData, "following") === "true") {
    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", profile.data.id)
      .eq("following_id", targetId);
  } else {
    const { error } = await supabase
      .from("follows")
      .insert({ follower_id: profile.data.id, following_id: targetId });
    // Only on a follow that actually landed, and only once: re-following
    // somebody you already follow hits the primary key and mails nobody.
    if (!error) notifyFollowed(target.data, profile.data);
  }

  revalidatePath(`/u/${target.data.handle}`);
  revalidatePath(`/u/${profile.data.handle}`);
  revalidatePath("/feed");
}

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

type UploadResult =
  | { readonly ok: true; readonly url: string; readonly path: string }
  | { readonly ok: false; readonly error: string };

/**
 * Put one image in a bucket and hand back its public URL.
 *
 * The object path always starts with the uploader's id, which is what the
 * storage policy checks, so a mistake here is refused rather than mixed into
 * somebody else's folder.
 */
async function uploadImage({
  file,
  bucket,
  userId,
  maxBytes,
}: {
  file: File;
  bucket: "avatars" | "fold-photos";
  userId: string;
  maxBytes: number;
}): Promise<UploadResult> {
  const checked = validateImageUpload(file, maxBytes);
  if (!checked.ok) return { ok: false, error: checked.error };

  const supabase = await socialClient();
  if (!supabase) return { ok: false, error: socialFailureMessage("unconfigured") };

  const path = objectPath(userId, crypto.randomUUID(), checked.value.extension);
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: checked.value.type,
    upsert: false,
    // Photos are immutable: a new upload gets a new name, so this one can be
    // cached hard.
    cacheControl: "31536000",
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("bucket") && message.includes("not found")) {
      return {
        ok: false,
        error:
          "Image storage is not set up yet. Run apps/web/supabase/migrations/" +
          "0001_social.sql, which creates the buckets.",
      };
    }
    return { ok: false, error: `Could not upload that image. ${error.message}` };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { ok: true, url: data.publicUrl, path };
}
