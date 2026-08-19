"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IDENTITY_VIEWPORT,
  ZOOM_STEP,
  clamp,
  fitScale,
  fitViewport,
  resolveInsets,
  panViewport,
  readWheel,
  recentreViewport,
  toWorld,
  zoomViewport,
  type Padding,
  type Point,
  type Size,
  type Viewport,
} from "./pan-zoom";

export interface UsePanZoomOptions {
  /** Size of the thing being shown, in its own units. */
  readonly contentWidth: number;
  readonly contentHeight: number;
  /**
   * Breathing room around the content when fitted, in CSS pixels: one number,
   * or per side when floating chrome covers part of the box.
   */
  readonly padding?: Padding;
  /** Zoom limits, as multiples of the fit scale. `1` is "fits the box". */
  readonly minZoom?: number;
  readonly maxZoom?: number;
  /** See `WheelOptions.capturePlainWheel`. Default `false`: the page keeps its scroll. */
  readonly capturePlainWheel?: boolean;
  /** Dragging with the primary button pans, with no modifier held. */
  readonly dragToPan?: boolean;
  /**
   * Hold space to pan, Figma's oldest muscle memory. Off by default: the
   * listener is on the window, and a viewer embedded in a page has no right to
   * take the space bar away from that page's scrolling.
   */
  readonly spaceToPan?: boolean;
  /**
   * What a single finger does. `"page"` leaves it to the page, which is the
   * only sane answer for a viewer embedded in a scrolling article; two fingers
   * still pan and pinch. `"capture"` is for surfaces that own the screen.
   */
  readonly touch?: "capture" | "page";
}

export interface PanZoom {
  /**
   * Attach to the element that defines the box. Measures it and owns its
   * wheel. Returns React 19's ref cleanup, so pass it straight through if you
   * wrap it.
   */
  readonly ref: (node: HTMLElement | SVGElement | null) => (() => void) | void;
  readonly view: Viewport;
  readonly box: Size;
  /** Zoom relative to the fit scale: `1` means "the whole thing, fitted". */
  readonly zoom: number;
  readonly panning: boolean;
  /** Space is held, so a drag would pan. Consumers use it for the cursor. */
  readonly panReady: boolean;
  readonly cssTransform: string;
  readonly svgTransform: string;
  readonly toWorld: (clientX: number, clientY: number) => Point;
  readonly zoomBy: (factor: number, anchor?: Point) => void;
  readonly zoomTo: (zoom: number) => void;
  readonly panBy: (dx: number, dy: number) => void;
  readonly fit: () => void;
  /** Each returns `true` when the gesture belongs to the viewport, not to you. */
  readonly onPointerDown: (event: React.PointerEvent) => boolean;
  readonly onPointerMove: (event: React.PointerEvent) => boolean;
  readonly onPointerUp: (event: React.PointerEvent) => boolean;
}

const EMPTY_BOX: Size = { width: 0, height: 0 };

/**
 * A Figma-shaped viewport: pinch and ctrl/⌘+scroll to zoom about the pointer,
 * two-finger scroll or space-drag or middle-drag to pan, and a fit that is a
 * single call away.
 *
 * The awkward parts it exists to hide:
 *
 *   - React attaches `wheel` passively at the root, so `preventDefault` inside
 *     an `onWheel` prop does nothing at all (and warns). The listener here is
 *     native and non-passive, which is the only way to stop the browser from
 *     page-zooming on ctrl+wheel.
 *   - Pinch arrives as a `wheel` event with `ctrlKey` set, not as a gesture.
 *   - The box changes size (panels open, phones rotate) and the drawing must
 *     not slide when it does.
 */
