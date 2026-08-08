/**
 * The social layer (DESIGN.md §7): profiles, folds, comments and follows.
 *
 * Server-side reads live in `profiles.ts`, `folds.ts` and `comments.ts`. The
 * writes are server actions in `actions.ts`. Everything pure, and so directly
 * testable, is in `validate.ts`, `format.ts`, `errors.ts` and `image.ts`.
 *
 * The whole surface is optional. A deploy with no Supabase keys, or with keys
 * but no migration run, still serves every pattern; the social parts render a
 * short notice explaining which step is missing.
 *
 * **This barrel is server-side.** It re-exports the query modules, which reach
 * `next/headers` through the Supabase server client, so importing it from a
 * Client Component would drag server code into the browser bundle. Client
 * Components import the isomorphic modules by path instead:
 * `@/lib/social/validate`, `@/lib/social/format`, `@/lib/social/image`,
 * `@/lib/social/types`, and `@/lib/social/actions` for the writes.
 */

export * from "./types";
export * from "./errors";
export * from "./format";
export * from "./validate";
export {
  getProfileByHandle,
  getProfileById,
  getCurrentProfile,
  ensureProfile,
  getProfileStats,
  isFollowing,
  listFollowingIds,
  listFollows,
  suggestedProfiles,
} from "./profiles";
export {
  listFoldsForPattern,
  countFoldsForPattern,
  listFoldsByAuthor,
  getFold,
  listFeed,
  listRecentFolds,
} from "./folds";
export { listComments, countComments } from "./comments";
