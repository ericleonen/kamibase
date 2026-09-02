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
forward cards, chrome only on hover, a filter bar that navigates on every
change rather than waiting for an Apply button, and a search field in the
sticky header that takes its focus ring around the whole pill.

Crease colours keep their meaning and the paper under them stays white in both
themes. The yellow is chrome; the pattern is data. See **Crease colours** and
**Themes** below.

Patterns lay out in a real grid (`.pattern-grid`), not a masonry. Crease
patterns are all square and every card draws one at the same size, so there is
nothing for a masonry to solve: CSS columns fill top-to-bottom and *balance*,
which puts a different number of cards in each column and reads as a row of four
followed by rows of three. Folds are the opposite case — a photograph is
whatever shape the camera was — so `FoldGrid` keeps the masonry. The pattern
inside a card stays `object-contain`; the geometry is never distorted.

## Routes

| Route | |
|---|---|
| `/` | Landing page, with bases and tessellations first |
| `/explore` | Every pattern, grouped by technique |
| `/p/:id` | Pattern page: viewer, metadata, validation badge, downloads, folds, comments |
| `/p/:id/simulate` | Full-screen 3D fold |
| `/p/:id/folds` | Every fold of one pattern |
| `/p/:id/fold` | Post your fold of it |
| `/upload` | Convert a `.fold` · `.kami` · `.cp` · `.opx` · `.svg` file, in the browser |
| `/edit` | The editor, on a fresh square of paper |
| `/edit/import` | The editor, opened on the pattern `/upload` just converted |
| `/p/:id/edit` | The editor, opened on a working copy of a pattern |
| `/p/:id/download/:format` | `.kami` · `.fold` · `.cp` · `.svg` |
| `/p/:id/thumbnail` | SVG thumbnail, straight from the core renderer |
| `/f/:id` | One fold: photo, notes, the pattern it came from, comments |
| `/feed` | Folds from people you follow, with a Discover tab |
| `/u/:handle` | Profile, with followers and following beside it |
| `/settings/profile` · `/settings/account` · `/settings/appearance` | Who you are, how the account behaves, how the site looks |
| `/about` · `/credits` · `/terms` | What this is, whose work it stands on, the rules |
| `/help` | Write in. The four links in the footer are these last two rows |

## The mark

A K drawn on the editor's own gridded paper: `src/lib/logo.ts` holds the
geometry, `KamiMark` draws the tile, and `KamiK` draws the letter so it can
stand in for the K of "Kamibase" in the header — set as a glyph, on the
baseline, sized in `em`, rather than as a badge parked beside the word.

Both keep the grey lattice behind the letter, because that is what makes it look
like it came off the editor's canvas rather than out of a logo generator. The
glyph's is trimmed arithmetically to its own box (`logoGridLinesIn`) rather than
with a `clipPath`, which would need a `useId` and therefore a client component
to draw some grey lines, and it rules in `--border` rather than the tile's fixed
`--paper-line`: the tile's grid sits on white paper, the glyph's sits on
whatever colour the header happens to be.

It is a drawing, not a foldable pattern, and that is worth stating because the
obvious idea was tried first. **A letter K cannot fold flat.** Kawasaki's
theorem puts the alternate angles at a stem-with-arm-and-leg vertex at 90° and
270°, and it is not a matter of choosing better angles: solving the condition
for a four-crease K asks the arm to be 360° from itself. Six creases can work,
and exactly two families do — a pair pointing away behind the stem, or a
straight line through the vertex between the arm and the leg. Both were built
and photographed at 20, 32, 48 and 120 pixels. The first is an asterisk; the
second puts a bar through the letter's counter, which is the one piece of white
space a K needs to be a K. So the mark shows what the editor shows: ruled
paper, and a shape drawn on it.

## Crease colours

