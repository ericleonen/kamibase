import Link from "next/link";
import { toggleFollowAction } from "@/lib/social/actions";
import { SubmitButton } from "./SubmitButton";

/**
 * Follow or unfollow, as a plain form post.
 *
 * No client state: the server already knows whether you follow this person, so
 * the button renders in the right state and the action flips it. That also
 * means it works with JavaScript disabled, which a button whose whole job is
 * one boolean has no excuse not to.
 */
export function FollowButton({
  profileId,
  handle,
  following,
  signedIn,
}: {
  readonly profileId: string;
  readonly handle: string;
  readonly following: boolean;
  readonly signedIn: boolean;
}) {
  if (!signedIn) {
    return (
      <Link
        href={`/login?next=/u/${handle}`}
        className="rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-80"
        style={{ background: "var(--brand)", color: "var(--ink)" }}
      >
        Follow
      </Link>
    );
  }

  return (
    <form action={toggleFollowAction}>
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="following" value={String(following)} />
      <SubmitButton
        label={following ? "Following" : "Follow"}
        pendingLabel="…"
        variant={following ? "outline" : "brand"}
        title={following ? `Stop following @${handle}` : `Follow @${handle}`}
      />
    </form>
  );
}
