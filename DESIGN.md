# Kamibase — Design Document

> A home for crease patterns. Share them, search them, fold them, simulate them.

**Status:** Draft v0.1 — pre-implementation design
**Last updated:** 2026-08-05

---

## 1. What Kamibase Is

Kamibase is a community site for origami designers and folders built around one
durable idea: **a crease pattern is structured data, not a picture.**

Today crease patterns (CPs) circulate as JPEGs on Flickr, Instagram, and Reddit.
That's lossy in every way that matters. You can't tell mountain from valley
without squinting. You can't simulate it. You can't search it by structure. You
can't diff two versions. You can't fold it at a different size without redrawing
it. The knowledge is trapped in pixels.

Kamibase treats a CP as a first-class object: a validated geometric graph with
provenance, licensing, difficulty metadata, and a folding record. From that one
object everything else follows — 3D simulation, semantic search, remixing,
attribution, and a social feed that is actually *about* the folds.

### The three-sentence pitch

1. Upload a CP in any form you have it — editor file, SVG, or a photo of a
   sketch — and Kamibase converts it to a clean, validated `.kami` file.
2. Anything on the site can be folded in 3D in the browser, searched
   semantically ("twist-based tessellation, box-pleated, 32×32 grid"), and
   remixed with attribution intact.
3. Around all of it sits a mobile-first, Pinterest-like social layer where
   people post their folds, their shaping, and their failures.

### Non-goals (v1)

- Not a full CAD replacement for Oriedita/ORIPA. The built-in editor is for
  quick edits and cleanup, not designing a 400-step insect from scratch.
- Not a diagram (step-by-step) publishing platform. CPs and folded results only.
- Not a marketplace. Attribution and licensing yes; payments no.

---

## 2. The `.kami` File Format

### 2.1 Design principle: extend, don't reinvent

There is already a good, well-designed, academically-backed interchange format
for origami: **FOLD** (Flexible Origami List Datastructure), by Erik Demaine,
Jason Ku, Robert Lang, Tomohiro Tachi et al. It is JSON-based, extensible, and
is the internal data structure of Origami Simulator. The stated goal of FOLD is
that *all* computational origami software adopt it as a common interchange
format.

**We will not compete with that.** Fighting an established standard would
isolate Kamibase from every existing tool and forfeit the simulator we want to
embed.

So: **`.kami` is a strict, opinionated profile of FOLD plus a namespaced
extension block and an optional container.**

Concretely:

- Every `.kami` file **is a valid FOLD file.** Any FOLD-aware tool can open it
  and ignore what it doesn't understand.
- `.kami` adds **required** fields FOLD leaves optional (so files are reliably
  usable, not just parseable).
- `.kami` adds a `kami:` namespace for everything FOLD has no opinion about:
  difficulty, grid system, provenance, licensing, tags, folding notes.
- FOLD reserves all colon-free keys for the spec and blesses `prefix:name` for
  extensions. Our extension is spec-legal by construction.

This gives free interop in both directions: **export to `.fold` is a
key-filter**, and **import from `.fold` is validation + metadata prompts.**

### 2.2 Two physical forms

| Form | Extension | What it is | Use |
|---|---|---|---|
| Plain | `.kami` | A single UTF-8 JSON document | Editing, diffing, git, API responses |
| Container | `.kamiz` | Zip archive (JSON + assets) | Upload/download with photos, thumbnails, source files |

`.kamiz` layout:

```
pattern.kamiz
├── pattern.kami           # the JSON document (required, canonical)
├── thumbnail.webp         # rendered CP preview
├── source/                # original uploads, preserved verbatim
│   ├── original.svg
│   └── original.opx
└── media/                 # folded-result photos referenced by the JSON
    ├── folded-front.webp
    └── shaping-detail.webp
```

Rule: `pattern.kami` is always the source of truth. Everything else is derived
or supplementary and may be regenerated or discarded.

### 2.3 Anatomy of a `.kami` file

