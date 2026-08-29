"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KAMIBASE_DISPLAY_PALETTE, type EdgeAssignment } from "@kamibase/core";
import type { VertexMark } from "@/lib/editor/analysis";
import { gridLines, type GridSpec } from "@/lib/editor/grid";
import { paperTransform, toPaperPoint } from "@/lib/editor/paper";
import { segmentAt, snapPoint, type EditorDoc } from "@/lib/editor/model";
import {
  perpendicularBisector,
  snapToBisector,
  type BisectorHit,
} from "@/lib/editor/bisect";
import type { PanZoom } from "@/lib/viewport/use-pan-zoom";

export type EditorTool = "draw" | "bisect" | "erase" | "assign" | "pan";

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
/** Further than this between press and release and it was a drag, not a click. */
const CLICK_SLOP_PX = 5;
/** Radius of the equal-angle arcs drawn when a crease snaps to a bisector. */
const ARC_PX = 26;

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
  /**
   * Where the pointer went down, so a press-move-release can still draw.
   *
   * Click-to-start and click-to-finish is the primary way now: it is what every
   * CAD tool does, it does not ask anybody to hold a button steady across a
   * screen, and it is the only one that works with a trackpad without the line
   * escaping halfway. Dragging still works, because it is what a hand reaches
   * for on a touchscreen and because muscle memory is not something to take
   * away. The distance the pointer travelled between down and up is what tells
   * the two apart.
   */
  const pressed = useRef<{ x: number; y: number; fresh: boolean } | null>(null);
  const [bisector, setBisector] = useState<BisectorHit | null>(null);

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
    setBisector(null);
  }, [paperAngle]);

  /*
   * Reaching for another tool is an answer to "what do I want to do next", and
   * a half-drawn crease is the previous answer. Left alone it would land on the
   * first click made with the new tool, in a place chosen for a different one.
   */
  useEffect(() => {
    setStart(null);
    setCursor(null);
    setBisector(null);
  }, [tool]);

  // Escape abandons a line in progress. Without it a click-to-start line can
  // only be got rid of by finishing it somewhere and undoing.
  useEffect(() => {
    if (!start) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      setStart(null);
      setCursor(null);
      setBisector(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [start]);

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

  const clearStroke = useCallback((): void => {
    setStart(null);
    setCursor(null);
    setBisector(null);
  }, []);

  /**
   * Where the line being drawn currently ends, and what pulled it there.
   *
   * One function for both the preview and the commit, so what gets drawn is
   * exactly what was shown. Three things can claim the endpoint, in order of
   * how deliberate they are: a held shift (an explicit 45° step), the bisector
   * of the creases already at the start point (a thing the designer means; a
   * lattice point near it is a coincidence), then the lattice itself.
   */
  const resolve = useCallback(
    (
      clientX: number,
      clientY: number,
      shiftKey: boolean,
      from: readonly [number, number] | null,
    ): { point: [number, number]; hit: BisectorHit | null } => {
      const raw = toPaper(clientX, clientY);
      if (!from) return { point: snapWith(raw, doc), hit: null };
      if (shiftKey) return { point: constrain(from, raw), hit: null };
      const hit = tool === "draw" ? snapToBisector(from, raw, doc) : null;
      if (hit) return { point: [hit.point[0], hit.point[1]], hit };
      return { point: snapWith(raw, doc), hit: null };
    },
    [doc, snapWith, toPaper, tool],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      // Middle-drag pans everywhere on the web; without this the browser
      // starts its own autoscroll on top of ours.
      if (event.button === 1) event.preventDefault();

      // The viewport first: a second finger, a held space bar, a middle button
      // or the hand tool outranks whatever tool is selected, and a stroke in
      // progress is abandoned rather than finished where the pointer never went.
      if (panZoom.onPointerDown(event)) {
        clearStroke();
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
      pressed.current = { x: event.clientX, y: event.clientY, fresh: start === null };
      // A second press lands on a line that is already in progress; what
      // happens to it is decided on release, where the pointer finally is.
      if (start) return;

      const snapped = snapWith(point, doc);
      setStart(snapped);
      setCursor(snapped);
      setBisector(null);
    },
    [clearStroke, doc, onAssign, onErase, panZoom, px, snapWith, start, toPaper, tool],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (panZoom.onPointerMove(event)) {
        // A pinch that begins mid-stroke cancels it rather than dragging the
        // crease along with the gesture.
        clearStroke();
        return;
      }
      if (tool !== "draw" && tool !== "bisect") return;
      const { point, hit } = resolve(event.clientX, event.clientY, event.shiftKey, start);
      setCursor(point);
      setBisector(hit);
    },
    [clearStroke, panZoom, resolve, start, tool],
  );

  const finishPointer = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const wasViewport = panZoom.onPointerUp(event);
      const press = pressed.current;
      pressed.current = null;

      if (wasViewport) {
        clearStroke();
        return;
      }
      if ((tool !== "draw" && tool !== "bisect") || !start) return;

      const travelled = press
        ? Math.hypot(event.clientX - press.x, event.clientY - press.y)
        : Infinity;
      // The click that began the line is not also the click that ends it: this
      // is the release of the opening click, so the line stays in progress and
      // follows the pointer until the next one.
      if (press?.fresh && travelled <= CLICK_SLOP_PX) return;

      const { point: end } = resolve(event.clientX, event.clientY, event.shiftKey, start);
      // Finished where it began, which is how you take it back.
      if (Math.hypot(end[0] - start[0], end[1] - start[1]) <= px(HIT_PX)) {
        clearStroke();
        return;
      }

      if (tool === "bisect") {
        const crease = perpendicularBisector(start, end);
        if (crease) onDraw({ ...crease, assignment });
      } else {
        onDraw({ x1: start[0], y1: start[1], x2: end[0], y2: end[1], assignment });
      }
      clearStroke();
    },
    [assignment, clearStroke, onDraw, panZoom, px, resolve, start, tool],
  );

  /**
   * The crease as it would land if the pointer stopped here.
   *
   * For the bisector tool that is not the line between the two points at all —
   * it is the crease that folds one onto the other, which is the whole point of
   * the tool: you get the midpoint without ever measuring one.
   */
  const preview = useMemo(() => {
    if (!start || !cursor) return null;
    if (tool === "bisect") return perpendicularBisector(start, cursor);
    return { x1: start[0], y1: start[1], x2: cursor[0], y2: cursor[1] };
  }, [cursor, start, tool]);

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

        {/* The two points being folded together, and the midpoint the crease
            will pass through. Thin and grey: it is the measurement, not the
            fold, and it does not survive the click. */}
        {tool === "bisect" && start && cursor && (
          <g stroke="var(--text-muted)" strokeWidth={px(1)} opacity={0.7}>
            <line
              x1={start[0]}
              y1={1 - start[1]}
              x2={cursor[0]}
              y2={1 - cursor[1]}
              strokeDasharray={`${px(3)} ${px(4)}`}
            />
            <circle
              cx={(start[0] + cursor[0]) / 2}
              cy={1 - (start[1] + cursor[1]) / 2}
              r={px(3.5)}
              fill="var(--text-muted)"
            />
          </g>
        )}

        {/* The crease being drawn, dashed until it is committed. */}
        {preview && (
          <line
            x1={preview.x1}
            y1={1 - preview.y1}
            x2={preview.x2}
            y2={1 - preview.y2}
            stroke={KAMIBASE_DISPLAY_PALETTE[assignment]}
            strokeWidth={px(CREASE_PX)}
            strokeDasharray={`${px(8)} ${px(6)}`}
            strokeLinecap="round"
          />
        )}

        {/* Equal-angle marks, the way they are drawn on paper: one arc across
            each half of the angle with a tick through it. They are what turns
            "the line jumped" into "the line found the bisector". */}
        {start && bisector && (
          <BisectorMark at={start} hit={bisector} radius={px(ARC_PX)} width={px(1.4)} />
        )}

        {/* Snap indicator: without it, snapping feels like drift. */}
        {cursor && (tool === "draw" || tool === "bisect") && (
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

/**
 * The two equal angles a snapped crease sits between.
 *
 * Drawn the way a draughtsman draws them: an arc across each half of the angle
 * and a tick through each arc, which is the notation for "these two are the
 * same". Everything is in paper units divided by the scale by the caller, so
 * the mark is the same size on screen at any zoom, and `1 - y` because the
 * sheet's y runs up while the SVG's runs down.
 */
function BisectorMark({
  at,
  hit,
  radius,
  width,
}: {
  readonly at: readonly [number, number];
  readonly hit: BisectorHit;
  readonly radius: number;
  readonly width: number;
}) {
  const from = hit.between[0];
  // `between` was normalised, so the winding has to be recovered: the angle is
  // the one swept anticlockwise from the first crease to the second.
  const span = (((hit.between[1] - from) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const half = span / 2;

  const point = (angle: number, r: number): [number, number] => [
    at[0] + Math.cos(angle) * r,
    1 - (at[1] + Math.sin(angle) * r),
  ];

  const arc = (start: number, end: number): string => {
    const steps = Math.max(6, Math.round((Math.abs(end - start) / Math.PI) * 24));
    const points: string[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const [x, y] = point(start + ((end - start) * i) / steps, radius);
      points.push(`${x},${y}`);
    }
    return points.join(" ");
  };

  /** A short tick across the arc, marking the two halves as equal. */
  const tick = (angle: number): { x1: number; y1: number; x2: number; y2: number } => {
    const [x1, y1] = point(angle, radius - width * 2.5);
    const [x2, y2] = point(angle, radius + width * 2.5);
    return { x1, y1, x2, y2 };
  };

  return (
    <g
      stroke="var(--brand-strong)"
      strokeWidth={width}
      fill="none"
      strokeLinecap="round"
      pointerEvents="none"
    >
      <polyline points={arc(from, from + half)} />
      <polyline points={arc(from + half, from + span)} />
      <line {...tick(from + half / 2)} />
      <line {...tick(from + half + half / 2)} />
    </g>
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
  if (tool === "draw" || tool === "bisect") return "crosshair";
  return "pointer";
}
