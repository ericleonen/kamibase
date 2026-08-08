import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isSupabaseConfigured,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "./config";

/**
 * A Supabase client for Server Components, route handlers and server actions.
 *
 * Returns `null` when auth is not configured, so callers handle "no accounts
 * yet" the same way they handle "signed out" rather than crashing the render.
 */
export async function createClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. The middleware refreshes the
          // session on every request, so this is safe to swallow. It is the
          // pattern Supabase's own Next.js guide uses.
        }
      },
    },
  });
}

export interface CurrentUser {
  readonly id: string;
  readonly email: string;
  /** Display name from user metadata, falling back to the email's local part. */
  readonly name: string;
}

/**
 * The signed-in user, or `null`.
 *
 * Uses `getUser()` rather than `getSession()` on purpose: `getSession()` reads
 * the cookie without verifying it, so it can be spoofed. `getUser()` checks
 * with the auth server.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;

  const metadata = data.user.user_metadata as { name?: unknown } | null;
  const name =
    typeof metadata?.name === "string" && metadata.name !== ""
      ? metadata.name
      : (data.user.email.split("@")[0] ?? data.user.email);

  return { id: data.user.id, email: data.user.email, name };
}
