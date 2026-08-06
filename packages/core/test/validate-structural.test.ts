import { describe, expect, it } from "vitest";
import {
  analyzeBoundary,
  hasDefect,
  ingest,
  parseCp,
  validateDocument,
  validateGraph,
  validateStructure,
  type FoldDocument,
  type KamiDocument,
} from "../src/index.js";
import { fixture, fixtureJson, graph, unitSquare } from "./helpers.js";

/** A structurally clean pattern: unit square, both diagonals, centre vertex. */
function cleanGraph() {
  return graph(
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0.5, 0.5],
    ],
    [
      [0, 1, "B"],
      [1, 2, "B"],
      [2, 3, "B"],
      [3, 0, "B"],
      [0, 4, "M"],
      [1, 4, "V"],
      [2, 4, "M"],
      [3, 4, "M"],
    ],
  );
}

function codes(report: { defects: readonly { code: string }[] }): string[] {
  return report.defects.map((d) => d.code);
}

describe("validateGraph: a clean pattern", () => {
  it("reports no defects at all", () => {
    const report = validateGraph(cleanGraph());
    expect(report.ok).toBe(true);
    expect(report.defects).toEqual([]);
  });

  it("never throws, whatever it is handed", () => {
    expect(() => validateGraph(graph([], []))).not.toThrow();
    expect(() =>
      validateGraph(graph([[0, 0]], [[0, 0, "M"]])),
    ).not.toThrow();
  });
});

describe("§2.4.1 presence and mutual consistency", () => {
  it("flags a document with no geometry", () => {
    const report = validateStructure({} as FoldDocument);
    expect(codes(report)).toContain("missing-geometry");
    expect(report.ok).toBe(false);
  });

  it("flags edges_assignment of the wrong length", () => {
    const report = validateStructure({
      vertices_coords: [
        [0, 0],
        [1, 0],
      ],
      edges_vertices: [[0, 1]],
      edges_assignment: ["B", "B"],
    } as FoldDocument);
    expect(codes(report)).toContain("array-length-mismatch");
  });

  it("flags edges_foldAngle of the wrong length", () => {
    const report = validateStructure({
      vertices_coords: [
        [0, 0],
        [1, 0],
      ],
      edges_vertices: [[0, 1]],
      edges_assignment: ["B"],
      edges_foldAngle: [0, 0, 0],
    } as FoldDocument);
    expect(codes(report)).toContain("array-length-mismatch");
  });

  it("flags an edge referencing a vertex that does not exist", () => {
    const report = validateStructure({
      vertices_coords: [[0, 0]],
      edges_vertices: [[0, 7]],
      edges_assignment: ["B"],
    } as FoldDocument);
    expect(codes(report)).toContain("vertex-index-out-of-range");
  });

  it("flags an edges_vertices entry that is not a pair", () => {
    const report = validateStructure({
      vertices_coords: [
        [0, 0],
        [1, 0],
      ],
      edges_vertices: [[0, 1, 2]],
      edges_assignment: ["B"],
    } as unknown as FoldDocument);
    expect(codes(report)).toContain("degenerate-edge-record");
  });
});

describe("§2.4.2 assignments", () => {
  it("rejects a value outside B M V F U C J", () => {
    const report = validateStructure({
      vertices_coords: [
        [0, 0],
        [1, 0],
      ],
      edges_vertices: [[0, 1]],
      edges_assignment: ["X"],
    } as unknown as FoldDocument);
    expect(codes(report)).toContain("invalid-assignment");
  });

  it("rejects a null assignment", () => {
    const report = validateStructure({
      vertices_coords: [
        [0, 0],
        [1, 0],
      ],
      edges_vertices: [[0, 1]],
      edges_assignment: [null],
    } as unknown as FoldDocument);
    expect(codes(report)).toContain("invalid-assignment");
  });

  it("warns, but does not fail, on U", () => {
    const withUnassigned = graph(
      [...unitSquare().vertices, [0.5, 0.5]],
      [...unitSquare().edges, [0, 4, "U"], [1, 4, "U"], [2, 4, "U"], [3, 4, "U"]],
    );
    const report = validateGraph(withUnassigned);
    expect(hasDefect(report, "unassigned-edge")).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
  });
});

