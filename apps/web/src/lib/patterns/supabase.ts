import type { SupabaseClient } from "@supabase/supabase-js";
import type { KamiDocument, ValidationLevel } from "@kamibase/core";
import { createPublicClient } from "@/lib/supabase/public";
import { patternFromDocument } from "./document";
import type { Pattern, PatternRepository, PatternSummary } from "./types";

/**
 * Patterns saved from the editor, read out of Postgres.
 *
 * Reads go through the session-less client on purpose: patterns are public
 * (the "patterns are public" policy in 0002_patterns.sql), and a cookie-bound
 * client would opt every page that lists them out of static rendering and make
 * `generateStaticParams` fail outright.
 *
 * Nothing here throws. A deploy with no keys, or one whose migration has not
 * been run, is *unfinished* rather than broken, and the honest rendering of
 * that is the seeded library on its own rather than an error page. The reason
 * is logged once so it is findable, and the list comes back empty.
 */
export class SupabasePatternRepository implements PatternRepository {
  async list(): Promise<readonly PatternSummary[]> {
    const supabase = createPublicClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("patterns")
      .select(PATTERN_SUMMARY_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT);

    if (error || !data) {
      report("list", error);
      return [];
    }
    return (data as unknown as SummaryRow[]).map(rowToSummary);
  }

  async get(id: string): Promise<Pattern | null> {
    const supabase = createPublicClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("patterns")
      .select(`${PATTERN_SUMMARY_COLUMNS}, document`)
      .eq("slug", id)
      .maybeSingle();

    if (error || !data) {
      report("get", error);
      return null;
    }

    const row = data as unknown as SummaryRow & { document: unknown };
    // Graded from the stored document rather than from the row's own counts:
    // the document is the source of truth, and `patternFromDocument` is the
    // same path a seeded file takes. The author is the one fact about a saved
    // pattern that is not in the document, so it is carried across by hand.
    return {
      ...patternFromDocument(row.slug, row.document as KamiDocument),
      authorId: row.author_id,
      isPrivate: row.is_private,
    };
  }
}

/**
 * How many saved patterns a listing reads.
 *
 * The explore page filters and sorts in memory over everything the repository
 * hands it, which is fine while a Kamibase holds hundreds of patterns and is
 * not fine at ten thousand. The cap is here so the page degrades to "the most
 * recent 500" rather than to a slow query, and it is the marker for where
 * server-side paging goes when it is needed.
 */
const LIST_LIMIT = 500;

/**
 * The columns a card needs, shared with the session-bound reads in `./owner`.
 *
 * One list, because two lists is how a column gets added to the listing and
 * forgotten in the author's own view of the same rows.
 */
export const PATTERN_SUMMARY_COLUMNS = [
  "slug",
  "author_id",
  "is_private",
  "title",
  "designer",
  "description",
  "license",
  "difficulty",
  "tags",
  "level",
  "flat_foldable",
  "paper_shape",
  "content_hash",
  "vertex_count",
  "edge_count",
  "face_count",
  "mountain_count",
  "valley_count",
].join(", ");

export interface SummaryRow {
  slug: string;
  author_id: string;
  is_private: boolean;
  title: string;
  designer: string;
  description: string;
  license: string;
  difficulty: number | null;
  tags: string[] | null;
  level: ValidationLevel;
  flat_foldable: boolean;
  paper_shape: string;
  content_hash: string;
  vertex_count: number;
  edge_count: number;
  face_count: number;
  mountain_count: number;
  valley_count: number;
}

/**
 * A row as a card.
 *
 * These columns exist so that listing a hundred patterns does not mean parsing
 * and grading a hundred documents. They were derived from the document at save
 * time by the same `summarise` the seeded library uses.
 */
export function rowToSummary(row: SummaryRow): PatternSummary {
  return {
    id: row.slug,
    authorId: row.author_id,
    isPrivate: row.is_private,
    title: row.title,
    designer: row.designer === "" ? "Unknown" : row.designer,
    ...(row.description === "" ? {} : { description: row.description }),
    level: row.level,
    flatFoldable: row.flat_foldable,
    vertexCount: row.vertex_count,
    edgeCount: row.edge_count,
    faceCount: row.face_count,
    mountainCount: row.mountain_count,
    valleyCount: row.valley_count,
    paperShape: row.paper_shape,
    ...(row.difficulty === null ? {} : { difficulty: row.difficulty }),
    license: row.license,
    subject: [],
    techniques: [],
    tags: row.tags ?? [],
    contentHash: row.content_hash,
  };
}

/** Slugs already taken in the database, among the candidates offered. */
export async function takenSlugs(
  supabase: SupabaseClient,
  candidates: readonly string[],
): Promise<ReadonlySet<string>> {
  const { data, error } = await supabase
    .from("patterns")
    .select("slug")
    .in("slug", [...candidates]);
  if (error || !data) return new Set();
  return new Set((data as { slug: string }[]).map((row) => row.slug));
}

/**
 * Say once, in the server log, why a pattern read came back empty.
 *
 * Not shown to anybody: a visitor looking at the seeded library does not need
 * to hear that a table they have never heard of is missing, and the person who
 * can fix it is reading the log.
 */
function report(operation: string, error: { code?: string | null; message?: string | null } | null): void {
  if (!error) return;
  console.error("[kamibase/patterns]", operation, error.code ?? "", error.message ?? error);
}
