import type { KamiDocument } from "@kamibase/core";
import { socialClient } from "@/lib/social/supabase";
import { patternFromDocument } from "./document";
import { patterns } from "./index";
import type { Pattern, PatternSummary } from "./types";
import { PATTERN_SUMMARY_COLUMNS, rowToSummary, type SummaryRow } from "./supabase";

/**
 * Reads that go through the session rather than around it.
 *
 * The repository in `./supabase` deliberately uses the anonymous key: patterns
 * are listed on pages that prerender, and a cookie-bound client would make
 * every one of them dynamic. That is also why it cannot see a private pattern —
 * `auth.uid()` is null for it, and the select policy in 0004 is exactly
 * `not is_private or author_id = auth.uid()`.
 *
 * These four functions are the other side of that. They ask as whoever is
 * signed in, so the same query answers differently for the author and for a
 * visitor, and the filtering is the policy's rather than a `where` clause
 * somebody could forget. Every one of them reads cookies, so every caller is a
 * page that was already dynamic.
 */

/**
 * Everything one person saved, as the caller is allowed to see it.
 *
 * Their own private drafts included when the caller is them, and excluded when
 * it is anybody else. There is no flag to pass and no way to ask for somebody
 * else's drafts, because the question is answered in Postgres.
 */
export async function listPatternsByAuthor(
  authorId: string,
): Promise<readonly PatternSummary[]> {
  const supabase = await socialClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("patterns")
    .select(PATTERN_SUMMARY_COLUMNS)
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) return [];
  return (data as unknown as SummaryRow[]).map(rowToSummary);
}

/**
 * A pattern the caller owns, or `null`.
 *
 * `null` covers three different situations that are one situation as far as
 * anybody asking is concerned: no such pattern, somebody else's pattern, and a
 * seeded file, which is on disk and belongs to nobody. Settings pages call this
 * and 404 on `null`, which is the right answer to all three: a page you cannot
 * edit is a page that does not exist for you.
 */
export async function getOwnedPattern(slug: string): Promise<Pattern | null> {
  const supabase = await socialClient();
  if (!supabase) return null;

  const { data: user } = await supabase.auth.getUser();
  const id = user.user?.id;
  if (!id) return null;

  const { data, error } = await supabase
    .from("patterns")
    .select(`${PATTERN_SUMMARY_COLUMNS}, document`)
    .eq("slug", slug)
    .eq("author_id", id)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as SummaryRow & { document: unknown };
  return {
    ...patternFromDocument(row.slug, row.document as KamiDocument),
    authorId: row.author_id,
    isPrivate: row.is_private,
  };
}

/**
 * The pattern at this slug as this visitor may see it.
 *
 * The public read first, which is what every visit is and which costs no
 * cookies, then the owner read only when that missed. A private pattern is a
 * 404 to the web and its own page to its author, and the extra query is paid
 * for by 404s rather than by page views.
 */
export async function getVisiblePattern(id: string): Promise<Pattern | null> {
  return (await patterns.get(id)) ?? (await getOwnedPattern(id));
}
