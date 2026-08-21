"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Spinner } from "@/components/Loading";
// Straight from the leaf modules, not the `@/lib/patterns` barrel: the barrel
// re-exports the filesystem-backed store, and pulling `node:fs/promises` into a
// client bundle fails the build.
import { DEFAULT_SORT, SORTS } from "@/lib/patterns/sort";
import type { TechniqueFacet } from "@/lib/patterns/search";

export interface ExploreFiltersProps {
  /** Carried through untouched: the search box owns it, not this bar. */
  readonly q?: string;
  readonly technique?: string;
  readonly sort: string;
  readonly foldable: boolean;
  readonly facets: readonly TechniqueFacet[];
}

interface Filters {
  readonly technique: string;
  readonly sort: string;
  readonly foldable: boolean;
}

/**
 * The library's filters.
 *
 * There is no Apply button. A filter bar with one is a form, and a form asks
 * you to describe the whole query before it will show you any of it; three
 * dropdowns and a checkbox over a grid of results is not a query, it is a set
 * of things to try. So every change navigates, in a transition, which leaves
 * the results you are looking at on screen while the next ones are fetched
 * rather than blanking the page between them.
 *
 * The state is mirrored locally rather than read straight off the URL, so the
 * control shows your answer the instant you give it instead of a third of a
 * second later when the server agrees.
 *
 * It is still a GET form pointed at `/explore`, and `noscript` puts the button
 * back, so the whole surface works with JavaScript off. That is the same bargain
 * the header's search box makes.
 */
export function ExploreFilters({ q, technique, sort, foldable, facets }: ExploreFiltersProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filters, setFilters] = useState<Filters>({
    technique: technique ?? "",
    sort,
    foldable,
  });

  // The URL wins whenever it changes under us: back, forward, or the Clear
  // link. Without this the controls keep claiming the filters they last set.
  useEffect(() => {
    setFilters({ technique: technique ?? "", sort, foldable });
  }, [technique, sort, foldable]);

  function update(patch: Partial<Filters>): void {
    const next = { ...filters, ...patch };
    setFilters(next);
    startTransition(() => router.push(href(q, next)));
  }

  const filtered = Boolean(q || filters.technique || filters.foldable);

  return (
    <form
      action="/explore"
      className="flex flex-wrap items-end gap-3 rounded-2xl p-3"
      style={{ background: "var(--surface-sunken)" }}
    >
      {q && <input type="hidden" name="q" value={q} />}

      <Field label="Technique">
        <select
          name="technique"
          value={filters.technique}
          onChange={(event) => update({ technique: event.target.value })}
          className={selectClass}
          style={controlStyle}
        >
          <option value="">All</option>
          {facets.map(({ technique: name, count }) => (
            <option key={name} value={name}>
              {name.replace(/-/g, " ")} ({count})
            </option>
          ))}
        </select>
      </Field>

      <Field label="Sort by">
        <select
          name="sort"
          value={filters.sort}
          onChange={(event) => update({ sort: event.target.value })}
          className={selectClass}
          style={controlStyle}
        >
          {Object.entries(SORTS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <label className="flex min-h-10 items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="foldable"
          value="1"
          checked={filters.foldable}
          onChange={(event) => update({ foldable: event.target.checked })}
        />
        Flat-foldable only
      </label>

      {/* Without JavaScript nothing above navigates, so the button comes back. */}
      <noscript>
        <button
          type="submit"
          className="min-h-10 rounded-xl px-4 text-sm font-bold"
          style={{ background: "var(--brand)", color: "var(--ink)" }}
        >
          Apply
        </button>
      </noscript>

      {filtered && (
        <Link
          href="/explore"
          className="flex min-h-10 items-center text-sm font-semibold underline"
          style={{ color: "var(--text-muted)" }}
        >
          Clear
        </Link>
      )}

      {/* The one acknowledgement that a filter did something, for the moment
          between the click and the new grid. */}
      <span className="flex min-h-10 items-center" aria-live="polite">
        {pending && <Spinner size="sm" label="Filtering patterns" />}
      </span>
    </form>
  );
}

/** Only what is set, so an untouched library stays at a bare `/explore`. */
function href(q: string | undefined, filters: Filters): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (filters.technique) params.set("technique", filters.technique);
  if (filters.sort !== DEFAULT_SORT) params.set("sort", filters.sort);
  if (filters.foldable) params.set("foldable", "1");
  const query = params.toString();
  return query ? `/explore?${query}` : "/explore";
}

const selectClass = "min-h-10 rounded-xl px-3 text-sm font-medium capitalize";

const controlStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
} as const;

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span
        className="block text-xs font-bold uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