Mountain red, valley blue, boundary black — the Origami Simulator convention
(DESIGN.md §3.3), which is what the file formats mean and what other tools read.
Full-gamut `#ff0000` and `#0000ff` are also two of the harshest colours a screen
can make: at hairline widths they vibrate, and a tessellation drawn in them is
tiring to study, which is a problem when studying it is the entire activity.

So the wire and the window are separated. `ORIGAMI_SIMULATOR_PALETTE` is what
Kamibase *exports*, exactly as before. `KAMIBASE_DISPLAY_PALETTE` is what it
*draws*: the same hues pulled in from the corners of the gamut, used by the
viewer, the thumbnails, the editor canvas, the legend and the mark. Nothing is
reinterpreted — red still means mountain to every eye and to every parser that
matches on hue, which includes ours (`parse/svg/classify`).

## Themes

Light, dark, or the machine's. Stored in `localStorage` rather than on the
account: it is a fact about the device you are reading on, and syncing a laptop
at night with a phone outdoors would make both wrong half the time.

The root element is *always* stamped with `data-theme`, by an inline script in
`<head>` that resolves "system" itself before the first paint. That is why
globals.css has one dark block instead of the usual two (a
`prefers-color-scheme` copy plus a `[data-theme]` copy that has to beat it in
both directions) — one palette, one place. With JavaScript off everybody gets
light, which is the right way round.

**Paper does not theme.** `--paper` and `--paper-line` are white and pale grey
in both themes, and every surface a crease pattern is drawn on uses them: the
viewer, the editor canvas, the cards, the mark. Red mountains, blue valleys and
a black edge only mean what they mean on white, and that convention is shared
with every other origami tool there is. In dark mode a pattern reads as a lit
sheet on a dark table, which is also what folding one at night looks like.

## Search history

The header's dropdown is ours, not Chrome's. A named field inside a form gets
the browser's own autofill list — its font, its width, and whatever you have
ever typed into a field with that name on any site — so `autocomplete="off"`
turns it off and `SearchField` puts a real recent-search list in its place,
wired as a combobox so `aria-activedescendant` moves through the options while
focus stays in the input.

Kept in `localStorage`, eight deep, and never sent anywhere. A list of what
somebody searched for is a small confession, and the server does not need one to
draw a dropdown.

## Settings and notifications

Three pages, split by who the setting is about. `/settings/profile` is what
other people see. `/settings/appearance` is this browser and works signed out.
`/settings/account` is the machinery: the sign-in address, a password reset,
private mode, which emails you want, and deleting the account.

A saved pattern has settings of its own at `/p/:slug/settings`, reachable from
the pattern's page and from your profile, and only by the person who saved it.
It is where the title, designer, notes, licence, difficulty and tags are edited
— all of them written to the row's columns *and* into the `.kami` document,
since the listings read the first and the pattern's own page reads the second —
and where a pattern is made private or deleted. The slug is the one thing it
will not change: `folds.pattern_id` references it and people have sent the link.

`supabase/migrations/0004_pattern_privacy.sql` adds `patterns.is_private` and
replaces "patterns are public" with `not is_private or author_id = auth.uid()`.
The app lists patterns with the anonymous key, for which `auth.uid()` is null,
so Explore, search and the home page drop private rows without knowing they
exist; the author's own pages read through the session and get them back.

`supabase/migrations/0003_settings.sql` adds four columns to `profiles` and
moves the read policies on `folds` and `comments` behind a `can_see_profile()`
check, so a private account's work is withheld by row-level security rather than
by the app remembering to. The profile row itself stays readable: hiding it
would turn "this account is private" into "this account does not exist".

Three emails go out — a new follower, a fold from somebody you follow, a comment
on your fold — through the same Resend helper the help form uses. All of them
are best-effort and none can fail the write they are about: a follow that landed
is a follow that landed, whether or not a mail provider was reachable a moment
later.

| Variable | |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Needed for notifications (email addresses live in `auth.users`, which the publishable key cannot read) and for account deletion. Without it neither is offered, and nothing breaks. **Never** `NEXT_PUBLIC_`-prefixed: that would publish a key that can read every row of every user's data to every visitor. |

