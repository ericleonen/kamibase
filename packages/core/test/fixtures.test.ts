import { describe, expect, it } from "vitest";
import {
  checkFlatFoldability,
  checkKamiDocument,
  contentHash,
  ingest,
  parse,
  parseCp,
  serializeCanonical,
  toFold,
  validateStructure,
} from "../src/index.js";
import { fixture } from "./helpers.js";

const verified = { simulation: { verified: true } };

describe("the crane fixture", () => {
  const result = ingest(parseCp(fixture("crane.cp")), verified);

  it("planarizes into the expected bird-base graph", () => {
    // 4 corners + 4 edge midpoints + centre + 4 petal-fold points.
    expect(result.graph.vertices.length).toBe(13);
    // 8 boundary + 4 diagonal rays + 8 book-fold segments + 8 petal creases.
    expect(result.graph.edges.length).toBe(28);
    // The petal-fold points are already vertices in the source file, so
    // planarization only has to split the paper edge at the four midpoints.
    expect(result.warnings.join("\n")).toMatch(
      /resolved crossings into 0 new vertex\/vertices and 4 new edge\(s\)/,
    );
  });

  it("computes its faces", () => {
    // Euler: V - E + F = 2, so 13 - 28 + F = 2 with the outer face included.
    expect(result.graph.faces?.length).toBe(28 - 13 + 1);
  });

  it("is structurally clean", () => {
    expect(result.grade.structural.errors).toEqual([]);
    expect(result.grade.structural.warnings).toEqual([]);
  });

  it("passes Maekawa and Kawasaki at all five interior vertices", () => {
    const flat = checkFlatFoldability(result.graph);
    const interior = flat.vertices.filter((v) => v.interior);
    expect(interior.length).toBe(5);
    expect(interior.every((v) => v.maekawa === "pass" && v.kawasaki === "pass")).toBe(true);
    // The centre carries eight creases, five valleys to three mountains.
    const centre = interior.find((v) => v.degree === 8)!;
    expect([centre.mountains, centre.valleys]).toEqual([3, 5]);
  });

  it("grades L3", () => {
    expect(result.grade.level).toBe("L3");
  });

  it("produces a valid .kami document", () => {
    const check = checkKamiDocument(result.document);
    expect(check.errors).toEqual([]);
    expect(result.document["kami:contentHash"]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("has a stable content hash across re-ingest", () => {
    const again = ingest(parseCp(fixture("crane.cp")), verified);
    expect(again.contentHash).toBe(result.contentHash);
    expect(again.json).toBe(result.json);
  });
});

describe("the Miura-ori fixture", () => {
  const result = ingest(parseCp(fixture("miura.cp")), verified);

  it("planarizes into a 4 x 3 grid of parallelograms", () => {
    // 5 columns x 4 rows of lattice points.
    expect(result.graph.vertices.length).toBe(20);
    expect(result.graph.faces?.length).toBe(12);
  });

  it("is structurally clean", () => {
    expect(result.grade.structural.errors).toEqual([]);
  });

  it("has 3-to-1 assignments at every interior vertex", () => {
    const flat = checkFlatFoldability(result.graph);
    const interior = flat.vertices.filter((v) => v.interior);
    expect(interior.length).toBe(6);
    for (const vertex of interior) {
      expect(vertex.degree).toBe(4);
      expect(Math.abs(vertex.mountains - vertex.valleys)).toBe(2);
      expect(vertex.maekawa).toBe("pass");
      expect(vertex.kawasaki).toBe("pass");
      expect(vertex.kawasakiResidual).toBeLessThan(1e-9);
    }
  });

  it("grades L3", () => {
    expect(result.grade.level).toBe("L3");
  });

  it("exports to .fold with the geometry intact", () => {
    const fold = toFold(result.document) as Record<string, unknown>;
    expect((fold["edges_vertices"] as unknown[]).length).toBe(result.graph.edges.length);
    expect(Object.keys(fold).some((key) => key.startsWith("kami:"))).toBe(false);
  });
});

describe("the waterbomb base fixture", () => {
  const result = ingest(parseCp(fixture("waterbomb.cp")), verified);

  it("splits both book folds and both diagonals at the centre", () => {
    // 4 corners + 4 edge midpoints + centre.
    expect(result.graph.vertices.length).toBe(9);
    // 8 boundary + 4 diagonal rays + 4 book-fold rays.
    expect(result.graph.edges.length).toBe(16);
    expect(result.graph.faces?.length).toBe(8);
  });

  it("is structurally clean", () => {
    expect(result.grade.structural.errors).toEqual([]);
  });

  it("stops at L2: the centre has four mountains and four valleys", () => {
    expect(result.grade.level).toBe("L2");
    expect(result.grade.reasons[0]).toMatch(/Maekawa/);
    const flat = result.grade.flatFold!;
    expect(flat.failures.length).toBe(1);
    expect(flat.failures[0]!.maekawa).toBe("fail");
    expect(flat.failures[0]!.kawasaki).toBe("pass");
  });

  it("reaches L3 once one half-crease is reversed", () => {
    const flipped = ingest(parseCp(fixture("waterbomb-flat-foldable.cp")), verified);
    expect(flipped.grade.level).toBe("L3");
    // Same geometry, different assignment, so a different pattern.
    expect(flipped.contentHash).not.toBe(result.contentHash);
    expect(flipped.graph.vertices).toEqual(result.graph.vertices);
  });
});

describe("every fixture", () => {
  const names = [
    "crane.cp",
    "miura.cp",
    "waterbomb.cp",
    "waterbomb-flat-foldable.cp",
    "square-x.opx",
    "square-x.fold",
    "square-spokes.kami",
  ];

  it.each(names)("%s ingests to at least L1", (name) => {
    const result = ingest(parse(fixture(name), { filename: name }), verified);
    expect(result.grade.structural.errors).toEqual([]);
    expect(["L1", "L2", "L3"]).toContain(result.grade.level);
  });

  it.each(names)("%s canonicalizes to stable bytes", (name) => {
    const once = ingest(parse(fixture(name), { filename: name }));
    const twice = ingest(parse(once.json, { filename: "round-trip.kami" }));
    expect(twice.contentHash).toBe(once.contentHash);
    expect(twice.json).toBe(once.json);
    expect(serializeCanonical(JSON.parse(once.json))).toBe(once.json);
  });

  it.each(names)("%s survives a .fold export/import round trip", (name) => {
    const original = ingest(parse(fixture(name), { filename: name }));
    const reimported = ingest(
      parse(JSON.stringify(toFold(original.document)), { filename: "x.fold" }),
    );
    expect(reimported.contentHash).toBe(original.contentHash);
  });

  it.each(names)("%s validates identically as a graph and as a document", (name) => {
    const result = ingest(parse(fixture(name), { filename: name }));
    const fromDocument = validateStructure(result.document);
    expect(fromDocument.ok).toBe(true);
    expect(contentHash(result.graph)).toBe(result.contentHash);
  });
});
