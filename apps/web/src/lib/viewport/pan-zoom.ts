/**
 * The pan/zoom maths behind every canvas on the site: the crease pattern
 * viewer and the editor.
 *
 * Everything here is pure, because the interesting part of a viewport is
 * arithmetic and the fiddly part of getting one right, "zoom towards the
 * cursor, not towards the middle", is a two-line invariant that is very easy
 * to get subtly wrong and impossible to eyeball afterwards. Pure functions can
 * be tested; a `useState` inside a pointer handler cannot.
 *
 * One convention throughout: a `Viewport` maps *world* coordinates (the
 * pattern's own units) to *box* coordinates (CSS pixels from the top-left of
 * the element showing it):
 *
 *     box = world * scale + (x, y)
 *
 * which is exactly `translate(x, y) scale(scale)` with a `0 0` transform
 * origin, so the same numbers drive a CSS transform, an SVG group transform
 * and the hit testing without any of the three having to agree by hand.
 */

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Space to leave around the content when fitting it.
 *
 * Per-side rather than a single number because the chrome floats *over* the
 * canvas: a dock at the bottom and a panel on the right are not "padding", they
 * are parts of the box you cannot see through. Fitting into the middle of the
 * box and hoping is how a drawing ends up half under a toolbar.
 */
export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export type Padding = number | Partial<Insets>;

export function resolveInsets(padding: Padding): Insets {
  if (typeof padding === "number") {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  return {
    top: padding.top ?? 0,
    right: padding.right ?? 0,
    bottom: padding.bottom ?? 0,
    left: padding.left ?? 0,
  };
}

export interface Viewport {
  /** Box-space offset of the world origin, in CSS pixels. */
  readonly x: number;
  readonly y: number;
  /** Box pixels per world unit. */
  readonly scale: number;
}

export const IDENTITY_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 };

/**
 * How far one wheel notch zooms. Wheel deltas differ wildly between a mouse
 * (±100 per notch), a trackpad (a stream of small deltas) and a pinch
 * gesture (a stream of tiny ctrl-deltas), so the factor is exponential in the
 * delta: that makes the *rate* of zoom consistent across all three, and makes
 * zooming reversible: scroll up N and back down N and you are where you
 * started, which linear steps do not give you.
 */
const ZOOM_PER_PIXEL = 0.0025;

/** A wheel notch on a mouse, roughly, for one line of `deltaMode: 1`. */
const LINE_HEIGHT = 16;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The scale at which `content` exactly fills `box`, less `padding`. */
export function fitScale(content: Size, box: Size, padding: Padding = 0): number {
  const insets = resolveInsets(padding);
  const usableWidth = Math.max(box.width - insets.left - insets.right, 1);
  const usableHeight = Math.max(box.height - insets.top - insets.bottom, 1);
  const width = Math.max(content.width, Number.EPSILON);
  const height = Math.max(content.height, Number.EPSILON);
  return Math.min(usableWidth / width, usableHeight / height);
}

/** `content`, scaled to fit `box` and centred in what `padding` leaves of it. */
export function fitViewport(content: Size, box: Size, padding: Padding = 0): Viewport {
  const insets = resolveInsets(padding);
  const scale = fitScale(content, box, padding);
  const usableWidth = Math.max(box.width - insets.left - insets.right, 1);
  const usableHeight = Math.max(box.height - insets.top - insets.bottom, 1);
  return {
    scale,
    x: insets.left + (usableWidth - content.width * scale) / 2,
    y: insets.top + (usableHeight - content.height * scale) / 2,
  };
}

/**
 * Zoom by `factor` about `anchor` (a point in box space), holding the world
 * point under the anchor still.
 *
 * This is the whole trick of a canvas that feels good: zoom about the pointer
 * and the thing you are looking at stays under the pointer, so you can dive
 * into a corner of a tessellation in one gesture. Zoom about the centre, the
 * old behaviour, and every zoom needs a corrective pan, which is why zooming
 * into anything off-centre used to mean chasing it around the box.
 */
