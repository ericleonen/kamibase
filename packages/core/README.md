# `@kamibase/core`

The shared crease-pattern core from [DESIGN.md](../../DESIGN.md) §9: one
TypeScript implementation of the geometry graph, the `.kami` schema, the
canonicalizer, the validator and the format parsers, running in the browser
(editor live-validation), on the server (ingest) and in workers.

Headless, dependency-light, no UI. Phase 0 of the build order in §10.

## What's here

| | |
|---|---|
| `CreaseGraph` | vertices, edges, assignments, optional fold angles and faces |
| `.kami` schema | JSON Schema (draft 2020-12) + a matching zod validator, kept honest by a conformance test |
| Canonicalizer | §2.5: normalize, round, sort, re-index, `kami:contentHash` |
| Validator | §2.4: a typed defect list, never an exception |
| Grading | §2.6: L0 Parsed / L1 Clean / L2 Simulatable / L3 Verified |
| Flat-foldability | Maekawa, Kawasaki and Big-Little-Big at every interior vertex |
| Parsers | `.fold`, `.kami`, `.cp`, `.opx`, `.svg` |
| Topology | planarization (split crossings) and planar face-finding |
| Exporter | `.fold`, as a key-filter over `.kami` |
| Renderer | CP → SVG in the Origami Simulator palette (§3.3) |

Not here, deliberately: the raster and photo pipelines (§3.3), the vision-model
fallback for odd SVG palettes, the simulator (§5), and anything with a DOM. The
SVG converter *is* here, minus the network: `parseSvg` classifies by colour,
layer name and stroke style, and exposes the style table a model or a person
would correct through.

## Install

```sh
pnpm add @kamibase/core
```

## Use

```ts
import { parse, ingest, renderSvg, toFoldJson } from "@kamibase/core";

const parsed = parse(await file.text(), { filename: file.name });
const result = ingest(parsed, { simulation: { verified: true } });

result.grade.level;        // "L3"
result.contentHash;        // "9f2b…"  SHA-256 over the canonical geometry
result.json;               // canonical .kami bytes
result.grade.structural.defects;   // typed, clickable defect list

renderSvg(result.graph, { size: 800 });   // thumbnail
toFoldJson(result.document);              // plain .fold for other tools
```

`ingest()` is the `CLEAN → TOPOLOGY → VALIDATE` tail of the §3.2 pipeline: it
normalizes to `[0,1]²`, resolves crossings into vertices, computes
`faces_vertices` by planar face-finding, stamps `kami:contentHash` and grades
the result. It does **not** snap to an inferred grid or repair assignments.
Those are converter concerns, and doing them silently would make the L1 grade
mean "we guessed and it worked out".

## Reading an SVG

An SVG does not state its assignments, it implies them, so `parseSvg` reports
what it read them from and how sure it is. The style table is the review UI
(§3.4) and the hook for the vision-model fallback (§3.3): correct a row, pass
the map back, and the file is read again.

```ts
import { parseSvg } from "@kamibase/core";

const parsed = parseSvg(await file.text());
parsed.confidence;   // 0.93, length-weighted over the creases
parsed.styles;       // [{ key: "#e8112d|solid|layer 2", stroke: "#e8112d",
                     //    assignment: "M", confidence: 0.9, method: "color",
                     //    reason: "…is within 3° of the M palette colour", … }]

// A person (or a model) says the reddish strokes really are mountains:
parseSvg(text, { assignments: { "#e8112d|solid|layer 2": "M" } });
```

Every piece is usable on its own:

```ts
import { validateGraph, checkFlatFoldability, canonicalizeGraph } from "@kamibase/core";

for (const defect of validateGraph(graph).defects) {
  console.log(defect.rule, defect.code, defect.message, defect.at);
}
```

## Validation

`validateStructure(doc)` and `validateGraph(graph)` return a
`ValidationReport` of `{ ok, defects, errors, warnings }`, and never throw.
Each defect carries the DESIGN.md rule it comes from, the vertex/edge/face
indices involved, and an `at` coordinate for the editor to zoom to.

