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
 * `/` is the pitch, `/explore` is the feed. The art is real: four patterns from
 * the library, rendered by the same route that draws every thumbnail. It used
 * to be four empty grey frames waiting on photography that was never going to
 * arrive, and a crease pattern is a better advertisement for a crease pattern
 * library than a placeholder is.
 */

const STEPS = [
  { n: "01", title: "Bring anything", body: "A file, or a photo of the paper." },
  { n: "02", title: "See if it holds", body: "Checked against Maekawa and Kawasaki." },
  { n: "03", title: "Fold it, print it", body: "In 3D, then at the designer's size." },
] as const;

export default async function HomePage() {
  const all = await patterns.list();
  const techniques = techniqueFacets(all).slice(0, 7);
  const foldable = all.filter((pattern) => pattern.flatFoldable).length;
  const creases = all.reduce((sum, pattern) => sum + pattern.edgeCount, 0);
  // One per technique, so the four are not four accordions. Taking the first
  // four in file order gave three of the same shape.
  const seen = new Set<string>();
  const showcase = all
    .filter((pattern) => {
      const key = pattern.techniques[0] ?? pattern.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);

  return (
    /* Prose needs to be narrower than the 1600px the masonry wants. */
    <div className="mx-auto max-w-6xl space-y-16 pb-8 sm:space-y-24">
      <section className="grid items-center gap-8 pt-4 sm:pt-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
        <div>
          <span
            className="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
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
            Not screenshots. Validated geometry you can zoom, fold in the
            browser, and print at the size the designer meant.
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
              href="/upload"
              className="rounded-full px-6 py-3 text-sm font-bold transition hover:opacity-70"
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border-strong)",
              }}
            >
              Add your own
            </Link>
          </div>
          <p className="mt-3 text-xs" style={{ color: "var(--text-faint)" }}>
            No account needed to browse, fold or download.
          </p>
        </div>

        {/* Staggered, echoing the masonry the feed uses. */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-3 sm:space-y-4">
            {showcase.slice(0, 2).map((pattern) => (
              <Showcase key={pattern.id} id={pattern.id} title={pattern.title} />
            ))}
          </div>
          <div className="space-y-3 pt-5 sm:space-y-4 sm:pt-6">
            {showcase.slice(2, 4).map((pattern) => (
              <Showcase key={pattern.id} id={pattern.id} title={pattern.title} />
            ))}
          </div>
        </div>
      </section>

      <section
        className="grid gap-px overflow-hidden rounded-3xl sm:grid-cols-3"
        style={{ background: "var(--border)", border: "1px solid var(--border)" }}
      >
        {[
          { value: all.length, label: "patterns, each validated" },
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

      <section>
        <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
          From a file you can&apos;t use to a fold you can.
        </h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {STEPS.map(({ n, title, body }) => (
            <div key={n}>
              <div className="text-xs font-black tracking-widest" style={{ color: "var(--brand-strong)" }}>
                {n}
              </div>
              <h3 className="mt-1.5 text-lg font-bold tracking-tight">{title}</h3>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
        {showcase[0] && <Showcase id={showcase[0].id} title={showcase[0].title} large />}
        <div>
          <h2 className="text-2xl font-black tracking-tight text-balance sm:text-3xl">
            One file that keeps everything the pattern knows.
          </h2>
          <p className="mt-4 text-base leading-relaxed" style={{ color: "var(--text-muted)" }}>
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
            , so anything that reads FOLD reads ours. It adds what a crease
            pattern usually loses: the designer, the paper, the licence.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["FOLD", ".cp", ".opx", "SVG", "photo"].map((format) => (
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

      {techniques.length > 0 && (
        <section>
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Start somewhere.</h2>
          <div className="mt-5 flex flex-wrap gap-2">
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

      <section
        className="rounded-3xl px-6 py-12 text-center sm:px-10 sm:py-16"
        style={{ background: "var(--brand-soft)" }}
      >
        <h2 className="mx-auto max-w-2xl text-3xl font-black tracking-tight text-balance sm:text-4xl">
          Open a pattern and fold it in the next thirty seconds.
        </h2>
        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          <Link
            href="/explore"
            className="rounded-full px-6 py-3 text-sm font-bold transition hover:opacity-85"
            style={{ background: "var(--brand)", color: "var(--ink)" }}
          >
            Browse the library
          </Link>
          <Link
            href="/upload"
            className="rounded-full px-6 py-3 text-sm font-bold transition hover:opacity-70"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border-strong)",
            }}
          >
            Add a pattern
          </Link>
        </div>
      </section>
    </div>
  );
}

/** A real pattern from the library, linked. */
function Showcase({
  id,
  title,
  large = false,
}: {
  readonly id: string;
  readonly title: string;
  readonly large?: boolean;
}) {
  return (
    <Link
      href={`/p/${id}`}
      className={`block overflow-hidden rounded-2xl transition hover:opacity-85 ${
        large ? "aspect-[5/4]" : "aspect-square"
      }`}
      style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- our own renderer */}
      <img
        src={`/p/${id}/thumbnail`}
        alt={title}
        className="size-full object-contain p-4"
        loading="lazy"
      />
    </Link>
  );
}
