import Link from "next/link";
import { PatternCard } from "@/components/PatternCard";
import { patterns } from "@/lib/patterns";

/** Bases first, then tessellations, then studies and reference grids. */
function rank(pattern: { readonly subject: readonly string[] }): number {
  if (pattern.subject.includes("base")) return 0;
  if (pattern.subject.includes("tessellation")) return 1;
  return 2;
}

export default async function LandingPage() {
  const all = await patterns.list();
  // Lead with the models rather than the studies — an accordion pleat is a
  // fine thing to have in the library and a poor thing to open the site with.
  const featured = [...all]
    .sort((a, b) => rank(a) - rank(b) || b.edgeCount - a.edgeCount)
    .slice(0, 8);

  return (
    <div className="space-y-12">
      <section className="space-y-4 pt-6">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          A crease pattern is structured data, not a picture.
        </h1>
        <p className="max-w-2xl text-lg" style={{ color: "var(--text-muted)" }}>
          Every pattern here is a validated geometric graph. Zoom it, toggle
          mountain and valley, print it to scale, fold it in 3D in the browser,
          and download it in whatever format your editor speaks.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/explore"
            className="rounded-md px-4 py-2 text-sm font-medium"
            style={{ background: "var(--text)", color: "var(--surface)" }}
          >
            Browse {all.length} patterns
          </Link>
          <a
            href="https://github.com/ericleonen/kamibase/blob/main/DESIGN.md"
            className="rounded-md border px-4 py-2 text-sm font-medium"
            style={{ borderColor: "var(--border)" }}
            target="_blank"
            rel="noreferrer noopener"
          >
            Read the design
          </a>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-medium">Seeded patterns</h2>
          <Link href="/explore" className="text-sm underline" style={{ color: "var(--text-muted)" }}>
            See all
          </Link>
        </div>
        <p className="max-w-2xl text-sm" style={{ color: "var(--text-muted)" }}>
          Traditional bases and published mathematical patterns, generated from
          their geometry and validated on the way in — no scanned JPEGs, no
          guessed assignments.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {featured.map((pattern) => (
            <PatternCard key={pattern.id} pattern={pattern} />
          ))}
        </div>
      </section>
    </div>
  );
}
