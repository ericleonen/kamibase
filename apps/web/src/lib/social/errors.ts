import { SUPABASE_SETUP_HINT } from "@/lib/supabase/config";
import type { SocialFailure } from "./types";

/** The shape PostgREST and supabase-js hand back on a failed query. */
export interface SupabaseErrorLike {
  readonly code?: string | null;
  readonly message?: string | null;
  readonly details?: string | null;
  readonly hint?: string | null;
}

/**
 * Postgres and PostgREST codes that mean "the migration has not been run".
 *
 * `42P01` is Postgres saying the relation does not exist. `PGRST205` and
 * `PGRST202` are PostgREST saying the same thing from its schema cache, which
 * is what you actually get through supabase-js. `42501` is a permissions
 * failure, which on a fresh project means the grants in the migration are
 * missing rather than that the user did something wrong.
 */
const NOT_MIGRATED_CODES = new Set(["42P01", "42501", "PGRST205", "PGRST202", "PGRST106"]);

/** Postgres codes worth turning into a sentence a person can act on. */
const CONSTRAINT_CODES = new Set(["23505", "23514", "23503"]);

/**
 * Decide what a failed Supabase call means.
 *
 * The distinction that matters is setup versus fault. A deploy with no keys and
 * a deploy whose SQL has not been run are both *unfinished*, not broken, and
 * telling someone "run the migration" is worth more than an error card.
 */
export function classifySupabaseError(error: SupabaseErrorLike | null): SocialFailure {
  if (!error) return "error";
  const code = error.code ?? "";
  if (NOT_MIGRATED_CODES.has(code)) return "not-migrated";
  if (CONSTRAINT_CODES.has(code)) return "invalid";
  // A missing table sometimes arrives as prose rather than a code, depending on
  // which layer noticed first.
  const message = (error.message ?? "").toLowerCase();
  if (
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  ) {
    return "not-migrated";
  }
  return "error";
}

/** The migration's path, quoted in every "not set up yet" message. */
export const MIGRATION_PATH = "apps/web/supabase/migrations/0001_social.sql";

export const NOT_MIGRATED_HINT =
  `Run ${MIGRATION_PATH} in your Supabase project's SQL editor to create the ` +
  "profiles, follows, folds and comments tables. See apps/web/SOCIAL.md.";

/** A sentence for a failure, aimed at whoever can actually fix it. */
export function socialFailureMessage(
  reason: SocialFailure,
  fallback = "Something went wrong.",
): string {
  switch (reason) {
    case "unconfigured":
      return `Accounts are not configured on this deployment. ${SUPABASE_SETUP_HINT}`;
    case "not-migrated":
      return `The social tables are not set up yet. ${NOT_MIGRATED_HINT}`;
    case "unauthorized":
      return "Log in to do that.";
    default:
      return fallback;
  }
}

/**
 * The sentence to show, and the detail to log.
 *
 * Supabase messages are written for whoever wrote the query, not for whoever is
 * reading the page: an unreachable project surfaces as `TypeError: fetch
 * failed`, which tells a visitor nothing and looks like the site is broken. So
 * the raw text goes to the server log and the reader gets the caller's sentence
 * about what could not be done.
 */
export function reportedMessage(
  error: SupabaseErrorLike | null,
  reason: SocialFailure,
  fallback: string,
): string {
  if (error && reason === "error") {
    console.error("[kamibase/social]", error.code ?? "", error.message ?? error);
  }
  return socialFailureMessage(reason, fallback);
}
