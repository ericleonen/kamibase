import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  isSupabaseConfigured,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "./config";

/**
 * A Supabase client with no session attached.
 *
 * The cookie-bound client in `./server` is the right one for anything a person
 * does, because row-level security has to know who they are. It is the wrong
 * one for reading the pattern library: touching cookies opts a route out of
 * static rendering, and `generateStaticParams` cannot read them at all, so a
 * build that listed patterns through it would fail rather than prerender.
 *
 * Patterns are public to read, so none of that is needed. This client carries
 * the publishable key and nothing else, which is exactly the `anon` role the
 * "patterns are public" policy grants.
 *
 * `null` when this deployment has no Supabase keys, so callers handle "no
 * database on this deploy" the same way they handle an empty table.
 */
let cached: SupabaseClient | null = null;

export function createPublicClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  cached ??= createSupabaseClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
