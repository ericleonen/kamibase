import {
  fromSupabaseError,
  mapProfile,
  PROFILE_COLUMNS,
  socialClient,
  unconfigured,
  type ProfileRow,
} from "./supabase";
import { socialOk, type Comment, type CommentTarget, type SocialResult } from "./types";

const COMMENT_SELECT =
  `id, body, created_at, pattern_id, fold_id, ` +
  `author:profiles!comments_author_id_fkey (${PROFILE_COLUMNS})`;

interface CommentRow {
  id: string;
  body: string;
  created_at: string;
  pattern_id: string | null;
  fold_id: string | null;
  author: ProfileRow | null;
}

function mapComment(row: CommentRow): Comment | null {
  if (!row.author) return null;
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    author: mapProfile(row.author),
    ...(row.pattern_id ? { patternId: row.pattern_id } : {}),
    ...(row.fold_id ? { foldId: row.fold_id } : {}),
  };
}

/**
 * A comment thread, oldest first.
 *
 * Chronological rather than ranked. A thread under a crease pattern is a
 * conversation about how to fold the thing, and conversations read forwards.
 */
export async function listComments(
  target: CommentTarget,
  limit = 200,
): Promise<SocialResult<readonly Comment[]>> {
  const supabase = await socialClient();
  if (!supabase) return unconfigured();

  const query = supabase
    .from("comments")
    .select(COMMENT_SELECT)
    .order("created_at", { ascending: true })
    .limit(limit);

  const { data, error } =
    target.kind === "pattern"
      ? await query.eq("pattern_id", target.patternId)
      : await query.eq("fold_id", target.foldId);

  if (error) return fromSupabaseError(error, "Could not load the comments.");

  const rows = (data ?? []) as unknown as CommentRow[];
  return socialOk(
    rows.flatMap((row) => {
      const comment = mapComment(row);
      return comment ? [comment] : [];
    }),
  );
}

/** How many comments a pattern has, for the tab label. */
export async function countComments(target: CommentTarget): Promise<number> {
  const supabase = await socialClient();
  if (!supabase) return 0;

  const query = supabase.from("comments").select("*", { count: "exact", head: true });
  const { count, error } =
    target.kind === "pattern"
      ? await query.eq("pattern_id", target.patternId)
      : await query.eq("fold_id", target.foldId);

  return error ? 0 : (count ?? 0);
}
