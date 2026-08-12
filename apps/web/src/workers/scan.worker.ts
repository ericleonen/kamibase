/// <reference lib="webworker" />

import { runScan } from "@/lib/scan/pipeline";
import type { ScanRequest, ScanResponse } from "@/lib/scan/types";

/**
 * The scan, off the main thread.
 *
 * A Hough transform over a 900px square takes about a second. On the main
 * thread that is a second in which the page does not scroll, the corner
 * handles do not move, and the tuning slider the user is dragging stops
 * following their finger, which reads as a broken page rather than a busy one.
 *
 * There is nothing here but a message handler: all of the work is in
 * `runScan`, which the page can also call directly if this worker fails to
 * load. See `runner.ts`.
 */

self.onmessage = (event: MessageEvent<ScanRequest>) => {
  try {
    const report = runScan(event.data);
    const response: ScanResponse = { ok: true, report };
    // The rectified preview is about 3MB. Transferring rather than copying it
    // keeps the round trip from costing more than the scan did.
    self.postMessage(response, [report.rectified.gray.buffer]);
  } catch (error) {
    const response: ScanResponse = {
      ok: false,
      error: error instanceof Error ? error.message : "The scan failed.",
    };
    self.postMessage(response);
  }
};
