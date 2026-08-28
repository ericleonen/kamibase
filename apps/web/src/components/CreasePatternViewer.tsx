"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Expand, Shrink } from "lucide-react";
import type { EdgeAssignment } from "@kamibase/core";
import { ZoomControls } from "@/components/viewport/ZoomControls";
import { useModifierLabel } from "@/lib/viewport/platform";
import { ZOOM_STEP, usePanZoom } from "@/lib/viewport/use-pan-zoom";

const LAYERS: { key: EdgeAssignment; label: string; swatch: string }[] = [
  { key: "M", label: "Mountain", swatch: "#ff0000" },
  { key: "V", label: "Valley", swatch: "#0000ff" },
  { key: "B", label: "Boundary", swatch: "#000000" },
  { key: "F", label: "Flat", swatch: "#ffff00" },
  { key: "U", label: "Unassigned", swatch: "#ff00ff" },
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
   * letterboxes rather than stretching, so capping the height costs nothing but
   * some side margin.
   */
  readonly frameClassName?: string;
}

/**
 * The crease pattern viewer from DESIGN.md §8.3: pan, zoom, layer toggles for
 * M/V/B, and print-to-scale.
 *
 * The SVG itself is rendered on the server by `@kamibase/core`, the same
 * renderer that makes thumbnails at ingest. This component only handles
 * interaction. Layer toggling works because the renderer tags one `<path>` per
 * assignment with `data-assignment`, so hiding a layer is one CSS rule rather
 * than a re-render.
 *
 * The interaction model is deliberately the one every map and design tool
 * shares, and it is chosen around the fact that this viewer lives *inside a
 * scrolling page*:
 *
 *   - a plain scroll belongs to the page, always. A canvas that eats the wheel
 *     turns a pattern into a scroll trap.
 *   - ctrl/⌘+scroll, and trackpad pinch, zoom about the pointer.
 *   - drag with a mouse pans; one finger scrolls the page and two fingers pan
 *     and pinch, which is what a phone user expects from an embedded map.
 *   - fullscreen hands the whole viewport over, and only then does a plain
 *     scroll pan the canvas, because there is no longer a page behind it.
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
  /** "⌘+scroll to zoom", shown only to someone who just tried a plain scroll. */
  const [hint, setHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<HTMLDivElement | null>(null);
  const modifier = useModifierLabel();

  const panZoom = usePanZoom({
    contentWidth: CONTENT,
    contentHeight: CONTENT,
    padding: 8,
    minZoom: 0.4,
    maxZoom: 24,
    // Only once the viewer owns the screen does a plain scroll belong to it.
    capturePlainWheel: expanded,
    dragToPan: true,
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

  const flashHint = useCallback(() => {
    setHint(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(false), 1400);
  }, []);
  useEffect(() => () => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
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
    [fit, panZoom],
  );

  const hiddenRules = [...hidden]
    .map((key) => `#${styleId} [data-assignment="${key}"]{display:none}`)
    .join("");

  const cursor = panZoom.panning ? "grabbing" : "grab";

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
        tabIndex={0}
        aria-label={`Crease pattern for ${title}. Drag to pan, ctrl or command and scroll to zoom.`}
        className={`print-sheet relative touch-pan-y overflow-hidden border outline-none ${
          overlay ? "fixed inset-0 z-50 h-[100dvh] w-screen rounded-none" : ""
        } ${expanded && !overlay ? "h-screen w-screen rounded-none" : ""} ${
          expanded ? "" : "aspect-square w-full rounded-[var(--radius-card)]"
        }`}
        style={{
          borderColor: "var(--border)",
          // Paper, not a card: the crease colours only read on white. See
          // the note at the top of globals.css.
          background: "var(--paper)",
          cursor,
          touchAction: expanded ? "none" : "pan-y",
          ...(printSizeMm ? { ["--print-size-mm" as string]: `${printSizeMm}mm` } : {}),
        }}
        onPointerDown={panZoom.onPointerDown}
        onPointerMove={panZoom.onPointerMove}
        onPointerUp={panZoom.onPointerUp}
        onPointerCancel={panZoom.onPointerUp}
        onKeyDown={onKeyDown}
        onDoubleClick={(event) => {
          panZoom.zoomBy(event.altKey ? 1 / 2 : 2, {
            x: event.clientX - (frame.current?.getBoundingClientRect().left ?? 0),
            y: event.clientY - (frame.current?.getBoundingClientRect().top ?? 0),
          });
        }}
        onWheel={(event) => {
          // The hook has already decided; this only explains the decision.
          if (!expanded && !event.ctrlKey && !event.metaKey) flashHint();
        }}
      >
        <div
          className="kami-pan-layer absolute left-0 top-0 origin-top-left"
          style={{
            width: CONTENT,
            height: CONTENT,
            transform: panZoom.cssTransform,
            willChange: "transform",
          }}
        >
          <div
            id={styleId}
            role="img"
            aria-label={`Crease pattern for ${title}`}
            className="size-full [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>

        <div className="print-hidden pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
          <div
            className={`pointer-events-none rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity duration-200 ${
              hint ? "opacity-100" : "opacity-0"
            }`}
            style={{ background: "var(--ink)", color: "var(--surface)" }}
            aria-hidden
          >
            Hold {modifier} and scroll to zoom
          </div>
        </div>

        <ZoomControls
          className="print-hidden absolute bottom-3 right-3"
          zoom={panZoom.zoom}
          onZoomIn={() => panZoom.zoomBy(ZOOM_STEP)}
          onZoomOut={() => panZoom.zoomBy(1 / ZOOM_STEP)}
          onFit={fit}
        >
          <button
            type="button"
            onClick={toggleExpanded}
            title={expanded ? "Exit fullscreen" : "Fullscreen"}
            aria-label={expanded ? "Exit fullscreen" : "Fullscreen"}
            className="flex size-8 items-center justify-center rounded-full transition hover:opacity-60"
            style={{ color: "var(--text-muted)" }}
          >
            {expanded ? (
              <Shrink className="size-4" aria-hidden />
            ) : (
              <Expand className="size-4" aria-hidden />
            )}
          </button>
        </ZoomControls>
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

