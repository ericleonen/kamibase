import { join } from "node:path";
import { FileSystemPatternRepository } from "./filesystem";
import type { PatternRepository } from "./types";

export * from "./types";
export { FileSystemPatternRepository, readPattern } from "./filesystem";

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
