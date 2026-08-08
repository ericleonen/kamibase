import {
  renderSvg,
  serializeCanonical,
  toCp,
  toFoldJson,
  type CreaseGraph,
  type KamiDocument,
} from "@kamibase/core";

/** Formats offered on the pattern page (DESIGN.md §8.3). */
export const DOWNLOAD_FORMATS = ["kami", "fold", "cp", "svg"] as const;

export type DownloadFormat = (typeof DOWNLOAD_FORMATS)[number];

export function isDownloadFormat(value: string): value is DownloadFormat {
  return (DOWNLOAD_FORMATS as readonly string[]).includes(value);
}

export const FORMAT_LABELS: Record<DownloadFormat, string> = {
  kami: ".kami",
  fold: ".fold",
  cp: ".cp",
  svg: ".svg",
};

export const FORMAT_HINTS: Record<DownloadFormat, string> = {
  kami: "Canonical Kamibase document: FOLD plus the kami: metadata block",
  fold: "Plain FOLD for Origami Simulator, the FOLD viewer and anything else FOLD-aware",
  cp: "ASCII crease list for ORIPA, Oriedita and Lang's tools",
  svg: "Vector drawing in the standard mountain/valley colours",
};

export interface RenderedDownload {
  readonly body: string;
  readonly contentType: string;
  readonly filename: string;
}

/**
 * Produce one downloadable representation of a pattern.
 *
 * Every format comes straight out of `@kamibase/core`, so what a visitor
 * downloads is byte-for-byte what the validator checked. The `.fold` is the
 * documented key-filter, and the `.kami` is the canonical serialization whose
 * hash is `kami:contentHash`.
 */
export function renderDownload(
  format: DownloadFormat,
  slug: string,
  document: KamiDocument,
  graph: CreaseGraph,
): RenderedDownload {
  switch (format) {
    case "kami":
      return {
        body: `${serializeCanonical(document)}\n`,
        contentType: "application/json; charset=utf-8",
        filename: `${slug}.kami`,
      };
    case "fold":
      return {
        body: toFoldJson(document),
        contentType: "application/json; charset=utf-8",
        filename: `${slug}.fold`,
      };
    case "cp":
      return {
        body: toCp({ graph }),
        contentType: "text/plain; charset=utf-8",
        filename: `${slug}.cp`,
      };
    case "svg":
      return {
        body: renderSvg(graph, {
          size: 1000,
          padding: 0,
          background: null,
          xmlDeclaration: true,
          title: typeof document.file_title === "string" ? document.file_title : slug,
        }),
        contentType: "image/svg+xml; charset=utf-8",
        filename: `${slug}.svg`,
      };
  }
}
