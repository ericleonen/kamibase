import { describe, expect, it } from "vitest";
import {
  findFaces,
  graphFromSegments,
  ingest,
  parseCp,
  planarize,
  segmentsFromGraph,
  withFaces,
  type Segment,
} from "../src/index.js";
import { fixture, graph } from "./helpers.js";

const square: Segment[] = [
  { x1: 0, y1: 0, x2: 1, y2: 0, assignment: "B" },
  { x1: 1, y1: 0, x2: 1, y2: 1, assignment: "B" },
  { x1: 1, y1: 1, x2: 0, y2: 1, assignment: "B" },
  { x1: 0, y1: 1, x2: 0, y2: 0, assignment: "B" },
];

describe("graphFromSegments", () => {
  it("merges shared endpoints into one vertex", () => {
    const { graph: built } = graphFromSegments(square);
    expect(built.vertices.length).toBe(4);
    expect(built.edges.length).toBe(4);
  });

  it("drops zero-length segments with a warning", () => {
    const { graph: built, warnings } = graphFromSegments([
      ...square,
      { x1: 0.5, y1: 0.5, x2: 0.5, y2: 0.5, assignment: "M" },
    ]);
    expect(built.edges.length).toBe(4);
    expect(warnings.join("\n")).toMatch(/zero-length/);
  });

  it("drops an exact duplicate edge", () => {
    const { graph: built, warnings } = graphFromSegments([
      ...square,
      { x1: 0, y1: 0, x2: 1, y2: 0, assignment: "B" },
    ]);
    expect(built.edges.length).toBe(4);
    expect(warnings.join("\n")).toMatch(/duplicate edge/);
  });

  it("keeps the stronger assignment when duplicates disagree", () => {
    const { graph: built, warnings } = graphFromSegments([
      { x1: 0, y1: 0, x2: 1, y2: 0, assignment: "U" },
      { x1: 1, y1: 0, x2: 0, y2: 0, assignment: "M" },
    ]);
    expect(built.assignments).toEqual(["M"]);
    expect(warnings.join("\n")).toMatch(/conflicting assignment/);
  });

  it("round-trips through segmentsFromGraph", () => {
    const { graph: built } = graphFromSegments(square);
    const again = graphFromSegments(segmentsFromGraph(built)).graph;
    expect(again.vertices).toEqual(built.vertices);
    expect(again.edges).toEqual(built.edges);
  });
});

describe("planarize", () => {
  it("splits two crossing creases into four, adding the crossing vertex", () => {
    const crossing = graph(
      [
        [0, 0],
        [1, 1],
        [0, 1],
        [1, 0],
      ],
      [
        [0, 1, "M"],
        [2, 3, "V"],
      ],
    );
    const { graph: planar } = planarize(crossing);
    expect(planar.vertices.length).toBe(5);
    expect(planar.edges.length).toBe(4);
    expect(planar.vertices).toContainEqual([0.5, 0.5]);
    expect(planar.assignments.filter((a) => a === "M").length).toBe(2);
    expect(planar.assignments.filter((a) => a === "V").length).toBe(2);
  });

  it("splits an edge at a T-junction vertex", () => {
    const tee = graph(
      [
        [0, 0],
        [1, 0],
        [0.5, 0],
        [0.5, 1],
      ],
      [
        [0, 1, "B"],
        [2, 3, "M"],
      ],
    );
    const { graph: planar } = planarize(tee);
    expect(planar.edges.length).toBe(3);
    expect(planar.assignments.filter((a) => a === "B").length).toBe(2);
  });

  it("collapses a collinear overlap into shared edges", () => {
    const overlap = graph(
      [
        [0, 0],
        [1, 0],
        [0.5, 0],
        [1.5, 0],
      ],
      [
        [0, 1, "M"],
        [2, 3, "M"],
      ],
    );
    const { graph: planar } = planarize(overlap);
    // 0–0.5, 0.5–1 (shared, deduplicated), 1–1.5
    expect(planar.edges.length).toBe(3);
    expect(planar.vertices.length).toBe(4);
  });

  it("leaves an already-planar graph alone", () => {
    const { graph: built } = graphFromSegments(square);
    const { graph: planar } = planarize(built);
    expect(planar.edges.length).toBe(built.edges.length);
    expect(planar.vertices.length).toBe(built.vertices.length);
  });

  it("does not split at a shared endpoint", () => {
    const corner = graph(
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      [
        [0, 1, "B"],
        [1, 2, "B"],
      ],
    );
    const { graph: planar } = planarize(corner);
    expect(planar.edges.length).toBe(2);
    expect(planar.vertices.length).toBe(3);
  });
});

describe("findFaces", () => {
  it("finds the four triangles of a square with both diagonals", () => {
    const { graph: planar } = planarize(
      graph(
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
          [3, 0, "B"],
          [0, 2, "M"],
          [1, 3, "V"],
        ],
      ),
    );
    const { faces, outerLoops } = findFaces(planar);
    expect(faces.length).toBe(4);
    expect(outerLoops.length).toBe(1);
    expect(outerLoops[0]!.length).toBe(4);
    for (const face of faces) expect(face.length).toBe(3);
  });

  it("finds one face for a bare polygon", () => {
    const { graph: built } = graphFromSegments(square);
    const { faces } = findFaces(built);
    expect(faces).toEqual([expect.arrayContaining([0, 1, 2, 3])]);
  });

  it("orients every face counter-clockwise", () => {
    const withF = withFaces(graphFromSegments(square).graph);
    const face = withF.faces![0]!;
    const points = face.map((v) => withF.vertices[v]!);
    let area = 0;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i]!;
      const b = points[(i + 1) % points.length]!;
      area += a[0] * b[1] - b[0] * a[1];
    }
    expect(area / 2).toBeGreaterThan(0);
  });

  it("computes faces for a real pattern during ingest", () => {
    const miura = ingest(parseCp(fixture("miura.cp")));
    // 4 columns x 3 bands of parallelograms.
    expect(miura.graph.faces?.length).toBe(12);
    expect(miura.document.faces_vertices?.length).toBe(12);
  });

  it("returns no faces for a graph with no cycles", () => {
    const path = graph(
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
      [
        [0, 1, "M"],
        [1, 2, "M"],
      ],
    );
    expect(findFaces(path).faces).toEqual([]);
  });
});
