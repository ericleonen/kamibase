import { join } from "node:path";
import { FileSystemPatternRepository } from "./filesystem";
import type { PatternRepository } from "./types";

export * from "./types";
export { FileSystemPatternRepository, readPattern } from "./filesystem";
export { filterPatterns, techniqueFacets, type PatternFilter } from "./search";

/** Where the seeded `.kami` files live. */
export const PATTERNS_DIRECTORY = join(process.cwd(), "content", "patterns");

/**
 * The repository the app reads from.
 *
 * Swapping this one binding for a Postgres-backed implementation is the whole
 * of the Phase 4 migration (DESIGN.md §9); nothing else imports the
 * filesystem.
 */
export const patterns: PatternRepository = new FileSystemPatternRepository({
  directory: PATTERNS_DIRECTORY,
});

/**
 * Route id to title, for anywhere that has a pattern id and needs its name.
 *
 * Folds reference patterns by slug rather than by a foreign key, since the
 * patterns are still files on disk. One list read resolves every title on a
 * page, which beats a lookup per card.
 */
export async function patternTitles(): Promise<Readonly<Record<string, string>>> {
  const all = await patterns.list();
  return Object.fromEntries(all.map((pattern) => [pattern.id, pattern.title]));
}
