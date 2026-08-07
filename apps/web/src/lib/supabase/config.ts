/**
 * Supabase configuration.
 *
 * Auth is *optional*. If the environment variables are absent the site still
 * builds, deploys and serves every pattern — the sign-in UI just explains that
 * accounts are not configured yet. That is deliberate: a demo deploy should
 * never 500 because a key is missing, and the pattern library does not need an
 * account to be useful (DESIGN.md §8.4: "never gate the magic behind a signup
 * wall").
 *
 * Keys go in `apps/web/.env.local` for development and in the Vercel project's
 * Environment Variables for deploys. See apps/web/DEPLOYING.md.
 */

export const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "";

/**
 * Supabase calls this the "anon" key, and newer projects call the same thing a
 * "publishable" key. Either name works here. It is safe in the browser: it
 * only grants what row-level security allows.
 */
export const SUPABASE_ANON_KEY =
  process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ??
  process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] ??
  "";

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";
}

/** Shown wherever auth would be, when it has not been set up. */
export const SUPABASE_SETUP_HINT =
  "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in " +
  "apps/web/.env.local (or in the Vercel project's environment variables) " +
  "to enable accounts.";
