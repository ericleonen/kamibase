import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EyeOff, Link2, Pencil, Settings2 } from "lucide-react";
import { Avatar } from "@/components/social/Avatar";
import { PatternCard } from "@/components/PatternCard";
import { FoldGrid } from "@/components/social/FoldCard";
import { FollowButton } from "@/components/social/FollowButton";
import { SocialNotice } from "@/components/social/SocialNotice";
import { getAccountSettings } from "@/lib/social/account";
import { patternTitles } from "@/lib/patterns";
import { listPatternsByAuthor } from "@/lib/patterns/owner";
import {
  compactCount,
  getProfileByHandle,
  getProfileStats,
  isFollowing,
  listFoldsByAuthor,
  nameOf,
} from "@/lib/social";
import { getCurrentUser } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const result = await getProfileByHandle(handle);
  if (!result.ok || !result.data) return { title: `@${handle}` };
  return {
    title: `${nameOf(result.data)} (@${result.data.handle})`,
    description: result.data.bio || `Folds by ${nameOf(result.data)} on Kamibase.`,
  };
}

/** A number under the name. Followers and following link to their lists. */
function Stat({
  label,
  value,
  href,
}: {
  readonly label: string;
  readonly value: number;
  readonly href?: string;
}) {
  const body = (
    <>
      <span className="font-bold tabular-nums">{compactCount(value)}</span>{" "}
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className="text-sm transition hover:opacity-70">
      {body}
    </Link>
  ) : (
    <span className="text-sm">{body}</span>
  );
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const result = await getProfileByHandle(handle);

  // A deployment without keys, or without the migration, has no profiles to
  // fail to find. Say which step is missing rather than showing a 404 that
  // blames the URL.
  if (!result.ok) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <SocialNotice reason={result.reason} message={result.message} />
      </div>
    );
  }
  if (!result.data) notFound();

  const profile = result.data;
  const [user, stats, folds, titles, saved] = await Promise.all([
    getCurrentUser(),
    getProfileStats(profile.id),
    listFoldsByAuthor(profile.id),
    patternTitles(),
    listPatternsByAuthor(profile.id),
  ]);

  const isSelf = user?.id === profile.id;
  const following = user && !isSelf ? await isFollowing(user.id, profile.id) : false;

  /*
   * A private account keeps its name, its handle and its counts.
   *
   * Row-level security is what actually withholds the folds (see
   * `supabase/migrations/0003_settings.sql`); this only decides what to say in
   * the space where they would have been. Hiding the profile row as well would
   * turn "this account is private" into "this account does not exist", which
   * breaks every link anybody ever shared and tells a follower nothing.
   */
  const account = await getAccountSettings(profile.id);
  const hidden = account.isPrivate && !isSelf && !following;

  return (
    <div className="space-y-8">
      <header className="flex flex-col items-center gap-4 pt-4 text-center">
        <Avatar profile={profile} size="xl" />

        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{nameOf(profile)}</h1>
          <p className="font-mono text-sm" style={{ color: "var(--text-muted)" }}>
            @{profile.handle}
          </p>
        </div>

        {profile.bio && (
          <p className="max-w-xl whitespace-pre-wrap text-sm">{profile.bio}</p>
        )}

        {profile.website && (
          <a
            href={profile.website}
            target="_blank"
            rel="noreferrer noopener nofollow"
            className="flex items-center gap-1.5 text-sm underline transition hover:opacity-70"
            style={{ color: "var(--brand-strong)" }}
          >
            <Link2 className="size-3.5" aria-hidden />
            {profile.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </a>
        )}

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Stat label="folds" value={stats.folds} />
          <Stat
            label="followers"
            value={stats.followers}
            href={`/u/${profile.handle}/followers`}
          />
          <Stat
            label="following"
            value={stats.following}
            href={`/u/${profile.handle}/following`}
          />
        </div>

        {isSelf ? (
          <Link
            href="/settings/profile"
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-70"
            style={{ border: "1px solid var(--border-strong)" }}
          >
            <Pencil className="size-3.5" aria-hidden />
            Edit profile
          </Link>
        ) : (
          <FollowButton
            profileId={profile.id}
            handle={profile.handle}
            following={following}
            signedIn={user !== null}
          />
        )}
      </header>

      {/*
       * Patterns before folds, on a profile that has any.
       *
       * A fold is a photograph of one evening; a crease pattern is a design
       * other people can build from, and it is the thing this site is for. It
       * is also, on your own profile, the only place your saved patterns are
       * gathered — which is what makes deleting one something you can find
       * rather than something you have to remember a URL for.
       *
       * Not hidden behind the private-account gate. Row-level security keeps
       * folds private; patterns are public by policy (0002_patterns.sql),
       * because a pattern nobody can see is not on a pattern hub.
       */}
      {saved.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Patterns</h2>
          <div className="pattern-grid">
            {saved.map((pattern) => (
              <div key={pattern.id} className="space-y-1.5">
                <PatternCard pattern={pattern} />
                {/*
                 * A private one is in this grid because it is yours; nobody
                 * else's copy of this page has it. The badge is the reminder
                 * that the link beside it goes somewhere nobody else can
                 * follow.
                 */}
                {isSelf && (
                  <div className="flex items-center gap-3 px-1 text-xs">
                    {pattern.isPrivate && (
                      <span
                        className="flex items-center gap-1 font-semibold"
                        style={{ color: "var(--brand-strong)" }}
                      >
                        <EyeOff className="size-3" aria-hidden />
                        Private
                      </span>
                    )}
                    <Link
                      href={`/p/${pattern.id}/settings`}
                      className="ml-auto flex items-center gap-1 transition hover:opacity-70"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <Settings2 className="size-3" aria-hidden />
                      Settings
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Folds</h2>

        {hidden ? (
          <div
            className="rounded-2xl px-6 py-10 text-center"
            style={{ background: "var(--surface-sunken)" }}
          >
            <p className="font-semibold">This account is private.</p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              Follow {nameOf(profile)} to see their folds.
            </p>
          </div>
        ) : !folds.ok ? (
          <SocialNotice reason={folds.reason} message={folds.message} />
        ) : folds.data.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {isSelf ? (
              <>
                No folds yet. Pick something from{" "}
                <Link href="/explore" className="font-semibold underline">
                  the library
                </Link>
                .
              </>
            ) : (
              `${nameOf(profile)} has not posted a fold yet.`
            )}
          </p>
        ) : (
          <FoldGrid folds={folds.data} titles={titles} />
        )}
      </section>
    </div>
  );
}
