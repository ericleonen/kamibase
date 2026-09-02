import { ingest, type IngestResult, type KamiDocument, type ValidationLevel } from "@kamibase/core";
import { graphFromDoc, type EditorDoc } from "@/lib/editor/model";
import { summarise } from "./document";
import { ulid } from "./ulid";
import { licenseTerms, type PatternDraft } from "./validate";

/**
 * A drawing plus a filled-in form, as the row that gets written.
 *
 * Kept apart from the server action so it can be tested directly and so that
 * nothing here needs a database, a session or a request. The action's job is
 * authentication, a free slug and the insert; deciding what a saved pattern
 * *is* happens here.
 */

/** The row `public.patterns` takes. Column names, because it is a row. */
export interface PatternRow {
  readonly slug: string;
  readonly author_id: string;
  readonly title: string;
  readonly designer: string;
  readonly description: string;
  readonly license: string;
  readonly difficulty: number | null;
  readonly tags: string[];
  readonly document: KamiDocument;
  readonly content_hash: string;
  readonly level: ValidationLevel;
  readonly flat_foldable: boolean;
  readonly paper_shape: string;
  readonly vertex_count: number;
  readonly edge_count: number;
  readonly face_count: number;
  readonly mountain_count: number;
  readonly valley_count: number;
}

/**
 * Turn the editor's segments into a graded `.kami` document.
 *
 * The same `ingest` the seed script and the upload converter run: canonicalize,
 * planarize, find faces, stamp the content hash, grade. Running it on the
 * server rather than trusting a document from the browser is what stops a
 * client posting geometry whose hash and grade it made up.
 */
export function ingestPattern(input: {
  readonly draft: PatternDraft;
  readonly doc: EditorDoc;
  /** Who is saving it, used as the designer when they did not name one. */
  readonly savedBy: string;
  /** Fixed only by the tests; a real save gets a fresh ULID. */
  readonly kamiId?: string;
}): IngestResult {
  return ingest(graphFromDoc(input.doc), {
    document: patternDocument(input.draft, input.savedBy, input.kamiId ?? ulid()) as KamiDocument,
  });
}

/**
 * The metadata a saved pattern carries.
 *
 * `ingest` merges this over the defaults `documentFromGraph` produces, so
 * everything not named here (the FOLD frame keys, the geometry, the content
 * hash) still comes from core rather than from this file.
 *
 * The designer and the person saving are separate fields on purpose. The
 * designer is whoever worked the pattern out, which is often not whoever typed
 * it in, and a hub that conflates the two starts misattributing other people's
 * designs the first time somebody transcribes one.
 */
export function patternDocument(
  draft: PatternDraft,
  savedBy: string,
  kamiId: string,
): Partial<KamiDocument> {
  const designer = draft.designer === "" ? savedBy : draft.designer;
  return {
    file_title: draft.title,
    file_author: designer,
    file_creator: "Kamibase editor",
    ...(draft.description === "" ? {} : { file_description: draft.description }),
    "kami:id": kamiId,
    // The editor draws on a unit square, and nothing in it can change that.
    "kami:paper": { shape: "square" },
    ...(draft.difficulty === undefined
      ? {}
      : { "kami:difficulty": { rating: draft.difficulty } }),
    "kami:taxonomy": { tags: [...draft.tags] },
    "kami:provenance": { designer },
    "kami:license": licenseTerms(draft.license),
  } as Partial<KamiDocument>;
}

/**
 * The row for a pattern that has just been ingested.
 *
 * Every derived column comes from {@link summarise}, the same function the
 * seeded library's cards come from, so a saved pattern and a seeded one cannot
 * describe themselves differently.
 */
