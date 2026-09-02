import { describe, expect, it } from "vitest";
import type { KamiDocument } from "@kamibase/core";
import { patternMetadataRow, withMetadata } from "@/lib/patterns/save";
import { patternFromDocument } from "@/lib/patterns/document";
import type { PatternDraft } from "@/lib/patterns/validate";

/**
 * Editing a pattern's metadata writes it twice: to the row's columns, which
 * listings read, and into the `.kami` document, which the pattern's own page
 * and its download read. These tests are about the second half, because it is
 * the one that is easy to forget and impossible to see in review — a rename
 * that only touches the columns looks completely correct until you open the
 * page it renamed.
 */

const BASE: KamiDocument = {
  file_spec: 1.2,
  file_title: "Old name",
  file_author: "Old designer",
  file_description: "Old notes",
  "kami:version": "0.1",
  "kami:provenance": { designer: "Old designer", originalSourceUrl: "https://example.com/x" },
  "kami:license": { spdx: "CC0-1.0", foldingAllowed: "any", redistribution: "any" },
  "kami:difficulty": { rating: 3, estimatedMinutes: 20 },
  "kami:taxonomy": { tags: ["old"], subject: ["animal"] },
  "kami:contentHash": "a".repeat(64),
  vertices_coords: [
    [0, 0],
    [1, 0],
  ],
  edges_vertices: [[0, 1]],
  edges_assignment: ["B"],
} as unknown as KamiDocument;

const FULL: PatternDraft = {
  title: "New name",
  designer: "New designer",
  description: "New notes",
  license: "CC-BY-4.0",
  tags: ["fresh", "tessellation"],
  difficulty: 7,
};

const EMPTY: PatternDraft = {
  title: "Just a title",
  designer: "",
  description: "",
  license: "LicenseRef-All-Rights-Reserved",
  tags: [],
};

describe("withMetadata", () => {
  it("is what the pattern's own page will read back", () => {
    // The round trip, which is the whole point: the summary a page renders
    // comes from the document, not from the row.
    const summary = patternFromDocument("slug", withMetadata(BASE, FULL));
    expect(summary.title).toBe("New name");
    expect(summary.designer).toBe("New designer");
    expect(summary.description).toBe("New notes");
    expect(summary.license).toBe("CC-BY-4.0");
    expect(summary.difficulty).toBe(7);
    expect(summary.tags).toEqual(["fresh", "tessellation"]);
  });

  it("agrees with the columns written beside it", () => {
    const row = patternMetadataRow(FULL);
    const summary = patternFromDocument("slug", withMetadata(BASE, FULL));
    expect(row.title).toBe(summary.title);
    expect(row.designer).toBe(summary.designer);
    expect(row.license).toBe(summary.license);
    expect(row.difficulty).toBe(summary.difficulty);
    expect(row.tags).toEqual([...summary.tags]);
  });

  it("leaves the geometry and its hash alone", () => {
    const next = withMetadata(BASE, FULL);
    expect(next.vertices_coords).toBe(BASE.vertices_coords);
    expect(next.edges_vertices).toBe(BASE.edges_vertices);
    expect(next.edges_assignment).toBe(BASE.edges_assignment);
    // Two copies of the same creases under different names are still the same
    // creases, and the hash is what says so.
    expect(next["kami:contentHash"]).toBe(BASE["kami:contentHash"]);
  });

  it("does not mutate the document it was given", () => {
    const before = JSON.stringify(BASE);
    withMetadata(BASE, FULL);
    expect(JSON.stringify(BASE)).toBe(before);
  });

  it("clears the fields somebody emptied rather than writing empty strings", () => {
    const next = withMetadata(BASE, EMPTY) as Record<string, unknown>;
    expect(next["file_description"]).toBeUndefined();
    expect(next["file_author"]).toBeUndefined();
    const summary = patternFromDocument("slug", next as KamiDocument);
    expect(summary.description).toBeUndefined();
    expect(summary.designer).toBe("Unknown");
    expect(summary.difficulty).toBeUndefined();
    expect(summary.tags).toEqual([]);
  });

  it("keeps the parts of a block it was not asked about", () => {
    // Blanking the designer must not take the source URL with it, and dropping
    // the tags must not drop the subject: both live in a block this rewrites.
    const next = withMetadata(BASE, EMPTY) as Record<string, Record<string, unknown>>;
    expect(next["kami:provenance"]?.["originalSourceUrl"]).toBe("https://example.com/x");
    expect(next["kami:taxonomy"]?.["subject"]).toEqual(["animal"]);
    expect(next["kami:difficulty"]?.["estimatedMinutes"]).toBe(20);
  });

  it("writes the licence's terms, not just its name", () => {
    // A `.kami` file carries what the licence permits so a downstream tool can
    // answer "may I redistribute this" without parsing prose.
    const next = withMetadata(BASE, FULL) as Record<string, Record<string, unknown>>;
    expect(next["kami:license"]).toEqual({
      spdx: "CC-BY-4.0",
      foldingAllowed: "any",
      redistribution: "with-attribution",
    });
  });

  it("survives a document with none of the blocks in it", () => {
    const bare = {
      file_spec: 1.2,
      vertices_coords: [],
      edges_vertices: [],
      edges_assignment: [],
    } as unknown as KamiDocument;
    const summary = patternFromDocument("slug", withMetadata(bare, FULL));
    expect(summary.title).toBe("New name");
    expect(summary.tags).toEqual(["fresh", "tessellation"]);
  });
});
