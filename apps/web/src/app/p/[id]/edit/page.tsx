import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreasePatternEditor } from "@/components/editor/CreasePatternEditor";
import { docFromGraph } from "@/lib/editor/model";
import { patterns } from "@/lib/patterns";
import { getCurrentUser } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const pattern = await patterns.get(id);
  return { title: pattern ? `Edit ${pattern.title}` : "Pattern not found" };
}

/**
 * Edit an existing pattern.
 *
 * This opens a working copy rather than the pattern itself: draw on it, check
 * it, export it, and saving puts it on the site as a pattern of your own. The
 * original is left alone, which is the honest thing to do with someone else's
 * design and the only possible thing to do with a seeded one, since those are
 * files in the repository rather than rows anybody owns.
 */
export default async function EditPatternPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [pattern, user] = await Promise.all([patterns.get(id), getCurrentUser()]);
  if (!pattern) notFound();

  return (
    <CreasePatternEditor
      initialDoc={docFromGraph(pattern.graph)}
      title={pattern.title}
      slug={pattern.id}
      backHref={`/p/${pattern.id}`}
      signedIn={user !== null}
    />
  );
}
