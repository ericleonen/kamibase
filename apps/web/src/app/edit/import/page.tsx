import type { Metadata } from "next";
import { ImportedEditor } from "@/components/editor/ImportedEditor";

export const metadata: Metadata = {
  title: "Edit a converted pattern",
  description: "Review and repair a crease pattern that was just converted.",
};

/**
 * Where `/upload` hands a converted pattern to the editor: the review step of
 * DESIGN.md §8.2, "editor opens, defects highlighted".
 */
export default function ImportedEditorPage() {
  return <ImportedEditor />;
}
