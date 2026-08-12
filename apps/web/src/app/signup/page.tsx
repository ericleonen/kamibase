import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { signUp } from "@/app/auth/actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = next?.startsWith("/") && !next.startsWith("//") ? next : undefined;

  if (await getCurrentUser()) redirect(destination ?? "/");

  return (
    <div className="py-10">
      <AuthForm
        mode="signup"
        action={signUp}
        configured={isSupabaseConfigured()}
        {...(destination === undefined ? {} : { next: destination })}
      />
    </div>
  );
}
