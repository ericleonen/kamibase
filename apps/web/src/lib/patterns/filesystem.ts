import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseFold, type KamiDocument } from "@kamibase/core";
import { patternFromDocument } from "./document";
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

  /** Nobody's, always. A file in the repository has no account behind it. */
  async listByAuthor(): Promise<readonly PatternSummary[]> {
    return [];
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
  return patternFromDocument(id, (parsed.document ?? {}) as KamiDocument);
}

function toSummary(pattern: Pattern): PatternSummary {
  const { document: _document, graph: _graph, report: _report, ...summary } = pattern;
  return summary;
}
