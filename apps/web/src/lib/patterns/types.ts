import type {
  CreaseGraph,
  KamiDocument,
  ValidationLevel,
  ValidationReport,
} from "@kamibase/core";

/** Enough of a pattern to render a card, without loading its geometry. */
export interface PatternSummary {
  /** Route id: the file slug, e.g. `bird-base`. */
  readonly id: string;
  /** `kami:id` (ULID), when the document carries one. */
  readonly kamiId?: string;
  readonly title: string;
  readonly designer: string;
  readonly description?: string;
  readonly level: ValidationLevel;
  readonly flatFoldable: boolean;
  readonly vertexCount: number;
  readonly edgeCount: number;
  readonly faceCount: number;
  readonly mountainCount: number;
  readonly valleyCount: number;
  readonly paperShape: string;
  readonly gridSystem?: string;
  readonly gridDivisions?: number;
  readonly recommendedSizeMm?: number;
  readonly recommendedPaper?: string;
  readonly difficulty?: number;
  readonly estimatedMinutes?: number;
  readonly license: string;
  readonly subject: readonly string[];
  readonly techniques: readonly string[];
  readonly tags: readonly string[];
  readonly contentHash: string;
  readonly sourceUrl?: string;
}

/** A pattern with its geometry and validation report loaded. */
export interface Pattern extends PatternSummary {
  readonly document: KamiDocument;
  readonly graph: CreaseGraph;
  readonly report: ValidationReport;
}

/**
 * Where patterns come from.
 *
 * DESIGN.md §9 puts patterns in Postgres, but Phase 1 has no accounts and no
 * uploads. It is ~100 hand-seeded files (§10), and a filesystem store behind this
 * interface makes the app runnable with zero infrastructure and leaves exactly
 * one seam to replace when Phase 4 needs a database.
 */
export interface PatternRepository {
  list(): Promise<readonly PatternSummary[]>;
  /** Look up by route id or by `kami:id`. `null` when there is no such pattern. */
  get(id: string): Promise<Pattern | null>;
}
