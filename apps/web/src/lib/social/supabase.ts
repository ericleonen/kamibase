import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  classifySupabaseError,
  reportedMessage,
  socialFailureMessage,
  type SupabaseErrorLike,
} from "./errors";
import { socialFail, type SocialResult } from "./types";

/**
 * Shared plumbing for the social queries.
 *
 * Every read in this folder starts by asking for a client and ends by turning a
 * Supabase error into a typed failure. Both halves live here so no query module
 * has to remember the contract.
 */

/** The client, or `null` when this deployment has no Supabase keys. */
export async function socialClient(): Promise<SupabaseClient | null> {
  return createClient();
}

/** The standard "no keys on this deploy" failure. */
export function unconfigured<T>(): SocialResult<T> {
  return socialFail("unconfigured", socialFailureMessage("unconfigured"));
}

/** Turn a Supabase error into the failure the UI renders. */
export function fromSupabaseError<T>(
  error: SupabaseErrorLike | null,
  fallback: string,
): SocialResult<T> {
  const reason = classifySupabaseError(error);
  return socialFail(reason, reportedMessage(error, reason, fallback));
}

/** The columns a `Profile` needs, in one place so the embeds stay in step. */
export const PROFILE_COLUMNS =
  "id, handle, display_name, bio, avatar_url, avatar_path, website, created_at";

export interface ProfileRow {
  id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  avatar_path: string | null;
  website: string | null;
  created_at: string;
}

export function mapProfile(row: ProfileRow) {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name ?? "",
    bio: row.bio ?? "",
    createdAt: row.created_at,
    ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {}),
    ...(row.avatar_path ? { avatarPath: row.avatar_path } : {}),
    ...(row.website ? { website: row.website } : {}),
  };
}

/**
 * Count rows matching a filter without fetching them.
 *
 * Returns 0 rather than a failure: a follower count that cannot be read should
 * leave the page rendering, not replace it with an error.
 */
export async function countRows(
  supabase: SupabaseClient,
  table: string,
  column: string,
  value: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  if (error) return 0;
  return count ?? 0;
}