```jsonc
{
  // ─── Standard FOLD: file-level ────────────────────────────────────
  "file_spec": 1.2,
  "file_creator": "Kamibase 0.1 (converter: svg-vision)",
  "file_author": "Eric Leonen",
  "file_title": "Hex Twist Tessellation",
  "file_classes": ["singleModel"],

  // ─── Standard FOLD: frame-level (key frame = the crease pattern) ──
  "frame_title": "Crease pattern, unfolded",
  "frame_classes": ["creasePattern"],
  "frame_attributes": ["2D", "manifold", "orientable"],
  "frame_unit": "unit",

  // ─── Standard FOLD: geometry ──────────────────────────────────────
  "vertices_coords": [[0,0], [1,0], [1,1], [0,1], [0.5,0.5]],
  "edges_vertices": [[0,1],[1,2],[2,3],[3,0],[0,4],[1,4],[2,4],[3,4]],
  "edges_assignment": ["B","B","B","B","M","V","M","V"],
  "edges_foldAngle": [0,0,0,0,-180,180,-180,180],
  "faces_vertices": [[0,1,4],[1,2,4],[2,3,4],[3,0,4]],

  // ─── kami: extension ──────────────────────────────────────────────
  "kami:version": "0.1",
  "kami:id": "01J8XM4ZKQ7YV2N6R0BHTC3WFD",

  "kami:paper": {
    "shape": "square",
    "gridSystem": "22.5",           // "none" | "square" | "box-pleat" | "22.5" | "hex" | "arbitrary"
    "gridDivisions": 32,            // n for an n×n reference grid; null if none
    "recommendedSizeMm": 350,
    "recommendedPaper": "Tissue-foil, 25gsm"
  },

  "kami:difficulty": {
    "rating": 7,                    // 1–10, author-declared
    "communityRating": 7.4,         // server-computed, read-only in the file
    "estimatedMinutes": 180
  },

  "kami:taxonomy": {
    "subject": ["insect", "beetle"],
    "techniques": ["box-pleating", "circle-packing", "closed-sink"],
    "tags": ["stag-beetle", "horned"]
  },

  "kami:provenance": {
    "designer": "Eric Leonen",
    "designedOn": "2026-06-14",
    "derivedFrom": ["kami:01J8ABCD…"],   // remix lineage, by kami:id
    "originalSourceUrl": "https://…",
    "convertedFrom": {
      "format": "svg",
      "converter": "svg-vision@0.1",
      "confidence": 0.93,             // 0–1; see §3.4
      "reviewedByHuman": true
    }
  },

  "kami:license": {
    "spdx": "CC-BY-NC-4.0",
    "foldingAllowed": "personal",   // "personal" | "commercial" | "any"
    "redistribution": "with-attribution"
  },

  "kami:folding": {
    "collapseNotes": "Collapse the central twist first, then work outward.",
    "shapingNotes": "Wet-fold the thorax; MC the antennae.",
    "steps": [                       // optional coarse folding sequence
      { "label": "Precrease grid", "edges": [4,5,6,7] },
      { "label": "Collapse center", "edges": [8,9,10] }
    ]
  },

  "kami:media": [
    { "role": "folded", "src": "media/folded-front.webp", "credit": "Eric Leonen" }
  ],

  "kami:simulation": {
    "verified": true,               // did it collapse in our headless run?
    "flatFoldable": true,
    "maxStrain": 0.04,
    "simulatedOn": "2026-08-01T12:00:00Z"
  },

  // ─── Optional extra FOLD frames: folded states, step snapshots ─────
  "file_frames": [
    {
      "frame_classes": ["foldedForm"],
      "frame_attributes": ["3D"],
      "frame_parent": 0,
      "frame_inherit": true,
      "vertices_coords": [ /* 3D coords of the collapsed form */ ]
    }
  ]
}
```

### 2.4 What `.kami` requires beyond FOLD

FOLD is permissive by design — almost everything is optional. That's right for a
research interchange format and wrong for a content platform, where a file that
parses but can't be rendered or simulated is a support ticket. `.kami`
**validity** requires:

1. `vertices_coords`, `edges_vertices`, and `edges_assignment` are present and
   mutually consistent in length.
2. Every `edges_assignment` value is one of `B M V F U C J`. No nulls.
3. Coordinates are 2D and normalized to the unit square `[0,1]²` (or the paper's
   bounding box for non-square paper). Scale lives in
   `kami:paper.recommendedSizeMm`, not in the geometry.
4. The boundary is a closed loop of `B` edges. A CP with a hole in its border is
   rejected unless `frame_attributes` declares it intentional.
