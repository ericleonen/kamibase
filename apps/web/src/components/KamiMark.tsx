import { ORIGAMI_SIMULATOR_PALETTE } from "@kamibase/core";
import { LOGO_STROKES } from "@/lib/logo";

/**
 * The mark, drawn.
 *
 * Red mountains, blue valleys, black paper edge: the Origami Simulator
 * convention (DESIGN.md §3.3), the same three colours every pattern on the site
 * is drawn in, and the reason this is not restyled to match the brand in the
 * header. A mark in amber and ink would be a logo; this is a crease pattern,
 * and the whole claim of the site is that those are different things. See
 * `lib/logo.ts` for why these particular six creases.
 *
 * The paper stays white in dark mode, exactly as it does in the viewer, because
 * the colours only mean what they mean on white.
 */
export function KamiMark({ className = "size-8" }: { readonly className?: string }) {
  return (
    <svg
      viewBox="-1.6 -1.6 27.2 27.2"
      className={className}
      fill="none"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="0" y="0" width="24" height="24" rx="2.6" fill="var(--paper)" />

      {LOGO_STROKES.filter((stroke) => stroke.kind !== "boundary").map((stroke) => (
        <path
          key={stroke.d}
          d={stroke.d}
          stroke={
            stroke.kind === "mountain"
              ? ORIGAMI_SIMULATOR_PALETTE.M
              : ORIGAMI_SIMULATOR_PALETTE.V
          }
          strokeWidth="2.3"
        />
      ))}

      {/* The paper edge last, so the creases end cleanly against it rather than
          poking out past the corners. */}
      <rect
        x="0"
        y="0"
        width="24"
        height="24"
        rx="2.6"
        stroke={ORIGAMI_SIMULATOR_PALETTE.B}
        strokeWidth="2.3"
      />
    </svg>
  );
}
