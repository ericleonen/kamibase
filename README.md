# Kamibase

**A home for crease patterns.** Share them, search them, fold them, simulate them.

> ⚠️ **Status: pre-alpha.** See [DESIGN.md](DESIGN.md) for the full architecture,
> file format spec, and sitemap. What is built: [`@kamibase/core`](packages/core),
> the shared geometry, schema, validator and parsers; and
> [`@kamibase/web`](apps/web), with pattern pages, the CP viewer, the embedded
> 3D simulator, downloads in every format, the crease pattern editor, the
> in-browser converter at `/upload`, and accounts with profiles, folds, comments
> and following. Publishing a converted pattern to the library still needs the
> upload backend, so the library itself is hand-seeded.

---

## The problem

Crease patterns circulate as JPEGs on Instagram, Flickr, and Reddit. That's lossy
in every way that matters:

- You can't tell mountain from valley without squinting
- You can't simulate the fold
- You can't search by structure, only by whatever the poster typed in the caption
- You can't diff two versions, or scale one to different paper
- Attribution gets lost the moment the image is reposted

A crease pattern is **structured data**, not a picture. Kamibase treats it that way.

## What Kamibase does

| | |
|---|---|
| 📥 **Converts anything** | Upload a `.fold`, `.cp`, `.opx` or SVG, or photograph the creased paper itself, and get back a clean, validated `.kami` file |
| 🧊 **Folds it in 3D** | Every pattern is collapsible in the browser via an embedded [Origami Simulator](https://origamisimulator.org/) |
| 🔍 **Finds it semantically** | "Box-pleated beetle, 32 grid, medium difficulty". Or search by what the CP *looks like*, or by what it *folds into* |
| ✏️ **Edits it** | A simple in-browser CP editor with symmetry tools and live flat-foldability checks |
| 📱 **Connects folders** | A mobile-first, Pinterest-style feed where patterns and the folds people make from them live side by side |

Patterns and folds are separate on purpose. A pattern is the design; a fold is
somebody's execution of it, with the paper they used and how long it took. One
pattern has many folds, which is what makes a beginner's first attempt welcome
content rather than noise.

## The `.kami` format

`.kami` is **a strict profile of [FOLD](https://github.com/edemaine/fold)**, the
JSON-based origami interchange format by Demaine, Ku, Lang, and Tachi. It is not
a competing standard.

- Every `.kami` file **is a valid FOLD file.** Existing tools can open it.
- It *requires* what FOLD leaves optional, so files are reliably usable rather
  than merely parseable: normalized coordinates, no crossing creases without a
  vertex, a closed boundary, no unassigned nulls.
- It adds a spec-legal `kami:` namespace for what FOLD has no opinion on:
  difficulty, grid system, provenance, licensing, folding notes, simulation
  results.

```jsonc
{
  "file_spec": 1.2,
  "frame_classes": ["creasePattern"],
  "vertices_coords": [[0,0], [1,0], [1,1], [0,1], [0.5,0.5]],
  "edges_vertices": [[0,1],[1,2],[2,3],[3,0],[0,4],[1,4],[2,4],[3,4]],
  "edges_assignment": ["B","B","B","B","M","V","M","V"],

  "kami:version": "0.1",
  "kami:paper": { "shape": "square", "gridSystem": "22.5", "gridDivisions": 32 },
  "kami:difficulty": { "rating": 7, "estimatedMinutes": 180 },
  "kami:provenance": { "designer": "…", "derivedFrom": ["kami:01J8ABCD…"] },
  "kami:license": { "spdx": "CC-BY-NC-4.0" }
}
```

Export to plain `.fold` is a key-filter. Full spec in
[DESIGN.md §2](DESIGN.md#2-the-kami-file-format).

## Validation levels

Uploads are graded rather than accepted-or-rejected, so real-world scans have a
path in:

| Level | Meaning |
|---|---|
| `L0 Parsed` | Valid FOLD, geometry present |
| `L1 Clean` | Structurally sound, so it renders and exports correctly |
| `L2 Simulatable` | Reaches a stable folded state in a headless simulator run |
| `L3 Verified` | Locally flat-foldable (Maekawa, Kawasaki, Big-Little-Big) |

`L3` is informational, not a quality judgment. Plenty of excellent CPs aren't
flat-foldable.

## Architecture at a glance

```
Next.js + React + TypeScript
  ├── kami-render     CP → SVG/canvas
  ├── kami-editor     drawing + repair tools
  └── kami-sim        vendored Origami Simulator (MIT)
          │
       Node API ── Postgres + pgvector ── S3/R2
          │
     Worker queue
       ├── kamiconv          format conversion
       ├── headless simulate strain + convergence
       ├── embeddings        semantic / visual / folded-form
       └── vision + LLM      SVG style mapping, photo → CP, metadata prefill
```

Geometry, validation, canonicalization, and all format parsers live in one shared
package (`@kamibase/core`) that runs in the browser, on the server, and in
workers, so the editor's rules and the server's rules can never drift apart.

## Supported inputs

| Format | Ext | Status | Notes |
|---|---|---|---|
| FOLD | `.fold` | **Implemented** | Validate + canonicalize |
| ORIPA | `.opx` | **Implemented** | XML → segment list |
| Lang/ORIPA CP | `.cp` | **Implemented** | `<type> <x1> <y1> <x2> <y2>`; 1=contour, 2=mountain, 3=valley |
| Oriedita | `.ori` | Planned | |
| SVG | `.svg` | **Implemented** | Color/layer/dash heuristics; LLM fallback for odd palettes is planned |
| PDF / DXF | | Planned | Normalized into the SVG pipeline |
| Raster image | `.png` `.jpg` | **Implemented** | Rectify, Canny, Hough, then human review |
| Photo of paper | `.jpg` `.mp4` | **Implemented** | Corners, dewarp, detect, Maekawa-solved M/V |

SVG import follows the Origami Simulator color convention, which is the de facto
standard: red `#ff0000` mountain · blue `#0000ff` valley · black `#000000`
boundary · yellow `#ffff00` triangulation · green `#00ff00` cut · magenta
`#ff00ff` undriven.

Conversions emit a **confidence score** and a defect list. Ambiguous creases are
marked `U` (unassigned) rather than silently guessed, and low-confidence results
can't be published until reviewed in the editor.

## Roadmap

- [x] **Phase 0.** [`@kamibase/core`](packages/core): graph, schema, validator, canonicalizer, `.fold`/`.cp`/`.opx`/`.svg` parsers, SVG renderer
- [x] **Phase 1.** [`@kamibase/web`](apps/web): pattern pages, CP viewer, embedded simulator, downloads in every format (13 seeded patterns so far, not ~100)
- [ ] **Phase 2, half done.** The converter and its review flow are built: SVG
  import with a style table, confidence scoring, and the §3.4 publishing gate,
  all running client-side at `/upload`. Still to come: the upload backend, the
  job queue, and actually publishing to the library
- [x] **Phase 3.** Editor: line tool, eraser, assignment painting, grid snapping, live validation
- [x] **Phase 4.** Social layer: accounts, profiles, folds, comments, following, feed
- [ ] **Phase 5.** Semantic, visual, and folded-form search

The order is deliberate: **content and utility before community**. A social site
with no patterns is empty and dies, while a good viewer and simulator with 100
seeded patterns is useful on day one.

## Attribution

Origami has a real and frequently-violated norm about crediting designers.
Kamibase builds it in: designer and uploader are separate fields, licenses are
required and chosen in plain language, remixes carry their lineage in
`kami:provenance.derivedFrom`, and designers can claim their patterns or request
takedowns.

## Built on

Kamibase stands on a lot of existing work:

- [**FOLD**](https://github.com/edemaine/fold), by Erik Demaine, Jason Ku, Robert Lang, Tomohiro Tachi et al. The interchange format `.kami` extends.
- [**Origami Simulator**](https://github.com/amandaghassaei/OrigamiSimulator), by Amanda Ghassaei, Erik Demaine, and Neil Gershenfeld. MIT licensed, and vendored here for the 3D fold view. ([paper](https://erikdemaine.org/papers/OrigamiSimulator_Origami7/))
- [**ORIPA**](https://mitani.cs.tsukuba.ac.jp/oripa/), by Jun Mitani. Origin of the `.opx` and `.cp` formats.
- [**Oriedita**](https://github.com/oriedita/oriedita), a modern CP editor.
- [**TreeMaker**](https://langorigami.com/article/treemaker/), by Robert J. Lang.

## Contributing

Not open for contributions yet, since the design is still settling. If you're an
origami designer and want to shape how your work is represented, attributed, and
licensed here, that input is especially welcome at this stage.

## License

TBD. Core library and format spec are intended to be permissively licensed
(MIT/Apache-2.0) so `.kami` can be adopted by other tools.
