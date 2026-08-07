import Link from "next/link";
import { PatternCard } from "@/components/PatternCard";
import { patterns, techniqueFacets } from "@/lib/patterns";
import { getCurrentUser } from "@/lib/supabase/server";

/** Bases first, then tessellations, then studies and reference grids. */
function rank(pattern: { readonly subject: readonly string[] }): number {
  if (pattern.subject.includes("base")) return 0;
  if (pattern.subject.includes("tessellation")) return 1;
  return 2;
}

export default async function FeedPage() {
  const [all, user] = await Promise.all([patterns.list(), getCurrentUser()]);
  const facets = techniqueFacets(all).slice(0, 8);
  const feed = [...all].sort((a, b) => rank(a) - rank(b) || b.edgeCount - a.edgeCount);

  return (
    <div className="space-y-6">
      {!user && (
        <section
          className="overflow-hidden rounded-3xl px-6 py-10 sm:px-10 sm:py-14"
          style={{ background: "var(--brand-soft)" }}
        >
          <h1 className="max-w-2xl text-3xl font-black tracking-tight sm:text-5xl">
            Every crease pattern, as data you can actually fold.
          </h1>
          <p className="mt-3 max-w-xl text-base" style={{ color: "var(--text-muted)" }}>
            Not screenshots. Validated geometry you can zoom, toggle mountain
            and valley, print to scale, and collapse in 3D in your browser.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/signup"
              className="rounded-full px-5 py-2.5 text-sm font-bold transition hover:opacity-85"
              style={{ background: "var(--brand)", color: "var(--ink)" }}
            >
              Sign up
            </Link>
            <Link
              href="/explore"
              className="rounded-full px-5 py-2.5 text-sm font-bold transition hover:opacity-70"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
            >
              Browse {all.length} patterns
            </Link>
          </div>
        </section>
      )}

      {/* Pinterest's chip rail: one tap to narrow the feed. */}
      <nav
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Browse by technique"
      >
        <Link
          href="/explore"
          className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-70"
          style={{ background: "var(--text)", color: "var(--surface)" }}
        >
          All
        </Link>
        {facets.map(({ technique, count }) => (
          <Link
            key={technique}
            href={`/explore?technique=${encodeURIComponent(technique)}`}
            className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold capitalize transition hover:opacity-70"
            style={{ background: "var(--surface-sunken)" }}
          >
            {technique.replace(/-/g, " ")}{" "}
            <span style={{ color: "var(--text-faint)" }}>{count}</span>
          </Link>
        ))}
      </nav>

      <div className="masonry">
        {feed.map((pattern) => (
          <PatternCard key={pattern.id} pattern={pattern} />
        ))}
      </div>
    </div>
  );
}
