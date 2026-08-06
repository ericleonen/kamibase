import { describe, expect, it } from "vitest";
import {
  checkFlatFoldability,
  ingest,
  parseCp,
  type EdgeAssignment,
} from "../src/index.js";
import { fixture, graph } from "./helpers.js";

/**
 * A degree-4 interior vertex at the centre of the unit square, with the four
 * spokes running to the corners (90 degree sectors) unless `points` says
 * otherwise.
 */
function star(
  assignments: readonly EdgeAssignment[],
  points: readonly (readonly [number, number])[] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ],
) {
  const centre = points.length;
  return graph(
    [...points, [0.5, 0.5]],
    [
      ...points.map(
        (_, i) =>
          [i, (i + 1) % points.length, "B"] as [number, number, EdgeAssignment],
      ),
      ...points.map(
        (_, i) => [centre, i, assignments[i]!] as [number, number, EdgeAssignment],
      ),
    ],
  );
}

function centre(report: ReturnType<typeof checkFlatFoldability>) {
  return report.vertices[4]!;
}

/**
 * A vertex whose spokes leave at the given angles (degrees), with the spoke
 * endpoints wired into a closed `B` loop so the centre reads as interior.
 * Vertex `n` is the centre.
 */
function spokes(
  angles: readonly number[],
  assignments: readonly EdgeAssignment[],
  radius = 0.4,
) {
  const points = angles.map(
    (degrees) =>
      [
        0.5 + radius * Math.cos((degrees * Math.PI) / 180),
        0.5 + radius * Math.sin((degrees * Math.PI) / 180),
      ] as const,
  );
  const n = points.length;
  return graph(
    [...points, [0.5, 0.5]],
    [
      ...points.map(
        (_, i) => [i, (i + 1) % n, "B"] as [number, number, EdgeAssignment],
      ),
      ...points.map(
        (_, i) => [n, i, assignments[i]!] as [number, number, EdgeAssignment],
      ),
    ],
  );
}

describe("Maekawa", () => {
  it("passes at a 3-to-1 degree-4 vertex", () => {
    const report = checkFlatFoldability(star(["M", "M", "M", "V"]));
    expect(centre(report).maekawa).toBe("pass");
    expect(centre(report).mountains).toBe(3);
    expect(centre(report).valleys).toBe(1);
    expect(report.flatFoldable).toBe(true);
  });

  it("fails at a 2-to-2 degree-4 vertex", () => {
    const report = checkFlatFoldability(star(["M", "V", "M", "V"]));
    expect(centre(report).maekawa).toBe("fail");
    expect(report.flatFoldable).toBe(false);
    expect(report.failures.map((v) => v.vertex)).toEqual([4]);
  });

  it("fails at a 4-to-0 degree-4 vertex", () => {
    expect(centre(checkFlatFoldability(star(["M", "M", "M", "M"]))).maekawa).toBe("fail");
  });

  it("fails at a degree-8 vertex with four of each", () => {
    const result = ingest(parseCp(fixture("waterbomb.cp")));
    const report = checkFlatFoldability(result.graph);
    const eight = report.vertices.find((v) => v.interior && v.degree === 8);
    expect(eight?.mountains).toBe(4);
    expect(eight?.valleys).toBe(4);
    expect(eight?.maekawa).toBe("fail");
    expect(eight?.kawasaki).toBe("pass");
  });

  it("passes at a degree-8 vertex with five and three", () => {
    const result = ingest(parseCp(fixture("waterbomb-flat-foldable.cp")));
    const report = checkFlatFoldability(result.graph);
    const eight = report.vertices.find((v) => v.interior && v.degree === 8);
    expect(eight?.valleys).toBe(5);
    expect(eight?.mountains).toBe(3);
    expect(eight?.maekawa).toBe("pass");
    expect(eight?.kawasaki).toBe("pass");
    expect(report.flatFoldable).toBe(true);
  });

  it("fails on an odd number of creases, which Maekawa cannot balance", () => {
    const report = checkFlatFoldability(
      star(["M", "M", "V"], [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ]),
    );
    const vertex = report.vertices[3]!;
    expect(vertex.degree).toBe(3);
    expect(vertex.maekawa).toBe("fail");
    expect(vertex.kawasaki).toBe("fail");
    expect(vertex.note).toMatch(/odd number of creases/);
  });
});

