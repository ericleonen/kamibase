import { Skeleton } from "@/components/Loading";

/** A profile, before the profile: the header block, then a grid of folds. */
export default function ProfileLoading() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading profile">
      <header className="flex flex-col items-center gap-4 pt-4">
        <Skeleton className="size-24" radius="999px" />
        <Skeleton className="h-7 w-44" radius="999px" />
        <Skeleton className="h-4 w-28" radius="999px" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-20" radius="999px" />
          <Skeleton className="h-4 w-24" radius="999px" />
          <Skeleton className="h-4 w-24" radius="999px" />
        </div>
        <Skeleton className="h-9 w-32" radius="999px" />
      </header>

      <div className="masonry">
        {["h-60", "h-72", "h-56", "h-64", "h-72", "h-52"].map((height, index) => (
          <Skeleton key={index} className={`w-full ${height}`} radius="1rem" />
        ))}
      </div>
    </div>
  );
}
