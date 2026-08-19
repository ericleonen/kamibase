import type { Metadata } from "next";
import Link from "next/link";
import { patterns } from "@/lib/patterns";
import type { PatternSummary } from "@/lib/patterns";

export const metadata: Metadata = {
  title: "Kamibase: a centralized database of origami crease patterns",
  description:
    "Browse, fold and download origami crease patterns stored as validated " +
    "geometry rather than screenshots.",
};

/**
 * The home page: a headline, a handful of patterns, two buttons.
 *
 * It was six sections deep with a roadmap's worth of copy, all of which said
 * what the library is rather than showing it, and none of which anybody
 * scrolled to read. The patterns do that job instead — but only if they are
 * big enough to read as drawings.
 *
 * That is the constraint the previous version got backwards. It pinned the
 * whole page to one non-scrolling screen and let the thumbnails absorb every
 * bit of the squeeze, which on a phone left four columns of roughly 70px each:
 * four smudges. A crease pattern that small conveys nothing, so the no-scroll
 * rule is gone. The grid reflows to two columns on a phone and four from
 * `sm` up, and the tiles are sized in real terms rather than as whatever is
 * left over.
 */

/** How many patterns the front page shows. Four: one row wide, two rows narrow. */
const FEATURED = 4;

export default async function HomePage() {
  const all = await patterns.list();
  const featured = pickDaily(all, FEATURED);

  return (
    /*
     * `min-h` on the viewport minus the chrome, so on a tall desktop window the
     * content still centres and fills the screen, while on a phone it is free
     * to run past the fold rather than crushing the patterns to fit. `svh`
     * rather than `vh` so a collapsing address bar does not count twice.
     */
    <div className="flex min-h-[calc(100svh-13rem)] flex-col justify-center gap-8 py-4 sm:gap-10 sm:py-6">
      <header className="mx-auto max-w-3xl shrink-0 text-center">
        <h1 className="text-[2rem] font-black leading-[1.1] tracking-tight text-balance sm:text-5xl lg:text-6xl">
          A centralized database of origami crease patterns
        </h1>
        {/*
         * The subhead the old page dropped along with the six sections. One
         * line is not the wall of copy that got cut; it is what tells a first
         * visitor these are foldable files rather than pictures of paper.
         */}
        <p
          className="mx-auto mt-4 max-w-xl text-balance text-base leading-relaxed sm:mt-5 sm:text-lg"
          style={{ color: "var(--text-muted)" }}
        >
          Real geometry, not screenshots. Browse, fold in 3D, and download every
          pattern as FOLD, SVG or OPX.
        </p>
        {/*
         * Full-width stacked buttons on a phone, side by side from `sm` up. A
         * pair of pill buttons wrapping onto two ragged lines is the single
         * most common way a hero looks broken on a narrow screen.
         */}
        <div className="mt-7 flex flex-col justify-center gap-2.5 sm:mt-8 sm:flex-row">
          <Link
            href="/explore"
            className="rounded-full px-7 py-3.5 text-base font-bold transition hover:opacity-85 sm:text-sm"
            style={{ background: "var(--brand)", color: "var(--ink)" }}
          >
            Browse {all.length} patterns
          </Link>
          <Link
            href="/edit"
            className="rounded-full px-7 py-3.5 text-base font-bold transition hover:opacity-70 sm:text-sm"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border-strong)",
            }}
          >
            Draw one
          </Link>
        </div>
      </header>

      {featured.length > 0 && (
        <section className="shrink-0">
          <h2
            className="mb-3 text-center text-xs font-bold uppercase tracking-widest sm:mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Featured today
          </h2>
          {/*
           * Two columns on a phone, four from `sm` up. Two is the whole fix:
           * at four, a tile on a 390px screen is about 70px of drawing, and a
           * crease pattern at 70px is a grey smudge. At two it is nearer 160px,
           * which is enough to actually see the creases — which is the only
           * reason to put patterns on the front page at all.
           */}
          <ul className="mx-auto grid w-full max-w-sm grid-cols-2 gap-4 sm:max-w-4xl sm:grid-cols-4 sm:gap-5">
            {featured.map((pattern) => (
              <li key={pattern.id}>
                <Link href={`/p/${pattern.id}`} className="group block">
                  {/*
                   * `aspect-square`, matching the explore grid. The tile is
                   * sized by the column rather than by whatever vertical space
                   * happens to be left, so it never collapses on a short
                   * window.
                   */}
                  <div
                    className="aspect-square overflow-hidden rounded-2xl p-3 transition duration-300 group-hover:-translate-y-0.5 sm:p-4"
                    style={{
                      background: "var(--surface-raised)",
                      boxShadow: "var(--shadow-card)",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- our own renderer */}
                    <img
                      src={`/p/${pattern.id}/thumbnail`}
                      alt={pattern.title}
                      className="size-full object-contain transition duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  {/* Wrapped rather than truncated: a clipped title is
                      unreadable, and two short lines are not. */}
                  <p className="mt-2.5 line-clamp-2 text-sm font-bold leading-tight">
                    {pattern.title}
                  </p>
                  <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                    {pattern.designer}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * A different handful every day, the same handful all day.
 *
 * Seeded on the UTC date rather than `Math.random`, for two reasons. It has to
 * agree between the server render and anything that renders again later, and a
 * front page that reshuffles on every reload is a front page nobody can point
 * a friend at.
 */
function pickDaily(all: readonly PatternSummary[], count: number): PatternSummary[] {
  if (all.length <= count) return [...all];

  const today = new Date().toISOString().slice(0, 10);
  const random = seeded(hash(today));

  // Fisher-Yates over a copy, then take the front of it.
  const shuffled = [...all];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled.slice(0, count);
}

function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

function seeded(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}
