"use client";

import { useEffect, useRef } from "react";
import { toRgba } from "@kamibase/vision";
import { ORIGAMI_SIMULATOR_PALETTE } from "@kamibase/core";
import type { ScanReport } from "@/lib/scan/types";

/**
 * What was found, drawn on what it was found in.
 *
 * The rectified photograph underneath is the important half. A list of creases
 * on a white background looks plausible whatever it says; the same creases over
 * the paper they came from make a missed crease or an invented one obvious at a
 * glance, which is the only review that matters before this reaches the editor.
 *
 * Creases the solver was unsure about are drawn dashed. Mountain and valley are
 * the usual red and blue (DESIGN.md §3.3), so nothing here has to be relearned.
 */
export function ScanPreview({
  report,
  showPhoto,
}: {
  readonly report: ScanReport;
  readonly showPhoto: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext("2d");
    if (!context) return;

    const size = element.width;
    context.clearRect(0, 0, size, size);

    if (showPhoto) {
      const { size: rectifiedSize, gray } = report.rectified;
      const buffer = document.createElement("canvas");
      buffer.width = rectifiedSize;
      buffer.height = rectifiedSize;
      const bufferContext = buffer.getContext("2d");
      if (bufferContext) {
        // Written into an ImageData the context minted, rather than
        // constructing one around the array: `Uint8ClampedArray` is generic
        // over its buffer and the ImageData constructor insists on a plain
        // ArrayBuffer, which a worker transfer does not promise.
        const rgba = toRgba({ width: rectifiedSize, height: rectifiedSize, data: gray });
        const target = bufferContext.createImageData(rectifiedSize, rectifiedSize);
        target.data.set(rgba);
        bufferContext.putImageData(target, 0, 0);
        context.globalAlpha = 0.55;
        context.drawImage(buffer, 0, 0, size, size);
        context.globalAlpha = 1;
      }
    } else {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size, size);
    }

    context.lineCap = "round";
    for (const crease of report.creases) {
      const colour =
        crease.assignment === "M"
          ? ORIGAMI_SIMULATOR_PALETTE.M
          : crease.assignment === "V"
            ? ORIGAMI_SIMULATOR_PALETTE.V
            : crease.assignment === "B"
              ? ORIGAMI_SIMULATOR_PALETTE.B
              : "#8a8a8a";

      // Uncertainty is drawn, not merely reported. A dashed crease is one the
      // constraint could have flipped without complaint.
      const unsure = crease.assignment !== "B" && crease.confidence < 0.999;
      context.setLineDash(unsure ? [6, 5] : []);
      context.strokeStyle = colour;
      context.lineWidth = crease.assignment === "B" ? 3 : 2.2;

      context.beginPath();
      context.moveTo(crease.x1 * size, crease.y1 * size);
      context.lineTo(crease.x2 * size, crease.y2 * size);
      context.stroke();
    }
    context.setLineDash([]);
  }, [report, showPhoto]);

  return (
    <canvas
      ref={canvas}
      width={900}
      height={900}
      className="mx-auto w-full rounded-2xl"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        // The pattern is square, so an unbounded column makes it as tall as the
        // page is wide and pushes every control below the fold.
        maxWidth: "min(100%, 68vh)",
      }}
      role="img"
      aria-label={`${report.creases.length} creases detected, drawn over the flattened photograph.`}
    />
  );
}
