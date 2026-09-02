"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Expand, Shrink } from "lucide-react";
import { KAMIBASE_DISPLAY_PALETTE, type EdgeAssignment } from "@kamibase/core";
import { ZoomControls } from "@/components/viewport/ZoomControls";
import { ZOOM_STEP, usePanZoom } from "@/lib/viewport/use-pan-zoom";

const LAYERS: { key: EdgeAssignment; label: string }[] = [
  { key: "M", label: "Mountain" },
  { key: "V", label: "Valley" },
  { key: "B", label: "Boundary" },
  { key: "F", label: "Flat" },
  { key: "U", label: "Unassigned" },
];

/**
 * The pattern's own coordinate space, in "pixels". `renderViewerSvg` renders
 * at size 1000, and the SVG keeps its own aspect ratio inside this square box,
 * so a non-square pattern letterboxes rather than stretching.
 */
const CONTENT = 1000;

/** How far the arrow keys pan, in CSS pixels. */
const KEY_PAN = 48;

export interface CreasePatternViewerProps {
  /** Pre-rendered SVG from `@kamibase/core`'s renderSvg. */
  readonly svg: string;
  /** Assignments actually present, so we only offer toggles that do something. */
  readonly present: readonly EdgeAssignment[];
  /** `kami:paper.recommendedSizeMm`, for print-to-scale. */
  readonly printSizeMm?: number;
  readonly title: string;
  /**
   * Sizing for the frame when it is not expanded.
   *
   * A square filling its column is the right default for a browsing surface
   * and the wrong one inside a reading column, where 48rem square is the whole
   * screen on a laptop. The pattern is fitted into whatever box it is given and
   * letterboxes rather than stretching, so capping the size costs nothing but
   * some side margin.
   */
  readonly frameClassName?: string;
}

/**
 * The crease pattern viewer from DESIGN.md §8.3: layer toggles for M/V/B,
 * print-to-scale, and pan and zoom once it has the screen.
 *
 * The SVG itself is rendered on the server by `@kamibase/core`, the same
 * renderer that makes thumbnails at ingest. This component only handles
 * interaction. Layer toggling works because the renderer tags one `<path>` per
 * assignment with `data-assignment`, so hiding a layer is one CSS rule rather
 * than a re-render.
 *
 * On the page it is a picture, not a canvas. It used to pan and zoom in place,
 * which meant a viewer sitting in a scrolling page had to negotiate with the
 * page for every gesture: a plain scroll belonged to the page but ctrl+scroll
 * did not, a drag panned but a touch-drag scrolled, and the whole arrangement
 * needed a floating zoom pill and a tooltip explaining the modifier. Nobody
 * arrives at a pattern wanting to pan it eight pixels. They want to see it, and
 * then some of them want to see it big. So: fitted in its box, inert, with one
 * button — and everything the canvas could do is waiting on the other side of
 * it, where there is no page left to argue with.
 */