## The help form

`/help` posts to a server action that sends the message on by email. The
address it goes to never appears in any page, which is the entire reason the
form exists rather than a `mailto:` link.

Resend, over its HTTP API rather than an SDK: one `fetch` is the whole
integration, so there is no dependency to keep current and nothing to bundle.
Three environment variables, all optional, all read at call time so adding them
to a running deployment needs no rebuild:

| Variable | |
|---|---|
| `RESEND_API_KEY` | Without it the form renders, says plainly that it is not connected, and refuses to pretend it sent |
| `CONTACT_EMAIL` | Where messages land. Defaults to the maintainer's |
| `CONTACT_FROM` | The envelope sender. Defaults to Resend's `onboarding@resend.dev`, which needs no verified domain but only delivers to the Resend account's own address |

The sender's address goes in `reply_to`, never in `from`: sending as somebody
else is a forgery that SPF and DMARC exist to bounce. A hidden field catches the
indiscriminate half of the spam, and a bot that fills it in is told the message
sent, because one that is told it failed simply tries again.

## The editor

DESIGN.md §4, at the bar the design sets: "fix a converted file and make a
Miura-ori," not "design a competition-level insect." A line tool, an eraser,
assignment painting, grid snapping, undo/redo, live validation and export.
Deliberately no polygon tool, no symmetry engine and no layer ordering.

Three ways in, one for each thing people actually want to do:

- **`/edit`**, from **+ New → Draw from scratch**. A fresh square of paper.
- **`/edit/import`**, from **Open in the editor** on `/upload`. The pattern a
  file was just converted into, ready to be checked and repaired.
- **`/p/:id/edit`**, **Open in the editor** on any pattern page. This opens a
  *working copy*: draw on it, check it, export it, save it as a pattern of your
  own. The original is untouched, which is the honest behaviour for someone
  else's design and the only possible one for a seeded pattern, since those are
  files in the repository rather than rows anybody owns.

None of that needs an account (§8.4). **Save** does, and it is the only thing
that does: it puts the pattern on the site under a name, at its own `/p/:slug`.
The dialog shows the pattern as `@kamibase/core` renders it, next to a short
form (title, designer, notes, licence, difficulty, tags), and a button back to
the editor. What reaches the database is the segments, not a file: the server
runs the same `ingest` the seed script runs, so the stored document is
canonicalized, planarized, face-counted, hashed and graded server-side. See
[SOCIAL.md](SOCIAL.md) for the migration it needs.

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

**The editor needs a window at least 64rem (1024px) wide.** Below that,
`CreasePatternEditor` does not mount at all and every door into it — `/edit`,
`/edit/import`, `/p/:id/edit` — shows a note saying so, with links onward to
the library. A canvas with paper settings down one side and live checks down
the other has no honest 390px arrangement, and a squeezed one would still look
like it worked right up until somebody had spent twenty minutes drawing into
it. The notice is CSS-gated (`lg:hidden`) so it lands in the first paint, and
the `matchMedia` check is what keeps a phone from booting an analysis loop and
a WebGL iframe it will never show. Entry latches: narrowing the window after
you are in does not throw you out, because on the other side of that unmount is
somebody's drawing.

Given the room, then:

- One Pointer Events path for finger, stylus and mouse; two fingers pinch-zoom
  in any tool. A touchscreen laptop or a tablet in landscape draws fine.
- The tool dock floats at the bottom of the canvas, within reach of the
  pointer and never between you and the paper the way a top toolbar is.
- The canvas is bounded to the viewport height, so it never runs off the
  bottom of a wide desktop window.
- Both rails are drag-resizable between a floor and a ceiling, with a
  keyboard-operable splitter, and the width is remembered across sessions. The
  left one (what the paper is) collapses to a thin icon bar from a button on
  its own edge; the right one (what the paper does) does not collapse at all,
  because checks you have to open a panel to see are closed at the moment they
  matter.

