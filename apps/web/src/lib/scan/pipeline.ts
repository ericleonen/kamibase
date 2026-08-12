import { fromRgba, scanCreasePattern } from "@kamibase/vision";
import { tuningToOptions, type ScanReport, type ScanRequest } from "./types";

/**
 * The scan itself, in one function with no environment of its own.
 *
 * It runs unchanged on the main thread and inside a Web Worker, which is the
 * point: the worker is a performance detail, not a second code path. If the
 * bundler cannot produce one, the page calls this directly and the only
 * difference is that the tab stops painting for a second.
 */
export function runScan(request: ScanRequest): ScanReport {
  const image = fromRgba(request.pixels, request.width, request.height);
  const options = tuningToOptions(request.tuning);

  const result = scanCreasePattern(image, {
    quad: request.quad,
    workingSize: 900,
    edges: options.edges,
    minLengthFraction: options.minLengthFraction,
    angleStepDegrees: options.angleStepDegrees,
    grid: options.grid,
    seed: 1,
  });

  return {
    creases: result.creases.map((crease) => ({
      x1: crease.x1,
      y1: crease.y1,
      x2: crease.x2,
      y2: crease.y2,
      assignment: crease.assignment,
      confidence: crease.confidence,
    })),
    grid: result.grid,
    confidence: result.confidence,
    notes: result.notes,
    maekawaSatisfied: result.assignment.satisfied,
    maekawaTotal: result.assignment.total,
    ambiguous: result.assignment.ambiguous,
    oddVertices: result.assignment.oddVertices.length,
    rectified: {
      size: result.rectified.width,
      gray: result.rectified.data,
    },
  };
}
