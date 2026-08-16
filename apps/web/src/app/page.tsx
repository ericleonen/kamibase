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
 * The home page: one screen, no scrolling.
 *
 * A headline, four patterns, two buttons. It was six sections deep with a
 * roadmap's worth of copy, all of which said what the library is rather than
 * showing it, and none of which anybody scrolled to read.
 */

/** How many patterns the front page shows. Four fits one row at every width. */
const FEATURED = 4;

export default async function HomePage() {
  const all = await patterns.list();
  const featured = pickDaily(all, FEATURED);

  return (
    /*
     * Exactly the space left after the header, the main padding and the
     * footer. Not `min-h`: the thumbnails are the flexible part, and giving
     * this a definite height is what lets them shrink into a short window
     * instead of pushing the page past the fold. `svh` rather than `vh` so a
     * phone's collapsing address bar does not count twice.
     */
    <div className="flex h-[calc(100svh-13rem)] flex-col justify-center gap-6">
      <header className="mx-auto max-w-3xl shrink-0 text-center">
        <h1 className="text-3xl font-black tracking-tight text-balance sm:text-4xl lg:text-5xl">
          A centralized database of origami crease patterns
        </h1>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <Link
            href="/explore"
            className="rounded-full px-6 py-3 text-sm font-bold transition hover:opacity-85"
            style={{ background: "var(--brand)", color: "var(--ink)" }}
          >
            Browse {all.length} patterns
          </Link>
          <Link
            href="/edit"
            className="rounded-full px-6 py-3 text-sm font-bold transition hover:opacity-70"
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
        /* One row at every width. Four small thumbnails beat two big ones and
         * a scrollbar. */
        <section className="flex min-h-0 flex-1 flex-col justify-center">
          <h2
            className="mb-2 shrink-0 text-center text-xs font-bold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Featured today
          </h2>
          {/*
           * Grows into a tall window and shrinks into a short one, but only up
           * to roughly the point where a tile is square. Past that the extra
           * height is padding around a drawing, which reads as a bug, so the
           * cap tracks how wide a column actually gets at each breakpoint.
           */}
          <ul className="mx-auto grid max-h-32 min-h-0 w-full max-w-4xl flex-1 grid-cols-4 gap-3 sm:max-h-52 sm:gap-4 lg:max-h-64">
            {featured.map((pattern) => (
              <li key={pattern.id} className="min-h-0">
                <Link href={`/p/${pattern.id}`} className="group flex h-full flex-col">
                  <div
                    className="min-h-0 flex-1 overflow-hidden rounded-2xl p-3 transition group-hover:opacity-85"
                    style={{
                      background: "var(--surface-raised)",
                      boxShadow: "var(--shadow-card)",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- our own renderer */}
                    <img
                      src={`/p/${pattern.id}/thumbnail`}
                      alt={pattern.title}
                      className="size-full object-contain"
                    />
                  </div>
                  {/* Wrapped rather than truncated: at four columns on a phone
                      a clipped title is unreadable, and two short lines are
                      not. */}
                  <p className="mt-2 line-clamp-2 shrink-0 text-xs font-bold leading-tight sm:text-sm">
                    {pattern.title}
                  </p>
                  <p
                    className="shrink-0 truncate text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
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
