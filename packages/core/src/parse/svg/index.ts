import { XMLParser } from "fast-xml-parser";
import type { Vec2 } from "../../geometry/vec.js";
import { graphFromSegments } from "../../graph/build.js";
import type { EdgeAssignment, Segment } from "../../graph/types.js";
import { ParseError } from "../errors.js";
import type { ParsedMetadata, ParsedPattern } from "../types.js";
import {
  classifyStyle,
  styleKey,
  type ClassifyMethod,
  type StyleFacts,
} from "./classify.js";
import { parseColor, toHex } from "./color.js";
import {
  matchStylesheet,
  parseDeclarations,
  parseStylesheet,
  type CssRule,
} from "./css.js";
import { flattenPath } from "./path.js";
import {
  apply,
  IDENTITY,
  meanScale,
  multiply,
  parseTransform,
  type Matrix,
} from "./transform.js";

/** One distinct way the file draws creases, and what we made of it. */
export interface SvgStyleSummary {
  /** Stable identifier, and the key of the `assignments` override map. */
  readonly key: string;
  /** Normalized `#rrggbb`, or `null` when the elements carry no stroke colour. */
  readonly stroke: string | null;
  readonly dashed: boolean;
  /** The layer or group these creases were drawn in, when it has a name. */
  readonly layer: string | null;
  readonly segmentCount: number;
  readonly assignment: EdgeAssignment;
  readonly confidence: number;
  readonly method: ClassifyMethod;
  readonly reason: string;
}

export interface ParsedSvg extends ParsedPattern {
  /**
   * The document's style table: every distinct stroke/layer combination, with
   * the assignment it was read as. This is what a review UI shows and what a
   * vision model would be handed for the §3.3 fallback; feeding a corrected
   * map back through `options.assignments` re-reads the file.
   */
  readonly styles: readonly SvgStyleSummary[];
  /** Length-weighted mean confidence, in the sense of §3.4. */
  readonly confidence: number;
}

export interface ParseSvgOptions {
  /**
   * Per-style assignment overrides, keyed by {@link SvgStyleSummary.key}.
   * Overridden styles are reported at confidence 1.
   */
  readonly assignments?: Readonly<Record<string, EdgeAssignment>>;
  /** Assignment for creases no strategy could read. Default `"U"` (§3.4). */
  readonly unknownAssignment?: EdgeAssignment;
  /**
   * Flip the y axis. SVG's y grows downward and crease patterns use the maths
   * convention, so this is on by default; the pattern would otherwise import
   * mirrored, turning every mountain into the wrong-handed twin of itself.
   */
  readonly flipY?: boolean;
  /**
   * Vertex merge tolerance, as a fraction of the drawing's larger side.
   * Default `1e-6`: exporters round coordinates, so the endpoints of two
   * creases that meet can differ in the last decimal place, and merging at
   * `@kamibase/core`'s usual 1e-9 would leave the pattern full of
   * near-duplicate vertices and hairline gaps.
   */
  readonly snapTolerance?: number;
  /**
   * Curve flattening tolerance, as a fraction of the drawing's larger side.
   * Default `5e-4`.
   */
  readonly curveTolerance?: number;
}

/** Elements that draw creases. */
const GEOMETRY_TAGS = new Set(["line", "polyline", "polygon", "rect", "path"]);

/**
 * Elements that draw something which is not a crease. Counted and reported
 * rather than ignored: a circle is usually a vertex dot and a `<text>` is
 * usually a label, but "we dropped 40 elements" is the user's call to make.
 */
const UNREADABLE_TAGS = new Set([
  "circle",
  "ellipse",
  "text",
  "tspan",
  "image",
  "foreignobject",
]);

/** Containers whose contents are definitions, not drawing. */
const NON_RENDERED_TAGS = new Set([
  "defs",
  "clippath",
  "mask",
  "marker",
  "symbol",
  "pattern",
  "filter",
  "lineargradient",
  "radialgradient",
  "metadata",
  "title",
  "desc",
  "style",
  "script",
]);

/** Presentation attributes worth reading; the rest cannot change a crease. */
const STYLE_PROPERTIES = [
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-opacity",
  "fill",
  "opacity",
  "display",
  "visibility",
] as const;

interface RawSegment {
  readonly a: Vec2;
  readonly b: Vec2;
  readonly key: string;
}

