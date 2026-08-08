# Accounts (Supabase)

Email + password sign-up and log-in, via Supabase Auth.

**Where the keys go — the short version:**

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
still works — the app falls back to `NEXT_PUBLIC_SUPABASE_ANON_KEY` when the
publishable one is absent.

## Setting it up, start to finish

1. Create a project at [supabase.com](https://supabase.com). Any region; the
   free tier is plenty.
2. **Settings → API Keys**: copy the *Project URL* and the *publishable* key.
3. Locally: `cp apps/web/.env.example apps/web/.env.local` and paste them in.
   Restart `pnpm dev` — Next only reads env files at startup.
4. On Vercel: Project → Settings → Environment Variables, add both, tick all
   three environments (Production, Preview, Development), then redeploy.
   `NEXT_PUBLIC_` variables are inlined at **build** time, so an existing
   deployment will not pick them up until it rebuilds.
5. **Authentication → URL Configuration** in Supabase:
   - *Site URL*: your deployed URL (e.g. `https://kamibase.vercel.app`)
   - *Redirect URLs*: add `https://YOUR-DEPLOY/auth/callback` and
     `http://localhost:3000/auth/callback`

   Without this, confirmation links bounce users to the wrong place.
6. Optional: set `NEXT_PUBLIC_SITE_URL` to your deployed URL so confirmation
   emails link back to the right origin even behind a proxy.

By default Supabase requires email confirmation, so a new account cannot log in
until the link is clicked. To skip that while demoing, turn off
**Authentication → Sign In / Providers → Email → Confirm email**.

## Safe to expose, and what is not

The publishable key is designed to sit in the browser: it grants only what your
row-level security policies allow. That is why it is a `NEXT_PUBLIC_` variable.

The **secret** key (`sb_secret_…`, formerly the *service role* key) is the
opposite — it bypasses row-level security entirely. It must never appear in
`.env.example`, in any `NEXT_PUBLIC_` variable, or in client code. Nothing here
needs it, so the safest place for it is nowhere in this repo.

## Without the keys

Everything still works except accounts. `isSupabaseConfigured()` returns false,
the server client returns `null` instead of throwing, the middleware no-ops,
and `/login` and `/signup` render with a notice naming the two variables. The
pattern library, viewer, downloads and simulator are all usable signed out —
DESIGN.md §8.4: "never gate the magic behind a signup wall; gate only the
things that need an identity."

This is not a nicety: it is what stops a missing key from turning into a
failed deploy or a 500 on every page.

## How it fits together

| File | |
|---|---|
| `src/lib/supabase/config.ts` | Reads the env vars; `isSupabaseConfigured()` |
| `src/lib/supabase/server.ts` | Server client + `getCurrentUser()` |
| `src/lib/supabase/client.ts` | Browser client |
| `src/lib/supabase/middleware.ts` | Session refresh |
| `src/middleware.ts` | Runs the refresh on every page request |
| `src/app/auth/actions.ts` | `signIn`, `signUp`, `signOut` server actions |
| `src/app/auth/callback/route.ts` | Exchanges the emailed code for a session |
| `src/app/login`, `src/app/signup` | The screens |

Two details worth keeping:

- **`getUser()`, never `getSession()`.** `getSession()` reads the cookie
  without verifying it, so a forged cookie would look like a signed-in user.
  `getUser()` checks with the auth server.
- **The middleware must call `getUser()`.** That call is what refreshes an
  expiring token and writes the new cookie. Server Components cannot set
  cookies, so without the middleware users get silently signed out mid-session.

## Not built yet

Accounts exist; there is nothing to *do* with one yet. Saving patterns,
collections, posting folds and profiles are the Phase 4 social layer
(DESIGN.md §7). This is the auth foundation those sit on, landed early because
it was asked for — the roadmap puts it after the converter and editor.
