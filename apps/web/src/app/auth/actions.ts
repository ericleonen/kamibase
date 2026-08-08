"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SUPABASE_SETUP_HINT } from "@/lib/supabase/config";

export interface AuthFormState {
  readonly error?: string;
  readonly notice?: string;
}

function readCredentials(formData: FormData): {
  email: string;
  password: string;
  name: string;
} {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
  };
}

/** Where Supabase should send the user back to after a confirmation email. */
async function siteOrigin(): Promise<string> {
  const configured = process.env["NEXT_PUBLIC_SITE_URL"];
  if (configured) return configured.replace(/\/$/, "");
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

export async function signIn(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const supabase = await createClient();
  if (!supabase) return { error: `Accounts are not configured. ${SUPABASE_SETUP_HINT}` };

  const { email, password } = readCredentials(formData);
  if (!email || !password) return { error: "Enter your email and password." };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // Supabase deliberately does not distinguish "no such user" from "wrong
  // password", and neither do we. Telling an attacker which emails have
  // accounts is an enumeration gift.
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const supabase = await createClient();
  if (!supabase) return { error: `Accounts are not configured. ${SUPABASE_SETUP_HINT}` };

  const { email, password, name } = readCredentials(formData);
  if (!email || !password) return { error: "Enter an email and a password." };
  if (password.length < 8) {
    return { error: "Use at least 8 characters for your password." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/callback`,
      ...(name ? { data: { name } } : {}),
    },
  });
  if (error) return { error: error.message };

  // With email confirmation on (Supabase's default), there is no session yet.
  if (!data.session) {
    return {
      notice:
        `Check ${email} for a confirmation link. You can browse and fold ` +
        "everything in the meantime. An account is only needed to save.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
