import Link from "next/link";
import { Monitor } from "lucide-react";

/**
 * The width the editor needs, as a media query.
 *
 * 64rem is Tailwind's `lg`, and the two have to agree: the notice below is
 * hidden with `lg:hidden` so a phone sees it in the first paint without waiting
 * for JavaScript, and the same threshold in `matchMedia` is what decides
 * whether the editor mounts at all. Change one and you get a screen that shows
 * the editor and the "too small" notice at once, or neither.
 */
export const EDITOR_MIN_WIDTH_QUERY = "(min-width: 64rem)";

/** The same number, for saying out loud. */
const EDITOR_MIN_WIDTH_PX = 1024;

/**
 * What a phone gets instead of the editor.
 *
 * The editor is a canvas with a panel of paper settings on one side and live
 * checks and a 3D fold on the other, and there is no arrangement of that which
 * survives a 390 pixel screen: the rails alone are wider than the paper would
 * be. Shipping a cramped version would be worse than saying so, because the
 * cramped version still looks like it works right up until somebody has spent
 * twenty minutes drawing into it.
 *
 * So this is a door, and a door should say where else to go. Back to where they
 * came from, or into the library, which is the part of Kamibase that is genuinely
 * good on a phone.
 */
export function EditorTooSmall({
  backHref,
  className = "",
}: {
  /** Where they came from, when we know. */
  readonly backHref?: string;
  readonly className?: string;
}) {
  return (
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center overflow-y-auto p-6 ${className}`}
      style={{ background: "var(--surface)" }}
    >
      <div className="max-w-sm space-y-4 text-center">
        <span
          aria-hidden
          className="mx-auto flex size-14 items-center justify-center rounded-2xl"
          style={{ background: "var(--brand-soft)" }}
        >
          <Monitor className="size-7" style={{ color: "var(--brand-strong)" }} />
        </span>

        <h1 className="text-xl font-black tracking-tight">The editor needs a bigger screen</h1>

        <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Drawing a crease pattern means a canvas with the paper settings down one
          side and the live checks and 3D fold down the other. That does not fit on
          a phone, and a squeezed version would waste your time rather than save
          it.
        </p>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Open this on a laptop or desktop — a window at least{" "}
          {EDITOR_MIN_WIDTH_PX} pixels wide. Turning a tablet on its side is often
          enough.
        </p>

        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <Link
            href="/explore"
            className="rounded-full px-4 py-2 text-sm font-bold transition hover:opacity-85"
            style={{ background: "var(--brand)", color: "var(--ink)" }}
          >
            Browse patterns
          </Link>
          <Link
            href={backHref ?? "/"}
            className="rounded-full px-4 py-2 text-sm font-bold transition hover:opacity-70"
            style={{ border: "1px solid var(--border-strong)" }}
          >
            {backHref ? "Back to the pattern" : "Back to Kamibase"}
          </Link>
        </div>
      </div>
    </div>
  );
}
