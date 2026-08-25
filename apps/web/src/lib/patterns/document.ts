import {
  extractGraph,
  grade,
  type CreaseGraph,
  type KamiDocument,
} from "@kamibase/core";
import type { Pattern, PatternSummary } from "./types";

/**
 * One `.kami` document, graded and summarised into a {@link Pattern}.
 *
 * Both stores go through here: a seeded file read off disk and a row read out
 * of Postgres are the same document in different wrappers, and a pattern that
 * came from the editor should get exactly the badge and the counts a seeded one
 * would. Grading on read rather than trusting stored numbers is deliberate; the
 * document is the source of truth, and a column that disagrees with it is the
 * column that is wrong.
 */
export function patternFromDocument(id: string, document: KamiDocument): Pattern {
  const graded = grade(document);
  const graph: CreaseGraph = graded.graph ??
    extractGraph(document).graph ?? {
      vertices: [],
      edges: [],
      assignments: [],
    };

  return {
    ...summarise(id, document, graph, graded.level, graded.flatFold?.flatFoldable ?? false),
    document,
    graph,
    report: graded.structural,
  };
}

/**
 * The card-sized view of a document, given a graph and a grade already in hand.
 *
 * Split out from {@link patternFromDocument} because the database keeps the
 * counts and the grade in their own columns and lists patterns without reading
 * the documents at all.
 */
export function summarise(
  id: string,
  document: KamiDocument,
  graph: CreaseGraph,
  level: PatternSummary["level"],
  flatFoldable: boolean,
): PatternSummary {
  const assignments = graph.assignments;
  return {
    ...documentMetadata(id, document),
    level,
    flatFoldable,
    vertexCount: graph.vertices.length,
    edgeCount: graph.edges.length,
    faceCount: graph.faces?.length ?? 0,
    mountainCount: assignments.filter((a) => a === "M").length,
    valleyCount: assignments.filter((a) => a === "V").length,
  };
}

/** Everything a summary reads out of the document rather than off the geometry. */
function documentMetadata(
  id: string,
  document: KamiDocument,
): Omit<
  PatternSummary,
  | "level"
  | "flatFoldable"
  | "vertexCount"
  | "edgeCount"
  | "faceCount"
  | "mountainCount"
  | "valleyCount"
> {
  const paper = readRecord(document, "kami:paper");
  const taxonomy = readRecord(document, "kami:taxonomy");
  const provenance = readRecord(document, "kami:provenance");
  const license = readRecord(document, "kami:license");
  const difficulty = readRecord(document, "kami:difficulty");

  return {
    id,
    ...optional("kamiId", asString(document["kami:id"])),
    title: asString(document.file_title) ?? id,
    designer: asString(provenance?.["designer"]) ?? asString(document.file_author) ?? "Unknown",
    ...optional("description", asString(document.file_description)),
    paperShape: asString(paper?.["shape"]) ?? "square",
    ...optional("gridSystem", asString(paper?.["gridSystem"])),
    ...optional("gridDivisions", asNumber(paper?.["gridDivisions"])),
    ...optional("recommendedSizeMm", asNumber(paper?.["recommendedSizeMm"])),
    ...optional("recommendedPaper", asString(paper?.["recommendedPaper"])),
    ...optional("difficulty", asNumber(difficulty?.["rating"])),
    ...optional("estimatedMinutes", asNumber(difficulty?.["estimatedMinutes"])),
    license: asString(license?.["spdx"]) ?? "unknown",
    subject: asStringArray(taxonomy?.["subject"]),
    techniques: asStringArray(taxonomy?.["techniques"]),
    tags: asStringArray(taxonomy?.["tags"]),
    contentHash: asString(document["kami:contentHash"]) ?? "",
    ...optional("sourceUrl", asString(provenance?.["originalSourceUrl"])),
  };
}

/** Spread-in helper that omits the key entirely when the value is undefined. */
export function optional<K extends string, V>(
  key: K,
  value: V | undefined,
): Record<K, V> | Record<string, never> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

function readRecord(
  document: KamiDocument,
  key: string,
): Record<string, unknown> | undefined {
  const value = (document as Record<string, unknown>)[key];
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}
