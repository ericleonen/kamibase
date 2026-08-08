import type { Metadata } from "next";
import Link from "next/link";
import { patterns, techniqueFacets } from "@/lib/patterns";

export const metadata: Metadata = {
  title: "Kamibase: every crease pattern, as data you can actually fold",
  description:
    "A library of origami crease patterns stored as validated geometry, not " +
    "screenshots. Fold them in 3D, print them to scale, and download them in " +
    "the format your tools already read.",
};

/**
 * The landing page.
 *
 * `/` explains what Kamibase is; `/explore` is the feed. They were the same
 * page until now, which meant the pitch only ever reached signed-out visitors
 * and competed with the masonry for the fold.
 *
 * Every image slot here is deliberately empty. There is no photography yet,
 * and a placeholder that *looks* like a missing asset is worse than one that
 * reads as a considered blank. See `Frame` below.
 */

/**
 * An empty image slot.
 *
 * Tinted surface, hairline border, no icon and no "image goes here" text: at a
 * glance it reads as part of the layout rather than as a failed load. Swapping
 * in a real `<img>` later means replacing the children, not the frame.
 */
function Frame({
  className = "",
  label,
}: {
  readonly className?: string;
  readonly label: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`overflow-hidden rounded-2xl ${className}`}
      style={{
        background: "var(--surface-sunken)",
        border: "1px solid var(--border)",
      }}
    />
  );
}

const STEPS = [
  {
    n: "01",
    title: "Bring anything",
    body: "A .fold, .cp, .opx, an SVG export, or a photo of a sketch. It comes out the other side as one clean, validated file.",
  },
  {
    n: "02",
    title: "See if it holds",
    body: "Every pattern is checked against Maekawa and Kawasaki before it lands. Flat-foldability is a property you can filter on, not a claim in a caption.",
  },
  {
    n: "03",
    title: "Fold it, then print it",
    body: "Collapse the pattern in 3D in the browser, then print it at the paper size the designer intended. The scale travels with the file.",
  },
] as const;

