import { describe, expect, it } from "vitest";
import { checkKamiDocument } from "@kamibase/core";
import { emptyPaper, type EditorDoc } from "@/lib/editor/model";
import { patternFromDocument } from "@/lib/patterns/document";
import { ingestPattern, patternRow } from "@/lib/patterns/save";
import { DEFAULT_LICENSE, type PatternDraft } from "@/lib/patterns/validate";

/**
 * A waterbomb base: the paper edge, both diagonals and both midlines.
 *
 * The same geometry and the same assignments as the seeded `waterbomb-base`,
 * so the two can be compared verdict for verdict.
 */
function waterbomb(): EditorDoc {
  return [
    ...emptyPaper(),
    { x1: 0, y1: 0, x2: 1, y2: 1, assignment: "V" },
    { x1: 1, y1: 0, x2: 0, y2: 1, assignment: "V" },
    { x1: 0.5, y1: 0, x2: 0.5, y2: 1, assignment: "M" },
    { x1: 0, y1: 0.5, x2: 1, y2: 0.5, assignment: "M" },
  ];
}

const draft: PatternDraft = {
  title: "Waterbomb base",
  designer: "",
  description: "The one everyone starts with.",
  license: "CC0-1.0",
  tags: ["traditional", "base"],
  difficulty: 2,
};

const KAMI_ID = "01J0000000000000000000000A";

/** Any uuid; the row does not care, and nothing here talks to a database. */
const ID = "11111111-1111-1111-1111-111111111111";

function ingested(overrides: Partial<PatternDraft> = {}) {
  return ingestPattern({
    draft: { ...draft, ...overrides },
    doc: waterbomb(),
    savedBy: "eric",
    kamiId: KAMI_ID,
  });
}

describe("ingestPattern", () => {
  it("produces a document the .kami schema accepts", () => {
    const checked = checkKamiDocument(ingested().document);
    expect(checked.errors).toEqual([]);
    expect(checked.ok).toBe(true);
  });

  it("resolves the crossings the editor left in the segments", () => {
    // Four creases through the middle of the sheet meet at one point that no
    // segment mentions. Planarizing is what turns that into a vertex.
    const result = ingested();
    expect(result.graph.vertices.length).toBeGreaterThan(waterbomb().length);
    expect(result.graph.faces?.length).toBe(8);
  });

  it("grades the pattern rather than taking anyone's word for it", () => {
    const result = ingested();
    expect(result.grade.structural.ok).toBe(true);
    expect(result.grade.level).toBe("L1");
    /*
     * Not locally flat-foldable, and that is the right answer: the centre
     * vertex has four mountains and four valleys, so |M - V| is 0 rather than
     * 2 and Maekawa fails. The seeded waterbomb base gets the same verdict
     * (scripts/seeds/catalog.ts), which is the point of this assertion: a
     * saved pattern is graded by the same checks a seeded one is.
     */
    expect(result.grade.flatFold?.flatFoldable).toBe(false);
  });

  it("stamps a content hash of the geometry", () => {
    expect(ingested().contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes the same geometry the same, whatever it is called", () => {
    expect(ingested({ title: "Something else" }).contentHash).toBe(ingested().contentHash);
  });

  it("carries the form's metadata into the kami block", () => {
    const document = ingested().document;
    expect(document.file_title).toBe("Waterbomb base");
    expect(document["kami:license"]).toMatchObject({ spdx: "CC0-1.0", redistribution: "any" });
    expect(document["kami:taxonomy"]).toMatchObject({ tags: ["traditional", "base"] });
    expect(document["kami:difficulty"]).toMatchObject({ rating: 2 });
  });

  it("credits the person saving it when they named no designer", () => {
    expect(ingested().document["kami:provenance"]).toMatchObject({ designer: "eric" });
  });

  it("keeps the designer separate from the person saving it", () => {
    const document = ingested({ designer: "Kōryō Miura" }).document;
    expect(document["kami:provenance"]).toMatchObject({ designer: "Kōryō Miura" });
  });
});

describe("patternRow", () => {
  const row = patternRow({ slug: "waterbomb-base-2", authorId: ID, result: ingested() });

  it("fills the columns the table requires", () => {
    expect(row.slug).toMatch(/^[a-z0-9][a-z0-9-]{0,79}$/);
    expect(row.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.level).toBe("L1");
    expect(row.title).toBe("Waterbomb base");
    expect(row.license).toBe("CC0-1.0");
    expect(row.difficulty).toBe(2);
    expect(row.tags).toEqual(["traditional", "base"]);
  });

  it("counts what the document holds, not what was drawn", () => {
    expect(row.vertex_count).toBe(row.document.vertices_coords.length);
    expect(row.edge_count).toBe(row.document.edges_vertices.length);
    expect(row.face_count).toBe(8);
    expect(row.mountain_count + row.valley_count).toBeLessThan(row.edge_count);
  });

  it("leaves difficulty null rather than absent, since the column is nullable", () => {
    const { difficulty: _rated, ...unrated } = draft;
    const plain = patternRow({
      slug: "plain",
      authorId: ID,
      result: ingestPattern({
        draft: { ...unrated, license: DEFAULT_LICENSE },
        doc: waterbomb(),
        savedBy: "eric",
        kamiId: KAMI_ID,
      }),
    });
    expect(plain.difficulty).toBeNull();
  });
});

describe("a saved row read back", () => {
  it("describes itself exactly as the seeded library would", () => {
    const row = patternRow({ slug: "waterbomb-base-2", authorId: ID, result: ingested() });
    const pattern = patternFromDocument(row.slug, row.document);

    expect(pattern.title).toBe(row.title);
    expect(pattern.level).toBe(row.level);
    expect(pattern.flatFoldable).toBe(row.flat_foldable);
    expect(pattern.edgeCount).toBe(row.edge_count);
    expect(pattern.faceCount).toBe(row.face_count);
    expect(pattern.mountainCount).toBe(row.mountain_count);
    expect(pattern.contentHash).toBe(row.content_hash);
    expect(pattern.tags).toEqual(row.tags);
  });
});
