import Link from "next/link";
import { initialOf, nameOf, type Profile } from "@/lib/social";

const SIZES = {
  sm: "size-7 text-xs",
  md: "size-9 text-sm",
  lg: "size-12 text-base",
  xl: "size-24 text-3xl",
} as const;

/**
 * The ring, per size.
 *
 * A flat black hairline, not a shadow: avatars land on white cards, on white
 * page and on brand amber, and a border is the one treatment that reads the
 * same on all three. It scales with the avatar because 2px around a 28px
 * circle is a frame, and 1.5px around a 96px one is a scratch.
 */
const BORDERS = {
  sm: "1.5px",
  md: "1.5px",
  lg: "2px",
  xl: "3px",
} as const;

export type AvatarSize = keyof typeof SIZES;

/**
 * Somebody's picture, or the first letter of their name on brand amber.
 *
 * Plain `<img>` rather than `next/image`: the source is a Supabase Storage
 * origin known only from an environment variable, so `images.remotePatterns`
 * would have to be built from the same env at build time and would silently
 * break every avatar on a deploy that set the keys afterwards. These are
 * already small squares that the browser downscaled before upload.
 */
export function Avatar({
  profile,
  size = "md",
}: {
  readonly profile: Profile;
  readonly size?: AvatarSize;
}) {
  const classes = `${SIZES[size]} shrink-0 overflow-hidden rounded-full`;
  const ring = `${BORDERS[size]} solid var(--ink)`;

  if (profile.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- see the note above
      <img
        src={profile.avatarUrl}
        alt={`${nameOf(profile)}'s avatar`}
        className={`${classes} object-cover`}
        loading="lazy"
        style={{ background: "var(--surface-sunken)", border: ring }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`${classes} flex items-center justify-center font-bold`}
      style={{ background: "var(--brand)", color: "var(--ink)", border: ring }}
    >
      {initialOf(profile)}
    </span>
  );
}

/** Avatar plus name, linked to the profile. The byline on every fold. */
export function ProfileChip({
  profile,
  size = "sm",
  subtitle,
}: {
  readonly profile: Profile;
  readonly size?: AvatarSize;
  readonly subtitle?: string;
}) {
  return (
    <Link
      href={`/u/${profile.handle}`}
      className="flex min-w-0 items-center gap-2 transition hover:opacity-70"
    >
      <Avatar profile={profile} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{nameOf(profile)}</span>
        {subtitle && (
          <span className="block truncate text-xs" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </span>
        )}
      </span>
    </Link>
  );
}
