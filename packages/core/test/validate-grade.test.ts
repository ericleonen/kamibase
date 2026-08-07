import { describe, expect, it } from "vitest";
import {
  atLeast,
  grade,
  gradeGraph,
  ingest,
  parseCp,
  VALIDATION_LEVELS,
  type FoldDocument,
  type KamiDocument,
} from "../src/index.js";
import { fixture, fixtureJson, graph, unitSquare } from "./helpers.js";

const verified = { simulation: { verified: true } };

describe("grade", () => {
  it("returns invalid when there is no geometry at all", () => {
    const result = grade({} as FoldDocument);
    expect(result.level).toBe("invalid");
    expect(result.reasons[0]).toMatch(/no readable geometry/);
    expect(result.flatFold).toBeNull();
  });

  it("returns invalid for geometry that parses but is empty", () => {
    const result = grade({
      vertices_coords: [],
      edges_vertices: [],
      edges_assignment: [],
    } as FoldDocument);
    expect(result.level).toBe("invalid");
  });

  it("returns L0 for a file with geometry but structural defects", () => {
    const crossing = ingest(parseCp(fixture("waterbomb.cp")), { planarize: false });
    expect(crossing.grade.level).toBe("L0");
    expect(crossing.grade.reasons[0]).toMatch(/L1 blocked/);
    expect(crossing.grade.reasons[0]).toMatch(/crossing-without-vertex/);
  });

  it("returns L0 for a plain .fold with no kami: metadata", () => {
    const result = grade(fixtureJson<FoldDocument>("square-x.fold"));
    expect(result.level).toBe("L0");
    expect(result.reasons[0]).toMatch(/missing-required-metadata/);
  });

  it("returns L1 for a clean file with no simulation evidence", () => {
    const { "kami:simulation": _dropped, ...noEvidence } =
      fixtureJson<KamiDocument>("square-spokes.kami");
    const result = grade(noEvidence as KamiDocument);
    expect(result.level).toBe("L1");
    expect(result.reasons[0]).toMatch(/L2 needs a headless simulator run/);
  });

  it("stays at L1 when the simulator did not converge", () => {
    const result = grade(fixtureJson<KamiDocument>("square-spokes.kami"), {
      simulation: { verified: false },
    });
    expect(result.level).toBe("L1");
    expect(result.reasons[0]).toMatch(/did not reach a stable folded state/);
  });

  it("reads L2 evidence from kami:simulation when the caller supplies none", () => {
    // The fixture carries "kami:simulation": { "verified": true }.
    const result = grade(fixtureJson<KamiDocument>("square-spokes.kami"));
    expect(result.level).toBe("L2");
  });

  it("returns L2, not L3, when a vertex fails Maekawa", () => {
    const result = grade(fixtureJson<KamiDocument>("square-spokes.kami"));
    expect(result.level).toBe("L2");
    expect(result.reasons[0]).toMatch(/L3 blocked/);
    expect(result.reasons[0]).toMatch(/Maekawa/);
    expect(result.flatFold?.flatFoldable).toBe(false);
  });

  it("returns L3 when Maekawa and Kawasaki hold at every interior vertex", () => {
    const result = ingest(parseCp(fixture("miura.cp")), verified);
    expect(result.grade.level).toBe("L3");
    expect(result.grade.reasons).toEqual([]);
    expect(result.grade.flatFold?.failures).toEqual([]);
  });

  it("blocks L3 on unassigned creases rather than guessing", () => {
    const withUnassigned = graph(
      [...unitSquare().vertices, [0.5, 0.5]],
      [
        ...unitSquare().edges,
        [0, 4, "M"],
        [1, 4, "M"],
        [2, 4, "M"],
        [3, 4, "U"],
      ],
    );
    const result = gradeGraph(withUnassigned, verified);
    expect(result.level).toBe("L2");
    expect(result.reasons[0]).toMatch(/undecidable/);
  });

  it("reports L2 without a flat-fold verdict when the check is skipped", () => {
    const result = grade(fixtureJson<KamiDocument>("square-spokes.kami"), {
      skipFlatFoldCheck: true,
    });
    expect(result.level).toBe("L2");
    expect(result.flatFold).toBeNull();
    expect(result.reasons[0]).toMatch(/not evaluated/);
  });

  it("grades a bare graph without any document metadata", () => {
    const result = gradeGraph(
      ingest(parseCp(fixture("miura.cp"))).graph,
      verified,
    );
    expect(result.level).toBe("L3");
  });
});

describe("level ordering", () => {
  it("runs invalid < L0 < L1 < L2 < L3", () => {
    expect(VALIDATION_LEVELS).toEqual(["invalid", "L0", "L1", "L2", "L3"]);
    expect(atLeast("L3", "L1")).toBe(true);
    expect(atLeast("L1", "L1")).toBe(true);
    expect(atLeast("L0", "L1")).toBe(false);
    expect(atLeast("invalid", "L0")).toBe(false);
  });
});