describe("§2.4.3 coordinates", () => {
  it("flags a vertex with fewer than two coordinates", () => {
    const report = validateStructure({
      vertices_coords: [[0], [1, 0]],
      edges_vertices: [[0, 1]],
      edges_assignment: ["B"],
    } as FoldDocument);
    expect(codes(report)).toContain("non-2d-coordinates");
  });

  it("flags a non-zero z coordinate", () => {
    const report = validateStructure({
      vertices_coords: [
        [0, 0, 0],
        [1, 0, 0.5],
      ],
      edges_vertices: [[0, 1]],
      edges_assignment: ["B"],
    } as FoldDocument);
    expect(codes(report)).toContain("non-2d-coordinates");
  });

  it("accepts a z coordinate of zero", () => {
    const report = validateStructure({
      vertices_coords: [
        [0, 0, 0],
        [1, 0, 0],
      ],
      edges_vertices: [[0, 1]],
      edges_assignment: ["B"],
    } as FoldDocument);
    expect(codes(report)).not.toContain("non-2d-coordinates");
  });

  it("flags coordinates outside the unit square", () => {
    const scaled = graph(
      [
        [0, 0],
        [400, 0],
        [400, 400],
        [0, 400],
      ],
      unitSquare().edges,
    );
    const report = validateGraph(scaled);
    expect(codes(report)).toContain("coordinates-not-normalized");
  });

  it("flags a pattern that does not fill the unit square", () => {
    const small = graph(
      [
        [0, 0],
        [0.5, 0],
        [0.5, 0.5],
        [0, 0.5],
      ],
      unitSquare().edges,
    );
    expect(codes(validateGraph(small))).toContain("coordinates-not-normalized");
  });

  it("can be told not to require normalization", () => {
    const scaled = graph(
      [
        [0, 0],
        [400, 0],
        [400, 400],
        [0, 400],
      ],
      unitSquare().edges,
    );
    const report = validateGraph(scaled, { requireNormalized: false });
    expect(codes(report)).not.toContain("coordinates-not-normalized");
  });
});

describe("§2.4.4 boundary", () => {
  it("flags a pattern with no B edges", () => {
    const noBoundary = graph(
      [
        [0, 0],
        [1, 1],
      ],
      [[0, 1, "M"]],
    );
    expect(codes(validateGraph(noBoundary))).toContain("boundary-missing");
  });

  it("flags an open boundary", () => {
    const open = graph(
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      [
        [0, 1, "B"],
        [1, 2, "B"],
        [2, 3, "B"],
      ],
    );
    const report = validateGraph(open);
    expect(codes(report)).toContain("boundary-not-closed");
    expect(report.ok).toBe(false);
  });

  it("flags a boundary vertex with three B edges", () => {
    const branching = graph(
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0.5, 0.5],
      ],
      [
        [0, 1, "B"],
        [1, 2, "B"],
        [2, 3, "B"],
        [3, 0, "B"],
        [0, 4, "B"],
      ],
    );
    expect(codes(validateGraph(branching))).toContain("boundary-not-closed");
  });

  it("flags a hole in the border as two loops", () => {
    const holed = graph(
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0.25, 0.25],
        [0.75, 0.25],
        [0.75, 0.75],
        [0.25, 0.75],
      ],
      [
        [0, 1, "B"],
        [1, 2, "B"],
        [2, 3, "B"],
        [3, 0, "B"],
        [4, 5, "B"],
        [5, 6, "B"],
        [6, 7, "B"],
        [7, 4, "B"],
      ],
    );
    const report = validateGraph(holed);
    expect(codes(report)).toContain("boundary-multiple-loops");
    expect(report.ok).toBe(false);
  });

  it("downgrades multiple loops to a warning when frame_attributes declares it", () => {
    const doc = {
      frame_attributes: ["2D", "multiBoundary"],
      vertices_coords: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0.25, 0.25],
        [0.75, 0.25],
        [0.75, 0.75],
        [0.25, 0.75],
      ],
      edges_vertices: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 4],
      ],
      edges_assignment: ["B", "B", "B", "B", "B", "B", "B", "B"],
      "kami:version": "0.1",
      "kami:license": { spdx: "CC0-1.0" },
      "kami:paper": { shape: "square" },
    } as unknown as KamiDocument;
    const report = validateStructure(doc);
    const multi = report.defects.find((d) => d.code === "boundary-multiple-loops");
    expect(multi?.severity).toBe("warning");
    expect(report.ok).toBe(true);
  });

  it("flags geometry outside the boundary loop", () => {
    const outside = graph(
      [
        [0, 0],
        [1, 0],
        [1, 0.5],
        [0, 0.5],
        [0.5, 1],
      ],
      [
        [0, 1, "B"],
        [1, 2, "B"],
        [2, 3, "B"],
        [3, 0, "B"],
        [3, 4, "M"],
      ],
    );
    expect(codes(validateGraph(outside))).toContain("boundary-not-enclosing");
  });

  it("traces the boundary loop for the repair panel", () => {
    const analysis = analyzeBoundary(cleanGraph());
    expect(analysis.loops.length).toBe(1);
    expect(analysis.loops[0]!.length).toBe(4);
    expect(analysis.brokenVertices).toEqual([]);
    expect(analysis.boundaryEdgeCount).toBe(4);
    expect([...analysis.boundaryVertices].sort()).toEqual([0, 1, 2, 3]);
  });
});

