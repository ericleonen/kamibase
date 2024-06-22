// Two numbers are equal if they are equal up to PRECISION decimal places.
export const PRECISION = 13;

/**
 * The Kami Canvas has KAMI_PIXELS x KAMI_PIXELS pixels.
 */
export const KAMI_PIXELS = 1000;

/**
 * The Kami Canvas is padded with PADDING pixels.
 */
export const PADDING = 20;

/**
 * Your mouse hovers a Vertex or Crease if the mouse is within HOVER_RADIUS of it.
 */
export const HOVER_RADIUS = 10;

/**
 * A selected Vertex has radius SELECTED_VERTEX_RADIUS.
 */
export const SELECTED_VERTEX_RADIUS = 4;

/**
 * A hovered Vertex has radius HOVERED_VERTEX_RADIUS;
 */
export const HOVERED_VERTEX_RADIUS = 6;

/**
 * A Crease is normally rendered with CREASE_WIDTH.
 */
export const CREASE_WIDTH = 2;

/**
 * A Crease grows to line width HOVER_CREASE_WIDTH if hovered (with eraser tool).
 */
export const HOVER_CREASE_WIDTH = 10;

/**
 * A border Crease has line width KAMI_BORDER_WIDTH.
 */
export const KAMI_BORDER_WIDTH = 3;

/**
 * It takes KAMI_ROTATION_DURATION seconds to rotate the Kami 90° right or left.
 */
export const KAMI_ROTATION_DURATION = 0.3;

/**
 * The zoom in and out buttons change the size of the Kami by intervals of KAMI_ZOOM_DELTA pixels.
 */
export const KAMI_ZOOM_DELTA = 100;

/**
 * It takes KAMI_ZOOM_DURATION seconds to zoom in and out when using the zoom buttons.
 */
export const KAMI_ZOOM_DURATION = 0.25;

/**
 * The dimensions of a Kami will be in the range of KAMI_DIMS_RANGE.
 */
export const KAMI_DIMS_RANGE = [300, 700];