5. No duplicate edges; no zero-length edges; vertices deduplicated within
   epsilon (`1e-9` in normalized units).
6. Edge intersections are resolved into vertices — creases may not cross without
   a vertex at the crossing. (This is the single most common defect in
   converted files and the main thing that breaks simulation.)
7. `kami:version`, `kami:license`, and `kami:paper.shape` are present.

Faces (`faces_vertices`) are **not** required on upload — we compute them via
planar face-finding during ingest, because most sources don't provide them.

### 2.5 Canonicalization

Every ingested file passes through a canonicalizer so identical patterns produce
identical bytes. This gives us content-addressed dedup, meaningful diffs, and
stable hashes for remix lineage.

- Coordinates rounded to 9 decimal places, normalized to `[0,1]²`.
- Vertices sorted lexicographically by `(x, y)`; edges re-indexed to match.
- Each edge stored with `v0 < v1`; edge list sorted lexicographically.
- JSON keys emitted in a fixed order; no insignificant whitespace.
- `kami:contentHash` = SHA-256 of the canonical geometry arrays **only**
  (metadata excluded), so the same pattern uploaded with different tags is
  recognized as the same pattern.

### 2.6 Validation levels

Uploads are graded, not just accepted or rejected. This matters because a
strict-only gate would reject most real-world scans and kill the funnel.

| Level | Meaning | Site behavior |
|---|---|---|
| `L0 Parsed` | Valid JSON/FOLD, geometry present | Stored; flagged "unverified" |
| `L1 Clean` | Passes all §2.4 structural rules | Publishable; renders correctly |
| `L2 Simulatable` | Headless simulator reaches a stable folded state | Gets the 3D fold button |
| `L3 Verified` | Flat-foldability checks pass (Maekawa, Kawasaki, Big-Little-Big at every interior vertex) | "Verified" badge |

L3 is informational, not a quality judgment — plenty of great CPs are not
flat-foldable, and 3D models legitimately fail these local conditions. The badge
says "this is locally consistent," not "this is good."

---

## 3. The Converter (`kamiconv`)

Getting patterns *in* is the make-or-break problem. If uploading is hard, the
library stays empty and nothing else matters. The converter is therefore the
most important engineering component in v1.

### 3.1 Supported inputs

| Source | Ext | Difficulty | Approach |
|---|---|---|---|
| FOLD | `.fold` | Trivial | Validate, canonicalize, prompt for metadata |
| ORIPA | `.opx` | Easy | XML (`XMLDecoder`) → line list → graph |
| Oriedita | `.ori` | Easy | Documented format; or ask user to export `.cp`/`.fold` |
| Lang/ORIPA CP | `.cp` | Easy | ASCII: `<type> <x1> <y1> <x2> <y2>` per line, where 1=contour/border, 2=mountain, 3=valley |
| Vector | `.svg` | Medium | Color/layer heuristics + geometry cleanup |
| Vector | `.pdf`, `.dxf` | Medium | Normalize to paths, then SVG pipeline |
| Raster | `.png/.jpg` | **Hard** | Vision model + line detection + LLM reasoning |
| Photo of paper | `.jpg` | **Hardest** | Dewarp → enhance → raster pipeline |

### 3.2 Pipeline architecture

Every input converges on the same normalized intermediate — a flat list of
typed segments — and then through one shared cleanup stage. This keeps the hard
per-format logic small and the correctness-critical logic in one place.

```
  input file
      │
      ▼
┌─────────────┐   sniff magic bytes / extension / XML root
│  DETECT     │
└──────┬──────┘
       ▼
┌─────────────┐   format-specific parsers → List<Segment{x1,y1,x2,y2,assignment,confidence}>
│  EXTRACT    │   (raster path: vision + line detection, see §3.3)
└──────┬──────┘
       ▼
┌─────────────┐   • split segments at intersections
│  CLEAN      │   • snap near-coincident endpoints (adaptive epsilon)
│             │   • merge collinear duplicates, drop zero-length
│             │   • detect the paper boundary; assign B
│             │   • infer the reference grid; snap to it if confident
│             │   • normalize to [0,1]²
└──────┬──────┘
       ▼
┌─────────────┐   planar face-finding; compute vertices_* / faces_*
│  TOPOLOGY   │
└──────┬──────┘
       ▼
┌─────────────┐   §2.4 rules + flat-foldability checks → per-defect report
│  VALIDATE   │
└──────┬──────┘
       ▼
┌─────────────┐   headless Origami Simulator; strain + convergence
│  SIMULATE   │   (optional, async)
└──────┬──────┘
       ▼
   .kami + confidence report + defect list
```

