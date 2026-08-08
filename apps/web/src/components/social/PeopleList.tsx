import Link from "next/link";
import { nameOf, type Profile } from "@/lib/social";
import { Avatar } from "./Avatar";

/** A list of people: follower and following lists, and the feed's suggestions. */
export function PeopleList({
  people,
  empty,
}: {
  readonly people: readonly Profile[];
  readonly empty: string;
}) {
  if (people.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {empty}
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {people.map((profile) => (
        <li key={profile.id}>
          <Link
            href={`/u/${profile.handle}`}
            className="flex items-center gap-3 rounded-2xl p-2 transition hover:opacity-70"
          >
            <Avatar profile={profile} size="lg" />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{nameOf(profile)}</span>
              <span
                className="block truncate font-mono text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                @{profile.handle}
              </span>
              {profile.bio && (
                <span
                  className="mt-0.5 line-clamp-1 block text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {profile.bio}
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