interface WalkContext {
  readonly matrix: Matrix;
  readonly style: Readonly<Record<string, string>>;
  readonly layer: string | null;
}

/**
 * Parse an SVG crease pattern (DESIGN.md §3.3).
 *
 * Geometry first: every `<line>`, `<polyline>`, `<polygon>`, `<rect>` and
 * `<path>` is read through its accumulated transform into one flat list of
 * segments, with the style it was drawn in. Then the *distinct* styles, of
 * which a real file has a handful, are classified once each by the strategy
 * stack in {@link classifyStyle}, and every segment inherits its style's
 * assignment and confidence.
 *
 * Doing it in that order is what makes the file reviewable: the result carries
 * a style table, so the honest question to put to a person ("this file draws
 * 214 creases in `#e8112d`; is that a mountain?") is four rows rather than 214.
 */
export function parseSvg(xml: string, options: ParseSvgOptions = {}): ParsedSvg {
  const flipY = options.flipY ?? true;
  const warnings: string[] = [];

  const root = readRoot(xml);
  const stylesheet = collectStylesheet(root);
  if (stylesheet.skipped.length > 0) {
    warnings.push(
      `ignored ${stylesheet.skipped.length} CSS rule(s) with selectors too complex to ` +
        `match safely: ${stylesheet.skipped.slice(0, 3).join(", ")}`,
    );
  }

  const facts = new Map<string, StyleFacts>();
  const segments: RawSegment[] = [];
  const skippedTags = new Map<string, number>();
  let curves = 0;
  let filledShapes = 0;

  // Curve flattening happens in user units, but the tolerance is relative to
  // the drawing, whose size is not known until it has been read. Two passes
  // over a string would be worse than one pass at a provisional tolerance
  // derived from the viewBox, which is what the file itself says its size is.
  const extentHint = viewportExtent(root) ?? 1000;
  const curveTolerance = (options.curveTolerance ?? 5e-4) * extentHint;

  const walk = (node: OrderedNode, context: WalkContext): void => {
    const tag = tagOf(node);
    if (tag === null || tag === "#text") return;
    if (NON_RENDERED_TAGS.has(tag)) return;

    const attributes = attributesOf(node);
    const style = resolveStyle(attributes, stylesheet.rules, tag, context.style);
    if (isHidden(style)) return;

    const matrix = attributes["transform"]
      ? multiply(context.matrix, parseTransform(attributes["transform"]))
      : context.matrix;

    if (GEOMETRY_TAGS.has(tag)) {
      const points = geometryOf(tag, attributes, matrix, curveTolerance / meanScale(matrix));
      if (points === null) {
        skippedTags.set(tag, (skippedTags.get(tag) ?? 0) + 1);
        return;
      }
      curves += points.curves;

      const stroke = style["stroke"];
      if (stroke === "none") return;
      const fill = style["fill"];
      if (stroke === undefined && fill !== undefined && fill !== "none") {
        // A filled shape with no stroke is a background or a decoration, not a
        // crease. Dropping it silently is right; counting it is honest.
        filledShapes += 1;
        return;
      }

      const color = stroke === undefined ? null : parseColor(stroke);
      const styleFacts: StyleFacts = {
        stroke: color === null ? null : toHex(color),
        dashed: isDashed(style["stroke-dasharray"]),
        layer: labelOf(attributes) ?? context.layer,
      };
      const key = styleKey(styleFacts);
      if (!facts.has(key)) facts.set(key, styleFacts);

      for (const polyline of points.polylines) {
        for (let i = 1; i < polyline.length; i += 1) {
          segments.push({ a: polyline[i - 1]!, b: polyline[i]!, key });
        }
      }
      return;
    }

    if (UNREADABLE_TAGS.has(tag)) {
      skippedTags.set(tag, (skippedTags.get(tag) ?? 0) + 1);
      return;
    }

    if (tag === "use") {
      // Resolving <use> means instancing a subtree with its own transform
      // stack. Nothing in the wild needs it yet, and pretending to support it
      // would drop creases with no warning.
      skippedTags.set("use", (skippedTags.get("use") ?? 0) + 1);
      return;
    }

    const childContext: WalkContext = {
      matrix,
      style,
      layer: (tag === "g" || tag === "svg" ? labelOf(attributes) : null) ?? context.layer,
    };
    for (const child of childrenOf(node)) walk(child, childContext);
  };

  walk(root, { matrix: IDENTITY, style: {}, layer: null });

  for (const [tag, count] of skippedTags) {
    warnings.push(
      tag === "use"
        ? `skipped ${count} <use> element(s); expand them in your editor and re-export`
        : `skipped ${count} <${tag}> element(s), which cannot be read as creases`,
    );
  }
  if (filledShapes > 0) {
    warnings.push(`skipped ${filledShapes} filled shape(s) with no stroke`);
  }
  if (curves > 0) {
    warnings.push(
      `approximated ${curves} curve(s) with straight segments; check them before publishing`,
    );
  }
  if (segments.length === 0) {
    throw new ParseError(
      "svg",
      "no stroked lines, polylines, polygons, rectangles or paths were found",
    );
  }

  const summaries = summarize(facts, segments, options);
  const byKey = new Map(summaries.map((summary) => [summary.key, summary]));

  let totalLength = 0;
  let weightedConfidence = 0;
  // `-0` is a legal double and an illegal canonical coordinate (§2.5), and
  // negating an SVG y of 0 produces one.
  const flip = (y: number): number => (flipY && y !== 0 ? -y : y);
  const built: Segment[] = segments.map((segment) => {
    const summary = byKey.get(segment.key)!;
    const length = Math.hypot(segment.b[0] - segment.a[0], segment.b[1] - segment.a[1]);
    totalLength += length;
    weightedConfidence += length * summary.confidence;
    return {
      x1: segment.a[0],
      y1: flip(segment.a[1]),
      x2: segment.b[0],
      y2: flip(segment.b[1]),
      assignment: summary.assignment,
      confidence: summary.confidence,
    };
  });

  const epsilon = (options.snapTolerance ?? 1e-6) * extentOf(built);
  const { graph, warnings: buildWarnings } = graphFromSegments(built, { epsilon });
  warnings.push(...buildWarnings);

  const unreadable = summaries.filter((summary) => summary.method === "fallback");
  if (unreadable.length > 0) {
    warnings.push(
      `${unreadable.length} style(s) could not be identified and were marked ` +
        `${options.unknownAssignment ?? "U"}: ${unreadable.map(describeStyle).join(", ")}`,
    );
  }
  if (!graph.assignments.includes("B")) {
    warnings.push(
      "no boundary creases were identified; the paper edge has to be marked B before " +
        "this validates as L1",
    );
  }

  return {
    format: "svg",
    graph,
    document: null,
    metadata: metadataOf(root, xml),
    warnings,
    styles: summaries,
    confidence: totalLength > 0 ? weightedConfidence / totalLength : 0,
  };
}

