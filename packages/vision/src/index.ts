/**
 * `@kamibase/vision`: a photograph of a creased sheet of paper, turned into a
 * crease pattern.
 *
 * This is the raster half of DESIGN.md §3, and it is the hardest thing in
 * Kamibase. The pipeline is:
 *
 *   1. rectify   the sheet's four corners define a homography onto a square
 *   2. flatten   subtract the lighting, keep the creases
 *   3. edges     Canny, with thresholds taken from the image's own histogram
 *   4. lines     Hough, restricted to angles each pixel's gradient allows
 *   5. clean     merge fragments, snap to 22.5 degrees and to a lattice
 *   6. assign    Maekawa decides mountain and valley; the photo only advises
 *
 * Everything is pure TypeScript over `Float32Array`. No canvas, no OpenCV, no
 * wasm, no native build step, and no API key. That is partly about deployment
 * and mostly about testing: the suite draws crease patterns into buffers, adds
 * the lighting gradients and noise a real photograph has, and asserts the
 * pattern comes back.
 *
 * The result is a draft for a human to correct in the editor, and it says so.
 * §3.3 calls raster import best-effort with a human in the loop, and §3.4 asks
 * that anything uncertain be marked `U` rather than guessed. Both are honoured
 * literally.
 */

export {
  createGray,
  at,
  sampleBilinear,
  fromRgba,
  toRgba,
  boxBlur,
  gaussianish,
  flattenIllumination,
  normalizeContrast,
  downscale,
  sharpness,
  type GrayImage,
} from "./image.js";

export {
  detectEdges,
  edgeCount,
  edgesToGray,
  percentileThreshold,
  type EdgeMap,
  type EdgeOptions,
} from "./edges.js";

export {
  detectSegments,
  angleDistance,
  type DetectedSegment,
  type HoughLine,
  type HoughOptions,
} from "./hough.js";

export {
  orderCorners,
  homography,
  applyHomography,
  warpToSquare,
  guessPaperQuad,
  insetQuad,
  otsuThreshold,
  type Point,
  type Quad,
} from "./quad.js";

export {
  length,
  angleOf,
  toUnitSquare,
  mergeCollinear,
  snapAngles,
  snapToGrid,
  inferGrid,
  snapToBorder,
  removeBorderDuplicates,
  dropShort,
  dominantAngles,
  snapToAngles,
  inferGridAxes,
  snapToAxes,
  GRID_CANDIDATES,
  type GridAxes,
  type Line,
} from "./segments.js";

export {
  createRgb,
  pixelAt,
  rgbFromRgba,
  rgbToRgba,
  toGray,
  downscaleRgb,
  colourDistance,
  toHsv,
  profileRaster,
  BACKGROUND_TOLERANCE,
  type Rgb,
  type RgbImage,
  type RasterProfile,
} from "./raster.js";

export {
  extractInk,
  type InkLayer,
  type InkOptions,
  type InkResult,
  type InkRole,
} from "./ink.js";

export {
  edgeMapFromInk,
  orientationField,
  thin,
  close,
  dilate,
  erode,
  type InkEdgeOptions,
} from "./skeleton.js";

export {
  weldEndpoints,
  healJunctions,
  healGeometry,
  snapToPaper,
  dropDegenerate,
  DEFAULT_WELD_TOLERANCE,
} from "./weld.js";

export {
  scanLineArt,
  isLineArt,
  type LineArtOptions,
  type LineArtResult,
  type LayerSummary,
} from "./lineart.js";

export {
  readCreasePattern,
  type ReadKind,
  type ReadOptions,
  type ReadResult,
} from "./read.js";

export {
  shadingPrior,
  priorForEdges,
  type ShadingOptions,
} from "./shading.js";

export {
  inferAssignments,
  invertAssignments,
  type AssignmentOptions,
  type AssignmentResult,
} from "./assign.js";

export {
  scanCreasePattern,
  type ScanOptions,
  type ScanResult,
  type ScannedCrease,
} from "./scan.js";