The `CLEAN` stage is where conversions actually succeed or fail. Notes:

- **Adaptive epsilon.** A fixed snap tolerance fails on both dense
  tessellations and sparse CPs. Derive epsilon from the median edge length
  (~2%), clamped to a sane range.
- **Grid inference.** Try candidate divisions (8, 16, 22.5°, 24, 32, 64, hex)
  and score how many vertices land on each grid. A strong fit (>90% of vertices
  within epsilon) means we can snap everything and eliminate accumulated
  numerical drift — this single step fixes most scanned patterns.
- **Boundary detection.** The convex hull is usually the paper edge, but not for
  non-convex paper. Prefer the largest closed cycle enclosing all other
  geometry.

### 3.3 The hard case: SVG and raster

**SVG** is deceptively hard. There's no standard for how CPs are encoded, so we
run several strategies and pick the best-scoring result:

1. **Color heuristic** (most common). Origami Simulator's convention is the de
   facto standard and we adopt it exactly: red `#ff0000` = mountain, blue
   `#0000ff` = valley, black `#000000` = border, yellow `#ffff00` =
   triangulation, green `#00ff00` = cut, magenta `#ff00ff` = undriven. We match
   in HSV space with tolerance, so "reddish" works.
2. **Layer/group names** — `mountain`, `valley`, `M`, `V`, `mv`, Japanese
   equivalents (山 / 谷).
