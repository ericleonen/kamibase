# `@kamibase/web`

Phase 1 of [DESIGN.md](../../DESIGN.md) §10: **viewer + simulator**. Pattern
pages, a crease-pattern viewer, downloads in every format, and the embedded
3D simulator. The point is that the site is useful and impressive before any
social features exist.

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

Deploying: see [DEPLOYING.md](DEPLOYING.md). Accounts: see [AUTH.md](AUTH.md),
which says exactly where the Supabase keys go. Profiles, folds, comments and
following: see [SOCIAL.md](SOCIAL.md), which has the one SQL file to run.

## Design

`#F5B72E` (yellow-amber) is the primary, on a white page with white cards. It
fills backgrounds only; `--brand-strong` (`#9C6206`) is the text-grade amber for
links and focus rings, because the primary itself is 1.8:1 on white. `/` is the
landing page. The Pinterest-style masonry feed lives at `/explore`: image-
forward cards, chrome only on hover, a chip rail for techniques, and a search
field in the sticky header.

Crease colours are **not** themed. Mountain red, valley blue and boundary black
are the Origami Simulator convention and the de facto standard across the field
(DESIGN.md §3.3). Restyling them to match a brand would make our patterns
misread everywhere else. The yellow is chrome; the pattern is data.

Card frames vary in aspect so the masonry actually staggers. Crease patterns
are all square, and a grid of identical squares reads as a table rather than a
feed. The pattern inside stays `object-contain`, so only the mat around it
changes; the geometry is never distorted.

## Routes

| Route | |
|---|---|
| `/` | Landing page, with bases and tessellations first |
| `/explore` | Every pattern, grouped by technique |
| `/p/:id` | Pattern page: viewer, metadata, validation badge, downloads, folds, comments |
| `/p/:id/simulate` | Full-screen 3D fold |
| `/p/:id/folds` | Every fold of one pattern |
| `/p/:id/fold` | Post your fold of it |
| `/edit` | The editor, on a fresh square of paper |
| `/p/:id/edit` | The editor, opened on a working copy of a pattern |
| `/p/:id/download/:format` | `.kami` · `.fold` · `.cp` · `.svg` |
| `/p/:id/thumbnail` | SVG thumbnail, straight from the core renderer |
| `/f/:id` | One fold: photo, notes, the pattern it came from, comments |
| `/feed` | Folds from people you follow, with a Discover tab |
| `/u/:handle` | Profile, with followers and following beside it |
| `/settings/profile` | Edit your own |

## The editor

DESIGN.md §4, at the bar the design sets: "fix a converted file and make a
Miura-ori," not "design a competition-level insect." A line tool, an eraser,
assignment painting, grid snapping, undo/redo, live validation and export.
Deliberately no polygon tool, no symmetry engine and no layer ordering.

Two ways in, one for each thing people actually want to do:

- **`/edit`**, the **+ New** button in the header. A fresh square of paper.
- **`/p/:id/edit`**, **Open in the editor** on any pattern page. The seeded
  library is read-only, so this opens a *working copy*: draw on it, check it,
  export it. The original is untouched, which is also the honest behaviour for
  someone else's design. Saving back needs the accounts and storage of Phase 4.

Neither needs an account (§8.4).

**Every check on screen is `@kamibase/core` running in the browser**: the same
planarize, the same §2.4 rules, the same Maekawa and Kawasaki the server
applies on ingest. That is §9's argument made concrete: the editor's rules and
the server's rules cannot drift, because they are one implementation. Draw two
crossing creases and the crossing becomes a vertex; leave one dangling and it
is a warning; build a degree-8 vertex with four mountains and four valleys and
a red ring appears on it with the reason in its tooltip.

The document is a flat list of segments, not a vertex-indexed graph. §4 asks
for "immutable geometry snapshots with structural sharing → free undo/redo",
and a segment list gives exactly that. Every edit returns a new array, undo is
keeping the old one, and the graph is derived through `graphFromSegments`, the
same function the parsers use.

Mobile-first, and specifically:

- One Pointer Events path for finger, stylus and mouse; two fingers pinch-zoom
  in any tool.
- The control panel is pinned to the bottom of the viewport on phones, where
  thumbs are, and collapsed to two rows by default, because an expanded one is
  tall enough to cover the canvas outright.
- The canvas is bounded to the viewport height, so it never runs off the
  bottom of a wide desktop window.

