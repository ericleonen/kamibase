/**
 * Downscale a photo in the browser before it is uploaded.
 *
 * Phone cameras produce 4 to 12MB files, and none of that resolution survives
 * being displayed in a 600px card. Resizing on the client means a fold posted
 * over mobile data uploads in a second instead of thirty, and it keeps the
 * request comfortably under the server action's body limit.
 *
 * It is a convenience, not a control. The server action validates type and size
 * again, and the storage bucket enforces both a third time, because anything
 * done in the browser can be skipped.
 */

export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * The largest size that fits inside a square of `max` while keeping the aspect
 * ratio. Images already smaller than the box are left alone rather than being
 * scaled up into blur.
 */
export function fitWithin(size: Size, max: number): Size {
  const { width, height } = size;
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= max) return { width: Math.round(width), height: Math.round(height) };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export interface DownscaleOptions {
  /** Longest edge of the result, in pixels. */
  readonly maxEdge: number;
  /** JPEG quality, 0 to 1. */
  readonly quality?: number;
}

export const AVATAR_MAX_EDGE = 512;
export const FOLD_PHOTO_MAX_EDGE = 1600;

/**
 * Resize `file` to fit `maxEdge` and re-encode it as JPEG.
 *
 * Returns the original file untouched if anything goes wrong: an image the
 * browser cannot decode, a canvas that refuses to export, an environment with
 * no canvas at all. A slow upload beats a failed one, and the server checks the
 * result either way.
 */
export async function downscaleImage(
  file: File,
  options: DownscaleOptions,
): Promise<File> {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const target = fitWithin({ width: bitmap.width, height: bitmap.height }, options.maxEdge);
    if (target.width === 0 || target.height === 0) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, target.width, target.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", options.quality ?? 0.85);
    });
    if (!blob) return file;

    // Re-encoding a small PNG as JPEG can make it bigger. Keep whichever is
    // smaller, since the point of this whole function is a smaller upload.
    if (blob.size >= file.size) return file;

    return new File([blob], renameToJpeg(file.name), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export function renameToJpeg(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base === "" ? "photo" : base}.jpg`;
}
