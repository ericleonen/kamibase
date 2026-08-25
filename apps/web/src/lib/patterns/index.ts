import { join } from "node:path";
import { CompositePatternRepository } from "./composite";
import { FileSystemPatternRepository } from "./filesystem";
import { SupabasePatternRepository } from "./supabase";
import type { PatternRepository } from "./types";

export * from "./types";
export { FileSystemPatternRepository, readPattern } from "./filesystem";
export { CompositePatternRepository } from "./composite";
export { SupabasePatternRepository } from "./supabase";
export { patternFromDocument, summarise } from "./document";
export {
  filterPatterns,
  techniqueFacets,
  type PatternFilter,
  type TechniqueFacet,
} from "./search";
export { DEFAULT_SORT, SORTS, isSort, type SortKey } from "./sort";

/*
 * `./validate` is deliberately not re-exported here. This module reaches the
 * filesystem and `node:path`, and the save form is a client component that
 * needs the same rules; it imports `@/lib/patterns/validate` directly so that
 * none of this comes with it.
 */

/** Where the seeded `.kami` files live. */
export const PATTERNS_DIRECTORY = join(process.cwd(), "content", "patterns");

/**
 * The hand-seeded library: `.kami` files committed to the repository.
 *
 * Exported on its own as well as through `patterns` below because a save has
 * to know which slugs these have taken. They are files rather than rows, so no
 * unique constraint would catch a collision with one.
 */
export const seededPatterns = new FileSystemPatternRepository({
  directory: PATTERNS_DIRECTORY,
});

/**
 * The library the app reads from: everything anyone has saved, then the seeds.
 *
 * DESIGN.md §9 puts patterns in Postgres, and 0002_patterns.sql is that move.
 * It is additive rather than a cutover: the seeded files are still the library
 * a deploy with no Supabase keys serves, and they still resolve at their own
 * slugs on a deploy that has them. Which store a pattern came from is not a
 * thing any page needs to know.
 */
export const patterns: PatternRepository = new CompositePatternRepository([
  new SupabasePatternRepository(),
  seededPatterns,
]);

/**
 * Route id to title, for anywhere that has a pattern id and needs its name.
 *
 * Folds reference patterns by slug rather than by a foreign key, since not
 * every pattern has a row. One list read resolves every title on a page, which
 * beats a lookup per card.
 */
export async function patternTitles(): Promise<Readonly<Record<string, string>>> {
  const all = await patterns.list();
  return Object.fromEntries(all.map((pattern) => [pattern.id, pattern.title]));
}
