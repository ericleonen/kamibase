import type { Metadata } from "next";
import Link from "next/link";
import { PatternCard } from "@/components/PatternCard";
import { filterPatterns, patterns, techniqueFacets } from "@/lib/patterns";

export const metadata: Metadata = {
  title: "Explore",
  description: "Browse every crease pattern on Kamibase.",
};

interface SearchParams {
  readonly q?: string;
  readonly technique?: string;
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, technique } = await searchParams;
  const all = await patterns.list();
  const facets = techniqueFacets(all);
  const results = filterPatterns(all, {
    ...(q ? { q } : {}),
    ...(technique ? { technique } : {}),
  });

  const chipHref = (value?: string): string => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (value) params.set("technique", value);
    const query = params.toString();
    return query ? `/explore?${query}` : "/explore";
  };

  return (
    <div className="space-y-5">
      <nav
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Filter by technique"
      >
        <Link
          href={chipHref()}
          aria-current={technique ? undefined : "page"}
          className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-70"
          style={
            technique
              ? { background: "var(--surface-sunken)" }
              : { background: "var(--text)", color: "var(--surface)" }
          }
        >
          All
        </Link>
        {facets.map(({ technique: name, count }) => {
          const active = technique === name;
          return (
            <Link
              key={name}
              href={chipHref(active ? undefined : name)}
              aria-current={active ? "page" : undefined}
              className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold capitalize transition hover:opacity-70"
              style={
                active
                  ? { background: "var(--text)", color: "var(--surface)" }
                  : { background: "var(--surface-sunken)" }
              }
            >
              {name.replace(/-/g, " ")}{" "}
              <span style={{ color: active ? "inherit" : "var(--text-faint)" }}>{count}</span>
            </Link>
          );
        })}
      </nav>

      {(q || technique) && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {results.length} {results.length === 1 ? "pattern" : "patterns"}
          {q && (
            <>
              {" "}
              matching <strong style={{ color: "var(--text)" }}>{q}</strong>
            </>
          )}
          {technique && (
            <>
              {" "}
              in <strong style={{ color: "var(--text)" }}>{technique.replace(/-/g, " ")}</strong>
            </>
          )}
        </p>
      )}

      {results.length === 0 ? (
        <div
          className="rounded-2xl px-6 py-16 text-center"
          style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
        >
          <p className="font-semibold">Nothing matches that yet.</p>
          <p className="mx-auto mt-1 max-w-md text-sm" style={{ color: "var(--text-muted)" }}>
            The library is 13 seeded patterns so far: traditional bases and
            published tessellations. Search looks at titles, designers, tags and
            techniques.
          </p>
          <Link href="/explore" className="mt-4 inline-block text-sm font-semibold underline">
            Clear the search
          </Link>
        </div>
      ) : (
        <div className="masonry">
          {results.map((pattern) => (
            <PatternCard key={pattern.id} pattern={pattern} />
          ))}
        </div>
      )}
    </div>
  );
}
