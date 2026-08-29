"use client";

import { Minus, Plus } from "lucide-react";

export interface ZoomControlsProps {
  /** `1` is "fitted"; the label is that as a percentage. */
  readonly zoom: number;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onFit: () => void;
  /** Extra buttons in the same pill, e.g. fullscreen. */
  readonly children?: React.ReactNode;
  /**
   * `"floating"` is the pill over a canvas; `"panel"` is the same three
   * controls as a settings row, for a sidebar that already has a column of
   * them. A control that lives with the other settings should look like one.
   */
  readonly variant?: "floating" | "panel";
  readonly className?: string;
}

/**
 * The zoom control: `−  100%  +`, with the percentage doubling as "zoom to fit".
 *
 * Same component in the viewer and the editor, so the gesture and the label
 * mean the same thing in both.
 */
export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  children,
  variant = "floating",
  className = "",
}: ZoomControlsProps) {
  if (variant === "panel") {
    return (
      <div className={`flex items-stretch gap-1.5 ${className}`}>
        <Square label="Zoom out" onClick={onZoomOut}>
          <Minus className="size-4" aria-hidden />
        </Square>
        <button
          type="button"
          onClick={onFit}
          title="Zoom to fit"
          className="min-h-9 flex-1 rounded-lg px-1 text-xs font-bold tabular-nums transition hover:opacity-60"
          style={{ border: "1px solid var(--border)" }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <Square label="Zoom in" onClick={onZoomIn}>
          <Plus className="size-4" aria-hidden />
        </Square>
        {children}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-0.5 rounded-full p-1 ${className}`}
      style={{ background: "var(--surface-raised)", boxShadow: "var(--shadow-card)" }}
    >
      <Round label="Zoom out" onClick={onZoomOut}>
        <Minus className="size-4" aria-hidden />
      </Round>
      <button
        type="button"
        onClick={onFit}
        title="Zoom to fit"
        className="min-w-14 rounded-full px-2 py-1 text-xs font-bold tabular-nums transition hover:opacity-60"
      >
        {Math.round(zoom * 100)}%
      </button>
      <Round label="Zoom in" onClick={onZoomIn}>
        <Plus className="size-4" aria-hidden />
      </Round>
      {children}
    </div>
  );
}

function Square({
  label,
  onClick,
  children,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex min-h-9 w-9 shrink-0 items-center justify-center rounded-lg transition hover:opacity-60"
      style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
    >
      {children}
    </button>
  );
}

function Round({
  label,
  onClick,
  children,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-full transition hover:opacity-60"
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </button>
  );
}
