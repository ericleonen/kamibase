import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FileSystemPatternRepository } from "@/lib/patterns/filesystem";
import { filterPatterns, techniqueFacets } from "@/lib/patterns/search";

const repository = new FileSystemPatternRepository({
  directory: fileURLToPath(new URL("../content/patterns", import.meta.url)),
});
const all = await repository.list();

describe("filterPatterns", () => {
  it("returns everything for an empty filter", () => {
    expect(filterPatterns(all, {}).length).toBe(all.length);
    expect(filterPatterns(all, { q: "" }).length).toBe(all.length);
    expect(filterPatterns(all, { q: "   " }).length).toBe(all.length);
  });

  it("matches titles, case-insensitively", () => {
    const hits = filterPatterns(all, { q: "MIURA" });
    expect(hits.length).toBe(5);
    expect(hits.every((p) => p.title.toLowerCase().includes("miura"))).toBe(true);
  });

  it("matches designers", () => {
    expect(filterPatterns(all, { q: "kōryō" }).length).toBe(5);
  });

  it("matches tags and taxonomy, not just the title", () => {
    expect(filterPatterns(all, { q: "crane" }).map((p) => p.id)).toEqual(["bird-base"]);
    expect(filterPatterns(all, { q: "beginner" }).length).toBeGreaterThan(1);
  });

  it("requires every term, so more words narrow the results", () => {
    const one = filterPatterns(all, { q: "base" });
    const two = filterPatterns(all, { q: "base traditional" });
    expect(two.length).toBeLessThanOrEqual(one.length);
    expect(filterPatterns(all, { q: "miura accordion" })).toEqual([]);
  });

  it("filters by technique", () => {
    const pleating = filterPatterns(all, { technique: "pleating" });
    expect(pleating.length).toBeGreaterThan(0);
    expect(pleating.every((p) => p.techniques.includes("pleating"))).toBe(true);
  });

  it("combines a technique with free text", () => {
    const hits = filterPatterns(all, { technique: "pleating", q: "accordion" });
    expect(hits.length).toBe(3);
    expect(hits.every((p) => p.id.startsWith("accordion-"))).toBe(true);
  });

  it("returns nothing for a technique nobody uses", () => {
    expect(filterPatterns(all, { technique: "wet-folding" })).toEqual([]);
  });

  it("returns nothing rather than throwing on junk input", () => {
    expect(filterPatterns(all, { q: "((((" })).toEqual([]);
    expect(filterPatterns(all, { q: "a".repeat(500) })).toEqual([]);
  });
});

describe("techniqueFacets", () => {
  it("counts techniques, most common first", () => {
    const facets = techniqueFacets(all);
    expect(facets.length).toBeGreaterThan(3);
    for (let i = 1; i < facets.length; i += 1) {
      expect(facets[i - 1]!.count).toBeGreaterThanOrEqual(facets[i]!.count);
    }
  });

  it("counts each pattern once per technique it declares", () => {
    const facets = techniqueFacets(all);
    const pleating = facets.find((f) => f.technique === "pleating");
    expect(pleating?.count).toBe(
      all.filter((p) => p.techniques.includes("pleating")).length,
    );
  });

  it("handles an empty library", () => {
    expect(techniqueFacets([])).toEqual([]);
  });
});
