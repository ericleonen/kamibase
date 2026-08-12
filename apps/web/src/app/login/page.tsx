import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { signIn } from "@/app/auth/actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
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
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  // Only same-site paths, so a crafted link cannot bounce someone off-site
  // through our login screen.
  const destination = next?.startsWith("/") && !next.startsWith("//") ? next : undefined;

  if (await getCurrentUser()) redirect(destination ?? "/");

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
        {...(destination === undefined ? {} : { next: destination })}
      />
    </div>
  );
}
