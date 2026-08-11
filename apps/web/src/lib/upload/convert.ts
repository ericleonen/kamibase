import {
  ParseError,
  detectFormat,
  ingest,
  parse,
  parseSvg,
  type CreaseGraph,
  type EdgeAssignment,
  type GradeResult,
  type KamiDocument,
  type SourceFormat,
  type SvgStyleSummary,
} from "@kamibase/core";

/** What the file picker offers, and what the drop zone accepts. */
export const UPLOAD_ACCEPT = ".kami,.fold,.cp,.opx,.svg";

/**
 * Refuse to read anything larger. The whole conversion runs in the browser, so
 * the only thing protected here is the tab: a 40MB SVG of a photo traced by
 * accident would spend a minute planarizing before saying it found no creases.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * The publishing gate of DESIGN.md §3.4: "≥0.95 auto-publishable, 0.7–0.95
 * needs review, <0.7 blocked from publishing".
 */
export const CONFIDENCE_THRESHOLDS = { publishable: 0.95, review: 0.7 } as const;

export type ReviewLevel = "publishable" | "review" | "blocked";

export interface Conversion {
  readonly ok: true;
  readonly format: SourceFormat;
  /** Slug for downloads and the editor's autosave key. */
  readonly slug: string;
  readonly title: string;
  readonly document: KamiDocument;
  readonly graph: CreaseGraph;
  readonly grade: GradeResult;
  /** 0-1. Always 1 for formats that state their assignments outright. */
  readonly confidence: number;
  readonly review: ReviewLevel;
  /** Why the review level is what it is, in one line each. */
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
  /** The SVG style table (§3.3), empty for every other format. */
  readonly styles: readonly SvgStyleSummary[];
}

export interface ConversionFailure {
  readonly ok: false;
  readonly message: string;
  /** What to try instead. */
  readonly hint?: string;
}

export type ConversionResult = Conversion | ConversionFailure;

export interface ConvertOptions {
  /** Per-style assignment overrides for SVG, keyed by `SvgStyleSummary.key`. */
  readonly assignments?: Readonly<Record<string, EdgeAssignment>>;
}

const SUPPORTED = ".fold, .kami, .cp, .opx and .svg";

/**
 * The `DETECT → PARSE → CLEAN → TOPOLOGY → VALIDATE` pipeline of DESIGN.md
 * §3.2, run in the browser.
 *
 * Every step is `@kamibase/core`, which is the point of §9: what the upload
 * page grades is what the server would grade, because it is the same code.
 * Phase 2's worker queue will call this same function with the same arguments;
 * doing it client-side first means the conversion works today, with no
 * infrastructure, and the user can fix a bad file in the editor before anyone
 * has stored anything.
 */
export function convertUpload(
  text: string,
  filename: string,
  options: ConvertOptions = {},
): ConversionResult {
  const format = detectFormat(text, filename);
  if (format === null) {
    return {
      ok: false,
      message: `Kamibase could not tell what kind of file ${filename || "this"} is.`,
      hint: `Supported inputs are ${SUPPORTED}. Photos and scans are not converted yet.`,
    };
  }

  try {
    // SVG goes through `parseSvg` directly rather than `parse`, because the
    // style table is the whole review UI and only the specific parser has it.
    const svg =
      format === "svg"
        ? parseSvg(text, {
            ...(options.assignments === undefined
              ? {}
              : { assignments: options.assignments }),
          })
        : null;
    const parsed = svg ?? parse(text, { format, filename });

    const title = parsed.metadata.title?.trim() || titleFromFilename(filename);
    const confidence = parsed.confidence ?? 1;
    const result = ingest(parsed, {
      metadata: {
        title,
        ...(parsed.metadata.author === undefined ? {} : { author: parsed.metadata.author }),
        creator: "Kamibase 0.1 (converter: kamibase-web)",
        extra: {
          "kami:provenance": {
            ...(parsed.metadata.author === undefined
              ? {}
              : { designer: parsed.metadata.author }),
            convertedFrom: {
              format,
              converter: "kamibase-web@0.1",
              confidence: Math.round(confidence * 1000) / 1000,
              reviewedByHuman: false,
            },
          },
        },
      },
    });

    const { review, reasons } = gate(confidence, result.grade);
    return {
      ok: true,
      format,
      slug: slugFromFilename(filename),
      title,
      document: result.document,
      graph: result.graph,
      grade: result.grade,
      confidence,
      review,
      reasons,
      warnings: result.warnings,
      styles: svg?.styles ?? [],
    };
  } catch (error) {
    if (error instanceof ParseError) {
      return {
        ok: false,
        message: `That file looks like ${format.toUpperCase()}, but it could not be read: ${stripPrefix(error.message, format)}`,
        hint: "Re-export it from the editor you drew it in, or open a fresh pattern in the editor.",
      };
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : "The conversion failed.",
    };
  }
}

/** Which of the §3.4 buckets a conversion lands in, and why. */
function gate(
  confidence: number,
  grade: GradeResult,
): { review: ReviewLevel; reasons: string[] } {
  const reasons: string[] = [];
  const structural = grade.level === "invalid" || grade.level === "L0";

  if (structural) {
    reasons.push(
      grade.level === "invalid"
        ? "No usable geometry was found in the file."
        : "The pattern has structural defects, so it cannot be published until it reaches L1.",
    );
  }
  if (confidence < CONFIDENCE_THRESHOLDS.review) {
    reasons.push(
      `Only ${percent(confidence)} of the creases were identified with confidence. ` +
        "Check every assignment in the editor before publishing.",
    );
  } else if (confidence < CONFIDENCE_THRESHOLDS.publishable) {
    reasons.push(
      `${percent(confidence)} confidence in the crease assignments. ` +
        "Have a look at the ones the converter was unsure about.",
    );
  }

  if (structural || confidence < CONFIDENCE_THRESHOLDS.review) {
    return { review: "blocked", reasons };
  }
  if (confidence < CONFIDENCE_THRESHOLDS.publishable) return { review: "review", reasons };
  return { review: "publishable", reasons };
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** `Bird base (1).cp` → `bird-base-1`. */
export function slugFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  const slug = base
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug === "" ? "imported-pattern" : slug;
}

/** `bird_base-32.cp` → `Bird base 32`. */
export function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  if (base === "") return "Imported pattern";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** `ParseError` prefixes its message with the format; the UI already said it. */
function stripPrefix(message: string, format: string): string {
  return message.startsWith(`${format}:`) ? message.slice(format.length + 1).trim() : message;
}