export function zoomViewport(
  view: Viewport,
  anchor: Point,
  factor: number,
  minScale: number,
  maxScale: number,
): Viewport {
  const scale = clamp(view.scale * factor, minScale, maxScale);
  // Recomputed rather than assumed: clamping at the limits changes the factor,
  // and using the requested one there would drift the anchor every event.
  const applied = scale / view.scale;
  return {
    scale,
    x: anchor.x - (anchor.x - view.x) * applied,
    y: anchor.y - (anchor.y - view.y) * applied,
  };
}

/** Move the content by a box-space delta. */
export function panViewport(view: Viewport, dx: number, dy: number): Viewport {
  return { ...view, x: view.x + dx, y: view.y + dy };
}

/** Box space -> world space. */
export function toWorld(view: Viewport, point: Point): Point {
  return { x: (point.x - view.x) / view.scale, y: (point.y - view.y) / view.scale };
}

/** World space -> box space. */
export function toBox(view: Viewport, point: Point): Point {
  return { x: point.x * view.scale + view.x, y: point.y * view.scale + view.y };
}

/**
 * Keep the world point at the centre of the box centred when the box resizes.
 * Without this, opening the properties panel or rotating a phone slides the
 * drawing sideways.
 */
export function recentreViewport(view: Viewport, from: Size, to: Size): Viewport {
  return {
    ...view,
    x: view.x + (to.width - from.width) / 2,
    y: view.y + (to.height - from.height) / 2,
  };
}

export type WheelIntent =
  | { readonly kind: "none" }
  | { readonly kind: "zoom"; readonly factor: number }
  | { readonly kind: "pan"; readonly dx: number; readonly dy: number };

export interface WheelEventLike {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaMode: number;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}

export interface WheelOptions {
  /**
   * Whether a plain (unmodified) wheel belongs to the canvas or to the page.
   *
   * This is the setting that makes an embedded viewer usable. A canvas that
   * swallows every wheel event traps the page: you scroll past a pattern and
   * the page stops dead while the pattern zooms. So embedded viewers set this
   * `false` and only claim the gestures that unambiguously mean "zoom this"
   * (ctrl/⌘+wheel and trackpad pinch) exactly as Google Maps and Figma's own
   * embeds do. The fullscreen editor sets it `true`, because there is no page
   * behind it to scroll.
   */
  readonly capturePlainWheel: boolean;
  /** Used for `deltaMode: 2` (page) deltas. */
  readonly box: Size;
}

/**
 * What a wheel event means for a canvas.
 *
 * Browsers report a trackpad pinch as a wheel event with `ctrlKey` set and no
 * key pressed, which is why pinch and ctrl+wheel are deliberately the same
 * branch rather than two.
 */
export function readWheel(event: WheelEventLike, options: WheelOptions): WheelIntent {
  const unit =
    event.deltaMode === 1 ? LINE_HEIGHT : event.deltaMode === 2 ? options.box.height || 1 : 1;
  const dx = event.deltaX * unit;
  const dy = event.deltaY * unit;

  if (event.ctrlKey || event.metaKey) {
    if (dy === 0) return { kind: "none" };
    return { kind: "zoom", factor: Math.exp(-dy * ZOOM_PER_PIXEL) };
  }

  if (!options.capturePlainWheel) return { kind: "none" };
  if (dx === 0 && dy === 0) return { kind: "none" };

  // Shift+wheel is the long-standing "scroll sideways" gesture, and a mouse
  // with one wheel has no other way to pan horizontally.
  if (event.shiftKey && dx === 0) return { kind: "pan", dx: -dy, dy: 0 };
  return { kind: "pan", dx: -dx, dy: -dy };
}

/** Zoom factor for a discrete step, e.g. a button or a keyboard shortcut. */
export const ZOOM_STEP = 1.25;
