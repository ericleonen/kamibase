import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  extractGraph,
  grade,
  parseFold,
  type CreaseGraph,
  type KamiDocument,
} from "@kamibase/core";
import type { Pattern, PatternRepository, PatternSummary } from "./types";

export interface FileSystemPatternRepositoryOptions {
  /** Directory of `.kami` files. */
  readonly directory: string;
}

/**
 * Reads `.kami` files off disk, one pattern per file, id taken from the
 * filename.
 *
 * Every file goes through the same `@kamibase/core` path an upload would:
 * parse, extract, grade. So a seeded pattern gets exactly the badge an
 * uploaded one would, and a malformed seed shows up as a defect rather than a
 * crash. Results are cached for the process lifetime; the seeds are static.
 */
export class FileSystemPatternRepository implements PatternRepository {
  readonly #directory: string;
  #cache: Map<string, Pattern> | null = null;
  #loading: Promise<Map<string, Pattern>> | null = null;

  constructor(options: FileSystemPatternRepositoryOptions) {
    this.#directory = options.directory;
  }

  async list(): Promise<readonly PatternSummary[]> {
    const patterns = await this.#load();
    return [...patterns.values()]
      .map(toSummary)
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  async get(id: string): Promise<Pattern | null> {
    const patterns = await this.#load();
    const direct = patterns.get(id);
    if (direct) return direct;
    for (const pattern of patterns.values()) {
      if (pattern.kamiId === id) return pattern;
    }
    return null;
  }

  async #load(): Promise<Map<string, Pattern>> {
    if (this.#cache) return this.#cache;
    this.#loading ??= this.#read();
    this.#cache = await this.#loading;
    return this.#cache;
  }

  async #read(): Promise<Map<string, Pattern>> {
    let files: string[];
    try {
      files = await readdir(this.#directory);
    } catch {
      return new Map();
    }

    const patterns = new Map<string, Pattern>();
    for (const file of files.sort()) {
      if (!file.endsWith(".kami")) continue;
      const id = file.slice(0, -".kami".length);
      const text = await readFile(join(this.#directory, file), "utf8");
      patterns.set(id, readPattern(id, text));
    }
    return patterns;
  }
}

/** Parse and grade one `.kami` document into a {@link Pattern}. */
export function readPattern(id: string, text: string): Pattern {
  const parsed = parseFold(text);
  const document = (parsed.document ?? {}) as KamiDocument;
  const graded = grade(document);
  const graph: CreaseGraph = graded.graph ?? extractGraph(document).graph ?? {
    vertices: [],
    edges: [],
    assignments: [],
  };

  const paper = readRecord(document, "kami:paper");
  const taxonomy = readRecord(document, "kami:taxonomy");
  const provenance = readRecord(document, "kami:provenance");
  const license = readRecord(document, "kami:license");
  const difficulty = readRecord(document, "kami:difficulty");

  const assignments = graph.assignments;
  const summary: PatternSummary = {
    id,
    ...optional("kamiId", asString(document["kami:id"])),
    title: asString(document.file_title) ?? id,
    designer: asString(provenance?.["designer"]) ?? asString(document.file_author) ?? "Unknown",
    ...optional("description", asString(document.file_description)),
    level: graded.level,
    flatFoldable: graded.flatFold?.flatFoldable ?? false,
    vertexCount: graph.vertices.length,
    edgeCount: graph.edges.length,
    faceCount: graph.faces?.length ?? 0,
    mountainCount: assignments.filter((a) => a === "M").length,
    valleyCount: assignments.filter((a) => a === "V").length,
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

  return { ...summary, document, graph, report: graded.structural };
}

function toSummary(pattern: Pattern): PatternSummary {
  const { document: _document, graph: _graph, report: _report, ...summary } = pattern;
  return summary;
}

/** Spread-in helper that omits the key entirely when the value is undefined. */
function optional<K extends string, V>(
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
