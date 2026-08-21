import { PatternGridSkeleton, Skeleton } from "@/components/Loading";

/**
 * The library, before the library.
 *
 * The filter bar and the grid are both fixed shapes, so both can be drawn
 * before the patterns arrive: the page that replaces this one has its controls
 * in the same place and its tiles at the same size, which is the whole point of
 * a skeleton over a spinner.
 */
export default function ExploreLoading() {
  return (
    <div className="space-y-5">
      <div
        className="flex flex-wrap items-end gap-3 rounded-2xl p-3"
        style={{ background: "var(--surface-sunken)" }}
      >
        <Skeleton className="h-10 w-40" tone="strong" />
        <Skeleton className="h-10 w-32" tone="strong" />
        <Skeleton className="h-10 w-44" radius="999px" tone="strong" />
      </div>

      <Skeleton className="h-4 w-28" radius="999px" />

      <PatternGridSkeleton />
    </div>
  );
}
