import {
  fromSupabaseError,
  mapProfile,
  PROFILE_COLUMNS,
  socialClient,
  unconfigured,
  type ProfileRow,
} from "./supabase";
import { socialOk, type Fold, type SocialResult } from "./types";

const FOLD_COLUMNS =
  "id, pattern_id, photo_url, photo_path, caption, paper, size_mm, minutes, difficulty, created_at";

const FOLD_SELECT = `${FOLD_COLUMNS}, author:profiles!folds_author_id_fkey (${PROFILE_COLUMNS})`;

interface FoldRow {
  id: string;
  pattern_id: string;
  photo_url: string;
  photo_path: string;
  caption: string | null;
  paper: string | null;
  size_mm: number | null;
  minutes: number | null;
  difficulty: number | null;
  created_at: string;
  author: ProfileRow | null;
}

function mapFold(row: FoldRow): Fold | null {
  // A fold without its author is a row that should not exist: the foreign key
  // is NOT NULL and cascades. Drop it rather than inventing an author.
  if (!row.author) return null;
  return {
    id: row.id,
    patternId: row.pattern_id,
    photoUrl: row.photo_url,
    photoPath: row.photo_path,
    caption: row.caption ?? "",
    createdAt: row.created_at,
    author: mapProfile(row.author),
    ...(row.paper ? { paper: row.paper } : {}),
    ...(row.size_mm ? { sizeMm: row.size_mm } : {}),
    ...(row.minutes ? { minutes: row.minutes } : {}),
    ...(row.difficulty ? { difficulty: row.difficulty } : {}),
  };
}

function mapFolds(rows: readonly FoldRow[]): readonly Fold[] {
  return rows.flatMap((row) => {
    const fold = mapFold(row);
    return fold ? [fold] : [];
  });
}

/** Every fold of one pattern, newest first. */
export async function listFoldsForPattern(
  patternId: string,
  limit = 24,
): Promise<SocialResult<readonly Fold[]>> {
  const supabase = await socialClient();
  if (!supabase) return unconfigured();

  const { data, error } = await supabase
    .from("folds")
    .select(FOLD_SELECT)
    .eq("pattern_id", patternId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return fromSupabaseError(error, "Could not load the folds of this pattern.");
  return socialOk(mapFolds((data ?? []) as unknown as FoldRow[]));
}

/** How many folds a pattern has, without fetching them. */
export async function countFoldsForPattern(patternId: string): Promise<number> {
  const supabase = await socialClient();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from("folds")
    .select("*", { count: "exact", head: true })
    .eq("pattern_id", patternId);

  return error ? 0 : (count ?? 0);
}

/** One person's folds, newest first. */
export async function listFoldsByAuthor(
  authorId: string,
  limit = 60,
): Promise<SocialResult<readonly Fold[]>> {
  const supabase = await socialClient();
  if (!supabase) return unconfigured();

  const { data, error } = await supabase
    .from("folds")
    .select(FOLD_SELECT)
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return fromSupabaseError(error, "Could not load these folds.");
  return socialOk(mapFolds((data ?? []) as unknown as FoldRow[]));
}

export async function getFold(id: string): Promise<SocialResult<Fold | null>> {
  const supabase = await socialClient();
  if (!supabase) return unconfigured();

  // A malformed id would make Postgres complain about uuid syntax rather than
  // return nothing, which would render as an error where "no such fold" is the
  // truth.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return socialOk(null);

  const { data, error } = await supabase
    .from("folds")
    .select(FOLD_SELECT)
    .eq("id", id)
    .maybeSingle<FoldRow>();

  if (error) return fromSupabaseError(error, "Could not load that fold.");
  return socialOk(data ? mapFold(data) : null);
}

/**
 * Folds from the people you follow, newest first.
 *
 * Two queries rather than one: PostgREST has no subquery, so the follow list is
 * fetched and then used as an `in` filter. At the size a personal follow graph
 * actually reaches, that is cheaper than the view it would otherwise take.
 */
export async function listFeed(
  followingIds: readonly string[],
  limit = 40,
): Promise<SocialResult<readonly Fold[]>> {
  if (followingIds.length === 0) return socialOk([]);

  const supabase = await socialClient();
  if (!supabase) return unconfigured();

  const { data, error } = await supabase
    .from("folds")
    .select(FOLD_SELECT)
    .in("author_id", [...followingIds])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return fromSupabaseError(error, "Could not load your feed.");
  return socialOk(mapFolds((data ?? []) as unknown as FoldRow[]));
}

/** The newest folds from anyone. The Discover half of the feed. */
export async function listRecentFolds(limit = 40): Promise<SocialResult<readonly Fold[]>> {
  const supabase = await socialClient();
  if (!supabase) return unconfigured();

  const { data, error } = await supabase
    .from("folds")
    .select(FOLD_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return fromSupabaseError(error, "Could not load recent folds.");
  return socialOk(mapFolds((data ?? []) as unknown as FoldRow[]));
}
