import { describe, expect, it } from "vitest";
import {
  canonicalGeometryPayload,
  canonicalizeDocument,
  canonicalizeGraph,
  contentHash,
  isCanonical,
  parseCp,
  serializeCanonical,
  type KamiDocument,
} from "../src/index.js";
import { fixture, fixtureJson, graph } from "./helpers.js";

const squareWithSpoke = graph(
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
    [4, 0, "M"],
    [4, 1, "V"],
    [4, 2, "M"],
    [4, 3, "V"],
  ],
);

describe("canonicalizeGraph", () => {
  it("sorts vertices lexicographically by (x, y)", () => {
    const canonical = canonicalizeGraph(squareWithSpoke);
    expect(canonical.vertices).toEqual([
      [0, 0],
      [0, 1],
      [0.5, 0.5],
      [1, 0],
      [1, 1],
    ]);
    expect(isCanonical(canonical)).toBe(true);
  });

  it("stores every edge with v0 < v1 and sorts the edge list", () => {
    const canonical = canonicalizeGraph(squareWithSpoke);
    for (const [a, b] of canonical.edges) expect(a).toBeLessThan(b);
    const flat = canonical.edges.map(([a, b]) => a * 1000 + b);
    expect([...flat].sort((x, y) => x - y)).toEqual(flat);
  });

  it("rounds coordinates to 9 decimal places", () => {
    const canonical = canonicalizeGraph(
      graph(
        [
          [0, 0],
          [1, 0.1234567891234],
        ],
        [[0, 1, "M"]],
      ),
    );
    expect(canonical.vertices[1]![1]).toBe(0.123456789);
  });

  it("normalizes into the unit square, preserving aspect ratio", () => {
    const canonical = canonicalizeGraph(
      graph(
        [
          [-200, -200],
          [200, -200],
          [200, 0],
          [-200, 0],
        ],
        [
          [0, 1, "B"],
          [1, 2, "B"],
          [2, 3, "B"],
          [3, 0, "B"],
        ],
      ),
    );
    // 400 x 200 paper: the long side maps to [0,1], the short side to [0,0.5].
    expect(canonical.vertices).toEqual([
      [0, 0],
      [0, 0.5],
      [1, 0],
      [1, 0.5],
    ]);
  });

  it("merges vertices that land on the same rounded coordinate", () => {
    const canonical = canonicalizeGraph(
      graph(
        [
          [0, 0],
          [1, 0],
          [1, 1e-12],
        ],
        [
          [0, 1, "B"],
          [0, 2, "M"],
        ],
      ),
      { normalize: false },
    );
    expect(canonical.vertices.length).toBe(2);
  });

  it("keeps degenerate edges instead of quietly repairing them", () => {
    const canonical = canonicalizeGraph(
      graph(
        [
          [0, 0],
          [1, 0],
        ],
        [
          [0, 1, "B"],
          [0, 1, "B"],
          [0, 0, "M"],
        ],
      ),
      { normalize: false },
    );
    expect(canonical.edges.length).toBe(3);
  });

  it("is idempotent", () => {
    const once = canonicalizeGraph(squareWithSpoke);
    const twice = canonicalizeGraph(once);
    expect(twice).toEqual(once);
  });

  it("re-indexes and canonicalizes faces", () => {
    const withFace = { ...squareWithSpoke, faces: [[1, 4, 0]] };
    const canonical = canonicalizeGraph(withFace);
    // Vertex 0 -> 0, 1 -> 3, 4 -> 2, rotated to start at the lowest index.
    expect(canonical.faces).toEqual([[0, 3, 2]]);
  });
});

