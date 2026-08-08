import { XMLParser } from "fast-xml-parser";
import { ParseError } from "./errors.js";

/**
 * A decoded `java.beans.XMLDecoder` value. Objects carry their Java class
 * under {@link CLASS_KEY} so callers can tell an `OriLineProxy` from a
 * `Point2D$Double`.
 */
export type JavaValue =
  | string
  | number
  | boolean
  | null
  | JavaValue[]
  | { [key: string]: JavaValue };

/** Key under which a decoded object records its Java class name. */
export const CLASS_KEY = "@class";

interface OrderedNode {
  [tag: string]: unknown;
  ":@"?: Record<string, string>;
}

const NUMERIC_TAGS = new Set(["int", "double", "float", "long", "short", "byte"]);

/**
 * Decode the subset of `java.beans.XMLDecoder` output that ORIPA writes.
 *
 * ORIPA `.opx` files are Java bean serializations (DESIGN.md §3.1: "XML
 * (`XMLDecoder`) → line list → graph"). We decode the object graph generically
 * (`<object>`, `<void property>`, `<array>`, `<int>`, `<double>`, `<string>`)
 * so the `.opx` parser can just read properties off the result and stays
 * indifferent to which ORIPA version wrote the file.
 */
export function decodeXmlDecoder(xml: string): JavaValue {
  const parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
  });

  let parsed: OrderedNode[];
  try {
    parsed = parser.parse(xml) as OrderedNode[];
  } catch (error) {
    throw new ParseError(
      "opx",
      `not well-formed XML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // An XMLDecoder document is a <java> element wrapping the bean graph. Accept
  // a bare top-level <object> too, but nothing else: without this check any XML
  // at all decodes to *something*, and "this is not an ORIPA file" is the more
  // useful answer.
  const root = findTag(parsed, "java");
  const children = root ? (root.children as OrderedNode[]) : parsed;
  if (!root && !findTag(parsed, "object")) {
    throw new ParseError(
      "opx",
      "no <java …class=\"java.beans.XMLDecoder\"> root; this is not an ORIPA .opx file",
    );
  }
  const decoded = decodeChildren(children);
  if (decoded.length === 0) {
    throw new ParseError("opx", "no <object> element under the XMLDecoder root");
  }
  return decoded[0]!;
}

interface TagHit {
  tag: string;
  children: unknown;
  attributes: Record<string, string>;
}

function tagOf(node: OrderedNode): TagHit | null {
  for (const key of Object.keys(node)) {
    if (key === ":@") continue;
    return {
      tag: key,
      children: node[key],
      attributes: node[":@"] ?? {},
    };
  }
  return null;
}

function findTag(nodes: OrderedNode[], tag: string): TagHit | null {
  for (const node of nodes) {
    const hit = tagOf(node);
    if (hit && hit.tag === tag) return hit;
  }
  return null;
}

/** Decode every value-bearing element in a child list. */
function decodeChildren(nodes: OrderedNode[]): JavaValue[] {
  const values: JavaValue[] = [];
  for (const node of nodes) {
    const hit = tagOf(node);
    if (!hit || hit.tag === "#text" || hit.tag === "?xml") continue;
    values.push(decodeElement(hit));
  }
  return values;
}

function decodeElement(hit: TagHit): JavaValue {
  const children = Array.isArray(hit.children) ? (hit.children as OrderedNode[]) : [];

  if (NUMERIC_TAGS.has(hit.tag)) {
    const value = Number(textOf(children));
    return Number.isFinite(value) ? value : null;
  }
  switch (hit.tag) {
    case "string":
    case "char":
      return textOf(children);
    case "boolean":
      return textOf(children).toLowerCase() === "true";
    case "null":
      return null;
    case "array": {
      const array: JavaValue[] = [];
      for (const node of children) {
        const child = tagOf(node);
        if (!child || child.tag !== "void") continue;
        const index = Number(child.attributes["@_index"]);
        const value = decodeChildren(
          Array.isArray(child.children) ? (child.children as OrderedNode[]) : [],
        )[0];
        if (Number.isInteger(index)) array[index] = value ?? null;
        else array.push(value ?? null);
      }
      return [...array].map((entry) => entry ?? null);
    }
    case "object": {
      const object: Record<string, JavaValue> = {};
      const className = hit.attributes["@_class"];
      if (className !== undefined) object[CLASS_KEY] = className;
      for (const node of children) {
        const child = tagOf(node);
        if (!child || child.tag !== "void") continue;
        const property = child.attributes["@_property"];
        if (property === undefined) continue;
        const value = decodeChildren(
          Array.isArray(child.children) ? (child.children as OrderedNode[]) : [],
        )[0];
        object[property] = value ?? null;
      }
      return object;
    }
    case "void": {
      const value = decodeChildren(children)[0];
      return value ?? null;
    }
    default: {
      const nested = decodeChildren(children);
      if (nested.length > 0) return nested[0]!;
      return textOf(children);
    }
  }
}

function textOf(children: OrderedNode[]): string {
  for (const node of children) {
    const text = node["#text"];
    if (typeof text === "string") return text;
    if (typeof text === "number") return String(text);
  }
  return "";
}

/** Read a numeric property from a decoded Java object. */
export function javaNumber(
  object: JavaValue,
  ...names: readonly string[]
): number | undefined {
  if (object === null || typeof object !== "object" || Array.isArray(object)) {
    return undefined;
  }
  for (const name of names) {
    const value = object[name];
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}
