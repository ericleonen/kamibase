/**
 * The two ways this site says "not yet".
 *
 * A skeleton where the shape of what is coming is known: a grid of square
 * pattern tiles is a grid of square pattern tiles whether or not the data has
 * arrived, so drawing the boxes now means the page does not jump when it does.
 * A spinner where it is not: warming up a WebGL solver has no layout to
 * pre-draw, only a wait to acknowledge.
 *
 * Both stop moving under `prefers-reduced-motion`, and neither is announced on
 * its own. A screen reader that meets a loading state wants one live region
 * saying so, not forty pulsing rectangles; the containers below carry the
 * `role="status"` and hide their skeletons from the tree.
 */

/**
 * A pulsing block. Give it a size with `className`.
 *
 * `tone` is which grey: the default sits on the page, and `strong` is for a
 * skeleton inside a sunken container, where the default would be the same
 * colour as what it is standing on and the whole panel would read as one blob.
 */
export function Skeleton({
  className = "",
  radius = "0.75rem",
  tone = "default",
}: {
  readonly className?: string;
  readonly radius?: string;
  readonly tone?: "default" | "strong";
}) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse motion-reduce:animate-none ${className}`}
      style={{
        background: tone === "strong" ? "var(--border)" : "var(--surface-sunken)",
        borderRadius: radius,
      }}
    />
  );
}

const SPINNER_SIZES = {
  sm: "size-4 border-2",
  md: "size-7 border-2",
  lg: "size-10 border-[3px]",
} as const;

/**
 * A spinner.
 *
 * A bordered circle with one edge in brand amber rather than an SVG: it is
 * three CSS properties, it scales with the font, and it cannot arrive late the
 * way an icon component in a lazily-loaded chunk can.
 */
export function Spinner({
  size = "md",
  label,
}: {
  readonly size?: keyof typeof SPINNER_SIZES;
  /** Announced to screen readers. Omit inside something already saying it. */
  readonly label?: string;
}) {
  return (
    <>
      <span
        aria-hidden
        className={`${SPINNER_SIZES[size]} shrink-0 animate-spin rounded-full motion-reduce:animate-none`}
        style={{ borderColor: "var(--border-strong)", borderTopColor: "var(--brand-strong)" }}
      />
      {label && <span className="sr-only">{label}</span>}
    </>
  );
}

/** One pattern tile, at the size `PatternCard` draws one. */
export function PatternCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-square w-full" radius="1rem" />
      <div className="space-y-1.5 px-1 pt-2">
        <Skeleton className="h-3.5 w-2/3" radius="999px" />
        <Skeleton className="h-3 w-2/5" radius="999px" />
      </div>
    </div>
  );
}

/**
 * A masonry of them, staggered the way the real grid is.
 *
 * `count` is a guess at how many will land above the fold rather than how many
 * there are; a skeleton that undershoots is a short page for one frame, and one
 * that overshoots is a promise the data cannot keep.
 */
export function PatternGridSkeleton({ count = 10 }: { readonly count?: number }) {
  return (
    <div className="masonry masonry-stagger" role="status" aria-label="Loading patterns">
      {Array.from({ length: count }, (_, index) => (
        <PatternCardSkeleton key={index} />
      ))}
    </div>
  );
}

/**
 * A block of text that has not arrived.
 *
 * The lines are uneven on purpose: a stack of identical bars reads as a table,
 * and the thing being stood in for is a paragraph.
 */
const TEXT_WIDTHS = ["w-full", "w-11/12", "w-4/5", "w-10/12", "w-3/5"] as const;

export function TextSkeleton({ lines = 3 }: { readonly lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={`h-3.5 ${TEXT_WIDTHS[index % TEXT_WIDTHS.length]}`}
          radius="999px"
        />
      ))}
    </div>
  );
}
