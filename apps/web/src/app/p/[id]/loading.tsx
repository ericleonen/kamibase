import { Skeleton, TextSkeleton } from "@/components/Loading";

/**
 * A pattern's page, before the pattern.
 *
 * The viewer is the tall square in the middle of a reading column, and it is
 * the one thing worth reserving space for: everything under it moves a screen's
 * height if the drawing arrives after the prose does.
 */
export default function PatternLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-7 pb-16" role="status" aria-label="Loading">
      <header className="space-y-3">
        <Skeleton className="h-9 w-2/3" radius="999px" />
        <Skeleton className="h-4 w-48" radius="999px" />
        <TextSkeleton lines={2} />
      </header>

      <Skeleton className="aspect-square max-h-[32rem] w-full" radius="1rem" />

      <div className="grid gap-2 sm:grid-cols-2">
        <Skeleton className="h-12 w-full" radius="999px" />
        <Skeleton className="h-12 w-full" radius="999px" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-24" radius="999px" />
        <TextSkeleton lines={5} />
      </div>
    </div>
  );
}
