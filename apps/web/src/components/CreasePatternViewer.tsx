"use client";

import { useCallback, useId, useRef, useState } from "react";
import type { EdgeAssignment } from "@kamibase/core";

const LAYERS: { key: EdgeAssignment; label: string; swatch: string }[] = [
  { key: "M", label: "Mountain", swatch: "#ff0000" },
  { key: "V", label: "Valley", swatch: "#0000ff" },
  { key: "B", label: "Boundary", swatch: "#000000" },
  { key: "F", label: "Flat", swatch: "#ffff00" },
  { key: "U", label: "Unassigned", swatch: "#ff00ff" },
];

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 16;

export interface CreasePatternViewerProps {
  /** Pre-rendered SVG from `@kamibase/core`'s renderSvg. */
  readonly svg: string;
  /** Assignments actually present, so we only offer toggles that do something. */
  readonly present: readonly EdgeAssignment[];
  /** `kami:paper.recommendedSizeMm`, for print-to-scale. */
  readonly printSizeMm?: number;
  readonly title: string;
}

/**
 * The crease pattern viewer from DESIGN.md §8.3: zoom, layer toggles for
 * M/V/B, and print-to-scale.
 *
 * The SVG itself is rendered on the server by `@kamibase/core`, the same
 * renderer that makes thumbnails at ingest. This component only handles
 * interaction. Layer toggling works because the renderer tags one `<path>` per
 * assignment with `data-assignment`, so hiding a layer is one CSS rule rather
 * than a re-render.
 */
export function CreasePatternViewer({
  svg,
  present,
  printSizeMm,
  title,
}: CreasePatternViewerProps) {
  const styleId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hidden, setHidden] = useState<ReadonlySet<EdgeAssignment>>(new Set());
  const dragState = useRef<{ x: number; y: number; panX: number; panY: number } | null>(
    null,
  );

  const available = LAYERS.filter((layer) => present.includes(layer.key));

  const toggleLayer = useCallback((key: EdgeAssignment) => {
    setHidden((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const onWheel = useCallback((event: React.WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey && Math.abs(event.deltaY) < 2) return;
    event.preventDefault();
    setZoom((previous) =>
      Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, previous * (event.deltaY < 0 ? 1.12 : 1 / 1.12))),
    );
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      dragState.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    },
    [pan],
  );

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    const start = dragState.current;
    if (!start) return;
    setPan({
      x: start.panX + (event.clientX - start.x),
      y: start.panY + (event.clientY - start.y),
    });
  }, []);

  const endDrag = useCallback(() => {
    dragState.current = null;
  }, []);

  const hiddenRules = [...hidden]
    .map((key) => `#${styleId} [data-assignment="${key}"]{display:none}`)
    .join("");

  return (
    <figure className="m-0">
      <style>{hiddenRules}</style>

      <div
        className="print-sheet relative overflow-hidden rounded-lg border"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface-raised)",
          ...(printSizeMm ? { ["--print-size-mm" as string]: `${printSizeMm}mm` } : {}),
        }}
      >
        <div
          id={styleId}
          role="img"
          aria-label={`Crease pattern for ${title}`}
          className="flex aspect-square w-full touch-none items-center justify-center [&>svg]:h-full [&>svg]:w-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center",
            cursor: dragState.current ? "grabbing" : "grab",
            transition: dragState.current ? "none" : "transform 120ms ease-out",
          }}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      <figcaption className="print-hidden mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          {available.map((layer) => (
            <label key={layer.key} className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={!hidden.has(layer.key)}
                onChange={() => toggleLayer(layer.key)}
                className="size-3.5 accent-current"
              />
              <span
                aria-hidden
                className="inline-block size-3 rounded-sm border"
                style={{ background: layer.swatch, borderColor: "var(--border)" }}
              />
              {layer.label}
            </label>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.4))}
            className="rounded border px-2 py-0.5 hover:opacity-70"
            style={{ borderColor: "var(--border)" }}
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.4))}
            className="rounded border px-2 py-0.5 hover:opacity-70"
            style={{ borderColor: "var(--border)" }}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded border px-2 py-0.5 hover:opacity-70"
            style={{ borderColor: "var(--border)" }}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded border px-2 py-0.5 hover:opacity-70"
            style={{ borderColor: "var(--border)" }}
            title={
              printSizeMm
                ? `Prints at ${printSizeMm}mm, the designer's recommended size`
                : "Print the crease pattern"
            }
          >
            {printSizeMm ? `Print at ${printSizeMm}mm` : "Print"}
          </button>
        </div>
      </figcaption>
    </figure>
  );
}
