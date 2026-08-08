import { describe, expect, it } from "vitest";
import {
  classifySupabaseError,
  MIGRATION_PATH,
  socialFailureMessage,
} from "@/lib/social/errors";

describe("classifySupabaseError", () => {
  it("reads a missing relation as a migration that has not been run", () => {
    expect(classifySupabaseError({ code: "42P01", message: 'relation "public.folds" does not exist' })).toBe(
      "not-migrated",
    );
  });

  it("reads PostgREST's schema-cache miss the same way", () => {
    // This is what actually comes back through supabase-js when the table is
    // absent: PostgREST answers from its cache before Postgres is asked.
    expect(
      classifySupabaseError({
        code: "PGRST205",
        message: "Could not find the table 'public.folds' in the schema cache",
      }),
    ).toBe("not-migrated");
  });

  it("reads a permission denial as missing grants rather than user error", () => {
    expect(classifySupabaseError({ code: "42501", message: "permission denied" })).toBe(
      "not-migrated",
    );
  });

  it("falls back to the message when there is no code", () => {
    expect(classifySupabaseError({ message: 'relation "profiles" does not exist' })).toBe(
      "not-migrated",
    );
    expect(classifySupabaseError({ message: "Could not find the table in the schema cache" })).toBe(
      "not-migrated",
    );
  });

  it("reads constraint violations as invalid input", () => {
    expect(classifySupabaseError({ code: "23505" })).toBe("invalid");
    expect(classifySupabaseError({ code: "23514" })).toBe("invalid");
  });

  it("calls anything else an error, including a dead network", () => {
    expect(classifySupabaseError({ message: "TypeError: fetch failed" })).toBe("error");
    expect(classifySupabaseError(null)).toBe("error");
  });
});

describe("socialFailureMessage", () => {
  it("names the two environment variables when there are no keys", () => {
    const message = socialFailureMessage("unconfigured");
    expect(message).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(message).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  });

  it("names the migration file when the tables are missing", () => {
    expect(socialFailureMessage("not-migrated")).toContain(MIGRATION_PATH);
  });

  it("uses the caller's sentence for a generic error, not the raw database text", () => {
    // "TypeError: fetch failed" is true and useless. The caller knows what the
    // reader was trying to do.
    expect(socialFailureMessage("error", "Could not load the folds of this pattern.")).toBe(
      "Could not load the folds of this pattern.",
    );
  });
});
