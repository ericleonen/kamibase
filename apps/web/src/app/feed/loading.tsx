import { Skeleton } from "@/components/Loading";

/**
 * The feed, before the feed.
 *
 * Fold photos are whatever shape somebody's camera was, so these tiles vary in
 * height where the pattern grid's do not. Fixed heights per column position
 * rather than random ones: a skeleton that reshuffles on every render is a
 * loading state that looks like a bug.
 */
const HEIGHTS = ["h-56", "h-72", "h-64", "h-80", "h-60", "h-72", "h-52", "h-64"];

export default function FeedLoading() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-28" radius="999px" />
        <Skeleton className="h-9 w-52" radius="999px" />
      </header>

      <div className="masonry" role="status" aria-label="Loading folds">
        {HEIGHTS.map((height, index) => (
          <div key={index}>
            <Skeleton className={`w-full ${height}`} radius="1rem" />
            <div className="flex items-center gap-2 px-1 pt-2">
              <Skeleton className="size-7 shrink-0" radius="999px" />
              <Skeleton className="h-3 w-24" radius="999px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
