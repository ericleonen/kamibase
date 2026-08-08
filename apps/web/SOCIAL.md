# The social layer

Profiles, folds, comments and following. DESIGN.md §7.

The whole thing turns on one distinction: **a pattern is the design, a fold is
somebody's execution of it.** One pattern has many folds. That is what makes the
site generative rather than an archive, and it is why a beginner's fold of a
famous crease pattern is welcome content rather than noise.

## Set it up

Accounts have to work first, so start with [AUTH.md](AUTH.md) if you have not
put the Supabase keys in yet. Then:

1. Open your Supabase project and go to **SQL Editor -> New query**.
2. Paste the whole of
   [`supabase/migrations/0001_social.sql`](supabase/migrations/0001_social.sql)
   and press **Run**.
3. That is it. There are no new environment variables.

The migration creates four tables, their row-level security policies, two
storage buckets, and a trigger that gives every new account a profile. It is
safe to run twice: every object is created with a guard, and existing accounts
are backfilled with profiles on the way through.

**Check it worked:** sign in and open `/settings/profile`. If the tables are
missing you get a note saying so with the file name in it, not an error page.

### Buckets and image sizes

| Bucket | Holds | Cap | Longest edge after resizing |
|---|---|---|---|
| `avatars` | Profile pictures | 2MB | 512px |
| `fold-photos` | Fold photos | 8MB | 1600px |

Photos are resized in the browser before they upload, so a phone camera's 8MB
JPEG usually arrives as about 400KB. The caps above are the last line of
defence, not the expected size.

## What exists

| Route | |
|---|---|
| `/u/:handle` | Profile: picture, bio, link, counts, follow button, their folds |
| `/u/:handle/followers`, `/u/:handle/following` | Who follows whom |
| `/settings/profile` | Edit your own: picture, name, handle, bio, link |
| `/feed` | Folds from people you follow, with a Discover tab beside it |
| `/f/:id` | One fold: photo, notes, the pattern it came from, comments |
| `/p/:id` | The pattern page now carries its folds and a comment thread |
| `/p/:id/folds` | Every fold of one pattern |
| `/p/:id/fold` | Post yours |

Comments hang off either a pattern or a fold, and both threads use the same
component.

## How it is put together

```
src/lib/social/
  types.ts       Profile, Fold, Comment, SocialResult
  validate.ts    input rules, pure and unit-tested
  format.ts      names, relative times, counts
  image.ts       browser-side downscaling
  errors.ts      what a Supabase failure means
  supabase.ts    shared client and row mapping
  profiles.ts    ┐
  folds.ts       ├ server-side reads
  comments.ts    ┘
  actions.ts     every write, as server actions
```

`index.ts` is the server-side barrel. Client Components import the isomorphic
modules by path (`@/lib/social/validate` and friends) so server code never
reaches the browser bundle.

Three decisions worth knowing about:

**Reads never throw.** They return a `SocialResult`, which is either the data or
a typed reason. Two of those reasons are setup states rather than faults: no
Supabase keys on this deployment, and keys but no migration. Both render a short
note explaining which step is missing, and the rest of the page carries on. This
is the same contract `@kamibase/core`'s validator holds to.

**Uploads go through a server action, not the browser.** The page never opens a
connection to Supabase Storage, which keeps the site's
Content-Security-Policy tight; the action re-checks type and size after the
browser has resized; and the fold row and its photo are written by one request
rather than two that can disagree. If the row insert fails, the photo is deleted
again rather than left orphaned in the bucket.

**Patterns are still files on disk.** A fold references a pattern by its route
slug as plain text, not by a foreign key. When patterns move to Postgres those
columns become real references and nothing else about the schema changes.

## Checking the schema

`scripts/test-migration.sh` applies the migration to a real Postgres and then
asserts what it does: the signup trigger, handle collisions, every CHECK
constraint, and the row-level security policies from the point of view of a
hostile client. CI runs it against a `postgres:16` service container on every
push.

Row-level security is why it exists. A policy that is a little too permissive
looks exactly like a correct one until somebody writes a row they should not be
able to, and no amount of TypeScript notices. The checks try posting a fold as
somebody else, deleting another person's, following on their behalf, uploading
into their storage folder, and writing while logged out. All five have to fail.

Locally, point it at any Postgres:

```sh
PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres \
  bash apps/web/scripts/test-migration.sh
```

It drops and recreates its own database, and `supabase/test/00-supabase-stub.sql`
supplies just enough of `auth` and `storage` to stand in for Supabase.

## Security

Row-level security is on for all four tables. Everything is public to read,
because a profile, a fold and a comment thread are all things a logged-out
visitor should see (DESIGN.md §8.4). Writes are scoped to the row's owner:

- You can only insert a fold or a comment with your own id as the author.
- You can only delete your own.
- You can only follow as yourself, and the schema forbids following yourself.
- Storage objects must be written under a folder named for your user id.

The delete actions filter by author id as well, rather than leaning on the
policy alone. A `where` clause is easier to read than a policy is to audit, and
the two agreeing is the point.

Profile links are parsed and restricted to `http` and `https`. Without that,
`javascript:` in a "website" field is stored XSS with a friendly label.

## What is not here

Not built, and not pretending to be:

- **Collections and posts.** DESIGN.md §7 lists four content types; this is the
  two that matter first.
- **Ranked feed.** Following is your follow graph in reverse-chronological
  order and Discover is everything, newest first. §7 wants a blend of follows,
  tag affinity, recency and quality. With thirteen patterns and a new database
  there is nothing to rank yet, and a fake algorithm is worse than an honest
  list.
- **Likes, notifications, direct messages, blocking, reporting.** A moderation
  story is a prerequisite for opening this to strangers, and it is a bigger
  piece of work than the feature it guards.
- **Uploading patterns.** Still Phase 2. Folds are photos of paper; the crease
  patterns themselves are the seeded library.

## A note on prerendering

With Supabase keys set, every page renders on demand rather than at build time.
That is not new here: the site header reads the session, so a configured deploy
has been fully dynamic since accounts landed. It is worth knowing when reading
the build output, because the same commit prints `○ /p/[id]` without keys and
`ƒ /p/[id]` with them.