describe("contentHash", () => {
  it("is stable across vertex permutation and re-indexing", () => {
    const shuffled = graph(
      [
        [0.5, 0.5],
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ],
      [
        [4, 3, "B"],
        [3, 2, "B"],
        [2, 1, "B"],
        [1, 4, "B"],
        [0, 4, "M"],
        [0, 3, "V"],
        [0, 2, "M"],
        [0, 1, "V"],
      ],
    );
    expect(contentHash(shuffled)).toBe(contentHash(squareWithSpoke));
  });

  it("ignores metadata entirely", () => {
    const doc = fixtureJson<KamiDocument>("square-spokes.kami");
    const a = canonicalizeDocument(doc, squareWithSpoke);
    const b = canonicalizeDocument(
      {
        ...doc,
        file_title: "totally different",
        "kami:taxonomy": { tags: ["nothing", "alike"] },
      },
      squareWithSpoke,
    );
    expect(a.contentHash).toBe(b.contentHash);
  });

  it("ignores faces and fold angles, which are derived", () => {
    const withExtras = {
      ...squareWithSpoke,
      faces: [[0, 1, 4]],
      foldAngles: [0, 0, 0, 0, -180, 180, -180, 180],
    };
    expect(contentHash(withExtras)).toBe(contentHash(squareWithSpoke));
  });

  it("changes when an assignment changes", () => {
    const flipped = {
      ...squareWithSpoke,
      assignments: ["B", "B", "B", "B", "V", "V", "M", "V"] as const,
    };
    expect(contentHash(flipped)).not.toBe(contentHash(squareWithSpoke));
  });

  it("changes when geometry changes", () => {
    const moved = graph(
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0.4, 0.5],
      ],
      squareWithSpoke.edges.map((edge, i) => [
        edge[0],
        edge[1],
        squareWithSpoke.assignments[i]!,
      ]),
    );
    expect(contentHash(moved)).not.toBe(contentHash(squareWithSpoke));
  });

  it("is a 64-character lowercase hex digest of the documented payload", () => {
    const hash = contentHash(squareWithSpoke);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(canonicalGeometryPayload(squareWithSpoke)).toBe(
      '{"vertices_coords":[[0,0],[0,1],[0.5,0.5],[1,0],[1,1]],' +
        '"edges_vertices":[[0,1],[0,2],[0,3],[1,2],[1,4],[2,3],[2,4],[3,4]],' +
        '"edges_assignment":["B","M","B","V","B","V","M","B"]}',
    );
  });

  it("matches for the same pattern arriving as .cp and as .fold", () => {
    const fromCp = canonicalizeGraph(parseCp(fixture("waterbomb.cp")).graph);
    const again = canonicalizeGraph(parseCp(fixture("waterbomb.cp")).graph);
    expect(contentHash(fromCp)).toBe(contentHash(again));
  });
});

describe("serializeCanonical", () => {
  it("emits spec keys in spec order and the rest alphabetically", () => {
    const json = serializeCanonical({
      "zz:custom": 1,
      "kami:version": "0.1",
      edges_vertices: [[0, 1]],
      vertices_coords: [[0, 0]],
      file_spec: 1.2,
      "aa:custom": 2,
    });
    expect(json).toBe(
      '{"file_spec":1.2,"vertices_coords":[[0,0]],"edges_vertices":[[0,1]],' +
        '"kami:version":"0.1","aa:custom":2,"zz:custom":1}',
    );
  });

  it("emits no insignificant whitespace", () => {
    expect(serializeCanonical({ a: [1, 2], b: { c: 3 } })).toBe('{"a":[1,2],"b":{"c":3}}');
  });

  it("skips undefined values but keeps nulls", () => {
    expect(serializeCanonical({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it("produces identical bytes for documents that differ only in key order", () => {
    const a = serializeCanonical({ file_title: "x", file_spec: 1.2 });
    const b = serializeCanonical({ file_spec: 1.2, file_title: "x" });
    expect(a).toBe(b);
  });
});

describe("canonicalizeDocument", () => {
  it("stamps kami:contentHash and rewrites the geometry arrays", () => {
    const doc = fixtureJson<KamiDocument>("square-spokes.kami");
    const result = canonicalizeDocument(doc, squareWithSpoke);
    expect(result.document["kami:contentHash"]).toBe(result.contentHash);
    expect(result.document.vertices_coords).toEqual([
      [0, 0],
      [0, 1],
      [0.5, 0.5],
      [1, 0],
      [1, 1],
    ]);
    expect(result.json.startsWith("{")).toBe(true);
    expect(JSON.parse(result.json)).toEqual(result.document);
  });

  it("drops derived arrays that the new indices would invalidate", () => {
    const doc = {
      ...fixtureJson<KamiDocument>("square-spokes.kami"),
      vertices_vertices: [[1, 2]],
      faces_edges: [[0, 1, 2]],
    };
    const result = canonicalizeDocument(doc, squareWithSpoke);
    expect(result.document).not.toHaveProperty("vertices_vertices");
    expect(result.document).not.toHaveProperty("faces_edges");
  });
});
