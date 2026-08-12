"use client";

import { fromRgba, sharpness } from "@kamibase/vision";

/**
 * Getting pixels out of whatever the user picked.
 *
 * A photo is straightforward. A video is the interesting case, and it is worth
 * supporting for a reason that has nothing to do with motion: people hold
 * phones badly. Half the frames of a five-second clip are motion-blurred and
 * one or two are sharp, and a sharp frame is worth more to a line detector than
 * any amount of averaging. So a video is treated as a burst of stills to choose
 * between rather than as footage.
 */

/** Longest edge kept. Beyond this is memory spent resolving paper fibre. */
export const MAX_SOURCE_EDGE = 2000;

export interface LoadedFrame {
  readonly image: ImageData;
  /** Where in the video it came from, in seconds. Absent for a photo. */
  readonly time?: number;
  /** Laplacian variance. Only comparable between frames of the same clip. */
  readonly sharpness: number;
}

export interface LoadedMedia {
  readonly kind: "image" | "video";
  /** Best first. A photo yields exactly one. */
  readonly frames: readonly LoadedFrame[];
}

export function isVideo(file: File): boolean {
  return file.type.startsWith("video/");
}

export async function loadMedia(file: File): Promise<LoadedMedia> {
  if (isVideo(file)) {
    return { kind: "video", frames: await extractVideoFrames(file) };
  }
  const image = await imageDataFromBlob(file);
  return { kind: "image", frames: [{ image, sharpness: sharpnessOf(image) }] };
}

function sharpnessOf(image: ImageData): number {
  return sharpness(fromRgba(image.data, image.width, image.height));
}

/** Decode a still and scale it down to something worth working on. */
export async function imageDataFromBlob(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  try {
    return drawToImageData(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

function drawToImageData(
  source: CanvasImageSource,
  width: number,
  height: number,
): ImageData {
  const scale = Math.min(1, MAX_SOURCE_EDGE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This browser would not give us a 2D canvas.");

  context.drawImage(source, 0, 0, w, h);
  return context.getImageData(0, 0, w, h);
}

/** How many frames to sample across a clip. */
const FRAME_SAMPLES = 9;

/**
 * Sample a clip and return its frames, sharpest first.
 *
 * Seeking rather than playing: a play-and-grab loop is at the mercy of the
 * frame rate and of whether the tab is in the foreground, while seeking to a
 * timestamp and waiting for `seeked` is deterministic and finishes in about a
 * second for nine frames.
 */
export async function extractVideoFrames(file: File): Promise<LoadedFrame[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  try {
    await waitFor(video, "loadedmetadata");

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width === 0 || height === 0) {
      throw new Error("That video had no picture we could read.");
    }

    const frames: LoadedFrame[] = [];
    for (let i = 0; i < FRAME_SAMPLES; i += 1) {
      // Skip the very start and end, which are where the phone was still being
      // pointed at something else.
      const time =
        duration > 0.4 ? 0.15 * duration + ((0.7 * duration) / (FRAME_SAMPLES - 1)) * i : 0;

      try {
        await seekTo(video, time);
      } catch {
        continue;
      }

      const image = drawToImageData(video, width, height);
      frames.push({ image, time, sharpness: sharpnessOf(image) });
    }

    if (frames.length === 0) {
      throw new Error("No frames could be read out of that video.");
    }

    return [...frames].sort((a, b) => b.sharpness - a.sharpness);
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

function waitFor(element: HTMLVideoElement, event: string, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (): void => {
      clearTimeout(timer);
      element.removeEventListener(event, onEvent);
      element.removeEventListener("error", onError);
    };
    const onEvent = (): void => {
      done();
      resolve();
    };
    const onError = (): void => {
      done();
      reject(new Error("That file could not be decoded in this browser."));
    };
    const timer = setTimeout(() => {
      done();
      reject(new Error("Reading that video timed out."));
    }, timeoutMs);

    element.addEventListener(event, onEvent, { once: true });
    element.addEventListener("error", onError, { once: true });
  });
}

async function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 1e-3 && video.readyState >= 2) return;
  const seeked = waitFor(video, "seeked", 8_000);
  video.currentTime = time;
  await seeked;
}

/** Draw an `ImageData` into a canvas, scaled to fit, and report the mapping. */
export function drawFitted(
  canvas: HTMLCanvasElement,
  image: ImageData,
): { scale: number; offsetX: number; offsetY: number } {
  const context = canvas.getContext("2d");
  if (!context) return { scale: 1, offsetX: 0, offsetY: 0 };

  const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = (canvas.width - drawWidth) / 2;
  const offsetY = (canvas.height - drawHeight) / 2;

  // putImageData ignores transforms, so the frame goes through an offscreen
  // canvas first and is then drawn scaled.
  const buffer = document.createElement("canvas");
  buffer.width = image.width;
  buffer.height = image.height;
  buffer.getContext("2d")?.putImageData(image, 0, 0);

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(buffer, offsetX, offsetY, drawWidth, drawHeight);

  return { scale, offsetX, offsetY };
}
