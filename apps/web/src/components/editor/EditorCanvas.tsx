"use client";

import { useCallback, useRef, useState } from "react";
import { ORIGAMI_SIMULATOR_PALETTE, type EdgeAssignment } from "@kamibase/core";
import type { VertexMark } from "@/lib/editor/analysis";
import { segmentAt, snapPoint, type EditorDoc, type SnapOptions } from "@/lib/editor/model";

export type EditorTool = "draw" | "erase" | "assign" | "pan";

export interface EditorCanvasProps {
  readonly doc: EditorDoc;
  readonly tool: EditorTool;
  readonly assignment: EdgeAssignment;
  readonly snap: SnapOptions;
  readonly gridDivisions: number;
  readonly vertexMarks: readonly VertexMark[];
  readonly showMarks: boolean;
  readonly onDraw: (segment: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    assignment: EdgeAssignment;
  }) => void;
  readonly onErase: (index: number) => void;
  readonly onAssign: (index: number) => void;
}

interface View {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 12;

/**
 * The viewBox, as a span and an origin so the two can never disagree with the
 * `viewBox` attribute below.
 *
 * The margin around the unit square is small on purpose: this is the drawing
 * surface, and on a phone every wasted percent of it is a percent you are not
 * drawing on. Panning covers the rest.
 *
 * Every screen<->paper conversion needs this factor. Leaving it out silently
 * scales each stroke by the span and lands creases in mid-air, which is
 * exactly what it did before the first browser run caught it.
 */
const VIEW_SPAN = 1.3;
const VIEW_MIN = -0.15;

/**
 * The drawing surface.
 *
 * SVG, per DESIGN.md §4: "SVG for ≤5k edges, canvas/WebGL above that". Nothing
 * the simple editor is for comes close to that ceiling, and SVG buys hit
 * testing, crisp zoom and accessible focus for free.
 *
 * All pointer handling goes through Pointer Events rather than separate mouse
 * and touch paths, so a finger, a stylus and a mouse take exactly one code
 * path. That is most of what makes this usable on a phone.
 */
export function EditorCanvas({
  doc,
  tool,
  assignment,
  snap,
  gridDivisions,
  vertexMarks,
  showMarks,
  onDraw,
  onErase,
  onAssign,
}: EditorCanvasProps) {
  const surface = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [start, setStart] = useState<[number, number] | null>(null);
  const [cursor, setCursor] = useState<[number, number] | null>(null);

  /** Live pointers, so pinch-zoom works without a gesture library. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  const panFrom = useRef<{ x: number; y: number; view: View } | null>(null);

  /**
   * Screen → unit coordinates.
   *
   * The y axis flips: crease patterns use maths convention (y up) and SVG uses
   * y down, and the renderer that produces every other view of a pattern flips
   * too. Getting this wrong mirrors the drawing against its own thumbnail.
   */
  const toUnit = useCallback(
    (clientX: number, clientY: number): [number, number] => {
      const element = surface.current;
      if (!element) return [0, 0];
      const box = element.getBoundingClientRect();

      // Screen pixels -> viewBox coordinates.
      const vx = VIEW_MIN + ((clientX - box.left) / box.width) * VIEW_SPAN;
      const vy = VIEW_MIN + ((clientY - box.top) / box.height) * VIEW_SPAN;

      // Undo the group transform: translate(pan) then scale about (0.5, 0.5).
      const px = (vx - view.x - 0.5) / view.scale + 0.5;
      const py = (vy - view.y - 0.5) / view.scale + 0.5;

      // Undo the y flip the renderer applies: crease patterns are y-up, SVG is
      // y-down, and every other view of a pattern flips the same way.
      return [px, 1 - py];
    },
    [view],
  );

  /** Screen pixels -> viewBox units, for pan deltas. */
  const pixelsToView = useCallback((pixels: number): number => {
    const width = surface.current?.getBoundingClientRect().width ?? 1;
    return (pixels / width) * VIEW_SPAN;
  }, []);

  const hitRadius = 0.02 / view.scale;

  const onPointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      (event.target as Element).setPointerCapture?.(event.pointerId);
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      // Two fingers always means pinch/pan, whatever tool is selected.
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        pinch.current = {
          distance: Math.hypot(a!.x - b!.x, a!.y - b!.y),
          scale: view.scale,
        };
        setStart(null);
        return;
      }

      const point = toUnit(event.clientX, event.clientY);

