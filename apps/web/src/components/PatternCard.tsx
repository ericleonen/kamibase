import Link from "next/link";
import type { PatternSummary } from "@/lib/patterns";

/**
 * Pinterest-shaped card: image first, chrome only on hover, everything else
 * quiet.
 *
 * Every frame is the same square. Crease patterns are square, so a frame that
 * changed aspect per card was mat, not content: the same drawing sat in a
 * randomly taller or shorter box, which read as inconsistent rather than
 * deliberate. One size means one size for the pattern too, so cards are
 * comparable at a glance, and `.pattern-grid` can lay them in real rows.
 */
export function PatternCard({ pattern }: { readonly pattern: PatternSummary }) {
  return (
    <article className="group">
      <Link href={`/p/${pattern.id}`} className="block">
        <div
          className="relative aspect-square overflow-hidden rounded-2xl"
          style={{ background: "var(--paper)", boxShadow: "var(--shadow-card)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG from our own renderer */}
          <img
            src={`/p/${pattern.id}/thumbnail`}
            alt={`Crease pattern for ${pattern.title}`}
            className="size-full object-contain p-4 transition duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />

          {/* Hover chrome, Pinterest-style: an action on the image itself. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 opacity-0 transition group-hover:opacity-100">
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, rgb(27 26 23 / 0.28), rgb(27 26 23 / 0.06))" }}
            />
            <div className="relative flex justify-end">
              <span
                className="rounded-full px-3 py-1.5 text-xs font-bold"
                style={{ background: "var(--brand)", color: "var(--ink)" }}
              >
                Fold in 3D
              </span>
            </div>
            <div className="relative flex flex-wrap gap-1">
              {pattern.flatFoldable && (
                <span
                  className="rounded-full px-2 py-1 text-[11px] font-semibold"
                  style={{ background: "rgb(255 255 255 / 0.92)", color: "#1b1a17" }}
                >
                  Flat-foldable
                </span>
              )}
              <span
                className="rounded-full px-2 py-1 text-[11px] font-semibold tabular-nums"
                style={{ background: "rgb(255 255 255 / 0.92)", color: "#1b1a17" }}
              >
                {pattern.edgeCount} creases
              </span>
            </div>
          </div>
        </div>

        <div className="px-1 pt-2">
          <h3 className="truncate text-sm font-semibold">{pattern.title}</h3>
          <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
            {pattern.designer}
          </p>
        </div>
      </Link>
    </article>
  );
}
