import type { Metadata } from "next";
import { ImportedEditor } from "@/components/editor/ImportedEditor";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Edit a converted pattern",
  description: "Review and repair a crease pattern that was just converted.",
};

/**
 * Where `/upload` hands a converted pattern to the editor: the review step of
 * DESIGN.md §8.2, "editor opens, defects highlighted".
 */
export default async function ImportedEditorPage() {
  const user = await getCurrentUser();
  return <ImportedEditor signedIn={user !== null} />;
}
