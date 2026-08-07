import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreasePatternViewer } from "@/components/CreasePatternViewer";
import { ValidationBadge } from "@/components/ValidationBadge";
import { DOWNLOAD_FORMATS, FORMAT_HINTS, FORMAT_LABELS } from "@/lib/downloads";
import { patterns } from "@/lib/patterns";
import { presentAssignments, renderViewerSvg } from "@/lib/render";

export async function generateStaticParams(): Promise<{ id: string }[]> {
  const all = await patterns.list();
  return all.map((pattern) => ({ id: pattern.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const pattern = await patterns.get(id);
  if (!pattern) return { title: "Pattern not found" };
  return {
    title: pattern.title,
    description:
      pattern.description ??
      `${pattern.title} by ${pattern.designer} — ${pattern.edgeCount} creases.`,
    openGraph: { images: [{ url: `/p/${pattern.id}/thumbnail` }] },
  };
}

export default async function PatternPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pattern = await patterns.get(id);
  if (!pattern) notFound();

  const svg = renderViewerSvg(pattern.graph, pattern.title);
  const facts: [string, string][] = [
    ["Designer", pattern.designer],
    ["Creases", `${pattern.edgeCount} (${pattern.mountainCount}M / ${pattern.valleyCount}V)`],
    ["Vertices", String(pattern.vertexCount)],
    ["Faces", String(pattern.faceCount)],
    ["Paper", pattern.paperShape],
    ...(pattern.gridSystem
      ? ([
          [
            "Grid",
            pattern.gridDivisions
              ? `${pattern.gridSystem} · ${pattern.gridDivisions} divisions`
              : pattern.gridSystem,
          ],
        ] as [string, string][])
      : []),
    ...(pattern.recommendedSizeMm
      ? ([["Recommended size", `${pattern.recommendedSizeMm} mm`]] as [string, string][])
      : []),
    ...(pattern.recommendedPaper
      ? ([["Recommended paper", pattern.recommendedPaper]] as [string, string][])
      : []),
    ...(pattern.difficulty
      ? ([["Difficulty", `${pattern.difficulty} / 10`]] as [string, string][])
      : []),
    ...(pattern.estimatedMinutes
      ? ([["Estimated time", `${pattern.estimatedMinutes} min`]] as [string, string][])
      : []),
    ["License", pattern.license],
  ];

  return (
    <div className="space-y-8">
      <header className="print-hidden space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{pattern.title}</h1>
        {pattern.description && (
          <p className="max-w-2xl" style={{ color: "var(--text-muted)" }}>
            {pattern.description}
          </p>
        )}
        <ValidationBadge level={pattern.level} flatFoldable={pattern.flatFoldable} />
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <CreasePatternViewer
          svg={svg}
          present={presentAssignments(pattern.graph)}
          title={pattern.title}
          {...(pattern.recommendedSizeMm === undefined
            ? {}
            : { printSizeMm: pattern.recommendedSizeMm })}
        />

        <aside className="print-hidden space-y-6">
          <Link
            href={`/p/${pattern.id}/simulate`}
            className="block rounded-full px-4 py-3 text-center text-sm font-bold transition hover:opacity-85"
            style={{ background: "var(--brand)", color: "var(--ink)" }}
          >
            Fold it in 3D
          </Link>

          <section className="space-y-2">
            <h2 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Download
            </h2>
            <ul className="grid grid-cols-2 gap-2">
              {DOWNLOAD_FORMATS.map((format) => (
                <li key={format}>
                  <a
                    href={`/p/${pattern.id}/download/${format}`}
                    title={FORMAT_HINTS[format]}
                    className="block rounded-xl border px-3 py-2 text-center font-mono text-sm transition hover:opacity-70"
                    style={{ borderColor: "var(--border)" }}
                    download
                  >
                    {FORMAT_LABELS[format]}
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Details
            </h2>
            <dl className="space-y-1.5 text-sm">
              {facts.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt style={{ color: "var(--text-muted)" }}>{label}</dt>
                  <dd className="text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {pattern.tags.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Tags
              </h2>
              <ul className="flex flex-wrap gap-1.5">
                {pattern.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full border px-2 py-0.5 text-xs"
                    style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {pattern.contentHash && (
            <section className="space-y-1">
              <h2 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Content hash
              </h2>
              <p className="break-all font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                {pattern.contentHash}
              </p>
            </section>
          )}

          <section className="space-y-2 text-sm">
            <h2 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Folds
            </h2>
            <p style={{ color: "var(--text-muted)" }}>
              Nobody has posted a fold of this pattern yet — folds arrive with
              the social layer in Phase 4.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
