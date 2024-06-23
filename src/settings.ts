// Two numbers are equal if they are equal up to PRECISION decimal places.
export const PRECISION = 13;

/**
 * For every HTML pixel, there are PIXELS_DENSITY Canvas pixels.
 */
export const PIXEL_DENSITY = 2;

/**
 * The Kami Canvas is padded with PADDING HTML pixels.
 */
export const PADDING = 20;

/**
 * Your mouse hovers a Vertex or Crease if the mouse is within HOVER_RADIUS Canvas pixels of it.
 */
export const HOVER_RADIUS = 10;

/**
 * A selected Vertex has radius SELECTED_VERTEX_RADIUS Canvas pixels.
 */
export const SELECTED_VERTEX_RADIUS = 4;

/**
 * A hovered Vertex has radius HOVERED_VERTEX_RADIUS Canvas pixels;
 */
export const HOVERED_VERTEX_RADIUS = 6;

/**
 * A Crease is normally rendered with width CREASE_WIDTH Canvas pixels.
 */
export const CREASE_WIDTH = 2;

/**
 * A Crease grows to line width HOVER_CREASE_WIDTH Canvas pixels if hovered (with eraser tool).
 */
export const HOVER_CREASE_WIDTH = 10;

/**
 * A border Crease has line width KAMI_BORDER_WIDTH Canvas pixels.
 */
export const KAMI_BORDER_WIDTH = 3;

/**
 * The zoom in and out buttons change the size of the Kami by intervals of KAMI_ZOOM_DELTA HTML
 * pixels.
 */
export const KAMI_ZOOM_DELTA = 100;

/**
 * The dimensions of a Kami will be in the range of KAMI_DIMS_RANGE HTML pixels.
 */
export const KAMI_DIMS_RANGE = [300, 700];

/**
 * The default dimensions of a Kami will be DEFAULT_KAMI_DIMS HTML pixels.
 */
export const DEFAULT_KAMI_DIMS = 500;