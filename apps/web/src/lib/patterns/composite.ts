import type { Pattern, PatternRepository, PatternSummary } from "./types";

/**
 * Several stores, read as one library.
 *
 * Patterns live in two places while the move of DESIGN.md §9 is half done: the
 * seeded `.kami` files committed under `content/patterns`, and the rows anyone
 * has saved from the editor. A visitor should not have to know which is which,
 * so the app asks this and it asks both.
 *
 * Order is precedence. The database comes first, so a slug that exists in both
 * resolves to the saved pattern rather than to a seed with the same name, which
 * is the only sane answer once a seed has been superseded.
 */
export class CompositePatternRepository implements PatternRepository {
  readonly #stores: readonly PatternRepository[];

  constructor(stores: readonly PatternRepository[]) {
    this.#stores = stores;
  }

  async list(): Promise<readonly PatternSummary[]> {
    const lists = await Promise.all(this.#stores.map((store) => store.list()));

    // First writer wins, matching `get`. Sorted by title rather than left in
    // store order, because the seam between the two stores is not something a
    // browsing surface should show.
    const byId = new Map<string, PatternSummary>();
    for (const list of lists) {
      for (const summary of list) {
        if (!byId.has(summary.id)) byId.set(summary.id, summary);
      }
    }
    return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title));
  }

  async get(id: string): Promise<Pattern | null> {
    for (const store of this.#stores) {
      const found = await store.get(id);
      if (found) return found;
    }
    return null;
  }

  async listByAuthor(authorId: string): Promise<readonly PatternSummary[]> {
    const lists = await Promise.all(this.#stores.map((store) => store.listByAuthor(authorId)));
    // Newest first, which each store already answers with and which is the
    // order somebody looking at their own work expects.
    return lists.flat();
  }
}
