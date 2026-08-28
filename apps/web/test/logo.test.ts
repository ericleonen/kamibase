import { describe, expect, it } from "vitest";
import { LOGO_GRID, LOGO_LETTER, logoGridLines, logoPaths } from "@/lib/logo";

/**
 * The mark is a drawing, not a foldable pattern — `lib/logo.ts` says why at
 * length. What is worth pinning down is that it is a drawing *on the grid*,
 * because the grid is the whole reason it looks like it belongs to this site,
 * and a stray half-unit would be invisible in review and obvious on screen.
 */
describe("the Kamibase mark", () => {
  const { stemX, junctionY, armX, armY } = LOGO_LETTER;

  it("puts the letter on the lattice, to the half cell", () => {
    for (const value of [stemX, junctionY, armX, armY, LOGO_LETTER.stemTop, LOGO_LETTER.stemBottom]) {
      expect(value * 2).toBe(Math.round(value * 2));
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(LOGO_GRID);
    }
  });

  it("keeps the arm and the leg mirrored about the junction", () => {
    const legY = 2 * junctionY - armY;
    expect(armY - junctionY).toBe(junctionY - legY);
    expect(legY).toBeGreaterThan(0);
  });

  it("keeps the stem inside the paper", () => {
    expect(LOGO_LETTER.stemBottom).toBeGreaterThan(0);
    expect(LOGO_LETTER.stemTop).toBeLessThan(LOGO_GRID);
    // Tall enough to be the letter's cap height rather than a tick.
    expect(LOGO_LETTER.stemTop - LOGO_LETTER.stemBottom).toBeGreaterThan(LOGO_GRID * 0.75);
  });

  it("draws the wedge as one polyline through the junction", () => {
    // Two segments and one join: drawn as separate strokes the round caps
    // would stack up at the meeting point and thicken it.
    const { wedge } = logoPaths(100);
    expect(wedge.match(/L/g)).toHaveLength(2);
  });

  it("rules the paper on both axes", () => {
    expect(logoGridLines(100)).toHaveLength((LOGO_GRID - 1) * 2);
  });
});
