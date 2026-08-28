import { describe, expect, it } from "vitest";
import { analyse } from "@/lib/editor/analysis";
import { LOGO_CREASES } from "@/lib/logo";

/**
 * The mark is a crease pattern, so it goes through the same validator every
 * pattern on the site does. A logo that claimed to fold and did not would be a
 * bad joke on a site whose whole argument is that a crease pattern is data.
 */
describe("the Kamibase mark", () => {
  const analysis = analyse(LOGO_CREASES);

  it("folds flat", () => {
    expect(analysis.flatFoldable).toBe(true);
  });

  it("has no structural defects", () => {
    expect(analysis.defects.filter((defect) => defect.severity === "error")).toEqual([]);
  });

  it("has both mountains and valleys", () => {
    const kinds = new Set(LOGO_CREASES.map((crease) => crease.assignment));
    expect(kinds.has("M")).toBe(true);
    expect(kinds.has("V")).toBe(true);
  });

  it("obeys Maekawa at the one interior vertex", () => {
    const interior = analysis.vertexMarks;
    expect(interior).toHaveLength(1);
    expect(interior[0]?.ok).toBe(true);

    const mountains = LOGO_CREASES.filter((crease) => crease.assignment === "M").length;
    const valleys = LOGO_CREASES.filter((crease) => crease.assignment === "V").length;
    expect(Math.abs(mountains - valleys)).toBe(2);
  });

  it("is a closed sheet of paper", () => {
    expect(analysis.faceCount).toBeGreaterThan(0);
  });
});
