import { canonicalizeDocument, canonicalizeGraph } from "./canonical/index.js";
import type { CreaseGraph } from "./graph/types.js";
import { documentFromGraph, type DocumentMetadata } from "./kami/document.js";
import type { FoldDocument, KamiDocument } from "./kami/schema.js";
import type { ParsedPattern } from "./parse/types.js";
import { findFaces } from "./topology/faces.js";
import { planarize } from "./topology/planarize.js";
import { grade, type GradeOptions, type GradeResult } from "./validate/grade.js";

export interface IngestOptions extends GradeOptions {
  /**
   * Split crossings into vertices before validating (DESIGN.md §2.4.6).
   * Default `true`, because most sources have unresolved crossings and
   * face-finding is meaningless without it.
   */
  readonly planarize?: boolean;
  /** Run planar face-finding and populate `faces_vertices`. Default `true`. */
  readonly computeFaces?: boolean;
  /** Metadata to stamp on a document that does not already carry it. */
  readonly metadata?: DocumentMetadata;
  /** Base document whose metadata should be preserved. */
  readonly document?: FoldDocument;
}

export interface IngestResult {
  readonly document: KamiDocument;
  readonly graph: CreaseGraph;
  /** Canonical JSON bytes (DESIGN.md §2.5). */
  readonly json: string;
  readonly contentHash: string;
  readonly grade: GradeResult;
  readonly warnings: string[];
}

/**
 * The `CLEAN` → `TOPOLOGY` → `VALIDATE` tail of the ingest pipeline
 * (DESIGN.md §3.2), for sources that are already vector data.
 *
 * Normalizes and canonicalizes, resolves crossings into vertices, computes
 * faces by planar face-finding, stamps `kami:contentHash`, then grades the
 * result. It does *not* snap to an inferred grid or repair assignments. Those
 * are converter concerns, and doing them silently here would make the L1 grade
 * mean "we guessed and it worked out".
 */
export function ingest(
  input: ParsedPattern | CreaseGraph,
  options: IngestOptions = {},
): IngestResult {
  const parsed = "graph" in input ? input : null;
  const rawGraph = parsed ? parsed.graph : (input as CreaseGraph);
  const warnings = parsed ? [...parsed.warnings] : [];

  // Normalize first: the 1e-9 dedup epsilon of §2.4.5 is defined in normalized
  // units, so a pattern in millimetres has to be scaled before it applies.
  let graph = canonicalizeGraph(rawGraph, { normalize: true });

  if (options.planarize ?? true) {
    const planar = planarize(graph);
    warnings.push(...planar.warnings);
    const newVertices = planar.graph.vertices.length - graph.vertices.length;
    const newEdges = planar.graph.edges.length - graph.edges.length;
    if (newVertices > 0 || newEdges > 0) {
      warnings.push(
        `planarize: resolved crossings into ${newVertices} new vertex/vertices ` +
          `and ${newEdges} new edge(s)`,
      );
    }
    graph = canonicalizeGraph(planar.graph, { normalize: false });
  }

  if (options.computeFaces ?? true) {
    const { faces } = findFaces(graph);
    graph = canonicalizeGraph({ ...graph, faces }, { normalize: false });
  }

  const metadata: DocumentMetadata = {
    ...(parsed?.metadata.title === undefined ? {} : { title: parsed.metadata.title }),
    ...(parsed?.metadata.author === undefined ? {} : { author: parsed.metadata.author }),
    ...options.metadata,
  };
  const defaults = documentFromGraph(graph, metadata) as Record<string, unknown>;
  const original = (options.document ?? parsed?.document ?? {}) as Record<string, unknown>;
  const base = { ...defaults, ...original } as KamiDocument;

  const canonical = canonicalizeDocument(base, graph, { normalize: false });

  return {
    document: canonical.document,
    graph: canonical.graph,
    json: canonical.json,
    contentHash: canonical.contentHash,
    grade: grade(canonical.document, options),
    warnings,
  };
}
