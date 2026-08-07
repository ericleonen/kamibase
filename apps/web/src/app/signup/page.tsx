import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { signUp } from "@/app/auth/actions";
import { isSupabaseConfigured, SUPABASE_SETUP_HINT } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <div className="py-10">
      <AuthForm
        mode="signup"
        action={signUp}
        configured={isSupabaseConfigured()}
        setupHint={SUPABASE_SETUP_HINT}
      />
    </div>
  );
}