3. **Stroke style** — dashed vs. solid is a common print convention (dashed is
   usually valley, but it's ambiguous; low confidence).
4. **LLM fallback** — when the above disagree or the palette is unusual, hand
   the SVG's style table and a rendered preview to a vision model and ask it to
   map styles → assignments. This is a small, well-bounded classification task
   with a closed answer set, which is exactly where models are reliable.

**Raster/photo** is a research-grade problem and we treat it as best-effort with
a human in the loop:

1. Dewarp and rectify (detect paper quad, perspective-correct).
2. Enhance: contrast normalization, shadow removal.
3. Line detection (LSD / Hough) → candidate segments.
4. Vision model classifies each segment M/V/B by color and stroke, and — for
   pencil-on-paper photos with no color coding — reasons about the *structure*
   (Maekawa/Kawasaki consistency at each vertex) to propose an assignment.
5. Grid inference snaps everything to a clean lattice.
6. **Mandatory human review** in the editor before publishing. Raster imports
   never auto-publish.

Step 4 is where LLM/vision compute genuinely earns its cost. Assigning M/V to an
uncolored CP is a global constraint-satisfaction problem, and a model that has
seen thousands of CPs is a good proposer — with the validator as the check on
its output. We pair the model with a solver: the model proposes, Maekawa and
Kawasaki dispose. Never ship a model's answer unverified.

### 3.4 Confidence and honesty

Every conversion emits a confidence score and a defect list. The UI is explicit
about what was guessed:

- **≥0.95** — auto-publishable, no badge.
- **0.7–0.95** — "Needs review" badge; user is dropped into the editor with
  suspicious edges highlighted.
- **<0.7** — blocked from publishing; editor review required.

Ambiguous edges are marked `U` (unassigned) rather than guessed silently. A CP
that admits it doesn't know is far more useful than one that's confidently
wrong, because `U` is visible in the editor and invites a fix.

---

## 4. The Editor

A deliberately simple browser CP editor. The bar is "fix a converted file and
make a Miura-ori," not "design a competition-level insect." Serious designers
will keep using Oriedita/ORIPA and import — and that's fine, because good
import/export makes us a hub rather than a walled garden.

### Core capabilities

- **Canvas**: pan/zoom, square/rectangular/hex/custom paper.
- **Grid**: n×n, 22.5°, hex, or none. Snap-to-grid and snap-to-intersection.
- **Tools**: line, ray (extend to boundary), rectangle, polygon, erase,
  select-and-reassign.
- **Assignment**: click-cycle or hotkey M / V / B / F / U / C. Standard colors.
- **Symmetry**: mirror (H/V/diagonal) and rotational (2/4/n-fold) — a huge time
  saver, since most CPs are symmetric.
- **Repair panel**: the validator's defect list, each item clickable to zoom to
  the problem, with one-click fixes ("split at intersection," "snap to grid,"
  "assign unassigned by symmetry").
- **Live checks**: flat-foldability indicators per vertex, updating as you draw
  — a red dot at a vertex that violates Maekawa is worth a thousand words of
  documentation.
- **Simulate button**: pushes the current state to the embedded simulator.

### Technical approach

- Rendering: SVG for ≤5k edges, canvas/WebGL above that (dense tessellations
  can hit 50k+ edges and DOM nodes die).
- State: immutable geometry snapshots with structural sharing → free undo/redo.
- Model: same in-memory graph the converter's `CLEAN` stage uses, so the repair
  tools are literally the converter's operations exposed as UI.
- Autosave to IndexedDB; the editor works offline and syncs on reconnect.

---

## 5. The 3D Simulator

### 5.1 What we're embedding

**Origami Simulator** by Amanda Ghassaei (with Erik Demaine and Neil
Gershenfeld) — the GPU-accelerated WebGL simulator at origamisimulator.org. It
solves for all creases folding simultaneously via a dynamic solver running in
fragment shaders. It already uses FOLD internally and imports SVG using the
color conventions above, so our data model lines up with it exactly.

**License: MIT** (confirmed via the GitHub API on the
`amandaghassaei/OrigamiSimulator` repo). MIT permits embedding, modification,
and commercial use, requiring only that we preserve the copyright and license
notice. So embedding is legally straightforward.

### 5.2 Integration plan

There is **no documented public embed API, URL parameter, or headless mode** —
the README and site don't describe one. So "embed the iframe and pass a URL"
isn't available off the shelf, and we shouldn't plan as if it were. Instead:

**Phase 1 — Vendored fork.** Fork the repo, strip its UI chrome, and expose a
small `KamiSim` wrapper:

```ts
const sim = await KamiSim.mount(el, { fold: kamiToFold(pattern) });
sim.setFoldAmount(0.75);      // 0 → flat, 1 → fully folded
sim.setStrainVisible(true);
sim.on("converged", ({ maxStrain, stable }) => …);
const { vertices, faces } = sim.exportFoldedState();
```

Served from our own origin so we control versioning and don't depend on someone
else's uptime. The fork's changes stay minimal and rebasable, and we upstream
anything generally useful.

**Phase 2 — Headless simulation.** The same solver in a worker + headless-GL on
the server, run at ingest to populate `kami:simulation` and produce the
`L2 Simulatable` badge. This is what makes "sort by: actually collapses" a
filter we can offer.

**Phase 3 — Cached previews.** Rendered turntable WebP/MP4 loops of the folded
form, generated once at ingest. Most viewers never touch the interactive
simulator; they just want to see the shape. Cached loops are dramatically
cheaper than booting a WebGL context, and they work on low-end mobile.

### 5.3 Honest constraints

Simulation will not work for every pattern, and the UI must say so rather than
spin forever:

- Very dense CPs (>20k faces) are slow or infeasible on mobile GPUs.
- Non-flat-foldable and 3D-target designs may not converge to anything sensible.
- Patterns with unassigned (`U`) creases can't be driven.
- Requires WebGL2; degrade to the cached preview loop otherwise.

Failure is reported as "this pattern didn't converge," never as a silent hang.
Real CPs from real designers will fail this step regularly, and treating that as
normal — rather than as an error state — keeps the feature trustworthy.

---

## 6. Search & Discovery

Three complementary systems behind one search bar.

### 6.1 Semantic search

Text embeddings over a synthesized document per pattern: title, description,
tags, designer, techniques, and — importantly — **an LLM-generated structural
description** written at ingest ("a 32×32 box-pleated grid with a central
circle-packed region and four long flaps, suited to an insect with antennae").

That generated description is what makes "spiky bug thing with lots of legs"
find the right pattern. Users don't search in vocabulary; they search in
impressions.

### 6.2 Structural / visual search

- **CP image embeddings** — a vision embedding of the rendered CP enables
  "find patterns that look like this," which is how people actually browse CPs.
- **Graph features** — vertex/edge counts, M:V ratio, degree histogram,
  symmetry group, grid system, flap count estimate. Cheap to compute, great for
  "more like this."
- **Folded-form embeddings** — embed the simulated 3D result, so you can find
  patterns that *fold into* similar shapes even when the CPs look nothing alike.
  This is something no existing site can do, and it falls out of the simulation
  work for nearly free.

### 6.3 Filters

Faceted, combinable, and URL-addressable so any search is shareable:

`difficulty` · `gridSystem` · `gridDivisions` · `paperShape` · `technique` ·
`subject` · `license` · `simulationVerified` · `flatFoldable` · `edgeCount` ·
`designer` · `hasFoldedPhotos` · `estimatedTime`

### 6.4 Implementation

Postgres + `pgvector` for embeddings and facets in one query engine — one system
to run, and it comfortably handles the scale a niche community produces.
Reach for a dedicated vector DB only if we outgrow it, which we probably won't.

---

## 7. The Social Layer

Mobile-first, image-forward, and organized around a distinction that no existing
platform makes: **the pattern** vs. **the fold**.

- A **Pattern** is the `.kami` object — the design.
- A **Fold** is someone's execution of it — photos, paper choice, shaping notes,
  time taken, difficulty experienced.

One pattern has many folds. This is the core content relationship, and it's
what makes the site generative rather than a static archive. It gives beginners
a reason to post (their fold of a famous CP is welcome content), gives designers
feedback and reach, and creates a natural difficulty signal from real folders
instead of author self-assessment.

### Content types

| Type | Contains |
|---|---|
| Pattern | `.kami` + preview + metadata + simulation |
| Fold | Photos, paper, size, time, notes, difficulty-experienced → links to a Pattern |
| Collection | User-curated set ("Tessellations to try," "My 2026 folds") |
| Post | Short text/image update — WIPs, questions, shaping tips |

### Feed

Masonry grid (Pinterest-style), infinite scroll, tuned for phones since that's
where photos get posted and browsed. Ranking blends follows, tag affinity,
recency, and quality signals, with an explicit **Following / Discover** toggle
so the algorithm never fully takes over. Every card shows the CP preview *and*
the folded result — the pairing is the whole appeal.

### Attribution

Origami has a real and frequently-violated norm about crediting designers. We
build it in:

- Every Pattern has a designer field distinct from the uploader.
- "I didn't design this" flow: upload with attribution, link to the original.
- Remixes carry `kami:provenance.derivedFrom` and render a lineage tree.
- License is a required field, chosen from a short list with plain-language
  explanations. Designers can set a default.
- Designers can claim their patterns and request takedowns.

Getting this right is also a moat: designers will only bring their work to a
site that respects it, and they're the supply side of the whole marketplace.

---

## 8. Sitemap & UX Flows

### 8.1 Sitemap

```
/                             Landing (logged out) / Feed (logged in)
│
├── /explore                  Discovery surface
│   ├── /explore/search       Results: semantic + filters (URL-addressable)
│   ├── /explore/tags/:tag
│   ├── /explore/techniques/:technique
│   └── /explore/designers
│
├── /p/:patternId             ── PATTERN PAGE (the core object) ──
│   ├── (default)             CP viewer, metadata, download, folds
│   ├── /simulate             Full-screen 3D simulator
│   ├── /folds                All folds of this pattern
│   ├── /remixes              Derivation tree
│   └── /edit                 Editor (owner only)
│
├── /f/:foldId                Fold page — photos, paper, notes, → pattern
│
├── /editor                   ── EDITOR ──
│   ├── /editor/new
│   └── /editor/:draftId
│
├── /upload                   ── CONVERTER FUNNEL ──
│   ├── /upload               Dropzone
│   ├── /upload/:jobId        Conversion progress + result
│   └── /upload/:jobId/review Repair & confirm (editor in review mode)
│
├── /u/:username              ── PROFILE ──
│   ├── (default)             Patterns designed
│   ├── /folds                Folds posted
│   ├── /collections
│   └── /likes
│
├── /c/:collectionId          Collection page
│
├── /settings                 Account, default license, notifications, privacy
│
└── /docs                     ── REFERENCE ──
    ├── /docs/kami-format     Spec (+ JSON Schema)
    ├── /docs/api
    ├── /docs/converting      Per-tool export guides
    └── /docs/attribution     Norms & licensing, in plain language
```

### 8.2 Flow: uploading a crease pattern

The critical path. Every step is designed to reduce abandonment, because this is
where the library gets built.

```
 /upload
   │  drop a file (.svg, .fold, .cp, .opx, .png, photo…)
   ▼
 Detect format ──────────────► unsupported? → "here's how to export from <tool>"
   │
   ▼
 Convert (progress: extract → clean → topology → validate)
   │
   ├── confidence ≥0.95 ──────► preview → metadata form → PUBLISH
   │
   ├── confidence 0.7–0.95 ───► /upload/:jobId/review
   │                             editor opens, defects highlighted,
   │                             one-click fixes → PUBLISH
   │
   └── confidence <0.7 ───────► review REQUIRED, publish disabled
                                 until validation reaches L1
   │
   ▼
 Metadata form  (title, designer, license, difficulty, grid, tags)
   │  ← tags, difficulty, and technique are LLM-prefilled from the geometry;
   │    the user confirms rather than composes
   ▼
 Background: headless simulate → thumbnail → embeddings → L2/L3 badges
   │
   ▼
 /p/:patternId
```

Design notes: the metadata form is prefilled by the model, so uploading is
*confirming* rather than *authoring* — the difference between a 30-second and a
5-minute task, and the difference between a full library and an empty one.
Conversion runs async with a shareable job URL; users can close the tab.

### 8.3 Flow: discovering and folding

```
 /explore/search  "box pleated beetle, 32 grid, medium difficulty"
   │  semantic search + facet filters; results as CP+fold card pairs
   ▼
 /p/:patternId
   │  ├─ CP viewer (zoom, layer toggles M/V/B, print-to-scale)
   │  ├─ [Fold in 3D] → /p/:id/simulate, or cached loop on weak devices
   │  ├─ [Download] → .kami / .fold / .svg / .pdf(to scale) / .cp
   │  ├─ Metadata: designer, difficulty, grid, paper, license
   │  ├─ Community folds ← the proof it's foldable
   │  └─ [Remix] → /editor with provenance pre-linked
   ▼
 Fold it in real life
   ▼
 [Post your fold] → photos + paper + notes + difficulty experienced
   ▼
 /f/:foldId  → appears on the pattern page and in followers' feeds
```

This loop is the engine of the site: search → fold → post → which enriches the
pattern → which improves search. Each fold posted makes the pattern more
discoverable and more credible.

### 8.4 Flow: first-time visitor (logged out)

Landing leads with a live simulator running a beautiful pattern — the "whoa"
moment must be immediate and requires no signup. Browsing, searching,
simulating, and downloading all work logged out. Auth is required only to
publish, post, follow, or save. Never gate the magic behind a signup wall; gate
only the things that need an identity.

### 8.5 Mobile

Phone is the primary device for feed and fold-posting; desktop for editing and
serious simulation.

- Feed, pattern pages, folds, profiles: fully responsive, touch-first.
- Simulator: works, with a face-count cap and automatic fallback to the cached
  turntable loop.
- Editor: view/review capable; full editing is desktop-first (accurate line
  drawing on a phone is a bad experience, and pretending otherwise wastes
  effort better spent elsewhere).
- Camera upload: photograph a CP → conversion pipeline, right from the phone.

---

## 9. Technical Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Next.js (App Router) · React · TypeScript · Tailwind    │
│  ├── kami-render   CP → SVG/canvas renderer              │
│  ├── kami-editor   editing surface                       │
│  └── kami-sim      vendored Origami Simulator (MIT)      │
└───────────────────────┬──────────────────────────────────┘
                        │ tRPC / REST
┌───────────────────────▼──────────────────────────────────┐
│  API — Node/TypeScript                                   │
│  ├── auth · social graph · feed ranking                  │
│  ├── search (pgvector + facets)                          │
│  └── upload orchestration                                │
└───────┬───────────────────────────────┬──────────────────┘
        │                               │
┌───────▼────────────┐        ┌─────────▼─────────────────┐
│ Postgres+pgvector  │        │ Worker queue              │
│ users, patterns,   │        │ ├── kamiconv (convert)    │
│ folds, embeddings  │        │ ├── headless simulate     │
└────────────────────┘        │ ├── thumbnail/turntable   │
┌────────────────────┐        │ ├── embeddings            │
│ S3/R2: .kamiz,     │◄───────┤ └── LLM metadata + vision │
│ media, thumbnails  │        └───────────────────────────┘
└────────────────────┘
```

**Shared core (`@kamibase/core`)** — one TypeScript package containing the
geometry graph, validator, canonicalizer, and format parsers. It runs in the
browser (editor live-validation), on the server (ingest), and in workers. One
implementation, one set of rules, no drift between what the editor says and what
the server accepts. This is the most important architectural decision in the
document: two implementations of the validator would diverge within a month.

**Why TypeScript throughout** — the geometry code is the crown jewel and needs
to run client-side for a responsive editor. Sharing one language avoids
reimplementing the graph in Python. Heavy CV (dewarping, line detection) is the
exception and can be a Python service.

---

## 10. Build Order

**Phase 0 — Foundations**
`@kamibase/core`: graph, `.kami` schema + JSON Schema, canonicalizer, validator,
`.fold`/`.cp`/`.opx` parsers, SVG renderer. Testable, headless, no UI.

**Phase 1 — Viewer + Simulator**
Pattern pages, CP viewer, vendored simulator, download in all formats. Seed
~100 public-domain/CC patterns by hand. *The site is useful and impressive
before any social features exist.*

**Phase 2 — Converter**
SVG pipeline, upload funnel, confidence scoring, review flow. Raster/photo path
behind a flag.

**Phase 3 — Editor**
Drawing tools, symmetry, repair panel, live flat-foldability checks.

**Phase 4 — Social**
Accounts, folds, feed, follows, collections, attribution and licensing.

**Phase 5 — Search**
Embeddings, semantic + visual search, facets, "more like this."

The ordering is deliberate: **content and utility before community.** A social
site with no patterns is empty and dies; a great CP viewer/simulator with 100
seeded patterns is useful on day one and attracts the people who will supply the
content. Search comes last because it needs a corpus to be worth anything.

---

## 11. Open Questions

1. **Seeding the library.** Which patterns can we legally host? Likely: CC/PD
   patterns, plus designer partnerships. Probably needs direct outreach to a
   handful of well-known designers before launch — their presence sets the norm.
2. **Copyright enforcement.** CPs sit in a murky area (a CP is arguably a
   functional specification, but many designers treat them as protected work).
   Need a clear takedown policy and a designer-claim process from day one, not
   after the first dispute.
3. **Photo-to-CP accuracy.** Genuinely unsolved for uncolored hand-drawn CPs. Is
   assisted review good enough to be worth shipping, or does it produce more
   frustration than value? Prototype early and measure before committing.
4. **Simulator forking cost.** How invasive is stripping the UI from Origami
   Simulator, and how painful is rebasing on upstream? Spike this in week one —
   it's the largest unknown with the biggest blast radius on the roadmap.
5. **Moderation** at scale for image content.
6. **`.kami` vs. plain FOLD.** If FOLD adds first-class metadata, do we fold our
   extension back in? Ideally yes — we should propose `kami:` fields upstream
   and prefer standardization over differentiation.

---

## References

- [FOLD file format spec](https://github.com/edemaine/fold/blob/main/doc/spec.md) — Demaine, Ku, Lang, Tachi et al.
- [FOLD viewer & API](https://edemaine.github.io/fold/)
- [Origami Simulator](https://origamisimulator.org/) · [source, MIT](https://github.com/amandaghassaei/OrigamiSimulator)
- [Fast, Interactive Origami Simulation using GPU Computation](https://erikdemaine.org/papers/OrigamiSimulator_Origami7/) — Ghassaei, Demaine, Gershenfeld
- [ORIPA](https://mitani.cs.tsukuba.ac.jp/oripa/) — Jun Mitani · [source](https://github.com/oripa/oripa) · [`.cp` format described in the user manual](https://www.cs.upc.edu/~robert/teaching/origami/literatura/oripa-UserManual.pdf)
- [Oriedita](https://github.com/oriedita/oriedita) — modern CP editor
- [TreeMaker](https://langorigami.com/article/treemaker/) — Robert J. Lang