function summarize(
  facts: ReadonlyMap<string, StyleFacts>,
  segments: readonly RawSegment[],
  options: ParseSvgOptions,
): SvgStyleSummary[] {
  const counts = new Map<string, number>();
  for (const segment of segments) {
    counts.set(segment.key, (counts.get(segment.key) ?? 0) + 1);
  }

  const classifyOptions = {
    ...(options.assignments === undefined ? {} : { assignments: options.assignments }),
    ...(options.unknownAssignment === undefined
      ? {}
      : { unknownAssignment: options.unknownAssignment }),
  };

  return [...facts.entries()]
    .map(([key, style]) => {
      const classification = classifyStyle(style, classifyOptions);
      return {
        key,
        stroke: style.stroke,
        dashed: style.dashed,
        layer: style.layer,
        segmentCount: counts.get(key) ?? 0,
        assignment: classification.assignment,
        confidence: classification.confidence,
        method: classification.method,
        reason: classification.reason,
      };
    })
    .sort((a, b) => b.segmentCount - a.segmentCount);
}

function describeStyle(summary: SvgStyleSummary): string {
  const parts = [summary.stroke ?? "no stroke colour"];
  if (summary.dashed) parts.push("dashed");
  if (summary.layer) parts.push(`in "${summary.layer}"`);
  return `${parts.join(" ")} (${summary.segmentCount} creases)`;
}

/* -------------------------------------------------------------------------- */
/* Geometry                                                                    */
/* -------------------------------------------------------------------------- */

interface Geometry {
  readonly polylines: readonly (readonly Vec2[])[];
  readonly curves: number;
}

