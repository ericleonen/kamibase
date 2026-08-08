import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Link2, Pencil } from "lucide-react";
import { Avatar } from "@/components/social/Avatar";
import { FoldGrid } from "@/components/social/FoldCard";
import { FollowButton } from "@/components/social/FollowButton";
import { SocialNotice } from "@/components/social/SocialNotice";
import { patternTitles } from "@/lib/patterns";
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
  const [user, stats, folds, titles] = await Promise.all([
    getCurrentUser(),
    getProfileStats(profile.id),
    listFoldsByAuthor(profile.id),
    patternTitles(),
  ]);

  const isSelf = user?.id === profile.id;
  const following = user && !isSelf ? await isFollowing(user.id, profile.id) : false;

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

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Folds</h2>

        {!folds.ok ? (
          <SocialNotice reason={folds.reason} message={folds.message} />
        ) : folds.data.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {isSelf ? (
              <>
                You have not posted a fold yet. Pick something from{" "}
                <Link href="/explore" className="font-semibold underline">
                  the library
                </Link>
                , fold it, and share a photo.
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
