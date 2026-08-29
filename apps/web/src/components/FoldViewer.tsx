"use client";

import Link from "next/link";
import { useEffect } from "react";
import { X } from "lucide-react";
import type { FoldDocument } from "@kamibase/core";
import { Simulator } from "@/components/Simulator";

export interface FoldViewerProps {
  readonly fold: FoldDocument;
  /** Stable identity for the pattern; see `Simulator`. */
  readonly patternId: string;
  readonly title: string;
  readonly flatFoldable?: boolean;
  /**
   * How to leave. A URL when the viewer is its own page and the way out is
   * navigation; a callback when it is over something still mounted, like the
   * editor, whose drawing must survive the visit.
   */
  readonly closeHref?: string;
  readonly onClose?: () => void;
  /** Shown in place of the model when the simulator cannot run. */
  readonly fallback: React.ReactNode;
}

/**
 * The 3D fold, taking the screen.
 *
 * Folding is not a thing you glance at beside a paragraph. It is the reason
 * somebody opened the pattern: they want to turn it over, run it back and
 * forth, and look at what the layers do. So it gets the viewport, from wherever
 * it is opened — the pattern page and the editor both land here — and it gets a
 * single obvious way out rather than a browser Back that means something
 * different depending on which door you came through.
 *
 * Escape closes it too, because a thing that covers the screen and cannot be
 * dismissed from the keyboard is a trap.
 */
export function FoldViewer({
  fold,
  patternId,
  title,
  flatFoldable = true,
  closeHref,
  onClose,
  fallback,
}: FoldViewerProps) {
  useEffect(() => {
    if (!onClose) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // A viewer over the page must not leave the page scrolling behind it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const closeLabel = "Close the 3D fold";
  const closeClass =
    "flex size-9 shrink-0 items-center justify-center rounded-full transition hover:opacity-70";
  const closeStyle = { border: "1px solid var(--border)", color: "var(--text-muted)" } as const;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--surface)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`3D fold of ${title}`}
    >
      <header
        className="flex h-14 shrink-0 items-center gap-3 px-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold leading-tight">{title}</h1>
          <p className="truncate text-[11px] leading-tight" style={{ color: "var(--text-muted)" }}>
            Folding in 3D
          </p>
        </div>

        {closeHref ? (
          <Link href={closeHref} className={closeClass} style={closeStyle} aria-label={closeLabel} title={closeLabel}>
            <X className="size-4" aria-hidden />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className={closeClass}
            style={closeStyle}
            aria-label={closeLabel}
            title={closeLabel}
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1">
        <Simulator
          fold={fold}
          patternId={patternId}
          title={title}
          flatFoldable={flatFoldable}
          fill
          fallback={fallback}
        />
      </div>
    </div>
  );
}
