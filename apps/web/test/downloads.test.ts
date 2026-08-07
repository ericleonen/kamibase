import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseCp, parseFold, checkKamiDocument } from "@kamibase/core";
import {
  DOWNLOAD_FORMATS,
  isDownloadFormat,
  renderDownload,
} from "@/lib/downloads";
import { FileSystemPatternRepository } from "@/lib/patterns/filesystem";

const repository = new FileSystemPatternRepository({
  directory: fileURLToPath(new URL("../content/patterns", import.meta.url)),
});

const pattern = await repository.get("bird-base");
if (!pattern) throw new Error("the bird-base seed is missing");

describe("isDownloadFormat", () => {
  it("accepts the offered formats and nothing else", () => {
    for (const format of DOWNLOAD_FORMATS) expect(isDownloadFormat(format)).toBe(true);
    expect(isDownloadFormat("pdf")).toBe(false);
    expect(isDownloadFormat("../../etc/passwd")).toBe(false);
    expect(isDownloadFormat("")).toBe(false);
  });
});

describe("renderDownload", () => {
  it(".kami is the canonical document, and still schema-valid", () => {
    const download = renderDownload("kami", "bird-base", pattern.document, pattern.graph);
    expect(download.filename).toBe("bird-base.kami");
    expect(download.contentType).toContain("application/json");
    const parsed = JSON.parse(download.body) as unknown;
    expect(checkKamiDocument(parsed).errors).toEqual([]);
  });

  it(".fold drops the kami: namespace but keeps the geometry", () => {
    const download = renderDownload("fold", "bird-base", pattern.document, pattern.graph);
    const fold = JSON.parse(download.body) as Record<string, unknown>;
    expect(Object.keys(fold).some((key) => key.startsWith("kami:"))).toBe(false);
    expect(fold["vertices_coords"]).toEqual(pattern.document.vertices_coords);
    expect(fold["edges_assignment"]).toEqual(pattern.document.edges_assignment);
  });

  it(".fold round-trips back through our own parser", () => {
    const download = renderDownload("fold", "bird-base", pattern.document, pattern.graph);
    const reparsed = parseFold(download.body);
    expect(reparsed.graph.edges.length).toBe(pattern.graph.edges.length);
    expect(reparsed.graph.assignments).toEqual(pattern.graph.assignments);
  });

  it(".cp round-trips back through our own parser", () => {
    const download = renderDownload("cp", "bird-base", pattern.document, pattern.graph);
    expect(download.contentType).toContain("text/plain");
    const reparsed = parseCp(download.body);
    expect(reparsed.graph.edges.length).toBe(pattern.graph.edges.length);
    expect(reparsed.warnings).toEqual([]);
  });

  it(".svg is a standalone document in the standard colours", () => {
    const download = renderDownload("svg", "bird-base", pattern.document, pattern.graph);
    expect(download.contentType).toContain("image/svg+xml");
    expect(download.body.startsWith("<?xml")).toBe(true);
    expect(download.body).toContain('stroke="#ff0000"');
    expect(download.body).toContain('stroke="#0000ff"');
    expect(download.body).toContain('stroke="#000000"');
    expect(download.body.trimEnd().endsWith("</svg>")).toBe(true);
  });

  it("names every file after the pattern slug", () => {
    for (const format of DOWNLOAD_FORMATS) {
      const download = renderDownload(format, "bird-base", pattern.document, pattern.graph);
      expect(download.filename).toBe(`bird-base.${format}`);
    }
  });

  it("produces something for every seeded pattern in every format", async () => {
    for (const summary of await repository.list()) {
      const full = (await repository.get(summary.id))!;
      for (const format of DOWNLOAD_FORMATS) {
        const download = renderDownload(format, full.id, full.document, full.graph);
        expect(download.body.length, `${full.id}.${format}`).toBeGreaterThan(50);
      }
    }
  });
});
