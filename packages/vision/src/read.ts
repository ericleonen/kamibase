import type { AssignmentResult } from "./assign.js";
import type { GrayImage } from "./image.js";
import { scanLineArt, type LayerSummary, type LineArtOptions } from "./lineart.js";
import { profileRaster, toGray, type RasterProfile, type RgbImage } from "./raster.js";
import { scanCreasePattern, type ScannedCrease, type ScanOptions } from "./scan.js";
import type { GridAxes } from "./segments.js";

/**
 * One door, two pipelines.
 *
 * Callers hand over pixels. They should not have to know that a photograph of a
 * folded sheet and a PNG of a published crease pattern need almost entirely
 * different treatment, and they certainly should not have to ask the person
 * uploading — "is this a drawing or a photo?" is a question about our
 * implementation, not about their file, and half the answers would be wrong
 * anyway because a screenshot of a drawing is still a drawing.
 *
 * {@link profileRaster} decides, from three numbers taken off the image itself.
 * The caller can override it, and the answer is reported either way, because
 * when a scan comes back wrong the first useful thing to know is which of the
 * two pipelines it went through.
 */

export type ReadKind = "line-art" | "photo";

export interface ReadOptions {
  /** Force a pipeline. Defaults to whatever the image looks like. */
  readonly kind?: ReadKind;
  readonly lineArt?: LineArtOptions;
  readonly photo?: ScanOptions;
}

export interface ReadResult {
  readonly kind: ReadKind;
  /** Why: the numbers the choice was made from. */
  readonly profile: RasterProfile;
  readonly creases: readonly ScannedCrease[];
  /** The image the detection ran on, for the editor to trace against. */
  readonly rectified: GrayImage;
  /** The paper's extent in crease coordinates. Square unless it says otherwise. */
  readonly paper: { readonly width: number; readonly height: number };
  readonly grid: GridAxes;
  /** The ink colours found, and what each was taken to mean. Empty for photos. */
  readonly layers: readonly LayerSummary[];
  readonly assignment: AssignmentResult;
  readonly confidence: number;
  readonly notes: readonly string[];
}

export function readCreasePattern(image: RgbImage, options: ReadOptions = {}): ReadResult {
  const profile = profileRaster(image);
  const kind: ReadKind = options.kind ?? (profile.lineArt ? "line-art" : "photo");

  if (kind === "line-art") {
    const result = scanLineArt(image, options.lineArt ?? {});
    return {
      kind,
      profile,
      creases: result.creases,
      rectified: result.rectified,
      paper: result.paper,
      grid: result.grid,
      layers: result.layers,
      assignment: result.assignment,
      confidence: result.confidence,
      notes: result.notes,
    };
  }

  const result = scanCreasePattern(toGray(image), options.photo ?? {});
  return {
    kind,
    profile,
    creases: result.creases,
    rectified: result.rectified,
    paper: { width: 1, height: 1 },
    grid: { x: result.grid, y: result.grid },
    layers: [],
    assignment: result.assignment,
    confidence: result.confidence,
    notes: result.notes,
  };
}
