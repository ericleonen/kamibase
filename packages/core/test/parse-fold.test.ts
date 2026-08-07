import { describe, expect, it } from "vitest";
import { ParseError, parseFold, type FoldDocument } from "../src/index.js";
import { fixture, fixtureJson } from "./helpers.js";

describe("parseFold", () => {
  it("reads a plain FOLD document", () => {
    const parsed = parseFold(fixture("square-x.fold"));
    expect(parsed.format).toBe("fold");
    expect(parsed.graph.vertices.length).toBe(5);
    expect(parsed.graph.edges.length).toBe(8);
    expect(parsed.graph.assignments.slice(0, 4)).toEqual(["B", "B", "B", "B"]);
    expect(parsed.warnings).toEqual([]);
  });

  it("recognizes a .kami document by its namespace", () => {
    const parsed = parseFold(fixture("square-spokes.kami"));
    expect(parsed.format).toBe("kami");
    expect(parsed.metadata.title).toBe("Square with four spokes");
    expect(parsed.metadata.author).toBe("Eric Leonen");
    expect(parsed.graph.faces?.length).toBe(4);
  });

  it("accepts an already-parsed object", () => {
    const parsed = parseFold(fixtureJson("square-x.fold"));
    expect(parsed.graph.edges.length).toBe(8);
  });

  it("fills fold angles from the assignments when absent", () => {
    const parsed = parseFold(fixture("square-x.fold"));
    expect(parsed.graph.foldAngles).toEqual([0, 0, 0, 0, -180, -180, 180, -180]);
  });

  it("keeps supplied fold angles", () => {
    const parsed = parseFold(fixture("square-spokes.kami"));
    expect(parsed.graph.foldAngles).toEqual([0, 0, 0, 0, -180, 180, -180, 180]);
  });

  it("derives assignments from fold angles when edges_assignment is missing", () => {
    const parsed = parseFold({
      vertices_coords: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      edges_vertices: [
        [0, 1],
        [1, 2],
        [2, 0],
      ],
      edges_foldAngle: [180, -180, 0],
    } as FoldDocument);
    expect(parsed.graph.assignments).toEqual(["V", "M", "F"]);
    expect(parsed.warnings.join("\n")).toMatch(/edges_assignment is required/);
  });

  it("drops a zero z coordinate silently", () => {
    const parsed = parseFold({
      vertices_coords: [
        [0, 0, 0],
        [1, 0, 0],
      ],
      edges_vertices: [[0, 1]],
      edges_assignment: ["B"],
    } as FoldDocument);
    expect(parsed.graph.vertices).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect(parsed.warnings.join("\n")).not.toMatch(/non-2d/);
  });

  it("warns about a real z coordinate but still returns the projection", () => {
    const parsed = parseFold({
      vertices_coords: [
        [0, 0, 0],
        [1, 0, 3],
      ],
      edges_vertices: [[0, 1]],
      edges_assignment: ["B"],
    } as FoldDocument);
    expect(parsed.graph.vertices[1]).toEqual([1, 0]);
    expect(parsed.warnings.join("\n")).toMatch(/non-2d-coordinates/);
  });

  it("reports an out-of-range vertex index as a warning, not a crash", () => {
    const parsed = parseFold({
      vertices_coords: [
        [0, 0],
        [1, 0],
      ],
      edges_vertices: [
        [0, 1],
        [1, 99],
      ],
      edges_assignment: ["B", "M"],
    } as FoldDocument);
    expect(parsed.graph.edges.length).toBe(1);
    expect(parsed.warnings.join("\n")).toMatch(/vertex-index-out-of-range/);
  });

  it("reports an unknown assignment as a warning and reads it as U", () => {
    const parsed = parseFold({
      vertices_coords: [
        [0, 0],
        [1, 0],
      ],
      edges_vertices: [[0, 1]],
      edges_assignment: ["Z"],
    } as unknown as FoldDocument);
    expect(parsed.graph.assignments).toEqual(["U"]);
    expect(parsed.warnings.join("\n")).toMatch(/invalid-assignment/);
    expect(parsed.warnings.join("\n")).toMatch(/schema:/);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseFold("{not json")).toThrow(ParseError);
    expect(() => parseFold("{not json")).toThrow(/not valid JSON/);
  });

  it("throws when the root is not an object", () => {
    expect(() => parseFold("[1,2,3]")).toThrow(/root must be a JSON object/);
    expect(() => parseFold('"a string"')).toThrow(/root must be a JSON object/);
  });

  it("throws when there is no geometry anywhere", () => {
    expect(() => parseFold('{"file_spec":1.1}')).toThrow(ParseError);
  });
});

describe("file_frames", () => {
  const multiFrame = {
    file_spec: 1.2,
    file_classes: ["multiModel"],
    frame_unit: "unit",
    file_frames: [
      {
        frame_classes: ["foldedForm"],
        frame_attributes: ["3D"],
        vertices_coords: [
          [0, 0, 0],
          [1, 0, 1],
          [0.5, 1, 0],
        ],
        edges_vertices: [
          [0, 1],
          [1, 2],
          [2, 0],
        ],
        edges_assignment: ["B", "B", "B"],
      },
      {
        frame_classes: ["creasePattern"],
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
      },
    ],
  } as unknown as FoldDocument;

  it("falls back to the creasePattern frame when the key frame has no geometry", () => {
    const parsed = parseFold(multiFrame);
    expect(parsed.graph.vertices.length).toBe(4);
    expect(parsed.warnings.join("\n")).toMatch(/read it from file_frames\[1\]/);
  });

  it("can be pointed at a specific frame", () => {
    const parsed = parseFold(multiFrame, { frame: 0 });
    expect(parsed.graph.vertices.length).toBe(3);
    expect(parsed.warnings.join("\n")).toMatch(/non-2d-coordinates/);
  });

  it("throws for a frame index that does not exist", () => {
    expect(() => parseFold(multiFrame, { frame: 7 })).toThrow(/does not exist/);
  });

  it("merges parent keys into a frame that sets frame_inherit", () => {
    const parsed = parseFold(
      {
        frame_unit: "unit",
        edges_assignment: ["B", "B", "B", "B"],
        file_frames: [
          {
            frame_inherit: true,
            frame_parent: 0,
            frame_classes: ["creasePattern"],
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
          },
        ],
      } as unknown as FoldDocument,
      { frame: 0 },
    );
    expect(parsed.graph.assignments).toEqual(["B", "B", "B", "B"]);
  });

  it("prefers the key frame when it has geometry of its own", () => {
    const parsed = parseFold({
      ...(fixtureJson("square-x.fold") as FoldDocument),
      file_frames: [
        {
          frame_classes: ["creasePattern"],
          vertices_coords: [
            [0, 0],
            [1, 0],
          ],
          edges_vertices: [[0, 1]],
          edges_assignment: ["B"],
        },
      ],
    } as FoldDocument);
    expect(parsed.graph.vertices.length).toBe(5);
  });
});