export function CreasePatternViewer({
  svg,
  present,
  printSizeMm,
  title,
  frameClassName = "aspect-square w-full",
}: CreasePatternViewerProps) {
  const styleId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [hidden, setHidden] = useState<ReadonlySet<EdgeAssignment>>(new Set());
  /** True in real fullscreen *or* the CSS fallback, which iOS Safari needs. */
  const [expanded, setExpanded] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const frame = useRef<HTMLDivElement | null>(null);

  const panZoom = usePanZoom({
    contentWidth: CONTENT,
    contentHeight: CONTENT,
    padding: 8,
    minZoom: 0.4,
    maxZoom: 24,
    // Every gesture is the viewer's, because by the time any of them are
    // listened to there is no page behind it to take one.
    capturePlainWheel: expanded,
    dragToPan: expanded,
    touch: expanded ? "capture" : "page",
  });

  const { ref: measureRef, fit } = panZoom;
  const setFrame = useCallback(
    (node: HTMLDivElement | null) => {
      frame.current = node;
      return measureRef(node);
    },
    [measureRef],
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

  /* Fullscreen can also be left with Escape, which fires no click of ours. */
  useEffect(() => {
    const onChange = (): void => {
      const real = document.fullscreenElement !== null;
      setExpanded(real || overlay);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [overlay]);

  useEffect(() => {
    if (!overlay) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      setOverlay(false);
      setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlay]);

  // Opening the viewer starts it fitted rather than wherever the last visit
  // left it, and the measurement it fits to is the screen it just took.
  useEffect(() => {
    if (!expanded) return;
    const id = requestAnimationFrame(() => fit());
    return () => cancelAnimationFrame(id);
  }, [expanded, fit]);

  const toggleExpanded = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      setExpanded(false);
      return;
    }
    if (overlay) {
      setOverlay(false);
      setExpanded(false);
      return;
    }
    const node = frame.current;
    if (node?.requestFullscreen) {
      node
        .requestFullscreen()
        .then(() => setExpanded(true))
        .catch(() => {
          // iOS Safari refuses fullscreen on anything but a <video>. The CSS
          // overlay gets the same screen without it.
          setOverlay(true);
          setExpanded(true);
        });
      return;
    }
    setOverlay(true);
    setExpanded(true);
  }, [overlay]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!expanded) return;
      const step = event.shiftKey ? KEY_PAN * 4 : KEY_PAN;
      const pan = (dx: number, dy: number): void => {
        event.preventDefault();
        panZoom.panBy(dx, dy);
      };
      switch (event.key) {
        case "+":
        case "=":
          event.preventDefault();
          panZoom.zoomBy(ZOOM_STEP);
          break;
        case "-":
        case "_":
          event.preventDefault();
          panZoom.zoomBy(1 / ZOOM_STEP);
          break;
        case "0":
          event.preventDefault();
          fit();
          break;
        case "ArrowLeft":
          pan(step, 0);
          break;
        case "ArrowRight":
          pan(-step, 0);
          break;
        case "ArrowUp":
          pan(0, step);
          break;
        case "ArrowDown":
          pan(0, -step);
          break;
        default:
          break;
      }
    },
    [expanded, fit, panZoom],
  );

  const hiddenRules = [...hidden]
    .map((key) => `#${styleId} [data-assignment="${key}"]{display:none}`)
    .join("");

  /* The picture. One node, drawn two ways: fitted to its box on the page, and
     inside a pan layer that is 1000px square once the viewer owns the screen.
     Both letterbox rather than stretch. */
  const picture = (
    <div
      id={styleId}
      role="img"
      aria-label={`Crease pattern for ${title}`}
      className="size-full [&>svg]:h-full [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );

  return (
    /*
     * No `m-0` here, however much a `<figure>` looks like it needs one.
     *
     * Preflight already zeroes the user agent's `1em 40px`, so it was doing
     * nothing it was meant to do and one thing it was not: Tailwind's
     * `space-y-*` is a zero-specificity `:where()` rule, so a class on the child
     * outranks it, and the viewer sat flush against whatever the page put under
     * it. On a pattern page that was "Fold it in 3D" touching the layer
     * toggles.
     */
    <figure>
      <style>{hiddenRules}</style>

      <div
        ref={setFrame}
        {...(expanded ? { tabIndex: 0 } : {})}
        {...(expanded
          ? { "aria-label": `Crease pattern for ${title}. Drag to pan, scroll to zoom.` }
          : {})}
        className={`print-sheet relative overflow-hidden border outline-none ${
          overlay ? "fixed inset-0 z-50 h-[100dvh] w-screen rounded-none" : ""
        } ${expanded && !overlay ? "h-screen w-screen rounded-none" : ""} ${
          expanded ? "" : `${frameClassName} rounded-[var(--radius-card)]`
        }`}
        style={{
          borderColor: "var(--border)",
          // Paper, not a card: the crease colours only read on white. See
          // the note at the top of globals.css.
          background: "var(--paper)",
          ...(expanded
            ? { cursor: panZoom.panning ? "grabbing" : "grab", touchAction: "none" }
            : {}),
          ...(printSizeMm ? { ["--print-size-mm" as string]: `${printSizeMm}mm` } : {}),
        }}
        {...(expanded
          ? {
              onPointerDown: panZoom.onPointerDown,
              onPointerMove: panZoom.onPointerMove,
              onPointerUp: panZoom.onPointerUp,
              onPointerCancel: panZoom.onPointerUp,
              onKeyDown,
              onDoubleClick: (event: React.MouseEvent) => {
                panZoom.zoomBy(event.altKey ? 1 / 2 : 2, {
                  x: event.clientX - (frame.current?.getBoundingClientRect().left ?? 0),
                  y: event.clientY - (frame.current?.getBoundingClientRect().top ?? 0),
                });
              },
            }
          : {})}
      >
        {expanded ? (
          <div
            className="kami-pan-layer absolute left-0 top-0 origin-top-left"
            style={{
              width: CONTENT,
              height: CONTENT,
              transform: panZoom.cssTransform,
              willChange: "transform",
            }}
          >
            {picture}
          </div>
        ) : (
          <div className="kami-fit-layer absolute inset-2">{picture}</div>
        )}

        {expanded ? (
          /*
           * The controls take their own pointer events out of the canvas's
           * hands, and this is not a nicety.
           *
           * A press anywhere in the frame starts a pan, and starting a pan
           * means `setPointerCapture` on the frame. Once the frame holds the
           * capture the pointerup is retargeted to it, so the browser fires the
           * `click` at the frame rather than at whatever was under the finger —
           * and every button inside, the way out of fullscreen included, stops
           * responding. Stopping the press here means no capture is taken, so
           * the click lands where it was aimed.
           */
          <div
            className="print-hidden absolute bottom-4 right-4"
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <ZoomControls
              zoom={panZoom.zoom}
              onZoomIn={() => panZoom.zoomBy(ZOOM_STEP)}
              onZoomOut={() => panZoom.zoomBy(1 / ZOOM_STEP)}
              onFit={fit}
            >
              <FrameButton label="Exit fullscreen" onClick={toggleExpanded}>
                <Shrink className="size-4" aria-hidden />
              </FrameButton>
            </ZoomControls>
          </div>
        ) : (
          <div
            className="print-hidden absolute bottom-3 right-3 rounded-full p-1"
            style={{ background: "var(--surface-raised)", boxShadow: "var(--shadow-card)" }}
          >
            <FrameButton label="View full screen" onClick={toggleExpanded}>
              <Expand className="size-4" aria-hidden />
            </FrameButton>
          </div>
        )}
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
                style={{ background: KAMIBASE_DISPLAY_PALETTE[layer.key], borderColor: "var(--border)" }}
              />
              {layer.label}
            </label>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
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

function FrameButton({
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
