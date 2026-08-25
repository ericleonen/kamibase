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
