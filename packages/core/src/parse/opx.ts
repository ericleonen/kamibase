import { graphFromSegments } from "../graph/build.js";
import type { EdgeAssignment, Segment } from "../graph/types.js";
import { CP_LINE_TYPES } from "./cp.js";
import { ParseError } from "./errors.js";
import { decodeXmlDecoder, javaNumber, type JavaValue } from "./xmldecoder.js";
import type { ParsedMetadata, ParsedPattern } from "./types.js";

export interface ParseOpxOptions {
  readonly unknownTypeAssignment?: EdgeAssignment;
}

/**
 * Parse an ORIPA `.opx` file.
 *
 * `.opx` is a `java.beans.XMLDecoder` serialization of ORIPA's `DataSet`: a
 * `lines` array of `OriLineProxy` beans, each with a `type` and either
 * `x0/y0/x1/y1` or a pair of `Point2D` objects, depending on the ORIPA
 * version. Line types match `.cp` (DESIGN.md §3.1), so both formats share
 * {@link CP_LINE_TYPES}.
 *
 * ORIPA's coordinates are centred on the origin and measured in the file's own
 * paper units; `ingest()` normalizes them to `[0,1]²`.
 */
export function parseOpx(xml: string, options: ParseOpxOptions = {}): ParsedPattern {
  const unknownAssignment = options.unknownTypeAssignment ?? "U";
  const warnings: string[] = [];
  const root = decodeXmlDecoder(xml);

  if (root === null || typeof root !== "object" || Array.isArray(root)) {
    throw new ParseError("opx", "the XMLDecoder root is not an object");
  }

  const lines = root["lines"];
  if (!Array.isArray(lines)) {
    throw new ParseError(
      "opx",
      'no "lines" property on the root object; this does not look like an ORIPA DataSet',
    );
  }

  const segments: Segment[] = [];
  lines.forEach((line, i) => {
    if (line === null || typeof line !== "object" || Array.isArray(line)) {
      warnings.push(`lines[${i}]: not an object; skipped`);
      return;
    }
    const coords = readEndpoints(line);
    if (!coords) {
      warnings.push(`lines[${i}]: no readable endpoints; skipped`);
      return;
    }
    const type = javaNumber(line, "type");
    let assignment = type === undefined ? undefined : CP_LINE_TYPES[type];
    if (assignment === undefined) {
      warnings.push(
        `lines[${i}]: unknown line type ${String(type)}; assigned ${unknownAssignment}`,
      );
      assignment = unknownAssignment;
    }
    segments.push({ ...coords, assignment });
  });

  if (segments.length === 0) {
    throw new ParseError("opx", "the lines array contains no usable creases");
  }

  const { graph, warnings: buildWarnings } = graphFromSegments(segments);
  warnings.push(...buildWarnings);

  const paperSize = javaNumber(root, "paperSize");
  const title = root["title"];
  const author = root["author"];
  const metadata: ParsedMetadata = {
    ...(typeof title === "string" && title !== "" ? { title } : {}),
    ...(typeof author === "string" && author !== "" ? { author } : {}),
    ...(paperSize === undefined ? {} : { paperSize }),
    creator: "ORIPA",
  };

  return { format: "opx", graph, document: null, metadata, warnings };
}

/** Endpoints, from either the flat `x0/y0/x1/y1` form or a `Point2D` pair. */
function readEndpoints(
  line: Record<string, JavaValue>,
): Pick<Segment, "x1" | "y1" | "x2" | "y2"> | null {
  // ORIPA's own form: x0, y0, x1, y1.
  const x0 = javaNumber(line, "x0");
  const y0 = javaNumber(line, "y0");
  const ox1 = javaNumber(line, "x1");
  const oy1 = javaNumber(line, "y1");
  if (
    x0 !== undefined &&
    y0 !== undefined &&
    ox1 !== undefined &&
    oy1 !== undefined
  ) {
    return { x1: x0, y1: y0, x2: ox1, y2: oy1 };
  }

  // 1-based variant written by some exporters: x1, y1, x2, y2.
  const x2 = javaNumber(line, "x2");
  const y2 = javaNumber(line, "y2");
  if (
    ox1 !== undefined &&
    oy1 !== undefined &&
    x2 !== undefined &&
    y2 !== undefined
  ) {
    return { x1: ox1, y1: oy1, x2, y2 };
  }

  const p0 = line["p0"];
  const p1 = line["p1"];
  const px0 = javaNumber(p0 ?? null, "x");
  const py0 = javaNumber(p0 ?? null, "y");
  const px1 = javaNumber(p1 ?? null, "x");
  const py1 = javaNumber(p1 ?? null, "y");
  if (px0 !== undefined && py0 !== undefined && px1 !== undefined && py1 !== undefined) {
    return { x1: px0, y1: py0, x2: px1, y2: py1 };
  }
  return null;
}
