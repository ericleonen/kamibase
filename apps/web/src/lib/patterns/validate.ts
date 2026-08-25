import type { KamiLicense } from "@kamibase/core";

/**
 * Input rules for saving a pattern.
 *
 * Pure functions, no Supabase in sight, so the save form and the server action
 * share one set of rules and the tests can reach them directly. The database
 * enforces the same limits again as CHECK constraints; this layer exists to
 * produce a sentence a person can act on.
 */

export type Validated<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

function ok<T>(value: T): Validated<T> {
  return { ok: true, value };
}

function bad<T>(error: string): Validated<T> {
  return { ok: false, error };
}

export const TITLE_MAX = 120;
export const DESIGNER_MAX = 80;
export const DESCRIPTION_MAX = 2000;
export const TAG_MAX = 32;
export const TAGS_MAX = 12;

/**
 * The licences on offer, and what each one actually permits.
 *
 * A short list rather than a free text field. SPDX identifiers are the thing
 * DESIGN.md §2.3 stores, nobody types `CC-BY-NC-SA-4.0` correctly from memory,
 * and the two permissions below it are what a `.kami` file needs to carry so a
 * downstream tool can answer "may I redistribute this" without parsing prose.
 *
 * All rights reserved is the default, and it is the honest one: a pattern
 * somebody drew is theirs until they say otherwise, and a hub that defaults to
 * a permissive licence is deciding that for them.
 */
export const LICENSES: readonly {
  readonly spdx: string;
  readonly label: string;
  readonly terms: KamiLicense;
}[] = [
  {
    spdx: "LicenseRef-All-Rights-Reserved",
    label: "All rights reserved",
    terms: {
      spdx: "LicenseRef-All-Rights-Reserved",
      foldingAllowed: "personal",
      redistribution: "none",
    },
  },
  {
    spdx: "CC-BY-4.0",
    label: "CC BY 4.0 (credit me)",
    terms: { spdx: "CC-BY-4.0", foldingAllowed: "any", redistribution: "with-attribution" },
  },
  {
    spdx: "CC-BY-SA-4.0",
    label: "CC BY-SA 4.0 (credit me, share alike)",
    terms: { spdx: "CC-BY-SA-4.0", foldingAllowed: "any", redistribution: "with-attribution" },
  },
  {
    spdx: "CC-BY-NC-4.0",
    label: "CC BY-NC 4.0 (credit me, no commercial use)",
    terms: {
      spdx: "CC-BY-NC-4.0",
      foldingAllowed: "personal",
      redistribution: "with-attribution",
    },
  },
  {
    spdx: "CC0-1.0",
    label: "CC0 1.0 (public domain)",
    terms: { spdx: "CC0-1.0", foldingAllowed: "any", redistribution: "any" },
  },
];

export const DEFAULT_LICENSE = LICENSES[0]!.spdx;

/** The terms for an SPDX id, or all rights reserved for one we do not offer. */
export function licenseTerms(spdx: string): KamiLicense {
  return (LICENSES.find((entry) => entry.spdx === spdx) ?? LICENSES[0]!).terms;
}

/**
 * A title as a route: `Hex Twist Tessellation` becomes `hex-twist-tessellation`.
 *
 * The shape is the one the database's CHECK constraint enforces and the one
 * `folds.pattern_id` already assumes, so anything this returns is a legal
 * pattern reference everywhere in the app. Accented letters are folded to their
 * base form rather than dropped, so `Miura-ori Étoile` keeps its `etoile`
 * instead of turning into `miura-ori-toile`.
 */
export function slugify(title: string): string {
  const folded = title
    .normalize("NFKD")
    // Combining marks, left behind by the decomposition above.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // The constraint caps the length at 80, and refuses a trailing hyphen.
  return folded.slice(0, 80).replace(/-+$/, "");
}

/**
 * The slugs to try for a title, best first.
 *
 * Collisions are ordinary: two people can each draw a bird base, and the second
 * one should get `bird-base-2` rather than an error about a name they did not
 * choose. An untitled or entirely non-Latin title slugs to nothing, so there is
 * a fallback that is still a legal route.
 */
export function slugCandidates(title: string, attempts = 8): string[] {
  const base = slugify(title) || "pattern";
  const room = 80 - 4;
  const trimmed = base.length > room ? base.slice(0, room).replace(/-+$/, "") : base;
  const candidates = [trimmed];
  for (let n = 2; n <= attempts; n += 1) candidates.push(`${trimmed}-${n}`);
  return candidates;
}

export interface PatternDraft {
  readonly title: string;
  readonly designer: string;
  readonly description: string;
  readonly license: string;
  readonly tags: readonly string[];
  readonly difficulty?: number;
}

/**
 * Fold a comma-separated tag field into a clean list.
 *
 * Lowercased and de-duplicated, because `Tessellation` and `tessellation` are
 * one tag and a facet list that shows both is a facet list nobody trusts.
 */
export function normalizeTags(input: string): string[] {
  const seen = new Set<string>();
  for (const raw of input.split(",")) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, TAG_MAX);
    if (tag !== "") seen.add(tag);
    if (seen.size >= TAGS_MAX) break;
  }
  return [...seen];
}

export function validatePatternDraft(input: {
  title: string;
  designer: string;
  description: string;
  license: string;
  tags: string;
  difficulty: string;
}): Validated<PatternDraft> {
  const title = input.title.trim().replace(/\s+/g, " ");
  if (title === "") return bad("Give the pattern a title.");
  if (title.length > TITLE_MAX) {
    return bad(`Keep the title under ${TITLE_MAX} characters. That one is ${title.length}.`);
  }
  if (slugify(title) === "") {
    return bad("That title has no letters or numbers in it, so it cannot be a web address.");
  }

  const designer = input.designer.trim().slice(0, DESIGNER_MAX);

  const description = input.description.trim();
  if (description.length > DESCRIPTION_MAX) {
    return bad(
      `Keep the description under ${DESCRIPTION_MAX} characters. That one is ${description.length}.`,
    );
  }

  const license = LICENSES.some((entry) => entry.spdx === input.license)
    ? input.license
    : DEFAULT_LICENSE;

  const difficulty = input.difficulty.trim();
  let rating: number | undefined;
  if (difficulty !== "") {
    const value = Number(difficulty);
    if (!Number.isInteger(value) || value < 1 || value > 10) {
      return bad("Difficulty is a whole number from 1 to 10, or blank.");
    }
    rating = value;
  }

  return ok({
    title,
    designer,
    description,
    license,
    tags: normalizeTags(input.tags),
    ...(rating === undefined ? {} : { difficulty: rating }),
  });
}
