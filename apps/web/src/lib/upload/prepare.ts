"use client";

import { toRgba } from "@kamibase/vision";
import { fromRgba, guessPaperQuad, insetQuad } from "@kamibase/vision";
import { docFromGraph, type EditorDoc } from "@/lib/editor/model";
import { loadMedia } from "@/lib/scan/media";
import { scanImage } from "@/lib/scan/runner";
import { DEFAULT_TUNING } from "@/lib/scan/types";
import {
  conversionFromScan,
  convertUpload,
  MAX_UPLOAD_BYTES,
  UPLOAD_ACCEPT,
} from "./convert";

/**
 * One file in, an editable document out.
 *
 * The upload flow used to end at a review panel: a grade, a confidence, a
 * style table, a list of what had been guessed. All of it true, and all of it
 * asking someone who wanted to draw to first form an opinion about Maekawa.
 *
 * So the decisions are made here instead, with the best settings we have, and
 * the result goes straight to the editor. For a photograph the rectified image
 * comes too, as a backdrop to trace over, which is a better answer to "did it
 * read this right" than any amount of reporting: you can see it underneath.
 */

export interface PreparedUpload {
  readonly title: string;
  readonly slug: string;
  readonly doc: EditorDoc;
  /**
   * The source, rectified into the unit square, as a data URL. Present for
   * photographs and video only.
   *
   * Only when it is *exactly* aligned. The rectified square is the very image
   * the creases were detected in, so it lines up by construction. A raw SVG
   * would not: `ingest` normalizes a pattern's bounding box to the unit square
   * preserving aspect, and the file's own viewBox rarely matches that, so a
   * backdrop from one would sit a few percent off and quietly mislead every
   * line traced against it.
   */
  readonly backdrop?: string;
}

export type PrepareResult =
  | { readonly ok: true; readonly upload: PreparedUpload }
  | { readonly ok: false; readonly error: string };

/** What the file picker offers, kept next to the list the parsers agree on. */
export const ACCEPTED = UPLOAD_ACCEPT;

/**
 * Is this a photograph or a video, as opposed to a file that states its own
 * creases?
 *
 * The SVG exclusion is not a detail. A file dialog hands back `image/svg+xml`
 * for a `.svg`, so a plain `startsWith("image/")` sends drawings through the
 * crease detector, which decodes them as pictures, fails, and reports that the
 * image could not be read. It is a text format and it is parsed as one.
 */
export function isMediaFile(file: File): boolean {
  if (/\.svg$/i.test(file.name) || file.type === "image/svg+xml") return false;
  if (file.type.startsWith("image/") || file.type.startsWith("video/")) return true;
  // Some browsers hand back an empty type for a file they do not recognise,
  // and a photograph read as text fails in a much less obvious way.
  return /\.(jpe?g|png|gif|webp|avif|heic|heif|bmp|tiff?|mp4|mov|m4v|webm|avi|mkv)$/i.test(
    file.name,
  );
}

export async function prepareUpload(file: File): Promise<PrepareResult> {
  if (!isMediaFile(file) && file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `${file.name} is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`,
    };
  }

  return isMediaFile(file) ? prepareMedia(file) : prepareTextFile(file);
}

async function prepareTextFile(file: File): Promise<PrepareResult> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: `${file.name} could not be read.` };
  }

  const converted = convertUpload(text, file.name);
  if (!converted.ok) {
    return { ok: false, error: converted.hint ?? converted.message };
  }

  return {
    ok: true,
    upload: {
      title: converted.title,
      slug: converted.slug,
      doc: docFromGraph(converted.graph),
    },
  };
}

async function prepareMedia(file: File): Promise<PrepareResult> {
  let frame: ImageData;
  try {
    const media = await loadMedia(file);
    const best = media.frames[0];
    if (!best) return { ok: false, error: "No usable frame in that file." };
    frame = best.image;
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "That file could not be read.",
    };
  }

  // The corners, guessed and not asked about. Getting them wrong costs some
  // accuracy in the angles; asking costs a step, and the backdrop lets anyone
  // see and fix the result by hand anyway.
  const gray = fromRgba(frame.data, frame.width, frame.height);
  let quad;
  try {
    quad = guessPaperQuad(gray);
  } catch {
    quad = insetQuad(gray, 0.02);
  }

  try {
    const run = await scanImage({
      width: frame.width,
      height: frame.height,
      pixels: new Uint8ClampedArray(frame.data),
      quad,
      tuning: DEFAULT_TUNING,
    });

    const converted = conversionFromScan(
      run.report.creases.map((crease) => ({
        x1: crease.x1,
        y1: crease.y1,
        x2: crease.x2,
        y2: crease.y2,
        assignment: crease.assignment,
      })),
      run.report.confidence,
      [],
      file.name,
    );
    if (!converted.ok) return { ok: false, error: converted.message };

    const backdrop = rectifiedDataUrl(run.report.rectified);
    return {
      ok: true,
      upload: {
        title: converted.title,
        slug: converted.slug,
        doc: docFromGraph(converted.graph),
        ...(backdrop === undefined ? {} : { backdrop }),
      },
    };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "That photo could not be read.",
    };
  }
}

/** The rectified square as a PNG data URL, for the canvas to sit on top of. */
function rectifiedDataUrl(rectified: { size: number; gray: Float32Array }): string | undefined {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = rectified.size;
    canvas.height = rectified.size;
    const context = canvas.getContext("2d");
    if (!context) return undefined;

    const rgba = toRgba({
      width: rectified.size,
      height: rectified.size,
      data: rectified.gray,
    });
    const image = context.createImageData(rectified.size, rectified.size);
    image.data.set(rgba);
    context.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return undefined;
  }
}
