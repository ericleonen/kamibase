import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { toFold } from "@kamibase/core";
import { CreasePatternViewer } from "@/components/CreasePatternViewer";
import { Simulator } from "@/components/Simulator";
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
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <Link
            href={`/p/${pattern.id}`}
            className="inline-flex items-center gap-1 text-sm font-semibold transition hover:opacity-70"
            style={{ color: "var(--text-muted)" }}
          >
            <ChevronLeft className="size-4" aria-hidden />
            {pattern.title}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Folding in 3D</h1>
        </div>

        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Designed by <span style={{ color: "var(--text)" }}>{pattern.designer}</span>
        </p>
      </header>

      <Simulator
        fold={fold}
        patternId={pattern.id}
        title={pattern.title}
        flatFoldable={pattern.flatFoldable}
        fallback={
          <CreasePatternViewer
            svg={renderViewerSvg(pattern.graph, pattern.title)}
            present={presentAssignments(pattern.graph)}
            title={pattern.title}
            {...(pattern.recommendedSizeMm === undefined
              ? {}
              : { printSizeMm: pattern.recommendedSizeMm })}
          />
        }
      />
    </div>
  );
}