export function patternRow(input: {
  readonly slug: string;
  readonly authorId: string;
  readonly result: IngestResult;
}): PatternRow {
  const { result } = input;
  const summary = summarise(
    input.slug,
    result.document,
    result.graph,
    result.grade.level,
    result.grade.flatFold?.flatFoldable ?? false,
  );

  return {
    slug: input.slug,
    author_id: input.authorId,
    title: summary.title,
    // "Unknown" is what a summary shows for a document with no designer at
    // all. It is a rendering, not a name, so it does not go in the column.
    designer: summary.designer === "Unknown" ? "" : summary.designer,
    description: summary.description ?? "",
    license: summary.license,
    difficulty: summary.difficulty ?? null,
    tags: [...summary.tags],
    document: result.document,
    content_hash: result.contentHash,
    level: summary.level,
    flat_foldable: summary.flatFoldable,
    paper_shape: summary.paperShape,
    vertex_count: summary.vertexCount,
    edge_count: summary.edgeCount,
    face_count: summary.faceCount,
    mountain_count: summary.mountainCount,
    valley_count: summary.valleyCount,
  };
}

/**
 * The metadata columns, from a filled-in form.
 *
 * The subset of {@link PatternRow} an edit may touch: what a person typed, and
 * nothing derived from geometry. `slug` is not here either, and that is the
 * point — a title can change, a URL cannot, because folds reference a pattern
 * by slug and somebody has already sent that link to somebody else.
 */
export type PatternMetadataRow = Pick<
  PatternRow,
  "title" | "designer" | "description" | "license" | "difficulty" | "tags"
>;

export function patternMetadataRow(draft: PatternDraft): PatternMetadataRow {
  return {
    title: draft.title,
    designer: draft.designer,
    description: draft.description,
    license: draft.license,
    difficulty: draft.difficulty ?? null,
    tags: [...draft.tags],
  };
}

/**
 * The same edit, applied to the `.kami` document.
 *
 * Both, and not one or the other, because both are read. The columns are what
 * a listing sorts and filters on; the document is what `/p/:slug` renders from
 * and what the `.kami` download hands over, and `patternFromDocument` reads its
 * title out of `file_title` rather than out of the row. Writing only the
 * columns renames a pattern everywhere except on its own page.
 *
 * The geometry is untouched, so `kami:contentHash` still describes it. That is
 * the whole reason a metadata edit is a different operation from a save: two
 * copies of the same creases under different names are still the same creases,
 * and the hash is what says so.
 */
export function withMetadata(document: KamiDocument, draft: PatternDraft): KamiDocument {
  const next: Record<string, unknown> = { ...document };
  const taxonomy = asRecord(next["kami:taxonomy"]);
  const provenance = asRecord(next["kami:provenance"]);

  next["file_title"] = draft.title;
  if (draft.description === "") delete next["file_description"];
  else next["file_description"] = draft.description;

  // `file_author` is FOLD's own field and stays in step with ours, so a file
  // opened in another tool shows the same name.
  if (draft.designer === "") {
    delete next["file_author"];
    next["kami:provenance"] = omit(provenance, "designer");
  } else {
    next["file_author"] = draft.designer;
    next["kami:provenance"] = { ...provenance, designer: draft.designer };
  }
  if (Object.keys(next["kami:provenance"] as object).length === 0) {
    delete next["kami:provenance"];
  }

  next["kami:license"] = licenseTerms(draft.license);

  const difficulty = asRecord(next["kami:difficulty"]);
  const withRating =
    draft.difficulty === undefined
      ? omit(difficulty, "rating")
      : { ...difficulty, rating: draft.difficulty };
  if (Object.keys(withRating).length === 0) delete next["kami:difficulty"];
  else next["kami:difficulty"] = withRating;

  const withTags =
    draft.tags.length === 0
      ? omit(taxonomy, "tags")
      : { ...taxonomy, tags: [...draft.tags] };
  if (Object.keys(withTags).length === 0) delete next["kami:taxonomy"];
  else next["kami:taxonomy"] = withTags;

  return next as KamiDocument;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

function omit(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const { [key]: _removed, ...rest } = record;
  return rest;
}
