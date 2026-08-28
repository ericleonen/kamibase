/**
 * What you looked for last time.
 *
 * The browser already offers this, sort of: type into a named field inside a
 * form and Chrome shows its own autofill list, in its own font, at its own
 * width, containing whatever you have ever typed into a field with that name on
 * any site. It is not ours, it cannot be styled, and it is not really search
 * history — it is form history. So this replaces it.
 *
 * `localStorage`, and nothing leaves the browser. A list of the things somebody
 * searched for is a small confession, and there is no reason for the server to
 * hold one to make a dropdown work.
 */

export const SEARCHES_KEY = "kamibase:searches";

/**
 * How many to keep.
 *
 * Enough that yesterday's search is still there, few enough that the list is a
 * memory aid rather than an archive to scroll.
 */
export const MAX_SEARCHES = 8;

/** Longer than this is a paste, not a search worth offering again. */
const MAX_LENGTH = 120;

export function readSearches(): readonly string[] {
  try {
    const stored = window.localStorage.getItem(SEARCHES_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string").slice(0, MAX_SEARCHES);
  } catch {
    // Unparseable or unavailable. An empty history is a fine answer.
    return [];
  }
}

function write(searches: readonly string[]): readonly string[] {
  try {
    window.localStorage.setItem(SEARCHES_KEY, JSON.stringify(searches));
  } catch {
    // Private mode, or the quota is full. The list is still right for this
    // page's lifetime, which is most of what it is for.
  }
  return searches;
}

/**
 * Remember a search, newest first, no duplicates.
 *
 * Case-insensitive on the way in, because "Miura" and "miura" are the same
 * search and offering both back would make the list look broken. The spelling
 * that survives is the most recent one.
 */
export function rememberSearch(query: string): readonly string[] {
  const trimmed = query.trim().slice(0, MAX_LENGTH);
  if (!trimmed) return readSearches();
  const rest = readSearches().filter(
    (entry) => entry.toLowerCase() !== trimmed.toLowerCase(),
  );
  return write([trimmed, ...rest].slice(0, MAX_SEARCHES));
}

export function forgetSearch(query: string): readonly string[] {
  return write(readSearches().filter((entry) => entry !== query));
}

export function clearSearches(): readonly string[] {
  return write([]);
}

/**
 * The ones worth showing for what has been typed so far.
 *
 * A substring match rather than a prefix: somebody who half-remembers "Miura"
 * from "Miura-ori 16×12" should get it by typing the middle. The search itself
 * is already substring-based, so this matches how the results will behave.
 */
export function matchSearches(
  searches: readonly string[],
  query: string,
): readonly string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return searches;
  return searches.filter(
    (entry) => entry.toLowerCase().includes(needle) && entry.toLowerCase() !== needle,
  );
}
