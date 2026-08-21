/**
 * How the library can be ordered.
 *
 * Its own module rather than a couple of exports beside the filter bar: the
 * bar is a client component, and a `"use client"` module's functions cannot be
 * called from the server, only rendered. The explore page needs `isSort` to
 * read the query string before it renders anything, so the definition has to
 * live somewhere both sides can reach.
 */
export const SORTS = {
  title: "Title",
  creases: "Creases",
  difficulty: "Difficulty",
} as const;

export type SortKey = keyof typeof SORTS;

/** The default, and what an unrecognised `?sort=` falls back to. */
export const DEFAULT_SORT: SortKey = "title";

export function isSort(value: string | undefined): value is SortKey {
  return value === "title" || value === "creases" || value === "difficulty";
}
