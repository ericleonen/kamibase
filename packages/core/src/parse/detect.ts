import { ParseError } from "./errors.js";
import { parseCp, type ParseCpOptions } from "./cp.js";
import { parseFold, type ParseFoldOptions } from "./fold.js";
import { parseOpx, type ParseOpxOptions } from "./opx.js";
import { parseSvg, type ParseSvgOptions } from "./svg/index.js";
import type { ParsedPattern, SourceFormat } from "./types.js";

const CP_LINE = /^\s*-?\d+(?:\.\d+)?(?:[\s,]+[-+0-9.eE]+){4}\s*$/;

/**
 * Sniff the format of an uploaded file. This is the `DETECT` stage of
 * DESIGN.md §3.2, "sniff magic bytes / extension / XML root".
 *
 * The filename is a hint, not the answer: people rename files, and a `.cp`
 * that is really a FOLD document should still import.
 */
export function detectFormat(text: string, filename?: string): SourceFormat | null {
  const body = text.replace(/^﻿/, "").trimStart();

  if (body.startsWith("{")) {
    return /"kami:[a-zA-Z]/.test(body) ? "kami" : "fold";
  }
  if (body.startsWith("<")) {
    if (/<java[\s>]/.test(body) || /XMLDecoder/.test(body)) return "opx";
    // The root element, not merely the string "svg": an ORIPA file that names
    // an SVG in its metadata is still an ORIPA file.
    return /<(?:[a-zA-Z0-9_-]+:)?svg[\s>]/.test(body) ? "svg" : null;
  }

  const extension = filename?.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  switch (extension) {
    case "cp":
      return "cp";
    case "opx":
      return "opx";
    case "fold":
      return "fold";
    case "kami":
      return "kami";
    case "svg":
      return "svg";
    default:
      break;
  }

  const lines = body
    .split(/\r\n|\r|\n/)
    .map((line) => line.replace(/(^|\s)(#|\/\/).*$/, "").trim())
    .filter((line) => line !== "");
  if (lines.length > 0 && lines.every((line) => CP_LINE.test(line))) return "cp";

  return null;
}

export interface ParseOptions
  extends ParseFoldOptions,
    ParseCpOptions,
    ParseOpxOptions,
    ParseSvgOptions {
  /** Skip detection and parse as this format. */
  readonly format?: SourceFormat;
  /** Filename, used as a detection hint. */
  readonly filename?: string;
}

/** Detect the format and parse. Throws {@link ParseError} if neither works. */
export function parse(text: string, options: ParseOptions = {}): ParsedPattern {
  const format = options.format ?? detectFormat(text, options.filename);
  switch (format) {
    case "fold":
    case "kami":
      return parseFold(text, options);
    case "cp":
      return parseCp(text, options);
    case "opx":
      return parseOpx(text, options);
    case "svg":
      return parseSvg(text, options);
    default:
      throw new ParseError(
        "unknown",
        "could not detect the file format; supported inputs are .fold, .kami, .cp, .opx and .svg",
      );
  }
}
