# `@kamibase/web`

Phase 1 of [DESIGN.md](../../DESIGN.md) §10: **viewer + simulator**. Pattern
pages, a crease-pattern viewer, downloads in every format, and the embedded
3D simulator — the point being that the site is useful and impressive before
any social features exist.

Next.js (App Router) · React 19 · TypeScript strict · Tailwind 4 ·
[`@kamibase/core`](../../packages/core) for all geometry.

## Run it

```sh
pnpm install
pnpm --filter @kamibase/web vendor:simulator   # optional; needed for 3D folding
pnpm --filter @kamibase/web dev
```

Then open http://localhost:3000.

| Command | |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Production build (prerenders every pattern page) |
| `pnpm test` | Vitest |
| `pnpm seed` | Regenerate `content/patterns` from the seed catalog |
| `pnpm vendor:simulator` | Fetch Origami Simulator into `public/sim` |

Deploying: see [DEPLOYING.md](DEPLOYING.md). Accounts: see [AUTH.md](AUTH.md)
— including exactly where the Supabase keys go.

## Design

`#F5CB5C` is the primary, on an off-white page with white cards. The feed is a
Pinterest-style masonry: image-forward cards, chrome only on hover, a chip rail
for techniques, and a search field in the sticky header.

Crease colours are **not** themed. Mountain red, valley blue and boundary black
are the Origami Simulator convention and the de facto standard across the field
(DESIGN.md §3.3) — restyling them to match a brand would make our patterns
misread everywhere else. The yellow is chrome; the pattern is data.

Card frames vary in aspect so the masonry actually staggers — crease patterns
are all square, and a grid of identical squares reads as a table rather than a
feed. The pattern inside stays `object-contain`, so only the mat around it
changes; the geometry is never distorted.

## Routes

| Route | |
|---|---|
| `/` | Landing — bases and tessellations first |
| `/explore` | Every pattern, grouped by technique |
| `/p/:id` | Pattern page: viewer, metadata, validation badge, downloads |
| `/p/:id/simulate` | Full-screen 3D fold |
| `/p/:id/download/:format` | `.kami` · `.fold` · `.cp` · `.svg` |
| `/p/:id/thumbnail` | SVG thumbnail, straight from the core renderer |

## The pattern store

Phase 1 has no accounts and no uploads — it is a seeded library — so patterns
live on disk as `.kami` files behind a `PatternRepository` interface. Every
file is parsed, validated and graded by `@kamibase/core` on read, exactly as an
upload would be, so a seeded pattern earns its badge rather than being handed
one. Swapping the single binding in `src/lib/patterns/index.ts` for a
Postgres-backed implementation is the whole of the Phase 4 migration.

`content/patterns/*.kami` is **generated** — canonical bytes with real content
hashes. Edit `scripts/seeds/` and re-run `pnpm seed`; the script refuses to
write a pattern that is not structurally clean, or whose flat-foldability
verdict has changed from what the catalog claims.

`content/sources/*.cp` is the human-readable `.cp` each pattern was generated
from, committed alongside so the geometry is reviewable.

### Seeded patterns

13 today: four traditional bases, five Miura-ori sizes, three accordion
pleats, and an 8×8 reference grid. DESIGN.md §10 asks for ~100, and the
remaining 87 are a *content* problem, not a code one — reaching them means the
designer outreach §11 Q1 describes. We are not going to invent crease patterns
and attribute them to people.

## Embedding the simulator

DESIGN.md §5.2 plans a vendored fork because there is "no documented public
embed API, URL parameter, or headless mode". That is right about the
documentation and wrong about the code: Origami Simulator's `js/importer.js`
already listens for `{op: "importFold", fold}` and announces itself to its
parent with `{from: "OrigamiSimulator", status: "ready"}`. So `src/lib/kamisim.ts`
drives an **unmodified** copy in an iframe, and the fork can wait.

Four things this cost, all of which are load-bearing and none of which are
documented anywhere upstream:

1. **The handshake is one-shot.** It fires during the simulator's own init. A
   listener attached after that moment waits forever, so the iframe's `load`
   event plus a grace period is accepted as equivalent evidence.
2. **The simulator loads its own demo model at boot**, which lands *after* our
   import and replaces it. Its `?model=` parameter picks the demo by CSS
   attribute match, so a value matching no element (`kamibase-no-demo`)
   suppresses the demo entirely — upstream's own switch, not a patch.
3. **`setFoldData()` calls `gtag()`.** Deleting the bundled Google Analytics
   tag — which we do, because reporting our visitors to someone else's
   analytics property is not ours to do — makes every import throw
   `ReferenceError` before it builds any geometry. `vendor-simulator.sh`
   replaces the tag with a no-op shim that keeps the symbol defined.
4. **It needs `unsafe-eval`.** `/sim/*` gets its own Content-Security-Policy in
   `next.config.ts`; the app's policy is scoped to exclude those paths, because
   two CSP headers on one response intersect rather than override.

The vendoring script also strips the simulator's own site chrome — its navbar
offers File, Examples and About, which navigate out of Kamibase and load other
people's models into a page that is showing one specific pattern. That is
DESIGN.md §5.2's "strip its UI chrome", done as a stylesheet rather than a
fork: the elements stay in the DOM so the simulator's own code still finds
everything it queries, and every fold control stays visible. The 23MB bundled
demo library is pruned at the same time, since the demo loader is suppressed
and the Examples menu is hidden — nothing in it is reachable.

Upstream's JavaScript is untouched. The only edits are to `index.html`, both
additive and both re-applied on every vendoring run, so rebasing stays cheap.

What the wrapper deliberately does **not** expose: `setFoldAmount`,
`setStrainVisible` and `exportFoldedState` from §5.2's sketch. Upstream has no
message for any of them, and a method that silently did nothing would be worse
than an absent one. Those need the fork — as does the headless run that
produces the L2 badge.

`public/sim` is gitignored: it is 12MB of someone else's repository after
pruning, and vendoring it into our history would be worse than fetching it at
build time. Point `NEXT_PUBLIC_SIMULATOR_URL` at a deployed copy to serve it
from somewhere else instead.

## Known gaps

- **L2 and L3 badges never appear.** Both require simulator evidence that only
  a headless run can produce (§5.2 Phase 2), so every seeded pattern grades
  L1. Local flat-foldability is shown separately, as its own indicator, rather
  than being quietly promoted to a level it has not earned.
- **`script-src` allows `'unsafe-inline'`.** Next's bootstrap is inline, and
  the nonce-based alternative forces dynamic rendering and gives up the
  prerendered pattern pages. Phase 1 serves no user-supplied content, so the
  trade is defensible — but uploads (Phase 2) must move to nonces first.
- **Print-to-scale is CSS**, not server-side PDF. `@page` plus a millimetre
  width from `kami:paper.recommendedSizeMm` gets the geometry onto paper at the
  right size; a real `.pdf` export is a Phase 2 item.
- **No search.** `/explore` groups by technique. Semantic and visual search are
  Phase 5 and need a corpus first.
