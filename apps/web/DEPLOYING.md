# Deploying to Vercel

The repo side is done. This is what is left, and all of it happens in your
Vercel account.

## What you need to do

1. **Sign in to [vercel.com](https://vercel.com)** with the GitHub account that
   owns `ericleonen/kamibase`, and install the Vercel GitHub App on that
   repository when prompted. The Hobby plan is enough.

2. **New Project → Import `ericleonen/kamibase`.**

3. **Set Root Directory to `apps/web`.** This is the only setting that is not
   the default, and the deploy fails without it. Leave "Include files outside
   of the Root Directory" **on** — the build needs `packages/core` and the
   workspace lockfile.

4. **Deploy.** Framework detection finds Next.js; `apps/web/vercel.json`
   supplies the install and build commands, so there is nothing to type.

No environment variables are required. Two are optional:

| Variable | Effect |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Absolute URLs in Open Graph tags. Set it to the deployed URL once you have it. |
| `NEXT_PUBLIC_SIMULATOR_URL` | Point the 3D fold view at a simulator hosted elsewhere instead of the copy vendored into this deploy. |

That is the whole list. Once it is connected, every push to the branch gets a
preview URL and every PR gets a deployment comment — which is the "catch build
errors early" you were after.

## If you would rather I drove it

I can deploy from here with the Vercel CLI, but that needs a **Vercel access
token** (Account Settings → Tokens), plus the org and project IDs. Worth being
clear about what that hands over: a token can deploy to, and read the
environment variables of, projects in your account. If you go this route,
scope it to the one project, give it the shortest expiry offered, and delete it
when the demo is up. The UI path above takes about two minutes and hands over
nothing, which is why it is first.

## What the build does

`apps/web/package.json` defines `vercel-build`, which Vercel prefers over
`build`:

```
bash scripts/vendor-simulator.sh; next build
```

The vendoring step shallow-clones Origami Simulator (MIT) into `public/sim` so
the 3D fold view is served from your own origin, as DESIGN.md §5.2 asks. It
adds roughly 20–30 seconds and about 12MB to a deploy — the bundled 23MB demo
library is pruned, since the embed suppresses the demo loader anyway.

The `;` rather than `&&` is deliberate: if GitHub is unreachable during a
build, the deploy still succeeds and the pattern pages still work. The fold
view degrades to the flat crease pattern with a plain explanation, which is
what §5.3 asks for.

## Also wired up

`.github/workflows/ci.yml` runs `pnpm typecheck`, `pnpm test` and `pnpm build`
on every pull request, and fails if the generated pattern files have drifted
from the seed script. That catches build errors even on branches Vercel is not
deploying, and it needs nothing from you.

## Known limits of a Vercel deploy

- **Pattern pages are prerendered at build time.** Adding a `.kami` file to
  `content/patterns` needs a redeploy. That is correct for a seeded library and
  changes when uploads arrive.
- **The simulator is 12MB of static files** in the deployment. Well inside
  Hobby limits, but it is the bulk of the deploy.
- **No database.** Phase 1 reads patterns off disk, so there is nothing to
  provision.