describe("§2.4.5 degeneracies", () => {
  it("flags a duplicate edge", () => {
    const duplicated = graph(
      [...unitSquare().vertices],
      [...unitSquare().edges, [0, 1, "M"]],
    );
    const report = validateGraph(duplicated);
    expect(codes(report)).toContain("duplicate-edge");
    expect(report.ok).toBe(false);
  });

  it("flags a duplicate edge written with its endpoints reversed", () => {
    const duplicated = graph(
      [...unitSquare().vertices],
      [...unitSquare().edges, [1, 0, "M"]],
    );
    expect(codes(validateGraph(duplicated))).toContain("duplicate-edge");
  });

  it("flags a zero-length edge", () => {
    const degenerate = graph(
      [...unitSquare().vertices, [0.5, 0.5]],
      [...unitSquare().edges, [4, 4, "M"]],
    );
    expect(codes(validateGraph(degenerate))).toContain("zero-length-edge");
  });

  it("flags an edge between two distinct but coincident vertices", () => {
    const degenerate = graph(
      [...unitSquare().vertices, [0.5, 0.5], [0.5, 0.5 + 1e-12]],
      [...unitSquare().edges, [4, 5, "M"]],
    );
    const report = validateGraph(degenerate);
    expect(codes(report)).toContain("zero-length-edge");
    expect(codes(report)).toContain("coincident-vertices");
  });

  it("flags vertices duplicated within epsilon", () => {
    const duplicated = graph(
      [...unitSquare().vertices, [1, 1e-10]],
      [...unitSquare().edges],
    );
    expect(codes(validateGraph(duplicated))).toContain("coincident-vertices");
  });

  it("does not flag vertices that are merely close", () => {
    const near = graph([...unitSquare().vertices, [1, 1e-6]], [...unitSquare().edges]);
    expect(codes(validateGraph(near))).not.toContain("coincident-vertices");
  });
});

