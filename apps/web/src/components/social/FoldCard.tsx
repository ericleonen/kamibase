import Link from "next/link";
import { foldDetails, nameOf, relativeTime, type Fold } from "@/lib/social";
import { Avatar } from "./Avatar";

/**
 * One fold in a grid.
 *
 * The photo leads and the chrome is quiet, the same shape as `PatternCard`, so
 * a mixed grid of patterns and folds reads as one surface. What is deliberately
 * different: a fold card always shows who folded it. A pattern is a design and
 * a fold is somebody's work, and putting a name on it is the whole point
 * (DESIGN.md §7).
 */
export function FoldCard({
  fold,
  showPattern = true,
  patternTitle,
}: {
  readonly fold: Fold;
  readonly showPattern?: boolean;
  readonly patternTitle?: string;
}) {
  const details = foldDetails(fold);

  return (
    <article className="group">
      <Link href={`/f/${fold.id}`} className="block">
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{ background: "var(--surface-sunken)", boxShadow: "var(--shadow-card)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage origin, see Avatar */}
          <img
            src={fold.photoUrl}
            alt={fold.caption || `A fold by ${nameOf(fold.author)}`}
            className="w-full transition duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
          {showPattern && (
            <span
              className="absolute bottom-2 left-2 max-w-[85%] truncate rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: "rgb(255 255 255 / 0.92)", color: "#1b1a17" }}
            >
              {patternTitle ?? fold.patternId}
            </span>
          )}
        </div>
      </Link>

      <div className="px-1 pt-2">
        {fold.caption && <p className="line-clamp-2 text-sm">{fold.caption}</p>}
        <div className="mt-1.5 flex items-center gap-2">
          <Link
            href={`/u/${fold.author.handle}`}
            className="flex min-w-0 items-center gap-1.5 transition hover:opacity-70"
          >
            <Avatar profile={fold.author} size="sm" />
            <span className="truncate text-xs font-semibold">{nameOf(fold.author)}</span>
          </Link>
          <span className="shrink-0 text-xs" style={{ color: "var(--text-faint)" }}>
            {relativeTime(fold.createdAt)}
          </span>
        </div>
        {details && (
          <p className="mt-1 truncate text-xs" style={{ color: "var(--text-muted)" }}>
            {details}
          </p>
        )}
      </div>
    </article>
  );
}

/** Folds in the same masonry the pattern grid uses. */
export function FoldGrid({
  folds,
  showPattern = true,
  titles,
  layout = "masonry",
}: {
  readonly folds: readonly Fold[];
  readonly showPattern?: boolean;
  readonly titles?: Readonly<Record<string, string>>;
  /**
   * `masonry` fills the browsing surfaces, where the grid is as wide as the
   * window and the cards are the whole point.
   *
   * `column` is for a card that sits inside a narrow reading column. The
   * masonry is CSS columns, and CSS columns count off the *viewport* rather
   * than the container — so a 48rem column on a 1600px screen would lay five
   * columns of cards into it and each would be eighty pixels wide.
   */
  readonly layout?: "masonry" | "column";
}) {
  return (
    <div
      className={
        layout === "masonry"
          ? "masonry"
          : "grid grid-cols-2 gap-3 sm:grid-cols-3"
      }
    >
      {folds.map((fold) => (
        <FoldCard
          key={fold.id}
          fold={fold}
          showPattern={showPattern}
          {...(titles?.[fold.patternId] === undefined
            ? {}
            : { patternTitle: titles[fold.patternId] })}
        />
      ))}
    </div>
  );
}
