import type { Metadata } from "next";
import { ImportStudio } from "@/components/import/ImportStudio";

export const metadata: Metadata = {
  title: "Add a crease pattern",
  description:
    "Convert a .fold, .cp, .opx or SVG, or photograph the creased paper itself. " +
    "Everything runs in your browser.",
};

/**
 * The one way in (DESIGN.md §8.2). Files and photographs are the same problem
 * from the outside, so they share a page, a review panel and a handoff.
 */
export default function AddPatternPage() {
  return <ImportStudio />;
}
