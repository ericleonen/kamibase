import type { PatternSummary } from "./types";

export interface PatternFilter {
  /** Free text, matched against title, designer, description, tags and taxonomy. */
  readonly q?: string;
  /** Exact technique, as used by the chip row. */
  readonly technique?: string;
}

/**
 * Substring search over the seeded library.
 *
 * Deliberately not clever: DESIGN.md §6 puts semantic and visual search in
 * Phase 5, where it needs embeddings and a corpus worth embedding. With a
 * couple of dozen patterns, matching words is both sufficient and honest — it
 * is better to have a search box that plainly matches text than one that
 * implies an understanding it does not have.
 */
export function filterPatterns(
  patterns: readonly PatternSummary[],
  filter: PatternFilter,
): PatternSummary[] {
  const terms = (filter.q ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term !== "");

  return patterns.filter((pattern) => {
    if (filter.technique && !pattern.techniques.includes(filter.technique)) {
      return false;
    }
    if (terms.length === 0) return true;

    const haystack = [
      pattern.title,
      pattern.designer,
      pattern.description ?? "",
      pattern.paperShape,
      pattern.gridSystem ?? "",
      ...pattern.tags,
      ...pattern.subject,
      ...pattern.techniques,
    ]
      .join(" ")
      .toLowerCase();

    return terms.every((term) => haystack.includes(term));
  });
}

/** Techniques present in the library, most common first, for the chip row. */
export function techniqueFacets(
  patterns: readonly PatternSummary[],
): { technique: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const pattern of patterns) {
    for (const technique of pattern.techniques) {
      counts.set(technique, (counts.get(technique) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([technique, count]) => ({ technique, count }))
    .sort((a, b) => b.count - a.count || a.technique.localeCompare(b.technique));
}