describe("Kawasaki", () => {
  it("passes when alternate sectors sum to pi", () => {
    const report = checkFlatFoldability(star(["M", "M", "M", "V"]));
    expect(centre(report).kawasaki).toBe("pass");
    expect(centre(report).kawasakiResidual).toBeLessThan(1e-9);
  });

  it("fails when the sectors are lopsided", () => {
    // Move the centre off the diagonal intersection: sectors stop alternating to pi.
    const lopsided = graph(
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0.3, 0.5],
      ],
      [
        [0, 1, "B"],
        [1, 2, "B"],
        [2, 3, "B"],
        [3, 0, "B"],
        [4, 0, "M"],
        [4, 1, "M"],
        [4, 2, "M"],
        [4, 3, "V"],
      ],
    );
    const report = checkFlatFoldability(lopsided);
    expect(report.vertices[4]!.maekawa).toBe("pass");
    expect(report.vertices[4]!.kawasaki).toBe("fail");
    expect(report.vertices[4]!.kawasakiResidual).toBeGreaterThan(1e-3);
  });

  it("respects the angle tolerance option", () => {
    // Sectors of 90, 90, 90 + d, 90 - d degrees, with d = 0.02 degrees:
    // a residual of ~7e-4 rad, which 1e-6 rejects and 1e-3 accepts.
    const nearly = spokes([0, 90, 180, 270.02], ["M", "M", "M", "V"]);
    const strict = checkFlatFoldability(nearly).vertices[4]!;
    expect(strict.kawasaki).toBe("fail");
    expect(strict.kawasakiResidual).toBeGreaterThan(1e-6);
    expect(strict.kawasakiResidual).toBeLessThan(1e-3);
    expect(
      checkFlatFoldability(nearly, { angleTolerance: 1e-3 }).vertices[4]!.kawasaki,
    ).toBe("pass");
  });
});

describe("which vertices are checked", () => {
  it("skips boundary vertices", () => {
    const report = checkFlatFoldability(star(["M", "M", "M", "V"]));
    for (const id of [0, 1, 2, 3]) {
      expect(report.vertices[id]!.interior).toBe(false);
      expect(report.vertices[id]!.maekawa).toBe("indeterminate");
    }
    expect(report.flatFoldable).toBe(true);
  });

  it("treats F creases as unfolded, merging the sectors they separate", () => {
    // Eight spokes, four of them flat: the folded four are a 3-to-1 vertex.
    const points: [number, number][] = [
      [0, 0],
      [0.5, 0],
      [1, 0],
      [1, 0.5],
      [1, 1],
      [0.5, 1],
      [0, 1],
      [0, 0.5],
    ];
    const withFlats = graph(
      [...points, [0.5, 0.5]],
      [
        ...points.map(
          (_, i) => [i, (i + 1) % 8, "B"] as [number, number, EdgeAssignment],
        ),
        [8, 0, "M"],
        [8, 1, "F"],
        [8, 2, "M"],
        [8, 3, "F"],
        [8, 4, "M"],
        [8, 5, "F"],
        [8, 6, "V"],
        [8, 7, "F"],
      ],
    );
    const report = checkFlatFoldability(withFlats);
    const vertex = report.vertices[8]!;
    expect(vertex.degree).toBe(4);
    expect(vertex.maekawa).toBe("pass");
    expect(vertex.kawasaki).toBe("pass");
  });

  it("is indeterminate — not failing — when a crease is unassigned", () => {
    const report = checkFlatFoldability(star(["M", "M", "M", "U"]));
    expect(centre(report).maekawa).toBe("indeterminate");
    expect(centre(report).note).toMatch(/not M or V/);
    expect(report.flatFoldable).toBe(false);
    expect(report.indeterminate.map((v) => v.vertex)).toEqual([4]);
    expect(report.failures).toEqual([]);
  });

  it("is indeterminate at an interior vertex with no folded creases", () => {
    const allFlat = star(["F", "F", "F", "F"]);
    const report = checkFlatFoldability(allFlat);
    expect(centre(report).degree).toBe(0);
    expect(centre(report).maekawa).toBe("indeterminate");
    // Degree-0 interior vertices do not block the overall verdict.
    expect(report.flatFoldable).toBe(true);
  });
});

describe("Big-Little-Big", () => {
  /**
   * Sectors of 120, 30, 60, 150 degrees. Alternate sectors sum to 180 either
   * way, so Kawasaki holds; the 30 degree sector is a strict local minimum and
   * both creases bounding it are mountains, so Big-Little-Big does not.
   */
  const uneven = spokes([0, 120, 150, 210], ["M", "M", "M", "V"]);

  it("fails when the creases bounding a strict minimum sector match", () => {
    const report = checkFlatFoldability(uneven);
    expect(report.vertices[4]!.bigLittleBig).toBe("fail");
    expect(report.bigLittleBigFailures.map((v) => v.vertex)).toEqual([4]);
  });

  it("does not gate the verdict: Maekawa and Kawasaki still decide", () => {
    const report = checkFlatFoldability(uneven);
    expect(report.vertices[4]!.maekawa).toBe("pass");
    expect(report.vertices[4]!.kawasaki).toBe("pass");
    expect(report.flatFoldable).toBe(true);
  });

  it("is indeterminate when every sector is the same size", () => {
    expect(centre(checkFlatFoldability(star(["M", "M", "M", "V"]))).bigLittleBig).toBe(
      "indeterminate",
    );
  });
});