```
missing-geometry            §2.4.1   array-length-mismatch       §2.4.1
vertex-index-out-of-range   §2.4.1   degenerate-edge-record      §2.4.1
invalid-assignment          §2.4.2   non-2d-coordinates          §2.4.3
coordinates-not-normalized  §2.4.3   boundary-missing            §2.4.4
boundary-not-closed         §2.4.4   boundary-multiple-loops     §2.4.4
boundary-not-enclosing      §2.4.4   duplicate-edge              §2.4.5
zero-length-edge            §2.4.5   coincident-vertices         §2.4.5
crossing-without-vertex     §2.4.6   vertex-on-edge-interior     §2.4.6
overlapping-edges           §2.4.6   missing-required-metadata   §2.4.7
face-not-a-cycle            §2.4     unassigned-edge             §3.4  (warning)
dangling-edge               §2.4     isolated-vertex             §2.4  (warning)
```

Parsers are the exception to "never throw": `ParseError` means "there is no
crease pattern here": unparseable JSON, XML that isn't an ORIPA file or an SVG,
a `.cp` with no usable lines, an SVG with no stroked geometry. Everything
recoverable comes back as a warning on the parse result or as a defect from the
validator.

## Interpretation notes

Places where DESIGN.md left room, and what this package does:

- **Non-square paper (§2.4.3 vs §2.5).** §2.5 says "normalized to `[0,1]²`",
  §2.4.3 says "or the paper's bounding box for non-square paper". We scale
  *uniformly*: the longer side maps to `[0,1]` and the other keeps its aspect
  ratio. Stretching each axis independently would deform non-square paper and
  change its angles, breaking every flat-foldability check downstream.
- **What `kami:contentHash` covers.** `vertices_coords`, `edges_vertices` and
  `edges_assignment`, in canonical form. Faces and fold angles are excluded
  along with the metadata: both are derived, and including them would make the
  same pattern hash differently depending on how far through ingest it got.
- **L2 evidence.** L2 needs a headless simulator run, which this package does
  not do. `grade()` takes the evidence from the caller or from
  `kami:simulation` on the document; without it a document is capped at L1.
- **L3 gate.** Maekawa **and** Kawasaki at every interior vertex, per the
  build order for this package. Big-Little-Big is computed and reported on
  every vertex check but does not gate the grade.
- **`F` creases** are creased but unfolded, so the flat-foldability checks
  drop them and merge the sectors they separate. `U`, `C` and `J` at an
  interior vertex make the checks *indeterminate* rather than failed. That is
  §3.4: a CP that admits it doesn't know is more useful than one that's
  confidently wrong.
- **`invalid` grade.** Not in the §2.6 table, which starts at L0 and assumes
  geometry exists. Files with no readable geometry at all grade `invalid`.
- **Multi-loop boundaries.** §2.4.4 rejects "a hole in the border … unless
  `frame_attributes` declares it intentional"; the attribute we look for is
  `"multiBoundary"`.
- **SVG has no standard** (§3.3), so `parseSvg` runs the strategies in the
  order the design gives, with one refinement: black is treated as the default
  ink rather than as a claim, so a layer name or a dash pattern outranks it. A
  chromatic stroke outranks everything. A style no strategy can read becomes
  `U` at confidence 0, never a guessed `M` or `V`.
- **SVG confidence** is the length-weighted mean over creases, which puts a
  file with a certain paper edge and guessed creases in the middle of the §3.4
  range, where a review is exactly what it needs.
- **Cyan in an SVG** reads as `J`, at a lower score than the six standard
  colours: no other tool means anything by it, but Kamibase's own renderer
  emits it, so reading it back is a round trip rather than a guess.
- **`.cp` line types.** DESIGN.md §3.1 lists 1/2/3. ORIPA and Oriedita also
  write 0 (undeclared) and 4 (auxiliary), which we read as `U` and `F`.
  Anything else becomes `U` with a warning.
- **`J` (join) has no colour** in the §3.3 palette; we render it cyan so it is
  visible and obviously not one of the six standard colours.

## Performance

Planarization and crossing detection are O(E²), and T-junction detection is
O(V·E). That is fine into the tens of thousands of edges; a sweepline is the
upgrade path when dense tessellations (§4, "50k+ edges") start to hurt.

## Development

```sh
pnpm build       # emit schema/kami.schema.json, then tsc
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit over src, test and scripts
```

`schema/kami.schema.json` is generated from `src/kami/json-schema.ts` and
committed; a test asserts the two match.
