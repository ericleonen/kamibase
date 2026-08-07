import Link from "next/link";
import type { PatternSummary } from "@/lib/patterns";

/**
 * Pinterest-shaped card: image first, chrome only on hover, everything else
 * quiet.
 *
 * The frame height varies per card so the masonry actually staggers. Crease
 * patterns are all square, and a grid of identical squares reads as a table
 * rather than a feed — so the *frame* changes aspect while the pattern inside
 * stays `object-contain`. The geometry is never distorted; only the amount of
 * mat around it changes.
 */
const FRAMES = ["aspect-square", "aspect-[4/5]", "aspect-[5/6]", "aspect-[3/4]"] as const;

function frameFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return FRAMES[hash % FRAMES.length]!;
}

export function PatternCard({ pattern }: { readonly pattern: PatternSummary }) {
  return (
    <article className="group">
      <Link href={`/p/${pattern.id}`} className="block">
        <div
          className={`relative overflow-hidden rounded-2xl ${frameFor(pattern.id)}`}
          style={{ background: "var(--surface-raised)", boxShadow: "var(--shadow-card)" }}
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
