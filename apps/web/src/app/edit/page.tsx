import type { Metadata } from "next";
import { CreasePatternEditor } from "@/components/editor/CreasePatternEditor";

export const metadata: Metadata = {
  title: "New pattern",
  description: "Draw a crease pattern from scratch, validated as you go.",
};

/**
 * The standalone editor: a fresh square of paper.
 *
 * No account required. DESIGN.md §8.4 asks us never to gate the magic behind
 * a signup wall, and drawing is the magic. Work autosaves locally and exports
 * to a file whether or not anyone is signed in.
 */
export default function NewPatternPage() {
  return <CreasePatternEditor title="Untitled pattern" slug="untitled" />;
}
