import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PeopleList } from "@/components/social/PeopleList";
import { SocialNotice } from "@/components/social/SocialNotice";
import { getProfileByHandle, listFollows, nameOf } from "@/lib/social";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  return { title: `Who @${handle} follows` };
}

export default async function FollowingPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const profile = await getProfileByHandle(handle);

  if (!profile.ok) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <SocialNotice reason={profile.reason} message={profile.message} />
      </div>
    );
  }
  if (!profile.data) notFound();

  const following = await listFollows(profile.data.id, "following");

  return (
    <div className="mx-auto max-w-xl space-y-5 py-4">
      <div>
        <Link
          href={`/u/${profile.data.handle}`}
          className="text-sm underline transition hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
        >
          {nameOf(profile.data)}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Following</h1>
      </div>

      {following.ok ? (
        <PeopleList
          people={following.data}
          empty={`${nameOf(profile.data)} is not following anyone yet.`}
        />
      ) : (
        <SocialNotice reason={following.reason} message={following.message} />
      )}
    </div>
  );
}
