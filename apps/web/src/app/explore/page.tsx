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
  readonly sort?: string;
  readonly foldable?: string;
}

const SORTS = {
  title: "Title",
  creases: "Creases",
  difficulty: "Difficulty",
} as const;

type SortKey = keyof typeof SORTS;

function isSort(value: string | undefined): value is SortKey {
  return value === "title" || value === "creases" || value === "difficulty";
}

/**
 * The library.
 *
 * The filters used to be a scrolling rail of technique chips, which grows with
 * the library and answers exactly one question. This is a plain form: a
 * dropdown per axis, a checkbox, and a submit. It stays one line however many
 * techniques there are, and it works with JavaScript off.
 */
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, technique, sort, foldable } = await searchParams;
  const all = await patterns.list();
  const facets = techniqueFacets(all);
  const order: SortKey = isSort(sort) ? sort : "title";
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

  const filtered = Boolean(q || technique || onlyFoldable);

  return (
    <div className="space-y-5">
      <form
        action="/explore"
        className="flex flex-wrap items-end gap-3 rounded-2xl p-3"
        style={{ background: "var(--surface-sunken)" }}
      >
        {q && <input type="hidden" name="q" value={q} />}

        <Field label="Technique">
          <select name="technique" defaultValue={technique ?? ""} className={selectClass} style={controlStyle}>
            <option value="">All</option>
            {facets.map(({ technique: name, count }) => (
              <option key={name} value={name}>
                {name.replace(/-/g, " ")} ({count})
              </option>
            ))}
          </select>
        </Field>

        <Field label="Sort by">
          <select name="sort" defaultValue={order} className={selectClass} style={controlStyle}>
            {Object.entries(SORTS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <label className="flex min-h-10 items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="foldable" value="1" defaultChecked={onlyFoldable} />
          Flat-foldable only
        </label>

        <button
          type="submit"
          className="min-h-10 rounded-xl px-4 text-sm font-bold transition hover:opacity-85"
          style={{ background: "var(--brand)", color: "var(--ink)" }}
        >
          Apply
        </button>

        {filtered && (
          <Link
            href="/explore"
            className="flex min-h-10 items-center text-sm font-semibold underline"
            style={{ color: "var(--text-muted)" }}
          >
            Clear
          </Link>
        )}
      </form>

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
        // `masonry-stagger` because these tiles are all one square: the offset
        // has to come from margin, since nothing here varies in height.
        <div className="masonry masonry-stagger">
          {results.map((pattern) => (
            <PatternCard key={pattern.id} pattern={pattern} />
          ))}
        </div>
      )}
    </div>
  );
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
      <span className="block text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}
