import type { Metadata } from "next";
import { CreasePatternEditor } from "@/components/editor/CreasePatternEditor";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "New pattern",
  description: "Draw a crease pattern from scratch, validated as you go.",
};

/**
 * The standalone editor: a fresh square of paper.
 *
 * No account required. DESIGN.md §8.4 asks us never to gate the magic behind
 * a signup wall, and drawing is the magic. Work autosaves locally and exports
 * to a file whether or not anyone is signed in. Saving it to the site is the
 * one thing that needs a name attached, which is all the user is looked up for.
 */
export default async function NewPatternPage() {
  const user = await getCurrentUser();
  return (
    <CreasePatternEditor title="Untitled pattern" slug="untitled" signedIn={user !== null} />
  );
}
