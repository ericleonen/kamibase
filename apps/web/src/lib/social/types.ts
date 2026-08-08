/**
 * The social layer's shapes (DESIGN.md §7).
 *
 * The distinction everything turns on: a **pattern** is the design, a **fold**
 * is somebody's execution of it. One pattern has many folds. That is what makes
 * the site generative rather than an archive, and it is why a beginner's fold
 * of a famous crease pattern is welcome content rather than noise.
 */

/** A public profile. Every account has exactly one. */
export interface Profile {
  readonly id: string;
  /** Lowercase, URL-safe. This is what `/u/:handle` resolves. */
  readonly handle: string;
  /** What they call themselves. Falls back to the handle when empty. */
  readonly displayName: string;
  readonly bio: string;
  readonly avatarUrl?: string;
  readonly avatarPath?: string;
  readonly website?: string;
  readonly createdAt: string;
}

/** The three numbers a profile page puts under the name. */
export interface ProfileStats {
  readonly folds: number;
  readonly followers: number;
  readonly following: number;
}

/** Somebody's fold of a pattern: a photo, and how it went. */
export interface Fold {
  readonly id: string;
  readonly patternId: string;
  readonly photoUrl: string;
  readonly photoPath: string;
  readonly caption: string;
  readonly paper?: string;
  readonly sizeMm?: number;
  readonly minutes?: number;
  /**
   * Difficulty as this folder experienced it, 1 to 10. Distinct from the
   * designer's own rating on the pattern, which is the point: aggregated
   * across real folders it is the honest signal.
   */
  readonly difficulty?: number;
  readonly createdAt: string;
  readonly author: Profile;
}

/** A comment on a pattern or on a fold. Exactly one target is set. */
export interface Comment {
  readonly id: string;
  readonly body: string;
  readonly createdAt: string;
  readonly author: Profile;
  readonly patternId?: string;
  readonly foldId?: string;
}

/** Where a comment hangs. */
export type CommentTarget =
  | { readonly kind: "pattern"; readonly patternId: string }
  | { readonly kind: "fold"; readonly foldId: string };

/**
 * Why a social read or write could not happen.
 *
 * `unconfigured` and `not-migrated` are both *setup* states rather than
 * failures, and the UI says so in plain language instead of showing an error.
 * Accounts are optional on a Kamibase deploy, so both are normal.
 */
export type SocialFailure =
  /** No Supabase keys on this deployment. */
  | "unconfigured"
  /** Keys are present but the social tables do not exist yet. */
  | "not-migrated"
  /** Signed out, or trying to touch somebody else's row. */
  | "unauthorized"
  /** The input did not pass validation. */
  | "invalid"
  /** Anything else the database or storage reported. */
  | "error";

/**
 * The result of a social read.
 *
 * Reads never throw. A missing migration renders a setup notice, not a 500,
 * which is the same contract `@kamibase/core`'s validator holds to: return a
 * typed description of what went wrong and let the caller decide how loud to
 * be about it.
 */
export type SocialResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly reason: SocialFailure; readonly message: string };

export function socialOk<T>(data: T): SocialResult<T> {
  return { ok: true, data };
}

export function socialFail<T>(reason: SocialFailure, message: string): SocialResult<T> {
  return { ok: false, reason, message };
}

/** The data half of a result, or a fallback. Handy where a notice is overkill. */
export function socialData<T>(result: SocialResult<T>, fallback: T): T {
  return result.ok ? result.data : fallback;
}
