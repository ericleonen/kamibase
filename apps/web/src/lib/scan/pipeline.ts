import { readCreasePattern, rgbFromRgba } from "@kamibase/vision";
import { tuningToOptions, type ScanReport, type ScanRequest } from "./types";

/**
 * The scan itself, in one function with no environment of its own.
 *
 * It runs unchanged on the main thread and inside a Web Worker, which is the
 * point: the worker is a performance detail, not a second code path. If the
 * bundler cannot produce one, the page calls this directly and the only
 * difference is that the tab stops painting for a second.
 *
 * Colour survives the trip. It used to be discarded here, on the way in, which
 * threw away the one thing a published crease pattern states outright, since a red
 * line is a designer saying "mountain", and left the pipeline to rediscover it
 * from Maekawa, which can only ever get it right up to being inside out.
 */
export function runScan(request: ScanRequest): ScanReport {
  const image = rgbFromRgba(request.pixels, request.width, request.height);
  const options = tuningToOptions(request.tuning);

  const result = readCreasePattern(image, {
    ...(request.kind === undefined ? {} : { kind: request.kind }),
    photo: {
      ...(request.quad === undefined ? {} : { quad: request.quad }),
      workingSize: 900,
      edges: options.edges,
      minLengthFraction: options.minLengthFraction,
      angleStepDegrees: options.angleStepDegrees,
      grid: options.grid,
      seed: 1,
    },
    lineArt: {
      // The tuning sliders are about pulling faint creases out of a
      // photograph. A drawing has no faint creases, so the only one that
      // carries over is the shortest crease worth keeping, and even that is
      // scaled down, because a single cell of a 32-grid is 3% of the paper and
      // the photo default would throw the whole pattern away.
      minLengthFraction: Math.min(0.04, options.minLengthFraction * 0.25),
      seed: 1,
    },
  });

  return {
    kind: result.kind,
    creases: result.creases.map((crease) => ({
      x1: crease.x1,
      y1: crease.y1,
      x2: crease.x2,
      y2: crease.y2,
      assignment: crease.assignment,
      confidence: crease.confidence,
    })),
    grid: result.grid,
    paper: result.paper,
    layers: result.layers,
    confidence: result.confidence,
    notes: result.notes,
    maekawaSatisfied: result.assignment.satisfied,
    maekawaTotal: result.assignment.total,
    ambiguous: result.assignment.ambiguous,
    oddVertices: result.assignment.oddVertices.length,
    rectified: {
      width: result.rectified.width,
      height: result.rectified.height,
      gray: result.rectified.data,
    },
  };
}
