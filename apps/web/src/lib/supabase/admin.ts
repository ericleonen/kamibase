import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

/**
 * The service-role client: Supabase with row-level security switched off.
 *
 * Two things on this site cannot be done any other way, and both are about the
 * `auth.users` table, which the publishable key cannot touch at all:
 *
 *   * reading an account's email address, to send it a notification;
 *   * deleting an account, which means deleting the auth user, not just the
 *     profile row hanging off it.
 *
 * Everything else goes through the normal client and RLS, and should keep
 * doing so. A service-role key is a key that can read and write every row
 * belonging to every user, so the rule for this module is: it never takes a
 * user id from a form, only from a verified session, and it never returns a
 * client to anything that runs in the browser.
 *
 * `SUPABASE_SERVICE_ROLE_KEY` is deliberately not prefixed `NEXT_PUBLIC_`.
 * Anything with that prefix is inlined into the JavaScript bundle, which for
 * this key would be a full database compromise published to every visitor.
 *
 * Absent by default. A deployment without it keeps working: notifications are
 * simply not sent and account deletion says it is not available here rather
 * than pretending.
 */
export function adminClient(): SupabaseClient | null {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!SUPABASE_URL || !key) return null;

  return createClient(SUPABASE_URL, key, {
    auth: {
      // No session to persist and none to refresh: this client acts as the
      // service, not as a person, and every call is one request long.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function isAdminConfigured(): boolean {
  return adminClient() !== null;
}
