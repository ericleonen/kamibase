"use client";

import { runScan } from "./pipeline";
import type { ScanReport, ScanRequest, ScanResponse } from "./types";

/**
 * Run a scan in a worker, or on the main thread if a worker cannot be had.
 *
 * The fallback is not defensive padding. Worker construction depends on the
 * bundler emitting a separate chunk and on the browser allowing it, and both
 * have failed before in ways that only show up in a production build. Since the
 * pipeline is a pure function either way, the cost of surviving that is a
 * try/catch and a slower second, which is a much better outcome than a feature
 * that works locally and is dead on the deployed site.
 */

let workerFailed = false;

function createWorker(): Worker | null {
  if (workerFailed || typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("../../workers/scan.worker.ts", import.meta.url), {
      type: "module",
    });
  } catch {
    workerFailed = true;
    return null;
  }
}

export interface ScanRun {
  readonly report: ScanReport;
  /** False when the worker was unavailable and the page did the work itself. */
  readonly offMainThread: boolean;
}

export function scanImage(request: ScanRequest, signal?: AbortSignal): Promise<ScanRun> {
  const worker = createWorker();

  if (!worker) {
    // Yield first, so the caller's "working…" state gets a chance to paint
    // before the thread is taken for a second.
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve({ report: runScan(request), offMainThread: false });
        } catch (error) {
          reject(error instanceof Error ? error : new Error("The scan failed."));
        }
      }, 16);
    });
  }

  return new Promise<ScanRun>((resolve, reject) => {
    let settled = false;

    const cleanup = (): void => {
      worker.onmessage = null;
      worker.onerror = null;
      signal?.removeEventListener("abort", onAbort);
      worker.terminate();
    };

    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new DOMException("Scan cancelled", "AbortError"));
    };

    worker.onmessage = (event: MessageEvent<ScanResponse>) => {
      if (settled) return;
      settled = true;
      const data = event.data;
      cleanup();
      if (data.ok) resolve({ report: data.report, offMainThread: true });
      else reject(new Error(data.error));
    };

    worker.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      // The worker existed but could not run. Do not try another one this
      // session; fall back for the rest of it.
      workerFailed = true;
      try {
        resolve({ report: runScan(request), offMainThread: false });
      } catch (error) {
        reject(error instanceof Error ? error : new Error("The scan failed."));
      }
    };

    signal?.addEventListener("abort", onAbort);
    worker.postMessage(request);
  });
}