Known limits: analysis pauses above 600 creases (crossing detection is O(n²)
and would stall the canvas); autosave is localStorage rather than the IndexedDB
§4 asks for, which is the right size of tool for one small document; and there
is no repair panel with one-click fixes yet, so defects are listed, not fixed.

## The social layer

Profiles, folds, comments and following, on top of the Supabase accounts. Full
setup and design notes in [SOCIAL.md](SOCIAL.md); the short version is that it
needs one SQL file run in your Supabase project and no new environment
variables.

The distinction it turns on is a pattern versus a fold. A pattern is the
design, a fold is somebody's execution of it: a photo, the paper, how long it
took, how hard it felt. One pattern has many folds, and putting them on the
same page as the geometry is what makes this a place rather than an archive.

Two things about it that are load-bearing rather than incidental:

- **Reads never throw.** They return a typed result, and two of its failure
  reasons are setup states rather than faults: no Supabase keys, and keys with
  no migration run. Both render a note saying which step is missing while the
  rest of the page carries on. A pattern page on a deploy with no database is
  still a pattern page.
- **Photo uploads go through a server action.** The browser resizes to 1600px
  first, and the action re-checks type and size before anything reaches
  storage. The page never opens a connection to another origin, so the
  Content-Security-Policy stays as tight as it was.

Deliberately absent: likes, notifications, and any kind of ranking. Following
is your follow graph newest-first and Discover is everyone, newest-first.
DESIGN.md §7 wants a blend of follows, tag affinity and recency; with thirteen
patterns there is nothing to rank yet, and a fake algorithm reads worse than an
honest list.

## The pattern store

Phase 1 has no accounts and no uploads. It is a seeded library, so patterns
live on disk as `.kami` files behind a `PatternRepository` interface. Every
file is parsed, validated and graded by `@kamibase/core` on read, exactly as an
upload would be, so a seeded pattern earns its badge rather than being handed
one. Swapping the single binding in `src/lib/patterns/index.ts` for a
Postgres-backed implementation is the whole of the Phase 4 migration.

`content/patterns/*.kami` is **generated**: canonical bytes with real content
hashes. Edit `scripts/seeds/` and re-run `pnpm seed`. The script refuses to
write a pattern that is not structurally clean, or whose flat-foldability
verdict has changed from what the catalog claims.

`content/sources/*.cp` is the human-readable `.cp` each pattern was generated
from, committed alongside so the geometry is reviewable.

### Seeded patterns

13 today: four traditional bases, five Miura-ori sizes, three accordion
pleats, and an 8×8 reference grid. DESIGN.md §10 asks for ~100, and the
remaining 87 are a *content* problem, not a code one. Reaching them means the
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
   suppresses the demo entirely. That is upstream's own switch, not a patch.
3. **`setFoldData()` calls `gtag()`.** We delete the bundled Google Analytics
   tag, because reporting our visitors to someone else's analytics property is
   not ours to do, and that makes every import throw `ReferenceError` before it
   builds any geometry. `vendor-simulator.sh`
   replaces the tag with a no-op shim that keeps the symbol defined.
4. **It needs `unsafe-eval`.** `/sim/*` gets its own Content-Security-Policy in
   `next.config.ts`; the app's policy is scoped to exclude those paths, because
   two CSP headers on one response intersect rather than override.

The vendoring script also strips the simulator's own site chrome. Its navbar
offers File, Examples and About, which navigate out of Kamibase and load other
people's models into a page that is showing one specific pattern. That is
DESIGN.md §5.2's "strip its UI chrome", done as a stylesheet rather than a
fork: the elements stay in the DOM so the simulator's own code still finds
everything it queries, and every fold control stays visible. The 23MB bundled
demo library is pruned at the same time. With the demo loader suppressed and
the Examples menu hidden, nothing in it is reachable anyway.

Upstream's JavaScript is untouched. The only edits are to `index.html`, both
additive and both re-applied on every vendoring run, so rebasing stays cheap.

What the wrapper deliberately does **not** expose: `setFoldAmount`,
`setStrainVisible` and `exportFoldedState` from §5.2's sketch. Upstream has no
message for any of them, and a method that silently did nothing would be worse
than an absent one. Those need the fork, as does the headless run that
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
  trade is defensible. Uploads (Phase 2) must move to nonces first.
- **Print-to-scale is CSS**, not server-side PDF. `@page` plus a millimetre
  width from `kami:paper.recommendedSizeMm` gets the geometry onto paper at the
  right size; a real `.pdf` export is a Phase 2 item.
- **No search.** `/explore` groups by technique. Semantic and visual search are
  Phase 5 and need a corpus first.
