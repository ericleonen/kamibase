import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyse, LIVE_ANALYSIS_EDGE_LIMIT } from "@/lib/editor/analysis";
import { addSegment, docFromGraph, emptyPaper, type EditorDoc } from "@/lib/editor/model";
import { FileSystemPatternRepository } from "@/lib/patterns/filesystem";

const repository = new FileSystemPatternRepository({
  directory: fileURLToPath(new URL("../content/patterns", import.meta.url)),
});

/** The waterbomb base's eight creases, drawn as a person would draw them. */
function waterbomb(): EditorDoc {
  let doc = emptyPaper();
  for (const segment of [
    { x1: 0, y1: 0, x2: 1, y2: 1, assignment: "V" as const },
    { x1: 1, y1: 0, x2: 0, y2: 1, assignment: "V" as const },
    { x1: 0.5, y1: 0, x2: 0.5, y2: 1, assignment: "M" as const },
    { x1: 0, y1: 0.5, x2: 1, y2: 0.5, assignment: "M" as const },
  ]) {
    doc = addSegment(doc, segment);
  }
  return doc;
}

describe("analyse", () => {
  it("returns an empty result for an empty document", () => {
    const analysis = analyse([]);
    expect(analysis.errorCount).toBe(0);
    expect(analysis.vertexMarks).toEqual([]);
    expect(analysis.skipped).toBe(false);
  });

  it("finds no defects in a bare sheet of paper", () => {
    const analysis = analyse(emptyPaper());
    expect(analysis.errorCount).toBe(0);
    expect(analysis.faceCount).toBe(1);
  });

  it("splits crossings, so drawing through another crease is not a defect", () => {
    // The whole point of running planarize live: a person draws two lines that
    // cross and expects a vertex, not a §2.4.6 error.
    const analysis = analyse(waterbomb());
    expect(analysis.errorCount).toBe(0);
    expect(analysis.graph.vertices.length).toBe(9);
    expect(analysis.graph.edges.length).toBe(16);
    expect(analysis.faceCount).toBe(8);
  });

  it("marks the vertex that fails Maekawa, and says why", () => {
    const analysis = analyse(waterbomb());
    const failures = analysis.vertexMarks.filter((mark) => !mark.ok);
    expect(failures.length).toBe(1);
    expect(failures[0]?.reason).toContain("Maekawa");
    expect(failures[0]?.reason).toContain("4M / 4V");
    expect(failures[0]?.at).toEqual([0.5, 0.5]);
    expect(analysis.flatFoldable).toBe(false);
  });

  it("clears the mark once the pattern actually folds flat", () => {
    // Same eight creases with the lower half of the vertical fold reversed:
    // 5V/3M at the centre, which Maekawa accepts.
    let doc = emptyPaper();
    for (const segment of [
      { x1: 0, y1: 0, x2: 1, y2: 1, assignment: "V" as const },
      { x1: 1, y1: 0, x2: 0, y2: 1, assignment: "V" as const },
      { x1: 0, y1: 0.5, x2: 1, y2: 0.5, assignment: "M" as const },
      { x1: 0.5, y1: 0.5, x2: 0.5, y2: 1, assignment: "M" as const },
      { x1: 0.5, y1: 0, x2: 0.5, y2: 0.5, assignment: "V" as const },
    ]) {
      doc = addSegment(doc, segment);
    }
    const analysis = analyse(doc);
    expect(analysis.errorCount).toBe(0);
    expect(analysis.flatFoldable).toBe(true);
    expect(analysis.vertexMarks.filter((mark) => !mark.ok)).toEqual([]);
  });

  it("reports a crease that stops in mid-air as a warning, not an error", () => {
    const doc = addSegment(emptyPaper(), {
      x1: 0.5,
      y1: 0.5,
      x2: 0.75,
      y2: 0.75,
      assignment: "M",
    });
    const analysis = analyse(doc);
    expect(analysis.warningCount).toBeGreaterThan(0);
    expect(analysis.defects.some((defect) => defect.code === "dangling-edge")).toBe(true);
  });

  it("reports an unassigned crease without failing the pattern", () => {
    const doc = addSegment(emptyPaper(), {
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 1,
      assignment: "U",
    });
    const analysis = analyse(doc);
    expect(analysis.defects.some((defect) => defect.code === "unassigned-edge")).toBe(true);
    expect(analysis.errorCount).toBe(0);
  });

  it("does not rescale the paper when a crease strays outside it", () => {
    // Normalizing here would yank the drawing out from under the person
    // drawing it, so the analysis works in place.
    const doc = addSegment(emptyPaper(), {
      x1: 0.5,
      y1: 0.5,
      x2: 1.5,
      y2: 1.5,
      assignment: "M",
    });
    const analysis = analyse(doc);
    expect(analysis.graph.vertices.some(([x]) => x > 1)).toBe(true);
  });

  it("steps aside above the live limit rather than stalling the canvas", () => {
    const doc: EditorDoc = Array.from(
      { length: LIVE_ANALYSIS_EDGE_LIMIT + 1 },
      (_, i) => ({
        x1: 0,
        y1: i / (LIVE_ANALYSIS_EDGE_LIMIT + 2),
        x2: 1,
        y2: i / (LIVE_ANALYSIS_EDGE_LIMIT + 2),
        assignment: "M" as const,
      }),
    );
    const analysis = analyse(doc);
    expect(analysis.skipped).toBe(true);
    expect(analysis.vertexMarks).toEqual([]);
  });

  it("agrees with the seeded library it was loaded from", async () => {
    for (const id of ["bird-base", "miura-ori-4x3", "waterbomb-base"]) {
      const pattern = await repository.get(id);
      const analysis = analyse(docFromGraph(pattern!.graph));
      expect(analysis.errorCount, id).toBe(0);
      expect(analysis.flatFoldable, id).toBe(pattern!.flatFoldable);
      expect(analysis.faceCount, id).toBe(pattern!.faceCount);
    }
  });
});
