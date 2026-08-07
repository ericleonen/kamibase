import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import {
  checkKamiDocument,
  kamiJsonSchema,
  KAMI_SCHEMA_ID,
  type KamiDocument,
} from "../src/index.js";
import { fixtureJson } from "./helpers.js";

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats.default(ajv);
const validate = ajv.compile(kamiJsonSchema);

const base = fixtureJson<KamiDocument>("square-spokes.kami");

/** A document with `path` (dot notation) replaced by `value`. */
function withField(path: string, value: unknown): unknown {
  const clone = structuredClone(base) as Record<string, unknown>;
  const parts = path.split(".");
  let cursor: Record<string, unknown> = clone;
  for (const key of parts.slice(0, -1)) {
    cursor = cursor[key] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1]!;
  if (value === undefined) delete cursor[last];
  else cursor[last] = value;
  return clone;
}

/**
 * Documents the two validators must agree on. This is the test that makes
 * "a JSON Schema plus a *matching* zod validator" a checked fact.
 */
const CORPUS: { name: string; document: unknown; valid: boolean }[] = [
  { name: "the complete fixture", document: base, valid: true },
  {
    name: "a minimal document",
    document: {
      vertices_coords: [
        [0, 0],
        [1, 0],
      ],
      edges_vertices: [[0, 1]],
      edges_assignment: ["B"],
      "kami:version": "0.1",
      "kami:license": { spdx: "CC0-1.0" },
      "kami:paper": { shape: "square" },
    },
    valid: true,
  },
  { name: "no vertices_coords", document: withField("vertices_coords", undefined), valid: false },
  { name: "no edges_vertices", document: withField("edges_vertices", undefined), valid: false },
  {
    name: "no edges_assignment",
    document: withField("edges_assignment", undefined),
    valid: false,
  },
  { name: "no kami:version", document: withField("kami:version", undefined), valid: false },
  { name: "no kami:license", document: withField("kami:license", undefined), valid: false },
  { name: "no kami:paper", document: withField("kami:paper", undefined), valid: false },
  {
    name: "kami:paper without a shape",
    document: withField("kami:paper", { gridSystem: "square" }),
    valid: false,
  },
  {
    name: "an unknown paper shape",
    document: withField("kami:paper.shape", "dodecagon"),
    valid: false,
  },
  {
    name: "an assignment outside B M V F U C J",
    document: withField("edges_assignment", ["B", "B", "B", "B", "M", "V", "M", "X"]),
    valid: false,
  },
  {
    name: "a null assignment",
    document: withField("edges_assignment", ["B", "B", "B", "B", "M", "V", "M", null]),
    valid: false,
  },
  { name: "every legal assignment", document: withField("edges_assignment", [
    "B", "M", "V", "F", "U", "C", "J", "B",
  ]), valid: true },
  {
    name: "kami:license without an spdx id",
    document: withField("kami:license", { foldingAllowed: "any" }),
    valid: false,
  },
  {
    name: "an empty spdx id",
    document: withField("kami:license.spdx", ""),
    valid: false,
  },
  {
    name: "an unknown foldingAllowed value",
    document: withField("kami:license.foldingAllowed", "sometimes"),
    valid: false,
  },
  { name: "a difficulty of 11", document: withField("kami:difficulty.rating", 11), valid: false },
  {
    name: "a fractional difficulty rating",
    document: withField("kami:difficulty.rating", 7.5),
    valid: false,
  },
  {
    name: "a community rating in range",
    document: withField("kami:difficulty.communityRating", 9.9),
    valid: true,
  },
  { name: "a confidence above 1", document: withField("kami:provenance.convertedFrom", {
    format: "svg",
    confidence: 1.4,
  }), valid: false },
  {
    name: "convertedFrom without a format",
    document: withField("kami:provenance.convertedFrom", { converter: "x@1" }),
    valid: false,
  },
  { name: "a malformed kami:id", document: withField("kami:id", "not-a-ulid"), valid: false },
  {
    name: "a kami:id with excluded base32 letters",
    document: withField("kami:id", "01J8XM4ZKQ7YV2N6R0BHTC3WFI"),
    valid: false,
  },
  {
    name: "a malformed content hash",
    document: withField("kami:contentHash", "ABCDEF"),
    valid: false,
  },
  {
    name: "an uppercase content hash",
    document: withField("kami:contentHash", "A".repeat(64)),
    valid: false,
  },
  {
    name: "a well-formed content hash",
    document: withField("kami:contentHash", "a".repeat(64)),
    valid: true,
  },
  {
    name: "a derivedFrom entry that is not a kami: reference",
    document: withField("kami:provenance.derivedFrom", ["01J8ABCDEFGHJKMNPQRSTVWXYZ"]),
    valid: false,
  },
  {
    name: "a media entry with an unknown role",
    document: withField("kami:media", [{ role: "sculpture", src: "a.webp" }]),
    valid: false,
  },
  {
    name: "a media entry with no src",
    document: withField("kami:media", [{ role: "folded" }]),
    valid: false,
  },
  {
    name: "a simulation timestamp without an offset",
    document: withField("kami:simulation.simulatedOn", "2026-08-01 12:00"),
    valid: false,
  },
  {
    name: "another tool's extension block",
    document: withField("oripa:paperSize", 400),
    valid: true,
  },
  {
    name: "an unknown top-level FOLD key",
    document: withField("faces_re:matrix", [[1, 0]]),
    valid: true,
  },
  { name: "a JSON array", document: [1, 2, 3], valid: false },
  { name: "a JSON string", document: "not a document", valid: false },
  { name: "null", document: null, valid: false },
];

describe("the published JSON Schema", () => {
  it("is a draft 2020-12 schema with a stable $id", () => {
    expect(kamiJsonSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(kamiJsonSchema.$id).toBe(KAMI_SCHEMA_ID);
  });

  it("compiles", () => {
    expect(typeof validate).toBe("function");
  });

  it("matches the committed schema/kami.schema.json artefact", () => {
    const emitted = JSON.parse(
      readFileSync(new URL("../schema/kami.schema.json", import.meta.url), "utf8"),
    ) as unknown;
    expect(emitted).toEqual(JSON.parse(JSON.stringify(kamiJsonSchema)));
  });

  it("requires exactly the fields DESIGN.md §2.4 requires", () => {
    expect([...kamiJsonSchema.required].sort()).toEqual([
      "edges_assignment",
      "edges_vertices",
      "kami:license",
      "kami:paper",
      "kami:version",
      "vertices_coords",
    ]);
  });
});

describe("JSON Schema and zod agree", () => {
  for (const { name, document, valid } of CORPUS) {
    it(`${valid ? "accepts" : "rejects"} ${name}`, () => {
      const ajvVerdict = validate(document);
      const zodVerdict = checkKamiDocument(document).ok;
      expect(
        { ajv: ajvVerdict, zod: zodVerdict },
        `ajv errors: ${JSON.stringify(validate.errors)}`,
      ).toEqual({ ajv: valid, zod: valid });
    });
  }
});

describe("the zod validator", () => {
  it("reports a readable path for each violation", () => {
    const result = checkKamiDocument(withField("kami:paper.shape", "dodecagon"));
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/^kami:paper\.shape: /);
  });

  it("returns the parsed document on success, preserving unknown keys", () => {
    const result = checkKamiDocument(withField("oripa:paperSize", 400));
    expect(result.ok).toBe(true);
    expect((result.data as Record<string, unknown>)["oripa:paperSize"]).toBe(400);
  });
});