      if (tool === "pan") {
        panFrom.current = { x: event.clientX, y: event.clientY, view };
        return;
      }
      if (tool === "erase") {
        const index = segmentAt(doc, point, hitRadius);
        if (index >= 0) onErase(index);
        return;
      }
      if (tool === "assign") {
        const index = segmentAt(doc, point, hitRadius);
        if (index >= 0) onAssign(index);
        return;
      }
      const snapped = snapPoint(point, doc, snap);
      setStart(snapped);
      setCursor(snapped);
    },
    [doc, hitRadius, onAssign, onErase, snap, toUnit, tool, view],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (pointers.current.has(event.pointerId)) {
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }

      if (pointers.current.size === 2 && pinch.current) {
        const [a, b] = [...pointers.current.values()];
        const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        const ratio = distance / (pinch.current.distance || 1);
        setView((previous) => ({
          ...previous,
          scale: clamp(pinch.current!.scale * ratio, MIN_SCALE, MAX_SCALE),
        }));
        return;
      }

      if (panFrom.current) {
        const from = panFrom.current;
        setView({
          scale: from.view.scale,
          x: from.view.x + pixelsToView(event.clientX - from.x),
          y: from.view.y + pixelsToView(event.clientY - from.y),
        });
        return;
      }

      if (tool !== "draw") return;
      const point = toUnit(event.clientX, event.clientY);
      setCursor(snapPoint(point, doc, snap));
    },
    [doc, pixelsToView, snap, toUnit, tool],
  );

  const finishPointer = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      pointers.current.delete(event.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      panFrom.current = null;

      if (tool !== "draw" || !start) {
        setStart(null);
        return;
      }
      const end = snapPoint(toUnit(event.clientX, event.clientY), doc, snap);
      onDraw({ x1: start[0], y1: start[1], x2: end[0], y2: end[1], assignment });
      setStart(null);
      setCursor(null);
    },
    [assignment, doc, onDraw, snap, start, toUnit, tool],
  );

  const onWheel = useCallback((event: React.WheelEvent) => {
    if (event.deltaY === 0) return;
    setView((previous) => ({
      ...previous,
      scale: clamp(previous.scale * (event.deltaY < 0 ? 1.1 : 1 / 1.1), MIN_SCALE, MAX_SCALE),
    }));
  }, []);

  const gridLines: number[] = [];
  if (gridDivisions > 0) {
    for (let i = 1; i < gridDivisions; i += 1) gridLines.push(i / gridDivisions);
  }

  return (
    /*
     * The canvas is square and as large as it can be without running off the
     * screen. Unbounded, a wide desktop window gives it a height taller than
     * the viewport, which pushes the toolbar below the fold and leaves you
     * drawing on a surface you cannot see the bottom of.
     */
    <div className="relative mx-auto w-full" style={{ maxWidth: "min(100%, 68vh)" }}>
      <svg
        ref={surface}
        viewBox={`${VIEW_MIN} ${VIEW_MIN} ${VIEW_SPAN} ${VIEW_SPAN}`}
        className="block aspect-square w-full touch-none select-none rounded-2xl"
        style={{
          background: "var(--surface-raised)",
          boxShadow: "var(--shadow-card)",
          cursor: tool === "pan" ? "grab" : tool === "draw" ? "crosshair" : "pointer",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onWheel={onWheel}
        role="application"
        aria-label="Crease pattern editor canvas"
      >
        <g
          transform={`translate(${view.x} ${view.y}) translate(0.5 0.5) scale(${view.scale}) translate(-0.5 -0.5)`}
        >
          {/* Paper. Drawn under everything so creases read as ink on it. */}
          <rect x="0" y="0" width="1" height="1" fill="var(--surface)" />

          {gridLines.map((t) => (
            <g key={t} stroke="var(--border)" strokeWidth={0.0015 / view.scale}>
              <line x1={t} y1={0} x2={t} y2={1} />
              <line x1={0} y1={t} x2={1} y2={t} />
            </g>
          ))}

          {doc.map((segment, index) => (
            <line
              key={`${index}-${segment.x1},${segment.y1},${segment.x2},${segment.y2}`}
              x1={segment.x1}
              y1={1 - segment.y1}
              x2={segment.x2}
              y2={1 - segment.y2}
              stroke={ORIGAMI_SIMULATOR_PALETTE[segment.assignment]}
              strokeWidth={0.005 / view.scale}
              strokeLinecap="round"
            />
          ))}

          {/* The crease being drawn, dashed until it is committed. */}
          {start && cursor && (
            <line
              x1={start[0]}
              y1={1 - start[1]}
              x2={cursor[0]}
              y2={1 - cursor[1]}
              stroke={ORIGAMI_SIMULATOR_PALETTE[assignment]}
              strokeWidth={0.005 / view.scale}
              strokeDasharray={`${0.02 / view.scale} ${0.015 / view.scale}`}
              strokeLinecap="round"
            />
          )}

          {/* Snap indicator: without it, snapping feels like drift. */}
          {cursor && tool === "draw" && (
            <circle
              cx={cursor[0]}
              cy={1 - cursor[1]}
              r={0.008 / view.scale}
              fill="var(--brand-strong)"
            />
          )}

          {/* Live flat-foldability, per DESIGN.md §4: "a red dot at a vertex
              that violates Maekawa is worth a thousand words". */}
          {showMarks &&
            vertexMarks
              .filter((mark) => !mark.ok)
              .map((mark, index) => (
                <circle
                  key={`${mark.at[0]},${mark.at[1]},${index}`}
                  cx={mark.at[0]}
                  cy={1 - mark.at[1]}
                  r={0.011 / view.scale}
                  fill="none"
                  stroke="#d92d20"
                  strokeWidth={0.004 / view.scale}
                >
                  <title>{mark.reason}</title>
                </circle>
              ))}
        </g>
      </svg>

      <div className="pointer-events-none absolute right-2 bottom-2 flex gap-1">
        {[
          { label: "−", title: "Zoom out", delta: 1 / 1.4 },
          { label: "+", title: "Zoom in", delta: 1.4 },
        ].map(({ label, title, delta }) => (
          <button
            key={label}
            type="button"
            title={title}
            aria-label={title}
            onClick={() =>
              setView((previous) => ({
                ...previous,
                scale: clamp(previous.scale * delta, MIN_SCALE, MAX_SCALE),
              }))
            }
            className="pointer-events-auto flex size-9 items-center justify-center rounded-full text-lg font-bold"
            style={{ background: "var(--surface-raised)", boxShadow: "var(--shadow-card)" }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setView({ scale: 1, x: 0, y: 0 })}
          className="pointer-events-auto rounded-full px-3 text-xs font-bold"
          style={{ background: "var(--surface-raised)", boxShadow: "var(--shadow-card)" }}
        >
          Fit
        </button>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
