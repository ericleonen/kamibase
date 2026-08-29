import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { toFold } from "@kamibase/core";
import { CreasePatternViewer } from "@/components/CreasePatternViewer";
import { FoldViewer } from "@/components/FoldViewer";
import { patterns } from "@/lib/patterns";
import { presentAssignments, renderViewerSvg } from "@/lib/render";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const pattern = await patterns.get(id);
  return { title: pattern ? `Fold ${pattern.title}` : "Pattern not found" };
}

/**
 * The 3D fold, full screen.
 *
 * A page rather than a modal, so it has a URL somebody can send, and a page
 * that covers the site's own chrome, because folding is the reason they are
 * here and a WebGL canvas boxed into a reading column is a postage stamp of
 * one. The way out is the X, which goes back to the pattern.
 */
export default async function SimulatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pattern = await patterns.get(id);
  if (!pattern) notFound();

  // The simulator speaks FOLD, so the kami: block comes off on the way in.
  // Same key-filter the .fold download uses.
  const fold = toFold(pattern.document);

  return (
    <FoldViewer
      fold={fold}
      patternId={pattern.id}
      title={pattern.title}
      flatFoldable={pattern.flatFoldable}
      closeHref={`/p/${pattern.id}`}
      fallback={
        <div className="mx-auto max-w-3xl p-4">
          <CreasePatternViewer
            svg={renderViewerSvg(pattern.graph, pattern.title)}
            present={presentAssignments(pattern.graph)}
            title={pattern.title}
            {...(pattern.recommendedSizeMm === undefined
              ? {}
              : { printSizeMm: pattern.recommendedSizeMm })}
          />
        </div>
      }
    />
  );
}
