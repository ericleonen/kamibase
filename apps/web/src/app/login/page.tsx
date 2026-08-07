import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { signIn } from "@/app/auth/actions";
import { isSupabaseConfigured, SUPABASE_SETUP_HINT } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Log in" };

const ERRORS: Record<string, string> = {
  "link-expired": "That link has expired. Request a new one by signing up again.",
  "missing-code": "That link was incomplete. Try again from your email.",
  "not-configured": "Accounts are not configured on this deployment yet.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;

  return (
    <div className="py-10">
      {error && ERRORS[error] && (
        <p
          className="mx-auto mb-4 max-w-sm rounded-xl p-3 text-sm"
          role="alert"
          style={{ background: "var(--surface-sunken)", color: "var(--text)" }}
        >
          {ERRORS[error]}
        </p>
      )}
      <AuthForm
        mode="login"
        action={signIn}
        configured={isSupabaseConfigured()}
        setupHint={SUPABASE_SETUP_HINT}
      />
    </div>
  );
}
