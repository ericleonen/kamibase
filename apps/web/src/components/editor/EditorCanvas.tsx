"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KAMIBASE_DISPLAY_PALETTE, type EdgeAssignment } from "@kamibase/core";
import type { VertexMark } from "@/lib/editor/analysis";
import { gridLines, type GridSpec } from "@/lib/editor/grid";
import { paperTransform, toPaperPoint } from "@/lib/editor/paper";
import { segmentAt, snapPoint, type EditorDoc } from "@/lib/editor/model";
import type { PanZoom } from "@/lib/viewport/use-pan-zoom";

export type EditorTool = "draw" | "erase" | "assign" | "pan";

export interface EditorCanvasProps {
  readonly doc: EditorDoc;
  readonly tool: EditorTool;
  readonly assignment: EdgeAssignment;
  /** The snap radius is screen-relative, so it is not part of this. */
  readonly snap: { readonly grid: GridSpec; readonly snapToVertices: boolean };
  readonly vertexMarks: readonly VertexMark[];
  readonly showMarks: boolean;
  /**
   * How far the sheet is turned on screen, anticlockwise, in degrees. A view
   * setting only: see `@/lib/editor/paper`.
   */
  readonly paperAngle?: number;
  /** The viewport, owned by the editor so its chrome can drive it too. */
  readonly panZoom: PanZoom;
  /**
   * A rectified image of the source, as a data URL, drawn under the paper to
   * trace over. It fills the unit square exactly, because it is the same square
   * the creases were detected in.
   */
  readonly backdrop?: string;
  /** 0 to 1. The backdrop is a reference, so it is never at full strength. */
  readonly backdropOpacity?: number;
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

/* Everything below is in CSS pixels, divided by the scale at draw time so a
 * crease is the same thickness at 20% as at 2000%. Sizes that shrink as you
 * zoom in are the single loudest tell of a canvas that was built for one
 * zoom level. */
const CREASE_PX = 2.2;
const GRID_PX = 1;
const HIT_PX = 10;
const SNAP_PX = 14;
const MARK_PX = 7;

/**
 * The drawing surface.
 *
 * SVG, per DESIGN.md §4: "SVG for ≤5k edges, canvas/WebGL above that". Nothing
 * the simple editor is for comes close to that ceiling, and SVG buys hit
 * testing, crisp zoom and accessible focus for free.
 *
 * The canvas fills whatever it is given and the paper floats in it, Figma
 * style: there is no "edge of the document" to run out of, and the viewport
 * transform is a plain `translate/scale` in CSS pixels rather than a viewBox
 * that has to agree with a span constant. That is what lets a screen pixel
 * mean the same thing to the pointer, the stroke widths and the hit radius.
 *
 * All pointer handling goes through Pointer Events rather than separate mouse
 * and touch paths, so a finger, a stylus and a mouse take exactly one code
 * path, and the viewport gets first refusal on every one of them, which is
 * how two fingers pinch mid-stroke without leaving a stray crease behind.
 */
export function EditorCanvas({
  doc,
  tool,
  assignment,
  snap,
  vertexMarks,
  showMarks,
  paperAngle = 0,
  panZoom,
  backdrop,
  backdropOpacity = 0.35,
  onDraw,
  onErase,
  onAssign,
}: EditorCanvasProps) {
  const [start, setStart] = useState<[number, number] | null>(null);
  const [cursor, setCursor] = useState<[number, number] | null>(null);

  /*
   * The snap dot is where the pointer is, not a mark on the paper, so it does
   * not come round with the sheet. Turning the paper leaves it stale anyway —
   * the pointer has not moved, so the paper coordinate under it is a different
   * one — and a dot swinging away from the cursor during the turn reads as the
   * canvas losing track of the mouse. It comes back on the next pointer move,
   * in the right place. Same argument for a half-drawn crease.
   */
  useEffect(() => {
    setStart(null);
    setCursor(null);
  }, [paperAngle]);

  const { view } = panZoom;
  const px = useCallback((pixels: number): number => pixels / view.scale, [view.scale]);

  /**
   * Screen → paper coordinates.
   *
   * The viewport undoes the pan and zoom; `toPaperPoint` undoes the turn of the
   * sheet and the y flip. Every coordinate the tools see is therefore a
   * coordinate on the paper, whichever way the paper happens to be facing.
   */
  const toPaper = useCallback(
    (clientX: number, clientY: number): [number, number] =>
      toPaperPoint(panZoom.toWorld(clientX, clientY), paperAngle),
    [panZoom, paperAngle],
  );

  const { grid, snapToVertices } = snap;
  const snapWith = useCallback(
    (point: [number, number], document_: EditorDoc): [number, number] =>
      snapPoint(point, document_, { grid, snapToVertices, radius: px(SNAP_PX) }),
    [grid, px, snapToVertices],
  );

  // Recomputed only when the lattice changes, not on every pan: at 64
  // divisions on the diagonal this is a couple of hundred clipped segments,
  // and rebuilding them mid-drag is exactly the kind of work that turns a
  // smooth canvas into a stuttering one.
  const lattice = useMemo(() => gridLines(grid), [grid]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      // Middle-drag pans everywhere on the web; without this the browser
      // starts its own autoscroll on top of ours.
      if (event.button === 1) event.preventDefault();

      // The viewport first: a second finger, a held space bar, a middle button
      // or the hand tool outranks whatever tool is selected, and a stroke in
      // progress is abandoned rather than finished where the pointer never went.
      if (panZoom.onPointerDown(event)) {
        setStart(null);
        setCursor(null);
        return;
      }
      if (event.button !== 0) return;

      const point = toPaper(event.clientX, event.clientY);
      if (tool === "erase") {
        const index = segmentAt(doc, point, px(HIT_PX));
        if (index >= 0) onErase(index);
        return;
      }
      if (tool === "assign") {
        const index = segmentAt(doc, point, px(HIT_PX));
        if (index >= 0) onAssign(index);
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      const snapped = snapWith(point, doc);
      setStart(snapped);
      setCursor(snapped);
    },
    [doc, onAssign, onErase, panZoom, px, snapWith, toPaper, tool],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (panZoom.onPointerMove(event)) {
        // A pinch that begins mid-stroke cancels it rather than dragging the
        // crease along with the gesture.
        if (start) setStart(null);
        setCursor(null);
        return;
      }
      if (tool !== "draw") return;
      const point = toPaper(event.clientX, event.clientY);
      setCursor(event.shiftKey && start ? constrain(start, point) : snapWith(point, doc));
    },
    [doc, panZoom, snapWith, start, toPaper, tool],
  );