Known limits: analysis pauses above 600 creases (crossing detection is O(n²)
and would stall the canvas); autosave is localStorage rather than the IndexedDB
§4 asks for, which is the right size of tool for one small document; and there
is no repair panel with one-click fixes yet, so defects are listed, not fixed.

## The converter

`/upload` is the front of the funnel in DESIGN.md §8.2: drop a `.fold`,
`.kami`, `.cp`, `.opx` or `.svg` file and get back a validated `.kami`.

**It runs in the browser.** No upload, no job queue, no waiting, and the grade
on screen is the grade the server would give the same file, because it is the
same `@kamibase/core` code (§9). Publishing to the library is the part that
still needs Phase 2's backend; converting, checking, editing and downloading
all work today, with no account.

SVG gets a **style table**: one row per distinct stroke colour, dash style and
layer the file draws in, with the assignment it was read as, the confidence and
the reason. Change a row and the file is read again. That is the review step of
§3.3 and §3.4 made concrete, and it is why the converter never has to guess:
a style it cannot identify becomes `U`, and a person answers four questions
rather than four hundred.

Conversions are gated on the §3.4 thresholds: ≥0.95 confidence is publishable,
0.7–0.95 asks for a look, below that (or any structural defect) is blocked from
publishing until it is repaired in the editor. Nothing about the gate is
hidden: the reasons are listed next to the badge.

## Adding a pattern

`/upload` takes a file, a photo or a video and gives back an editable crease
pattern. Files convert straight through; photographs stop once to confirm the
paper's corners. It is the raster half of DESIGN.md §3.3 and the most
technical thing here; the full argument is in [SCANNING.md](SCANNING.md).

Everything runs in the browser, in a Web Worker with a main-thread fallback.
Nothing is uploaded and no key is needed, because the whole pipeline is
arithmetic over a `Float32Array` in [`@kamibase/vision`](../../packages/vision).

Three things about it are worth knowing without reading further:

- **The corner step is not skippable.** Four corners define the homography, the
  homography defines every angle, and Kawasaki's theorem is about angles. They
  are guessed and then dragged, like every document scanner ever written, and
  for the same reason: automatic detection fails on white paper on a white
  table.
- **Mountains and valleys come from Maekawa's theorem, not from the photo.** A
  flattened sheet does not record which way its creases went. The constraint
  does, for most patterns. Where several assignments fit equally well one is
  offered and drawn dashed, and the notes say how many were ambiguous.
- **A video is a burst of stills.** Nine frames are sampled and scored by
  sharpness. A handheld shot is blurred in half its frames and sharp in one, and
  the sharp one beats any amount of averaging.

It ends in the editor, never at a published pattern. §3.3 requires a human in
the loop for raster imports, and the confidence score is capped below §3.4's
auto-publish line by construction.

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

Patterns come from two places behind one `PatternRepository` interface: the
hand-seeded `.kami` files on disk, and the rows anybody has saved from the
editor. `src/lib/patterns/index.ts` composes them, database first, and nothing
else in the app knows which store a pattern came from. A deploy with no
Supabase keys serves the seeded library and nothing breaks.

Both go through `patternFromDocument`, so a saved pattern is parsed, validated
and graded by `@kamibase/core` on read exactly as a seeded one is, and earns its
badge rather than being handed one. The row's `document` column is the source of
truth; the count and grade columns beside it exist so that listing a hundred
patterns does not mean grading a hundred documents.

Reads use a session-less Supabase client. Patterns are public, and a
cookie-bound client would opt every page that lists them out of static
rendering and make `generateStaticParams` fail outright.

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
- **A saved pattern cannot yet be changed or removed from the site.** Opening
  one in the editor and pressing Save creates a second pattern rather than
  replacing the first. The update and delete policies are in the migration, so
  this is a missing screen rather than a missing permission.
