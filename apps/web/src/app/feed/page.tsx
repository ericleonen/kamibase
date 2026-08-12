import type { Metadata } from "next";
import Link from "next/link";
import { FoldGrid } from "@/components/social/FoldCard";
import { PeopleList } from "@/components/social/PeopleList";
import { SocialNotice } from "@/components/social/SocialNotice";
import { patternTitles } from "@/lib/patterns";
import {
  listFeed,
  listFollowingIds,
  listRecentFolds,
  suggestedProfiles,
} from "@/lib/social";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Feed",
  description: "Folds from the people you follow.",
};

type Tab = "following" | "discover";

/**
 * Folds from the people you follow, with an explicit Discover tab beside it.
 *
 * DESIGN.md §7 asks for the toggle by name, so the algorithm "never fully takes
 * over". There is no algorithm here yet: Following is your follow graph in
 * reverse-chronological order and Discover is everything, newest first. Both
 * are honest about what they are, which a blended ranking with thirteen posts
 * in it could not be.
 */
export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <SocialNotice
          reason="unconfigured"
          message="Accounts are not configured on this deployment yet, so there is no feed."
        />
      </div>
    );
  }

  const user = await getCurrentUser();
  const active: Tab = tab === "discover" || !user ? "discover" : "following";

  const followingIds = user ? await listFollowingIds(user.id) : [];
  const [folds, titles] = await Promise.all([
    active === "following" ? listFeed(followingIds) : listRecentFolds(),
    patternTitles(),
  ]);

  // Suggestions only matter when the Following tab has nothing in it. An empty
  // feed with no way out of it is how this dies before it starts.
  const showSuggestions =
    active === "following" && folds.ok && folds.data.length === 0;
  const suggestions = showSuggestions ? await suggestedProfiles(user?.id ?? null) : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Feed</h1>
        {user && (
          <nav className="flex gap-1 rounded-full p-1" style={{ background: "var(--surface-sunken)" }}>
            <TabLink label="Following" href="/feed" active={active === "following"} />
            <TabLink label="Discover" href="/feed?tab=discover" active={active === "discover"} />
          </nav>
        )}
      </header>

      {!user && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          <Link href="/login" className="font-semibold underline">
            Log in
          </Link>{" "}
          to follow folders. This is everyone&rsquo;s work, newest first.
        </p>
      )}

      {!folds.ok ? (
        <SocialNotice reason={folds.reason} message={folds.message} />
      ) : folds.data.length > 0 ? (
        <FoldGrid folds={folds.data} titles={titles} />
      ) : active === "discover" ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No folds yet. Fold something from{" "}
          <Link href="/explore" className="font-semibold underline">
            the library
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {followingIds.length === 0
              ? "You are not following anyone yet."
              : "Nobody you follow has posted a fold yet. Try Discover."}
          </p>
          <PeopleList people={suggestions} empty="There is nobody else here yet." />
        </div>
      )}
    </div>
  );
}

function TabLink({
  label,
  href,
  active,
}: {
  readonly label: string;
  readonly href: string;
  readonly active: boolean;
}) {
  return (
    <Link
      href={href}
      className="rounded-full px-4 py-1.5 text-sm font-semibold transition hover:opacity-80"
      style={
        active
          ? { background: "var(--text)", color: "var(--surface)" }
          : { color: "var(--text-muted)" }
      }
    >
      {label}
    </Link>
  );
}