export function usePanZoom(options: UsePanZoomOptions): PanZoom {
  const {
    contentWidth,
    contentHeight,
    padding = 0,
    minZoom = 0.2,
    maxZoom = 40,
    capturePlainWheel = false,
    dragToPan = false,
    spaceToPan = false,
    touch = "page",
  } = options;

  const [view, setViewState] = useState<Viewport>(IDENTITY_VIEWPORT);
  const [box, setBox] = useState<Size>(EMPTY_BOX);
  const [panning, setPanning] = useState(false);
  const [panReady, setPanReady] = useState(false);

  const elementRef = useRef<HTMLElement | SVGElement | null>(null);
  const viewRef = useRef(view);
  const boxRef = useRef(box);
  const fittedRef = useRef(false);
  const spaceRef = useRef(false);
  /**
   * Has anyone moved the view by hand yet? Until they have, the fit follows the
   * box and the chrome around it — open the properties panel and the paper
   * recentres. After a single deliberate zoom it stops second-guessing them.
   */
  const touchedRef = useRef(false);

  /** Live pointers, so pinch works without a gesture library. */
  const pointers = useRef(new Map<number, Point>());
  const claimed = useRef(new Set<number>());
  const pinch = useRef<{ distance: number; centre: Point } | null>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  const setView = useCallback((next: Viewport) => {
    viewRef.current = next;
    setViewState(next);
  }, []);

  const content = useMemo<Size>(
    () => ({ width: contentWidth, height: contentHeight }),
    [contentWidth, contentHeight],
  );

  /*
   * Held by value, not by identity: callers pass `{ bottom: 88, ... }` inline,
   * and a fresh object every render would make `fit` a fresh function every
   * render, which the auto-fit effect below would take as news.
   */
  const { top, right, bottom, left } = resolveInsets(padding);
  const insets = useMemo(
    () => ({ top, right, bottom, left }),
    [top, right, bottom, left],
  );

  const scaleLimits = useCallback((): { min: number; max: number } => {
    const base = fitScale(content, boxRef.current, insets);
    return { min: base * minZoom, max: base * maxZoom };
  }, [content, insets, maxZoom, minZoom]);

  const fit = useCallback(() => {
    if (boxRef.current.width === 0) return;
    fittedRef.current = true;
    setView(fitViewport(content, boxRef.current, insets));
  }, [content, insets, setView]);

  /** Client coordinates -> box coordinates. */
  const toLocal = useCallback((clientX: number, clientY: number): Point => {
    const rect = elementRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const zoomBy = useCallback(
    (factor: number, anchor?: Point) => {
      touchedRef.current = true;
      const { min, max } = scaleLimits();
      const point = anchor ?? {
        x: boxRef.current.width / 2,
        y: boxRef.current.height / 2,
      };
      setView(zoomViewport(viewRef.current, point, factor, min, max));
    },
    [scaleLimits, setView],
  );

  const zoomTo = useCallback(
    (zoom: number) => {
      if (boxRef.current.width === 0) return;
      const base = fitScale(content, boxRef.current, insets);
      const target = clamp(base * zoom, base * minZoom, base * maxZoom);
      zoomBy(target / viewRef.current.scale);
    },
    [content, insets, maxZoom, minZoom, zoomBy],
  );

  const panBy = useCallback(
    (dx: number, dy: number) => {
      touchedRef.current = true;
      setView(panViewport(viewRef.current, dx, dy));
    },
    [setView],
  );

  /*
   * The wheel listener lives here, natively and non-passively, because a React
   * `onWheel` cannot preventDefault. Kept in a ref so the listener itself is
   * registered once per element rather than on every render.
   */
  const wheelRef = useRef<(event: WheelEvent) => void>(() => {});
  wheelRef.current = (event: WheelEvent) => {
    const intent = readWheel(event, { capturePlainWheel, box: boxRef.current });
    if (intent.kind === "none") return;
    // Only now: an unclaimed wheel is the page's, and swallowing it is what
    // makes an embedded viewer feel like a trap.
    event.preventDefault();
    if (intent.kind === "zoom") {
      zoomBy(intent.factor, toLocal(event.clientX, event.clientY));
      return;
    }
    panBy(intent.dx, intent.dy);
  };

  const ref = useCallback((node: HTMLElement | SVGElement | null) => {
    elementRef.current = node;
    if (!node) return;

    // Typed as `Event` because `node` is a union of element types, which
    // collapses addEventListener's per-name overloads.
    const onWheel = (event: Event): void => wheelRef.current(event as WheelEvent);
    node.addEventListener("wheel", onWheel, { passive: false });

    const measure = (): void => {
      const rect = node.getBoundingClientRect();
      const next: Size = { width: rect.width, height: rect.height };
      const previous = boxRef.current;
      if (next.width === previous.width && next.height === previous.height) return;
      boxRef.current = next;
      setBox(next);
      if (previous.width > 0 && previous.height > 0 && fittedRef.current) {
        setView(recentreViewport(viewRef.current, previous, next));
      }
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
      node.removeEventListener("wheel", onWheel);
      elementRef.current = null;
    };
  }, [setView]);

  /* The first real measurement decides the starting view, and so does every
   * change to the box or the chrome until someone moves it themselves. */
  useEffect(() => {
    if (touchedRef.current || box.width === 0 || box.height === 0) return;
    fit();
  }, [box, fit]);

  useEffect(() => {
    if (!spaceToPan) return;
    const isTyping = (target: EventTarget | null): boolean => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      return (
        /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(element.tagName) || element.isContentEditable
      );
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code !== "Space" || event.repeat || isTyping(event.target)) return;
      event.preventDefault();
      spaceRef.current = true;
      setPanReady(true);
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code !== "Space") return;
      spaceRef.current = false;
      setPanReady(false);
    };
    const onBlur = (): void => {
      spaceRef.current = false;
      setPanReady(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [spaceToPan]);

  const capture = useCallback((event: React.PointerEvent) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Safari throws if the pointer is already gone. Nothing to recover.
    }
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent): boolean => {
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      // Two fingers is always the viewport, whatever tool is selected.
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        if (a && b) {
          pinch.current = {
            distance: Math.hypot(a.x - b.x, a.y - b.y),
            centre: toLocal((a.x + b.x) / 2, (a.y + b.y) / 2),
          };
        }
        drag.current = null;
        for (const id of pointers.current.keys()) claimed.current.add(id);
        capture(event);
        setPanning(true);
        return true;
      }
      if (pointers.current.size > 2) {
        claimed.current.add(event.pointerId);
        return true;
      }

      const isTouch = event.pointerType === "touch";
      const allowDrag = isTouch ? touch === "capture" && dragToPan : dragToPan;
      const wantsPan =
        event.button === 1 || spaceRef.current || (event.button === 0 && allowDrag);
      if (!wantsPan) return false;

      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      claimed.current.add(event.pointerId);
      capture(event);
      setPanning(true);
      return true;
    },
    [capture, dragToPan, toLocal, touch],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent): boolean => {
      if (!pointers.current.has(event.pointerId)) return false;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointers.current.size >= 2 && pinch.current) {
        touchedRef.current = true;
        const [a, b] = [...pointers.current.values()];
        if (!a || !b) return true;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const centre = toLocal((a.x + b.x) / 2, (a.y + b.y) / 2);
        const previous = pinch.current;
        const { min, max } = scaleLimits();
        // Zoom about where the fingers were, then follow where they went: two
        // fingers pinch and drag at the same time, and treating them as one
        // motion is what makes a map feel like paper.
        const zoomed = zoomViewport(
          viewRef.current,
          previous.centre,
          distance / (previous.distance || 1),
          min,
          max,
        );
        setView(panViewport(zoomed, centre.x - previous.centre.x, centre.y - previous.centre.y));
        pinch.current = { distance, centre };
        return true;
      }

      const active = drag.current;
      if (active && active.id === event.pointerId) {
        touchedRef.current = true;
        setView(
          panViewport(viewRef.current, event.clientX - active.x, event.clientY - active.y),
        );
        drag.current = { id: active.id, x: event.clientX, y: event.clientY };
        return true;
      }
      return false;
    },
    [scaleLimits, setView, toLocal],
  );

  const onPointerUp = useCallback((event: React.PointerEvent): boolean => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (drag.current?.id === event.pointerId) drag.current = null;
    if (pointers.current.size === 0) setPanning(false);
    return claimed.current.delete(event.pointerId);
  }, []);

  const zoom = box.width > 0 ? view.scale / fitScale(content, box, insets) : 1;

  return {
    ref,
    view,
    box,
    zoom,
    panning,
    panReady,
    cssTransform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
    svgTransform: `translate(${view.x} ${view.y}) scale(${view.scale})`,
    toWorld: useCallback(
      (clientX: number, clientY: number) => toWorld(viewRef.current, toLocal(clientX, clientY)),
      [toLocal],
    ),
    zoomBy,
    zoomTo,
    panBy,
    fit,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}

export { ZOOM_STEP };
