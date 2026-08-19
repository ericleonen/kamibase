import type { EdgeAssignment } from "@kamibase/core";
import type { GridAxes, LayerSummary, Quad, ReadKind } from "@kamibase/vision";

/**
 * What crosses the wire between the page and the worker.
 *
 * Deliberately plain: typed arrays and numbers, nothing with a prototype.
 * Structured clone will carry a `GrayImage` or a `ScanResult` happily, but
 * keeping the boundary boring means the fallback path (running the same code
 * on the main thread when a worker cannot be constructed) is a straight
 * function call rather than a second implementation.
 */

export interface ScanTuning {
  /**
   * 0 to 1. Higher finds fainter creases and more things that are not creases.
   * It moves the edge detector's noise floor, which is the knob that actually
   * decides what counts as a crease.
   */
  readonly sensitivity: number;
  /** Shortest crease to keep, as a fraction of the paper's width. */
  readonly minLength: number;
  /** Snap angles to this many degrees. 0 leaves them where they were found. */
  readonly angleStep: number;
  /** Lattice to snap onto. `"auto"` infers one, `"none"` snaps nothing. */
  readonly grid: number | "auto" | "none";
}

export const DEFAULT_TUNING: ScanTuning = {
  sensitivity: 0.5,
  minLength: 0.08,
  angleStep: 22.5,
  grid: "auto",
};

export interface ScanRequest {
  readonly width: number;
  readonly height: number;
  /** RGBA bytes, as they come out of `getImageData`. */
  readonly pixels: Uint8ClampedArray;
  /**
   * The paper's corners in the photo. Only a photograph has any: a drawing is
   * already flat, and its paper is found from where the ink is rather than
   * from where a rectangle was dragged.
   */
  readonly quad?: Quad;
  /** Force a pipeline. Omitted, the image is looked at and one is chosen. */
  readonly kind?: ReadKind;
  readonly tuning: ScanTuning;
}

export interface ScannedCreaseWire {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly assignment: EdgeAssignment;
  readonly confidence: number;
}

export interface ScanReport {
  /** Which pipeline read it. Worth knowing first when a result looks wrong. */
  readonly kind: ReadKind;
  readonly creases: readonly ScannedCreaseWire[];
  readonly grid: GridAxes;
  /** The paper's extent in crease coordinates. Not always square. */
  readonly paper: { readonly width: number; readonly height: number };
  /** The ink colours found and what each was taken to mean. Empty for photos. */
  readonly layers: readonly LayerSummary[];
  readonly confidence: number;
  readonly notes: readonly string[];
  readonly maekawaSatisfied: number;
  readonly maekawaTotal: number;
  readonly ambiguous: number;
  readonly oddVertices: number;
  /** The image the detection ran on, cropped to the paper, for the preview. */
  readonly rectified: {
    readonly width: number;
    readonly height: number;
    readonly gray: Float32Array;
  };
}

export type ScanResponse =
  | { readonly ok: true; readonly report: ScanReport }
  | { readonly ok: false; readonly error: string };

/**
 * Turn the one slider the UI shows into the several numbers the detector wants.
 *
 * The noise floor is the honest control: it says how many times the paper's own
 * texture a gradient has to be before it counts. Everything else follows from
 * it, and exposing four sliders instead would be exposing the implementation
 * rather than the decision.
 */
export function tuningToOptions(tuning: ScanTuning): {
  edges: { noiseFloorMultiple: number; strongPercentile: number };
  minLengthFraction: number;
  angleStepDegrees: number;
  grid: number | "auto" | null;
} {
  const sensitivity = Math.min(1, Math.max(0, tuning.sensitivity));
  return {
    edges: {
      // 8x the median at the cautious end, 2.5x at the eager end.
      noiseFloorMultiple: 8 - sensitivity * 5.5,
      strongPercentile: 0.02 + sensitivity * 0.1,
    },
    minLengthFraction: tuning.minLength,
    angleStepDegrees: tuning.angleStep,
    grid: tuning.grid === "none" ? null : tuning.grid,
  };
}