export default async function HomePage() {
  const all = await patterns.list();
  const techniques = techniqueFacets(all).slice(0, 7);
  const foldable = all.filter((pattern) => pattern.flatFoldable).length;
  const creases = all.reduce((sum, pattern) => sum + pattern.edgeCount, 0);

  return (
    /* The layout is 1600px wide for the masonry feed; prose needs to be
     * narrower than that to stay readable, so the landing page caps itself. */
    <div className="mx-auto max-w-6xl space-y-16 pb-8 sm:space-y-24">
      {/* Hero. Copy left, empty art right. The art is the thing you'll fill in. */}
      <section className="grid items-center gap-8 pt-4 sm:pt-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
        <div>
          <span
            className="inline-block rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase"
            style={{ background: "var(--brand-soft)", color: "var(--brand-strong)" }}
          >
            Origami, as data
          </span>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Every crease pattern, as data you can actually fold.
          </h1>
          <p
            className="mt-4 max-w-xl text-base leading-relaxed text-pretty sm:text-lg"
            style={{ color: "var(--text-muted)" }}
          >
            Most crease patterns online are screenshots. You can't zoom them,
            scale them, or check whether they close. Kamibase stores the
            geometry instead: validated, foldable in your browser, and printable
            at the size the designer meant.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <Link
              href="/explore"
              className="rounded-full px-6 py-3 text-sm font-bold transition hover:opacity-85"
              style={{ background: "var(--brand)", color: "var(--ink)" }}
            >
              Browse {all.length} patterns
            </Link>
            <Link
              href="/signup"
              className="rounded-full px-6 py-3 text-sm font-bold transition hover:opacity-70"
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border-strong)",
              }}
            >
              Create an account
            </Link>
          </div>
          <p className="mt-3 text-xs" style={{ color: "var(--text-faint)" }}>
            No account needed to browse, fold or download.
          </p>
        </div>

        {/* A staggered pair, echoing the masonry the feed uses. The offset is
         * small on purpose: enough to break the grid, not so much that the
         * column reads as misaligned with the headline beside it. */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-3 sm:space-y-4">
            <Frame className="aspect-[4/5]" label="Crease pattern preview" />
            <Frame className="aspect-square" label="Crease pattern preview" />
          </div>
          <div className="space-y-3 pt-5 sm:space-y-4 sm:pt-6">
            <Frame className="aspect-square" label="Crease pattern preview" />
            <Frame className="aspect-[4/5]" label="Crease pattern preview" />
          </div>
        </div>
      </section>

      {/* What the library actually contains right now. */}
      <section
        className="grid gap-px overflow-hidden rounded-3xl sm:grid-cols-3"
        style={{ background: "var(--border)", border: "1px solid var(--border)" }}
      >
        {[
          { value: all.length, label: "patterns, each one validated" },
          { value: foldable, label: "proven flat-foldable" },
          { value: creases.toLocaleString(), label: "creases stored as geometry" },
        ].map(({ value, label }) => (
          <div key={label} className="px-6 py-7" style={{ background: "var(--surface-raised)" }}>
            <div className="text-3xl font-black tabular-nums sm:text-4xl">{value}</div>
            <div className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              {label}
            </div>
          </div>
        ))}
      </section>

      {/* How it works. */}
      <section>
        <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
          From a file you can&apos;t use to a fold you can.
        </h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-6">
          {STEPS.map(({ n, title, body }) => (
            <div key={n}>
              <Frame className="aspect-[3/2] w-full" label={`${title} illustration`} />
              <div
                className="mt-4 text-xs font-black tracking-widest"
                style={{ color: "var(--brand-strong)" }}
              >
                {n}
              </div>
              <h3 className="mt-1.5 text-lg font-bold tracking-tight">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* The .kami pitch, with the format detail that makes it credible. */}
      <section className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
        <Frame className="aspect-[5/4] w-full" label="The .kami file format" />
        <div>
          <h2 className="text-2xl font-black tracking-tight text-balance sm:text-3xl">
            One file that keeps everything the pattern knows.
          </h2>
          <p
            className="mt-4 text-base leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            <code className="font-mono text-sm" style={{ color: "var(--text)" }}>
              .kami
            </code>{" "}
            is a strict profile of{" "}
            <a
              href="https://github.com/edemaine/fold"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-2"
              style={{ color: "var(--brand-strong)" }}
            >
              FOLD
            </a>
            , the interchange format by Demaine, Ku, Lang and Tachi. It's not a
            competing standard: anything that reads FOLD reads ours. What we add
            is the context a crease pattern usually loses, like who designed it,
            what paper it wants, how it was validated, and the licence it
            travels under.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["FOLD", ".cp", ".opx", "SVG", "PDF"].map((format) => (
              <span
                key={format}
                className="rounded-full px-3 py-1.5 font-mono text-xs font-semibold"
                style={{ background: "var(--surface-sunken)", color: "var(--text-muted)" }}
              >
                {format}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Techniques. Real facets, so this doubles as navigation. */}
      {techniques.length > 0 && (
        <section>
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Start somewhere.</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            The library leans traditional right now: bases, classic
            tessellations, and the reference grids everything else is built on.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {techniques.map(({ technique, count }) => (
              <Link
                key={technique}
                href={`/explore?technique=${encodeURIComponent(technique)}`}
                className="rounded-full px-4 py-2.5 text-sm font-semibold capitalize transition hover:opacity-70"
                style={{
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border)",
                }}
              >
                {technique.replace(/-/g, " ")}{" "}
                <span style={{ color: "var(--text-faint)" }}>{count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Close. */}
      <section
        className="rounded-3xl px-6 py-12 text-center sm:px-10 sm:py-16"
        style={{ background: "var(--brand-soft)" }}
      >
        <h2 className="mx-auto max-w-2xl text-3xl font-black tracking-tight text-balance sm:text-4xl">
          Open a pattern and fold it in the next thirty seconds.
        </h2>
        <p
          className="mx-auto mt-3 max-w-lg text-base"
          style={{ color: "var(--text-muted)" }}
        >
          Nothing is gated. An account is only for saving what you find and
          posting what you fold.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          <Link
            href="/explore"
            className="rounded-full px-6 py-3 text-sm font-bold transition hover:opacity-85"
            style={{ background: "var(--brand)", color: "var(--ink)" }}
          >
            Browse the library
          </Link>
          <Link
            href="/signup"
            className="rounded-full px-6 py-3 text-sm font-bold transition hover:opacity-70"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border-strong)",
            }}
          >
            Create an account
          </Link>
        </div>
      </section>
    </div>
  );
}
