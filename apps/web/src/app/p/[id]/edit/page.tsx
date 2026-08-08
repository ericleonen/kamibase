import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreasePatternEditor } from "@/components/editor/CreasePatternEditor";
import { docFromGraph } from "@/lib/editor/model";
import { patterns } from "@/lib/patterns";

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
 * The seeded library is read-only — patterns live as files on disk, and
 * saving back needs the accounts and storage of Phase 4. So this opens a
 * working copy: draw on it, check it, export it, and it is yours. The original
 * is untouched, which is also the honest behaviour for someone else's design.
 */
export default async function EditPatternPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pattern = await patterns.get(id);
  if (!pattern) notFound();

  return (
    <CreasePatternEditor
      initialDoc={docFromGraph(pattern.graph)}
      title={pattern.title}
      slug={pattern.id}
      backHref={`/p/${pattern.id}`}
    />
  );
}
