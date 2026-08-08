import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/social/ProfileForm";
import { SocialNotice } from "@/components/social/SocialNotice";
import { ensureProfile } from "@/lib/social";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit profile" };

export default async function ProfileSettingsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <SocialNotice
          reason="unconfigured"
          message="Accounts are not configured on this deployment yet."
        />
      </div>
    );
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings/profile");

  // Reaching this page is the moment a profile has to exist, so create one if
  // the signup trigger did not (an account older than the migration, say).
  const profile = await ensureProfile();

  return (
    <div className="mx-auto max-w-xl space-y-6 py-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Your profile</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          This is what people see next to your folds and comments.
          {profile.ok && (
            <>
              {" "}
              <Link
                href={`/u/${profile.data.handle}`}
                className="font-semibold underline"
                style={{ color: "var(--text)" }}
              >
                View it
              </Link>
              .
            </>
          )}
        </p>
      </header>

      {profile.ok ? (
        <ProfileForm profile={profile.data} />
      ) : (
        <SocialNotice reason={profile.reason} message={profile.message} tone="loud" />
      )}
    </div>
  );
}
