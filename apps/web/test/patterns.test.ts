import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkKamiDocument, contentHash, serializeCanonical } from "@kamibase/core";
import { FileSystemPatternRepository, readPattern } from "@/lib/patterns/filesystem";

const PATTERNS_DIR = fileURLToPath(new URL("../content/patterns", import.meta.url));
const repository = new FileSystemPatternRepository({ directory: PATTERNS_DIR });

describe("the seeded library", () => {
  it("has patterns in it", async () => {
    const all = await repository.list();
    expect(all.length).toBeGreaterThanOrEqual(13);
  });

  it("returns summaries sorted by title", async () => {
    const titles = (await repository.list()).map((p) => p.title);
    expect([...titles].sort((a, b) => a.localeCompare(b))).toEqual(titles);
  });

  it("looks a pattern up by slug", async () => {
    const pattern = await repository.get("bird-base");
    expect(pattern?.title).toBe("Bird base");
    expect(pattern?.designer).toBe("Traditional");
  });

  it("looks the same pattern up by kami:id", async () => {
    const bySlug = await repository.get("bird-base");
    expect(bySlug?.kamiId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    const byUlid = await repository.get(bySlug!.kamiId!);
    expect(byUlid?.id).toBe("bird-base");
  });

  it("returns null for an unknown id", async () => {
    expect(await repository.get("no-such-pattern")).toBeNull();
    expect(await repository.get("../../etc/passwd")).toBeNull();
  });

  it("returns an empty list for a directory that does not exist", async () => {
    const empty = new FileSystemPatternRepository({ directory: "/nonexistent" });
    expect(await empty.list()).toEqual([]);
    expect(await empty.get("anything")).toBeNull();
  });

  it("caches: two calls return the same objects", async () => {
    const first = await repository.get("kite-base");
    const second = await repository.get("kite-base");
    expect(first).toBe(second);
  });
});

describe("every seeded file", () => {
  it("is a schema-valid .kami document", async () => {
    const files = (await readdir(PATTERNS_DIR)).filter((f) => f.endsWith(".kami"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = await readFile(join(PATTERNS_DIR, file), "utf8");
      const check = checkKamiDocument(JSON.parse(text));
      expect(check.errors, `${file}: ${check.errors.join("; ")}`).toEqual([]);
    }
  });

  it("is structurally clean, so nothing ships below L1", async () => {
    for (const pattern of await repository.list()) {
      expect(["L1", "L2", "L3"], `${pattern.id} graded ${pattern.level}`).toContain(
        pattern.level,
      );
    }
  });

  it("is stored as canonical bytes with a matching content hash", async () => {
    for (const pattern of await repository.list()) {
      const full = (await repository.get(pattern.id))!;
      const text = await readFile(join(PATTERNS_DIR, `${pattern.id}.kami`), "utf8");
      expect(text.trimEnd()).toBe(serializeCanonical(full.document));
      expect(full.contentHash).toBe(contentHash(full.graph));
    }
  });

  it("carries the metadata the pattern page renders", async () => {
    for (const pattern of await repository.list()) {
      expect(pattern.title, pattern.id).not.toBe(pattern.id);
      expect(pattern.designer, pattern.id).not.toBe("Unknown");
      expect(pattern.license, pattern.id).not.toBe("unknown");
      expect(pattern.edgeCount, pattern.id).toBeGreaterThan(0);
      expect(pattern.faceCount, pattern.id).toBeGreaterThan(0);
    }
  });

  it("has computed faces, which most sources do not supply", async () => {
    const miura = await repository.get("miura-ori-8x6");
    expect(miura?.graph.faces?.length).toBe(48);
    expect(miura?.faceCount).toBe(48);
  });

  it("agrees with the flat-foldability the catalog claims", async () => {
    const expectations: Record<string, boolean> = {
      "bird-base": true,
      "blintz-base": true,
      "kite-base": true,
      "miura-ori-4x3": true,
      "miura-ori-16x12": true,
      "accordion-8": true,
      "waterbomb-base": false,
      "reference-grid-8": false,
    };
    for (const [id, flatFoldable] of Object.entries(expectations)) {
      const pattern = await repository.get(id);
      expect(pattern?.flatFoldable, id).toBe(flatFoldable);
    }
  });
});

describe("readPattern", () => {
  it("falls back to the slug when a document has no title", () => {
    const pattern = readPattern(
      "untitled",
      JSON.stringify({
        vertices_coords: [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
        edges_vertices: [
          [0, 1],
          [1, 2],
          [2, 3],
          [3, 0],
        ],
        edges_assignment: ["B", "B", "B", "B"],
      }),
    );
    expect(pattern.title).toBe("untitled");
    expect(pattern.designer).toBe("Unknown");
    expect(pattern.license).toBe("unknown");
  });

  it("surfaces a defective document as a low grade rather than throwing", () => {
    const pattern = readPattern(
      "broken",
      JSON.stringify({
        vertices_coords: [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
        // An open boundary and creases crossing with no vertex.
        edges_vertices: [
          [0, 1],
          [1, 2],
          [2, 3],
          [0, 2],
          [1, 3],
        ],
        edges_assignment: ["B", "B", "B", "M", "V"],
      }),
    );
    expect(pattern.level).toBe("L0");
    expect(pattern.report.ok).toBe(false);
    expect(pattern.report.errors.map((d) => d.code)).toContain("crossing-without-vertex");
  });
});
