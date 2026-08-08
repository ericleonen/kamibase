# Accounts (Supabase)

Email + password sign-up and log-in, via Supabase Auth.

**Where the keys go, in short:**

| Where | How |
|---|---|
| Local development | `apps/web/.env.local` (copy `apps/web/.env.example`) |
| Vercel | Project → Settings → **Environment Variables** |

Two variables, both from your Supabase project's **Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Current Supabase projects issue a *publishable* key (`sb_publishable_…`).
Older projects issued an *anon* key (a JWT) instead; that name is legacy but
still works. The app falls back to `NEXT_PUBLIC_SUPABASE_ANON_KEY` when the
publishable one is absent.

## Setting it up, start to finish

1. Create a project at [supabase.com](https://supabase.com). Any region; the
   free tier is plenty.
2. **Settings → API Keys**: copy the *Project URL* and the *publishable* key.
3. Locally: `cp apps/web/.env.example apps/web/.env.local` and paste them in.
   Restart `pnpm dev`, since Next only reads env files at startup.
4. On Vercel: Project → Settings → Environment Variables, add both, tick all
   three environments (Production, Preview, Development), then redeploy.
   `NEXT_PUBLIC_` variables are inlined at **build** time, so an existing
   deployment will not pick them up until it rebuilds.
5. **Authentication → URL Configuration** in Supabase. This step is the one
   everybody skips, and skipping it is why confirmation emails point at
   localhost. See the next section.

By default Supabase requires email confirmation, so a new account cannot log in
until the link is clicked. To skip that while demoing, turn off
**Authentication → Sign In / Providers → Email → Confirm email**.

## Confirmation emails that point at localhost

A brand new Supabase project has its *Site URL* set to `http://localhost:3000`,
and it stays there until you change it. That single default causes almost every
report of this.

The app does send Supabase the right address. What it cannot do is make Supabase
honour it: **Supabase substitutes the project's Site URL for any redirect target
that is not on the allowlist, and does not report an error.** So an address that
is correct but unlisted looks exactly like one that was never sent.

Fix it in **Authentication → URL Configuration**:

- *Site URL*: `https://kamibase-web.vercel.app` (your deployed URL, no trailing
  slash). This is the fallback for everything, so it should be production.
- *Redirect URLs*: add both, wildcards included:

  ```
  https://kamibase-web.vercel.app/**
  http://localhost:3000/**
  ```

  The `/**` matters. Without it, `…/auth/callback?next=/feed` is not a match and
  you are back to the Site URL.

Emails already sent keep their old link. Send yourself a fresh one to test.

If you deploy previews and want their confirmations to come back to the preview
rather than to production, add `https://*-your-team.vercel.app/**` as well.

### Which address the app sends

`src/lib/site-url.ts`, in order:

1. `NEXT_PUBLIC_SITE_URL`, if you set it. Needed for a custom domain.
2. On a Vercel **production** deployment, the project's production domain, which
   Vercel exposes as a system variable. So production links point at
   `kamibase-web.vercel.app` rather than at whichever deployment-specific
   hostname the request arrived on, and they still work after the next deploy.
3. Otherwise the request's own host, which is right for previews and for
   `localhost` in development.

You should not need `NEXT_PUBLIC_SITE_URL` on a plain Vercel setup. Set it if
you move to a custom domain, host somewhere else, or see a link you cannot
explain.

## Safe to expose, and what is not

The publishable key is designed to sit in the browser: it grants only what your
row-level security policies allow. That is why it is a `NEXT_PUBLIC_` variable.

The **secret** key (`sb_secret_…`, formerly the *service role* key) is the
opposite. It bypasses row-level security entirely, and must never appear in
`.env.example`, in any `NEXT_PUBLIC_` variable, or in client code. Nothing here
needs it, so the safest place for it is nowhere in this repo.

## Without the keys

Everything still works except accounts. `isSupabaseConfigured()` returns false,
the server client returns `null` instead of throwing, the proxy no-ops,
and `/login` and `/signup` render with a notice naming the two variables. The
pattern library, viewer, downloads and simulator are all usable signed out.
That is DESIGN.md §8.4: "never gate the magic behind a signup wall; gate only
the things that need an identity."

This is not a nicety. It is what stops a missing key from turning into a failed
deploy or a 500 on every page.

## How it fits together

| File | |
|---|---|
| `src/lib/supabase/config.ts` | Reads the env vars; `isSupabaseConfigured()` |
| `src/lib/supabase/server.ts` | Server client + `getCurrentUser()` |
| `src/lib/supabase/client.ts` | Browser client |
| `src/lib/supabase/middleware.ts` | Session refresh |
| `src/proxy.ts` | Runs the refresh on every page request |
| `src/app/auth/actions.ts` | `signIn`, `signUp`, `signOut` server actions |
| `src/app/auth/callback/route.ts` | Exchanges the emailed code for a session |
| `src/app/login`, `src/app/signup` | The screens |

Two details worth keeping:

- **`getUser()`, never `getSession()`.** `getSession()` reads the cookie
  without verifying it, so a forged cookie would look like a signed-in user.
  `getUser()` checks with the auth server.
- **The proxy must call `getUser()`.** That call is what refreshes an
  expiring token and writes the new cookie. Server Components cannot set
  cookies, so without the proxy users get silently signed out mid-session.
  (Next 16 renamed the `middleware` file convention to `proxy`; the helper it
  calls is still `src/lib/supabase/middleware.ts`.)

## What an account gets you

Profiles, folds, comments and following, all built on this. They need one more
setup step: the SQL in `supabase/migrations/0001_social.sql`. See
[SOCIAL.md](SOCIAL.md).

Collections, saving patterns and uploading your own are still ahead.
