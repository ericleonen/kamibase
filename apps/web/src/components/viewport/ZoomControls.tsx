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
  readonly className?: string;
}

/**
 * The zoom pill: `−  100%  +`, with the percentage doubling as "zoom to fit".
 *
 * Floating over the canvas rather than sitting under it, because it belongs to
 * the canvas and because a control below the fold on a phone may as well not
 * exist. Same component in the viewer and the editor, so the gesture and the
 * label mean the same thing in both.
 */
export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  children,
  className = "",
}: ZoomControlsProps) {
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
