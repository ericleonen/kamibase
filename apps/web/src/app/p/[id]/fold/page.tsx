import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ShareFoldForm } from "@/components/social/ShareFoldForm";
import { SocialNotice } from "@/components/social/SocialNotice";
import { patterns } from "@/lib/patterns";
import { ensureProfile } from "@/lib/social";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const pattern = await patterns.get(id);
  return { title: pattern ? `Share your fold of ${pattern.title}` : "Share a fold" };
}

export default async function ShareFoldPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pattern = await patterns.get(id);
  if (!pattern) notFound();

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <SocialNotice
          reason="unconfigured"
          message="Accounts are not configured on this deployment yet, so folds cannot be posted."
        />
      </div>
    );
  }

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/p/${pattern.id}/fold`);

  const profile = await ensureProfile();

  return (
    <div className="mx-auto max-w-xl space-y-6 py-4">
      <header className="space-y-2">
        <Link
          href={`/p/${pattern.id}`}
          className="text-sm underline transition hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
        >
          {pattern.title}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Share your fold</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          A photo is all it takes.
        </p>
      </header>

      {profile.ok ? (
        <ShareFoldForm patternId={pattern.id} patternTitle={pattern.title} />
      ) : (
        <SocialNotice reason={profile.reason} message={profile.message} tone="loud" />
      )}
    </div>
  );
}