function geometryOf(
  tag: string,
  attributes: Readonly<Record<string, string>>,
  matrix: Matrix,
  curveTolerance: number,
): Geometry | null {
  const at = (name: string): number => number(attributes[name]);
  const point = (x: number, y: number): Vec2 => apply(matrix, x, y);

  switch (tag) {
    case "line":
      return {
        polylines: [[point(at("x1"), at("y1")), point(at("x2"), at("y2"))]],
        curves: 0,
      };
    case "polyline":
    case "polygon": {
      const points = numberList(attributes["points"] ?? "");
      const vertices: Vec2[] = [];
      for (let i = 0; i + 1 < points.length; i += 2) {
        vertices.push(point(points[i]!, points[i + 1]!));
      }
      if (vertices.length < 2) return null;
      if (tag === "polygon") vertices.push(vertices[0]!);
      return { polylines: [vertices], curves: 0 };
    }
    case "rect": {
      const x = at("x");
      const y = at("y");
      const width = at("width");
      const height = at("height");
      if (width <= 0 || height <= 0) return null;
      const corners: Vec2[] = [
        point(x, y),
        point(x + width, y),
        point(x + width, y + height),
        point(x, y + height),
      ];
      return { polylines: [[...corners, corners[0]!]], curves: 0 };
    }
    case "path": {
      const d = attributes["d"];
      if (!d) return null;
      const flattened = flattenPath(d, curveTolerance);
      const polylines = flattened.subpaths
        .map((subpath) => {
          const points = subpath.points.map(([x, y]) => point(x, y));
          if (subpath.closed && points.length >= 2) points.push(points[0]!);
          return points;
        })
        .filter((points) => points.length >= 2);
      if (polylines.length === 0) return null;
      return { polylines, curves: flattened.curves };
    }
    default:
      return null;
  }
}

function extentOf(segments: readonly Segment[]): number {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const segment of segments) {
    minX = Math.min(minX, segment.x1, segment.x2);
    minY = Math.min(minY, segment.y1, segment.y2);
    maxX = Math.max(maxX, segment.x1, segment.x2);
    maxY = Math.max(maxY, segment.y1, segment.y2);
  }
  const extent = Math.max(maxX - minX, maxY - minY);
  return Number.isFinite(extent) && extent > 0 ? extent : 1;
}

/* -------------------------------------------------------------------------- */
/* Style resolution                                                            */
/* -------------------------------------------------------------------------- */

function resolveStyle(
  attributes: Readonly<Record<string, string>>,
  rules: readonly CssRule[],
  tag: string,
  inherited: Readonly<Record<string, string>>,
): Record<string, string> {
  const presentation: Record<string, string> = {};
  for (const property of STYLE_PROPERTIES) {
    const value = attributes[property];
    if (value !== undefined) presentation[property] = value.trim();
  }

  const classes = (attributes["class"] ?? "").split(/\s+/).filter((name) => name !== "");
  const fromStylesheet =
    rules.length === 0
      ? {}
      : matchStylesheet(rules, { tag, id: attributes["id"], classes });
  const inline = attributes["style"] ? parseDeclarations(attributes["style"]) : {};

  // Cascade: presentation attributes lose to stylesheet rules, which lose to
  // the inline style attribute. Inheritance is the base of the stack.
  return { ...inherited, ...presentation, ...fromStylesheet, ...inline };
}

function isHidden(style: Readonly<Record<string, string>>): boolean {
  if (style["display"] === "none") return true;
  if (style["visibility"] === "hidden" || style["visibility"] === "collapse") return true;
  if (style["opacity"] !== undefined && number(style["opacity"]) === 0) return true;
  if (style["stroke-opacity"] !== undefined && number(style["stroke-opacity"]) === 0) {
    return true;
  }
  return false;
}

function isDashed(value: string | undefined): boolean {
  if (value === undefined || value === "none") return false;
  return numberList(value).some((entry) => entry > 0);
}

/** A group's human-given name: what the person who drew it called this layer. */
function labelOf(attributes: Readonly<Record<string, string>>): string | null {
  const candidates = [
    attributes["inkscape:label"],
    attributes["data-name"],
    attributes["serif:id"],
    attributes["aria-label"],
    attributes["id"],
  ];
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate.trim() !== "") return candidate.trim();
  }
  return null;
}