describe("§2.4.6 crossings", () => {
  it("flags two creases that cross with no vertex at the crossing", () => {
    const crossing = graph(
      [...unitSquare().vertices],
      [...unitSquare().edges, [0, 2, "M"], [1, 3, "V"]],
    );
    const report = validateGraph(crossing);
    expect(codes(report)).toContain("crossing-without-vertex");
    const defect = report.defects.find((d) => d.code === "crossing-without-vertex");
    expect(defect?.at?.[0]).toBeCloseTo(0.5, 9);
    expect(defect?.at?.[1]).toBeCloseTo(0.5, 9);
    expect(defect?.edges).toEqual([4, 5]);
  });

  it("accepts the same pattern once planarized", () => {
    const crossing = graph(
      [...unitSquare().vertices],
      [...unitSquare().edges, [0, 2, "M"], [1, 3, "V"]],
    );
    const cleaned = ingest(crossing);
    expect(cleaned.grade.structural.errors).toEqual([]);
  });

  it("flags a T-junction: a vertex sitting on an unsplit edge", () => {
    const tee = graph(
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0.5, 0],
        [0.5, 0.5],
      ],
      [
        [0, 1, "B"],
        [1, 2, "B"],
        [2, 3, "B"],
        [3, 0, "B"],
        [4, 5, "M"],
      ],
    );
    expect(codes(validateGraph(tee))).toContain("vertex-on-edge-interior");
  });

  it("flags two collinear edges that overlap", () => {
    const overlapping = graph(
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0.25, 0.5],
        [0.75, 0.5],
        [0.4, 0.5],
        [0.9, 0.5],
      ],
      [
        [0, 1, "B"],
        [1, 2, "B"],
        [2, 3, "B"],
        [3, 0, "B"],
        [4, 5, "M"],
        [6, 7, "M"],
      ],
    );
    expect(codes(validateGraph(overlapping))).toContain("overlapping-edges");
  });

  it("does not flag creases that merely share an endpoint", () => {
    expect(codes(validateGraph(cleanGraph()))).not.toContain("crossing-without-vertex");
  });
});

describe("§2.4.7 required metadata", () => {
  it("flags a plain FOLD file with no kami: block", () => {
    const report = validateStructure(fixtureJson<FoldDocument>("square-x.fold"));
    const defect = report.defects.find((d) => d.code === "missing-required-metadata");
    expect(defect?.message).toContain("kami:version");
    expect(defect?.message).toContain("kami:license");
    expect(defect?.message).toContain("kami:paper.shape");
  });

  it("flags kami:paper without a shape", () => {
    const doc = {
      ...fixtureJson<KamiDocument>("square-spokes.kami"),
      "kami:paper": { gridSystem: "square" },
    } as unknown as KamiDocument;
    const report = validateStructure(doc);
    const defect = report.defects.find((d) => d.code === "missing-required-metadata");
    expect(defect?.message).toContain("kami:paper.shape");
  });

  it("accepts the complete fixture", () => {
    const report = validateStructure(fixtureJson<KamiDocument>("square-spokes.kami"));
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
  });
});

describe("face consistency", () => {
  it("flags a face that is not a cycle of existing edges", () => {
    const broken = graph(
      [...unitSquare().vertices],
      [...unitSquare().edges],
      [[0, 1, 2]],
    );
    expect(codes(validateGraph(broken))).toContain("face-not-a-cycle");
  });

  it("flags a face with fewer than three vertices", () => {
    const broken = graph([...unitSquare().vertices], [...unitSquare().edges], [[0, 1]]);
    expect(codes(validateGraph(broken))).toContain("face-not-a-cycle");
  });

  it("accepts the faces computed at ingest", () => {
    const result = ingest(parseCp(fixture("waterbomb.cp")));
    expect(result.grade.structural.errors).toEqual([]);
    expect(result.graph.faces?.length).toBeGreaterThan(0);
  });
});

describe("connectivity warnings", () => {
  it("warns about a crease that stops in the middle of the paper", () => {
    const dangling = graph(
      [...unitSquare().vertices, [0.5, 0.5]],
      [...unitSquare().edges, [0, 4, "M"]],
    );
    const report = validateGraph(dangling);
    expect(hasDefect(report, "dangling-edge")).toBe(true);
    expect(report.ok).toBe(true);
  });

  it("warns about an isolated vertex", () => {
    const isolated = graph(
      [...unitSquare().vertices, [0.5, 0.5]],
      [...unitSquare().edges],
    );
    expect(hasDefect(validateGraph(isolated), "isolated-vertex")).toBe(true);
  });
});

describe("validateDocument", () => {
  it("returns the extracted graph alongside the report", () => {
    const { report, graph: extracted } = validateDocument(
      fixtureJson<KamiDocument>("square-spokes.kami"),
    );
    expect(report.ok).toBe(true);
    expect(extracted?.vertices.length).toBe(5);
    expect(extracted?.edges.length).toBe(8);
  });

  it("returns a null graph for a document with no geometry", () => {
    const { graph: extracted } = validateDocument({} as FoldDocument);
    expect(extracted).toBeNull();
  });
});
