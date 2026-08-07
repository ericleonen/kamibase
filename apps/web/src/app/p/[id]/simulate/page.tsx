import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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

  // The simulator speaks FOLD, so the kami: block comes off on the way in —
  // the same key-filter the .fold download uses.
  const fold = toFold(pattern.document);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{pattern.title}</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Folding in 3D · drag to rotate, and use the simulator&apos;s own
            fold slider to collapse it
          </p>
        </div>
        <Link href={`/p/${pattern.id}`} className="text-sm underline">
          Back to the pattern
        </Link>
      </header>

      <Simulator
        fold={fold}
        patternId={pattern.id}
        title={pattern.title}
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

      {!pattern.flatFoldable && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Heads up: this pattern fails a local flat-foldability check, so the
          solver may not settle into anything sensible. That is normal for 3D
          and non-flat-foldable designs.
        </p>
      )}
    </div>
  );
}
