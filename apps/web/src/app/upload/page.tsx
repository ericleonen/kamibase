import type { Metadata } from "next";
import { UploadConverter } from "@/components/upload/UploadConverter";

export const metadata: Metadata = {
  title: "Convert a crease pattern",
  description:
    "Turn a .fold, .cp, .opx or SVG crease pattern into a clean, validated .kami file, in your browser.",
};

/**
 * The upload funnel's front door (DESIGN.md §8.2).
 *
 * No account required, and nothing leaves the browser: the conversion is
 * `@kamibase/core` running client-side. Publishing to the library is what
 * still needs Phase 2's backend.
 */
export default function UploadPage() {
  return <UploadConverter />;
}
