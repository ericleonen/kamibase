import { KAMIBASE_DISPLAY_PALETTE } from "@kamibase/core";
import {
  LOGO_GRID,
  LOGO_LETTER,
  LOGO_STROKE,
  logoGridLines,
  logoPaths,
} from "@/lib/logo";

const BOX = 100;
const UNIT = BOX / LOGO_GRID;
const STROKE = LOGO_STROKE * UNIT;

/*
 * The glyph is drawn heavier than the mark.
 *
 * In the tile the letter is one thing on a sheet of paper and reads at a weight
 * a crease would have. Set inside a word, it has to match the type around it,
 * and the wordmark is 900: a black sans carries stems at roughly a fifth of its
 * cap height, which over the letter's seven grid units is about 1.5.
 */
const LOGO_GLYPH_STROKE = 1.5;

/**
 * The mark: a K on a sheet of gridded paper.
 *
 * Mountain red and valley blue, in the softened display palette, on paper that
 * stays white in both themes — the same three decisions every crease pattern on
 * the site is drawn with. See `lib/logo.ts` for what the letter is and, more
 * to the point, what it is not.
 */
export function KamiMark({ className = "size-8" }: { readonly className?: string }) {
  const paths = logoPaths(BOX);
  const inset = STROKE / 2;

  return (
    <svg
      viewBox={`${-inset} ${-inset} ${BOX + STROKE} ${BOX + STROKE}`}
      className={className}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="0" y="0" width={BOX} height={BOX} rx={BOX * 0.18} fill="var(--paper)" />

      {/* The editor's own reference lattice, in the editor's own grey. */}
      <g stroke="var(--paper-line)" strokeWidth={STROKE * 0.2}>
        {logoGridLines(BOX).map((d) => (
          <path key={d} d={d} />
        ))}
      </g>

      <path d={paths.stem} stroke={KAMIBASE_DISPLAY_PALETTE.M} strokeWidth={STROKE} />
      <path d={paths.wedge} stroke={KAMIBASE_DISPLAY_PALETTE.V} strokeWidth={STROKE} />

      {/* The paper's edge last, so the grid ends cleanly against it. */}
      <rect
        x="0"
        y="0"
        width={BOX}
        height={BOX}
        rx={BOX * 0.18}
        stroke={KAMIBASE_DISPLAY_PALETTE.B}
        strokeWidth={STROKE}
      />
    </svg>
  );
}

/**
 * The same letter with the paper taken away, to stand in for the K of
 * "Kamibase".
 *
 * Sized and positioned as a glyph rather than as a picture: the viewBox is the
 * letter's own ink box, the height is set in `em` so it tracks the font, and it
 * sits on the text baseline. That is what makes it read as the first letter of
 * a word instead of a badge parked next to one.
 *
 * The grid and the paper edge are dropped on purpose. At the size a capital
 * letter is set, ruled lines behind it are noise, and a box around it would be
 * a box around one letter of a word.
 */
export function KamiK({ className = "" }: { readonly className?: string }) {
  const paths = logoPaths(BOX);
  const { stemX, stemBottom, stemTop, armX } = LOGO_LETTER;
  const stroke = LOGO_GLYPH_STROKE * UNIT;
  const half = stroke / 2;

  /*
   * The box is the *stem*, not the ink.
   *
   * `vertical-align: baseline` puts an inline SVG's bottom edge on the
   * baseline, so a box drawn round the ink would rest the stroke's round cap
   * there and float the letter half a stroke high. Sizing to the stem instead
   * puts the stem's end on the baseline, where a letter's stem belongs, and
   * `overflow: visible` lets the caps hang over the edge the way ink does.
   * Height in `em` so the letter tracks the word it is the first letter of.
   */
  const top = (LOGO_GRID - stemTop) * UNIT;
  const bottom = (LOGO_GRID - stemBottom) * UNIT;
  const left = stemX * UNIT - half;
  const right = armX * UNIT + half;

  return (
    <svg
      viewBox={`${left} ${top} ${right - left} ${bottom - top}`}
      className={className}
      style={{
        height: "0.72em",
        width: "auto",
        overflow: "visible",
        verticalAlign: "baseline",
      }}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d={paths.stem} stroke={KAMIBASE_DISPLAY_PALETTE.M} strokeWidth={stroke} />
      <path d={paths.wedge} stroke={KAMIBASE_DISPLAY_PALETTE.V} strokeWidth={stroke} />
    </svg>
  );
}
