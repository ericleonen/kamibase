import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { KAMIBASE_DISPLAY_PALETTE } from "@kamibase/core";
import {
  LOGO_GLYPH_STROKE,
  LOGO_GRID,
  LOGO_LETTER,
  LOGO_STROKE,
  logoFaviconSvg,
  logoGridLines,
  logoInkBox,
  logoPaths,
} from "@/lib/logo";

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

/**
 * The favicon is generated from the module above, and checked in because Next
 * serves `app/icon.svg` as a file. These are the two ways that arrangement can
 * rot: somebody edits the SVG by hand, or somebody moves the letter and forgets
 * to run `pnpm --filter @kamibase/web icon`.
 */
describe("the favicon", () => {
  const committed = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "src", "app", "icon.svg"),
    "utf8",
  );

  it("matches what lib/logo.ts generates", () => {
    expect(committed).toBe(logoFaviconSvg());
  });

  it("draws the letter at the glyph's weight, not the tile's", () => {
    // The whole point of the change: a tab icon is sixteen pixels, and the
    // tile's crease-weight stroke did not survive them.
    expect(LOGO_GLYPH_STROKE).toBeGreaterThan(LOGO_STROKE * 1.5);
    const widths = [...committed.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]));
    const letter = (LOGO_GLYPH_STROKE * 100) / LOGO_GRID;
    expect(widths).toContain(letter);
  });

  it("uses the display palette's mountain and valley", () => {
    expect(committed).toContain(KAMIBASE_DISPLAY_PALETTE.M);
    expect(committed).toContain(KAMIBASE_DISPLAY_PALETTE.V);
  });

  it("keeps the whole letter inside the tile", () => {
    // The ink box includes the round caps, and it is what the transform fits,
    // so a letter that overhangs the card is an arithmetic slip rather than a
    // matter of taste.
    const ink = logoInkBox(100, LOGO_GLYPH_STROKE);
    const [, dx, dy, scale] = /translate\(([\d.-]+) ([\d.-]+)\) scale\(([\d.]+)\)/
      .exec(committed)!
      .map(Number);
    for (const [x, y] of [
      [ink.left, ink.top],
      [ink.right, ink.bottom],
    ] as const) {
      expect((dx as number) + x * (scale as number)).toBeGreaterThanOrEqual(0);
      expect((dy as number) + y * (scale as number)).toBeGreaterThanOrEqual(0);
      expect((dx as number) + x * (scale as number)).toBeLessThanOrEqual(32);
      expect((dy as number) + y * (scale as number)).toBeLessThanOrEqual(32);
    }
  });
});
