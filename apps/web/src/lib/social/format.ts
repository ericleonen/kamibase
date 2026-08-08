import type { Fold, Profile } from "./types";

/** What to call somebody: their display name, or their handle. */
export function nameOf(profile: Profile): string {
  return profile.displayName.trim() !== "" ? profile.displayName : profile.handle;
}

/** The letter in the circle when there is no avatar. */
export function initialOf(profile: Profile): string {
  const source = nameOf(profile);
  return (source[0] ?? "?").toUpperCase();
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * "3 days ago", for timestamps in a feed.
 *
 * `now` is a parameter rather than a call to `Date.now()` so this is testable
 * and so a server render and the hydration that follows it cannot disagree.
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";

  const elapsed = now - then;
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return plural(Math.floor(elapsed / MINUTE), "minute");
  if (elapsed < DAY) return plural(Math.floor(elapsed / HOUR), "hour");
  if (elapsed < WEEK) return plural(Math.floor(elapsed / DAY), "day");
  if (elapsed < 52 * WEEK) return plural(Math.floor(elapsed / WEEK), "week");
  return plural(Math.floor(elapsed / (52 * WEEK)), "year");
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
}

/** "62 · 15cm kami · 40 min", the line under a fold photo. Empty parts drop out. */
export function foldDetails(fold: Fold): string {
  return [
    fold.paper,
    fold.sizeMm ? `${fold.sizeMm} mm` : null,
    fold.minutes ? formatMinutes(fold.minutes) : null,
    fold.difficulty ? `felt like ${fold.difficulty}/10` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** "1.2k" past a thousand, so a follower count never wraps its chip. */
export function compactCount(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) {
    const thousands = value / 1000;
    return `${thousands < 10 ? thousands.toFixed(1).replace(/\.0$/, "") : Math.round(thousands)}k`;
  }
  const millions = value / 1_000_000;
  return `${millions < 10 ? millions.toFixed(1).replace(/\.0$/, "") : Math.round(millions)}M`;
}
