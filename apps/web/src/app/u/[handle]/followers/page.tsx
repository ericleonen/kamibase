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
  return { title: `Followers of @${handle}` };
}

export default async function FollowersPage({
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

  const followers = await listFollows(profile.data.id, "followers");

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
        <h1 className="text-2xl font-bold tracking-tight">Followers</h1>
      </div>

      {followers.ok ? (
        <PeopleList
          people={followers.data}
          empty={`Nobody follows ${nameOf(profile.data)} yet.`}
        />
      ) : (
        <SocialNotice reason={followers.reason} message={followers.message} />
      )}
    </div>
  );
}
