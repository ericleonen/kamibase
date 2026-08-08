import { getCurrentUser } from "@/lib/supabase/server";
import {
  countRows,
  fromSupabaseError,
  mapProfile,
  PROFILE_COLUMNS,
  socialClient,
  unconfigured,
  type ProfileRow,
} from "./supabase";
import { normalizeHandle } from "./validate";
import {
  socialFail,
  socialOk,
  type Profile,
  type ProfileStats,
  type SocialResult,
} from "./types";

/** Look somebody up by the handle in their URL. */
export async function getProfileByHandle(
  handle: string,
): Promise<SocialResult<Profile | null>> {
  const supabase = await socialClient();
  if (!supabase) return unconfigured();

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("handle", normalizeHandle(handle))
    .maybeSingle<ProfileRow>();

  if (error) return fromSupabaseError(error, "Could not load that profile.");
  return socialOk(data ? mapProfile(data) : null);
}

export async function getProfileById(id: string): Promise<SocialResult<Profile | null>> {
  const supabase = await socialClient();
  if (!supabase) return unconfigured();

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", id)
    .maybeSingle<ProfileRow>();

  if (error) return fromSupabaseError(error, "Could not load that profile.");
  return socialOk(data ? mapProfile(data) : null);
}

/**
 * The signed-in user's profile.
 *
 * Three different nulls collapse into one here on purpose: no keys, signed out,
 * and signed in without a profile row all mean "there is no profile to show",
 * and the header does the same thing in each case.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const result = await getProfileById(user.id);
  return result.ok ? result.data : null;
}

/**
 * The signed-in user's profile, creating it if the row is missing.
 *
 * The migration installs a trigger that makes a profile for every new account,
 * so this normally finds one. It exists for the accounts that predate the
 * migration and for the case where the trigger could not be installed: the
 * first time such a user posts anything, their profile appears rather than the
 * write failing on a foreign key they cannot see.
 */
export async function ensureProfile(): Promise<SocialResult<Profile>> {
  const user = await getCurrentUser();
  if (!user) return socialFail("unauthorized", "Log in to do that.");

  const existing = await getProfileById(user.id);
  if (!existing.ok) return existing;
  if (existing.data) return socialOk(existing.data);

  const supabase = await socialClient();
  if (!supabase) return unconfigured();

  const seed = normalizeHandle(user.name || user.email.split("@")[0] || "folder");
  const base = seed.length >= 3 ? seed : `folder${seed}`;

  // Handles are unique, so a collision is a normal outcome rather than an
  // error. Try a few suffixes before giving up.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const handle = attempt === 0 ? base : `${base.slice(0, 20)}${attempt}`;
    const { data, error } = await supabase
      .from("profiles")
      .insert({ id: user.id, handle, display_name: user.name.slice(0, 60) })
      .select(PROFILE_COLUMNS)
      .maybeSingle<ProfileRow>();

    if (!error && data) return socialOk(mapProfile(data));
    // 23505 is a unique violation: that handle went to somebody else.
    if (error && error.code !== "23505") {
      return fromSupabaseError(error, "Could not create your profile.");
    }
  }

  return socialFail("error", "Could not find a free handle. Try setting one yourself.");
}

/** Folds posted, followers, following. */
export async function getProfileStats(id: string): Promise<ProfileStats> {
  const supabase = await socialClient();
  if (!supabase) return { folds: 0, followers: 0, following: 0 };

  const [folds, followers, following] = await Promise.all([
    countRows(supabase, "folds", "author_id", id),
    countRows(supabase, "follows", "following_id", id),
    countRows(supabase, "follows", "follower_id", id),
  ]);

  return { folds, followers, following };
}

/** Does `followerId` follow `followingId`? False whenever it cannot be read. */
export async function isFollowing(
  followerId: string,
  followingId: string,
): Promise<boolean> {
  const supabase = await socialClient();
  if (!supabase) return false;

  const { count, error } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", followerId)
    .eq("following_id", followingId);

  return !error && (count ?? 0) > 0;
}

/** The ids `profileId` follows. The feed is built from this. */
export async function listFollowingIds(profileId: string): Promise<readonly string[]> {
  const supabase = await socialClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", profileId);

  if (error || !data) return [];
  return data.map((row) => (row as { following_id: string }).following_id);
}

type FollowDirection = "followers" | "following";

/** The people following `profileId`, or the people they follow. */
export async function listFollows(
  profileId: string,
  direction: FollowDirection,
  limit = 100,
): Promise<SocialResult<readonly Profile[]>> {
  const supabase = await socialClient();
  if (!supabase) return unconfigured();

  // Walk the edge in whichever direction was asked for, embedding the profile
  // at the far end of it.
  const [filterColumn, joinColumn] =
    direction === "followers"
      ? (["following_id", "follower_id"] as const)
      : (["follower_id", "following_id"] as const);

  const { data, error } = await supabase
    .from("follows")
    .select(`created_at, profile:profiles!follows_${joinColumn}_fkey (${PROFILE_COLUMNS})`)
    .eq(filterColumn, profileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return fromSupabaseError(error, "Could not load that list.");

  const rows = (data ?? []) as unknown as { profile: ProfileRow | null }[];
  return socialOk(rows.flatMap((row) => (row.profile ? [mapProfile(row.profile)] : [])));
}

/**
 * A few profiles to suggest, newest first.
 *
 * Following nobody is the normal state of a new account, and an empty feed with
 * no way out of it is how a social layer dies before it starts. DESIGN.md §7
 * wants ranking that blends follows, tag affinity and recency; this is the
 * honest placeholder until there is enough activity for any of that to mean
 * something.
 */
export async function suggestedProfiles(
  excludeId: string | null,
  limit = 12,
): Promise<readonly Profile[]> {
  const supabase = await socialClient();
  if (!supabase) return [];

  let query = supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as ProfileRow[]).map(mapProfile);
}
