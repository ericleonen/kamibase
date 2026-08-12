import type { Metadata } from "next";
import { ScanStudio, ScanTips } from "@/components/scan/ScanStudio";

export const metadata: Metadata = {
  title: "Scan a crease pattern",
  description:
    "Photograph a creased sheet of paper and get an editable crease pattern. " +
    "The lines come from the photo; the mountains and valleys come from the geometry.",
};

/**
 * The raster import funnel of DESIGN.md §3.3.
 *
 * Everything runs in the browser: the photograph is never uploaded, no key is
 * needed, and no account is required. That is partly DESIGN.md §8.4 (never gate
 * the magic behind a signup wall) and partly that the whole pipeline is a few
 * hundred lines of arithmetic over a Float32Array, so there is nothing a server
 * would add except a round trip and a privacy question.
 */
export default function ScanPage() {
  return (
    <div className="space-y-10 py-2">
      <ScanStudio />
      <ScanTips />
    </div>
  );
}