function metadataOf(root: OrderedNode, xml: string): ParsedMetadata {
  const title = textOf(findChild(root, "title"));
  const generator = /Generator:\s*(.+?)\s*(?:,|-->|[\r\n])/.exec(xml)?.[1]?.trim();
  const creator =
    generator ??
    (/inkscape:version=/.test(xml)
      ? "Inkscape"
      : /<!--\s*Created with Inkscape/i.test(xml)
        ? "Inkscape"
        : undefined);
  return {
    ...(title === null ? {} : { title }),
    ...(creator === undefined ? {} : { creator }),
  };
}

/* -------------------------------------------------------------------------- */
/* XML plumbing                                                                */
/* -------------------------------------------------------------------------- */

/**
 * `preserveOrder` keeps sibling order, which matters here: two creases drawn
 * on top of each other are resolved by the later one in
 * {@link graphFromSegments}, and that is the same rule a renderer applies.
 */
interface OrderedNode {
  readonly [tag: string]: unknown;
}

const ATTRIBUTES_KEY = ":@";
const ATTRIBUTE_PREFIX = "@_";

function readRoot(xml: string): OrderedNode {
  const parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: ATTRIBUTE_PREFIX,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    removeNSPrefix: false,
    processEntities: true,
  });

  let parsed: OrderedNode[];
  try {
    parsed = parser.parse(xml) as OrderedNode[];
  } catch (error) {
    throw new ParseError(
      "svg",
      `not well-formed XML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const root = parsed.find((node) => tagOf(node) === "svg");
  if (!root) throw new ParseError("svg", "no <svg> root element");
  return root;
}

function tagOf(node: OrderedNode): string | null {
  for (const key of Object.keys(node)) {
    if (key === ATTRIBUTES_KEY) continue;
    // Namespace prefixes appear on elements in documents exported from Office
    // and some CAD tools: <svg:line> is a line.
    return key.replace(/^[^:]+:/, "").toLowerCase();
  }
  return null;
}

function childrenOf(node: OrderedNode): OrderedNode[] {
  for (const [key, value] of Object.entries(node)) {
    if (key === ATTRIBUTES_KEY) continue;
    return Array.isArray(value) ? (value as OrderedNode[]) : [];
  }
  return [];
}

function attributesOf(node: OrderedNode): Record<string, string> {
  const raw = node[ATTRIBUTES_KEY];
  if (raw === undefined || raw === null || typeof raw !== "object") return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    result[key.slice(ATTRIBUTE_PREFIX.length)] = String(value);
  }
  return result;
}

function findChild(node: OrderedNode, tag: string): OrderedNode | null {
  return childrenOf(node).find((child) => tagOf(child) === tag) ?? null;
}

function textOf(node: OrderedNode | null): string | null {
  if (!node) return null;
  const text = childrenOf(node)
    .map((child) => (typeof child["#text"] === "string" ? child["#text"] : ""))
    .join("")
    .trim();
  return text === "" ? null : text;
}

/** Every `<style>` element in the document, wherever it was hidden. */
function collectStylesheet(root: OrderedNode): {
  rules: readonly CssRule[];
  skipped: readonly string[];
} {
  const chunks: string[] = [];
  const visit = (node: OrderedNode): void => {
    if (tagOf(node) === "style") {
      const text = childrenOf(node)
        .map((child) => (typeof child["#text"] === "string" ? child["#text"] : ""))
        .join("");
      if (text.trim() !== "") chunks.push(text);
      return;
    }
    for (const child of childrenOf(node)) visit(child);
  };
  visit(root);
  return chunks.length === 0
    ? { rules: [], skipped: [] }
    : parseStylesheet(chunks.join("\n"));
}

/** The larger side of the viewBox or width/height, in user units. */
function viewportExtent(root: OrderedNode): number | null {
  const attributes = attributesOf(root);
  const viewBox = numberList(attributes["viewBox"] ?? "");
  if (viewBox.length === 4) {
    const extent = Math.max(Math.abs(viewBox[2]!), Math.abs(viewBox[3]!));
    if (extent > 0) return extent;
  }
  const extent = Math.max(number(attributes["width"]), number(attributes["height"]));
  return extent > 0 ? extent : null;
}

/** A length attribute in user units; `%`, `mm` and friends are read as-is. */
function number(value: string | undefined): number {
  if (value === undefined) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberList(value: string): number[] {
  return (value.match(/[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/g) ?? []).map((entry) =>
    Number.parseFloat(entry),
  );
}