  const finishPointer = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const wasViewport = panZoom.onPointerUp(event);
      if (wasViewport || tool !== "draw" || !start) {
        setStart(null);
        return;
      }
      const raw = toPaper(event.clientX, event.clientY);
      const end = event.shiftKey ? constrain(start, raw) : snapWith(raw, doc);
      onDraw({ x1: start[0], y1: start[1], x2: end[0], y2: end[1], assignment });
      setStart(null);
      setCursor(null);
    },
    [assignment, doc, onDraw, panZoom, snapWith, start, toPaper, tool],
  );

  return (
    <svg
      ref={panZoom.ref}
      className="absolute inset-0 size-full touch-none select-none"
      style={{ cursor: cursorFor(tool, panZoom) }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onContextMenu={(event) => event.preventDefault()}
      role="application"
      aria-label="Crease pattern editor canvas"
    >
      <g transform={panZoom.svgTransform}>
        {/* Everything on the sheet turns with the sheet, which is why the
            rotation is one group around the lot rather than a term in every
            coordinate. */}
        <g transform={paperTransform(paperAngle)}>
        {/* Paper. Drawn under everything so creases read as ink on it, and
            given a shadow so it reads as a sheet on a table rather than as a
            hole in the background. */}
        <rect
          x="0"
          y="0"
          width="1"
          height="1"
          fill="var(--paper)"
          style={{ filter: "drop-shadow(0 2px 10px rgb(27 26 23 / 0.14))" }}
        />

        {/* The photograph this came from, if it came from one. Faded, so a
            crease drawn over it is still obviously the darker of the two. */}
        {backdrop && (
          <image
            href={backdrop}
            x="0"
            y="0"
            width="1"
            height="1"
            opacity={backdropOpacity}
            preserveAspectRatio="none"
          />
        )}

        {/* The lattice. Drawn in paper coordinates like everything else, so a
            rotated grid needs no special case: `gridLines` has already turned
            it into segments clipped to the sheet. */}
        <g stroke="var(--paper-line)" strokeWidth={px(GRID_PX)}>
          {lattice.map((line, index) => (
            <line
              key={`${index}-${line.x1},${line.y1}`}
              x1={line.x1}
              y1={1 - line.y1}
              x2={line.x2}
              y2={1 - line.y2}
            />
          ))}
        </g>

        {doc.map((segment, index) => (
          <line
            key={`${index}-${segment.x1},${segment.y1},${segment.x2},${segment.y2}`}
            x1={segment.x1}
            y1={1 - segment.y1}
            x2={segment.x2}
            y2={1 - segment.y2}
            stroke={KAMIBASE_DISPLAY_PALETTE[segment.assignment]}
            strokeWidth={px(CREASE_PX)}
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
            stroke={KAMIBASE_DISPLAY_PALETTE[assignment]}
            strokeWidth={px(CREASE_PX)}
            strokeDasharray={`${px(8)} ${px(6)}`}
            strokeLinecap="round"
          />
        )}

        {/* Snap indicator: without it, snapping feels like drift. */}
        {cursor && tool === "draw" && (
          <circle
            cx={cursor[0]}
            cy={1 - cursor[1]}
            r={px(4)}
            fill="var(--brand-strong)"
          />
        )}

        {/* Live flat-foldability, per DESIGN.md §4: "a red dot at a vertex
            that violates Maekawa is worth a thousand words".

            A dot, and not a ring around one. The ring was a second circle
            drawn around a place where creases already meet, so a pattern with
            a few problems in it read as a pattern with targets scattered over
            it. This is the vertex itself, marked. It grows under the pointer,
            which is both how you find the one you want among close neighbours
            and how you get its reason to appear. */}
        {showMarks &&
          vertexMarks
            .filter((mark) => !mark.ok)
            .map((mark, index) => (
              <circle
                key={`${mark.at[0]},${mark.at[1]},${index}`}
                className="kami-vertex"
                cx={mark.at[0]}
                cy={1 - mark.at[1]}
                fill="#d92d20"
                style={{
                  // The two radii, in paper units, so the dot is the same size
                  // on screen at 15% as at 6000%.
                  ["--vertex-r" as string]: px(MARK_PX * 0.5),
                  ["--vertex-r-hover" as string]: px(MARK_PX),
                }}
              >
                <title>{mark.reason}</title>
              </circle>
            ))}
        </g>
      </g>
    </svg>
  );
}

/** Nearest 0°/45°/90° from `from`, for shift-constrained drawing. */
function constrain(
  from: readonly [number, number],
  to: readonly [number, number],
): [number, number] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  const length = Math.hypot(dx, dy);
  return [from[0] + Math.cos(angle) * length, from[1] + Math.sin(angle) * length];
}

function cursorFor(tool: EditorTool, panZoom: PanZoom): string {
  if (panZoom.panning) return "grabbing";
  if (panZoom.panReady || tool === "pan") return "grab";
  if (tool === "draw") return "crosshair";
  return "pointer";
}
