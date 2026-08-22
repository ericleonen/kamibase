import type { Metadata } from "next";
import Link from "next/link";
import { PatternCard } from "@/components/PatternCard";
import { ExploreFilters } from "@/components/explore/ExploreFilters";
import {
  DEFAULT_SORT,
  filterPatterns,
  isSort,
  patterns,
  techniqueFacets,
  type SortKey,
} from "@/lib/patterns";

export const metadata: Metadata = {
  title: "Explore",
  description: "Browse every crease pattern on Kamibase.",
};

interface SearchParams {
  readonly q?: string;
  readonly technique?: string;
  readonly sort?: string;
  readonly foldable?: string;
}

/**
 * The library.
 *
 * The filters used to be a scrolling rail of technique chips, which grows with
 * the library and answers exactly one question. They are a dropdown per axis
 * and a checkbox now, and changing any of them is the whole gesture: see
 * `ExploreFilters` for why there is no Apply button.
 */
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, technique, sort, foldable } = await searchParams;
  const all = await patterns.list();
  const facets = techniqueFacets(all);
  const order: SortKey = isSort(sort) ? sort : DEFAULT_SORT;
  const onlyFoldable = foldable === "1";

  let results = filterPatterns(all, {
    ...(q ? { q } : {}),
    ...(technique ? { technique } : {}),
  });
  if (onlyFoldable) results = results.filter((pattern) => pattern.flatFoldable);

  results = [...results].sort((a, b) => {
    if (order === "creases") return b.edgeCount - a.edgeCount;
    if (order === "difficulty") return (b.difficulty ?? 0) - (a.difficulty ?? 0);
    return a.title.localeCompare(b.title);
  });

  return (
    <div className="space-y-5">
      <ExploreFilters
        {...(q ? { q } : {})}
        {...(technique ? { technique } : {})}
        sort={order}
        foldable={onlyFoldable}
        facets={facets}
      />

      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {results.length} {results.length === 1 ? "pattern" : "patterns"}
        {q && (
          <>
            {" "}
            matching <strong style={{ color: "var(--text)" }}>{q}</strong>
          </>
        )}
      </p>

      {results.length === 0 ? (
        <div
          className="rounded-2xl px-6 py-16 text-center"
          style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
        >
          <p className="font-semibold">Nothing matches that.</p>
          <Link href="/explore" className="mt-4 inline-block text-sm font-semibold underline">
            Clear the filters
          </Link>
        </div>
      ) : (
        // A grid, not a masonry: every tile is the same square, so every row
        // should hold the same number of them. See globals.css.
        <div className="pattern-grid">
          {results.map((pattern) => (
            <PatternCard key={pattern.id} pattern={pattern} />
          ))}
        </div>
      )}
    </div>
  );
}
