"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { metadataSiteUrl } from "@/lib/site-url";
import { updateAccountSettings } from "./account";

export interface AccountState {
  readonly error?: string;
  readonly notice?: string;
}

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function checked(form: FormData, name: string): boolean {
  return form.get(name) === "on" || form.get(name) === "true";
}

/**
 * Privacy and notification switches.
 *
 * One form, one save, because these are four checkboxes and a page that saves
 * each of them separately would be four times the chrome for the same four
 * decisions.
 */
export async function updateAccountAction(
  _previous: AccountState,
  form: FormData,
): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You are not signed in." };

  const result = await updateAccountSettings(user.id, {
    isPrivate: checked(form, "isPrivate"),
    notifyFollows: checked(form, "notifyFollows"),
    notifyFolds: checked(form, "notifyFolds"),
    notifyComments: checked(form, "notifyComments"),
  });
  if (!result.ok) return { error: result.error };

  revalidatePath("/settings/account");
  return { notice: "Saved." };
}

/**
 * Change the address the account signs in with.
 *
 * Supabase sends a confirmation link to the *new* address and does not move the
 * account until it is clicked, which is the right shape: an address nobody can
 * receive mail at is an account nobody can get back into.
 */
export async function changeEmailAction(
  _previous: AccountState,
  form: FormData,
): Promise<AccountState> {
  const email = field(form, "email");
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) {
    return { error: "That does not look like an email address." };
  }

  const supabase = await createClient();
  if (!supabase) return { error: "Accounts are not configured on this deployment." };

  const user = await getCurrentUser();
  if (!user) return { error: "You are not signed in." };
  if (user.email.toLowerCase() === email.toLowerCase()) {
    return { notice: "That is already your address." };
  }

  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: new URL("/auth/callback", metadataSiteUrl()).toString() },
  );
  if (error) return { error: error.message };

  return {
    notice: `Check ${email} for a link. The address changes when you follow it, not before.`,
  };
}

/**
 * Send a password reset link.
 *
 * To the address on file rather than to one typed into the form: this is a
 * signed-in page, the account is known, and a field here would only be a way to
 * mail somebody else's inbox.
 */
export async function resetPasswordAction(): Promise<AccountState> {
  const supabase = await createClient();
  if (!supabase) return { error: "Accounts are not configured on this deployment." };

  const user = await getCurrentUser();
  if (!user) return { error: "You are not signed in." };

  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: new URL("/auth/callback", metadataSiteUrl()).toString(),
  });
  if (error) return { error: error.message };

  return { notice: `A reset link is on its way to ${user.email}.` };
}

/**
 * Delete the account, for good.
 *
 * Deleting the `auth.users` row is what actually ends an account; the profile,
 * folds and comments follow it out through `on delete cascade`. Only the
 * service role can do that, so a deployment without `SUPABASE_SERVICE_ROLE_KEY`
 * says so instead of half-deleting somebody.
 *
 * The id comes from the verified session and never from the form. The typed
 * confirmation is a speed bump for the person, not a security control, and it
 * is not treated as one.
 */
export async function deleteAccountAction(
  _previous: AccountState,
  form: FormData,
): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You are not signed in." };

  if (field(form, "confirm").toLowerCase() !== "delete") {
    return { error: 'Type "delete" to confirm.' };
  }

  const admin = adminClient();
  if (!admin) {
    return {
      error:
        "Account deletion is not available on this deployment. Write in through /help and it will be done by hand.",
    };
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { error: error.message };

  // Sign the now-nonexistent session out before leaving, so the browser is not
  // holding a cookie for an account that is gone.
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();

  redirect("/?deleted=1");
}
