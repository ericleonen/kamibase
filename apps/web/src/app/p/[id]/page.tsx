import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Box, Camera, Download, PencilRuler } from "lucide-react";
import { CreasePatternViewer } from "@/components/CreasePatternViewer";
import { Section, SectionHeading } from "@/components/Section";
import { ValidationBadge } from "@/components/ValidationBadge";
import { CommentThread } from "@/components/social/CommentThread";
import { FoldGrid } from "@/components/social/FoldCard";
import { SocialNotice } from "@/components/social/SocialNotice";
import { DOWNLOAD_FORMATS, FORMAT_HINTS, FORMAT_LABELS } from "@/lib/downloads";
import { patterns } from "@/lib/patterns";
import { presentAssignments, renderViewerSvg } from "@/lib/render";
import { listFoldsForPattern } from "@/lib/social";

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
      `${pattern.title} by ${pattern.designer}, ${pattern.edgeCount} creases.`,
    openGraph: { images: [{ url: `/p/${pattern.id}/thumbnail` }] },
  };
}

/**
 * A pattern's page.
 *
 * A reading column, not a dashboard. It used to be a two-column layout inside
 * a 1600px shell: the pattern on the left, a 20rem rail on the right holding
 * the buttons, the downloads, the facts, the tags and the content hash, and
 * then the folds and the conversation running the full width underneath. On a
 * laptop that put the metadata a screen's width away from the thing it
 * described, gave the eye no line to return to, and left the sections below
 * reading as one undifferentiated scroll because nothing separated them.
 *
 * So: one column, capped at a comfortable measure, everything in the order
 * somebody actually wants it — what it is, what it looks like, what you can do
 * with it, what is known about it, who has folded it, what people said — and a
 * rule between each of those, because a rule is what separates content for
 * somebody scanning rather than reading.
 */
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
    <article className="mx-auto w-full max-w-3xl space-y-7 pb-16">
      <header className="print-hidden space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{pattern.title}</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          by <span style={{ color: "var(--text)" }}>{pattern.designer}</span> ·{" "}
          {pattern.edgeCount} creases
        </p>
        {pattern.description && (
          <p className="leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {pattern.description}
          </p>
        )}
        <ValidationBadge level={pattern.level} flatFoldable={pattern.flatFoldable} />
      </header>

      {/*
       * Capped in height as well as width. A square viewer filling a 48rem
       * column is 768px tall, which on a laptop is the whole screen and then
       * some — and the viewer has a fullscreen button for exactly the moment
       * somebody wants it that big. The pattern letterboxes inside a wider
       * frame rather than stretching, so a shorter box costs nothing.
       */}
      <CreasePatternViewer
        svg={svg}
        present={presentAssignments(pattern.graph)}
        title={pattern.title}
        frameClassName="aspect-square max-h-[32rem] w-full"
        {...(pattern.recommendedSizeMm === undefined
          ? {}
          : { printSizeMm: pattern.recommendedSizeMm })}
      />

      {/* The two things anyone came here to do, immediately under the thing
          they would do them to. */}
      <div className="print-hidden grid gap-2 sm:grid-cols-2">
        <Link
          href={`/p/${pattern.id}/simulate`}
          className="flex items-center justify-center gap-2 rounded-full px-4 py-3 text-center text-sm font-bold transition hover:opacity-85"
          style={{ background: "var(--brand)", color: "var(--ink)" }}
        >
          <Box className="size-4" aria-hidden />
          Fold it in 3D
        </Link>
        {/* The editor's second entry point: open this pattern as a working
            copy. The library is read-only, so it opens a copy rather than
            implying an edit that cannot be saved back. */}
        <Link
          href={`/p/${pattern.id}/edit`}
          className="flex items-center justify-center gap-2 rounded-full px-4 py-3 text-center text-sm font-bold transition hover:opacity-70"
          style={{ border: "1px solid var(--border-strong)" }}
        >
          <PencilRuler className="size-4" aria-hidden />
          Open in the editor
        </Link>
      </div>

      <Section title="Details" className="print-hidden">
        {/* Two columns of pairs on a wide screen, one on a phone. A single
            long list of ten facts is a scroll; two columns of five is a
            glance. */}
        <dl className="grid gap-x-8 gap-y-0 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-4 border-b py-2 text-sm last:border-b-0"
              style={{ borderColor: "var(--border)" }}
            >
              <dt className="shrink-0" style={{ color: "var(--text-muted)" }}>
                {label}
              </dt>
              <dd className="text-right">{value}</dd>
            </div>
          ))}
        </dl>

        {pattern.tags.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {pattern.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full border px-2.5 py-0.5 text-xs"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                {tag}
              </li>
            ))}
          </ul>
        )}

        {pattern.contentHash && (
          <p
            className="mt-4 break-all font-mono text-[11px]"
            style={{ color: "var(--text-faint)" }}
            title="Content hash: the same geometry always hashes the same, whoever exported it."
          >
            {pattern.contentHash}
          </p>
        )}
      </Section>

      <Section title="Download" className="print-hidden">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DOWNLOAD_FORMATS.map((format) => (
            <li key={format}>
              <a
                href={`/p/${pattern.id}/download/${format}`}
                title={FORMAT_HINTS[format]}
                className="flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-center font-mono text-sm transition hover:opacity-70"
                style={{ borderColor: "var(--border)" }}
                download
              >
                <Download className="size-3.5 shrink-0" aria-hidden />
                {FORMAT_LABELS[format]}
              </a>
            </li>
          ))}
        </ul>
      </Section>

      {/*
       * The pattern is the design; a fold is somebody's execution of it. One
       * pattern has many folds, and putting them on the same page as the
       * geometry is what makes this a place rather than an archive
       * (DESIGN.md §7).
       */}
      <PatternFolds patternId={pattern.id} />

      <CommentThread target={{ kind: "pattern", patternId: pattern.id }} />
    </article>
  );
}

async function PatternFolds({ patternId }: { readonly patternId: string }) {
  const folds = await listFoldsForPattern(patternId, 6);

  return (
    <section className="print-hidden border-t pt-7" style={{ borderColor: "var(--border)" }}>
      <SectionHeading
        title="Folds"
        {...(folds.ok ? { count: folds.data.length } : {})}
        action={
          <div className="flex items-center gap-3">
            {folds.ok && folds.data.length >= 6 && (
              <Link
                href={`/p/${patternId}/folds`}
                className="text-xs underline hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
              >
                See all
              </Link>
            )}
            <Link
              href={`/p/${patternId}/fold`}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition hover:opacity-85"
              style={{ background: "var(--brand)", color: "var(--ink)" }}
            >
              <Camera className="size-3.5" aria-hidden />
              Share your fold
            </Link>
          </div>
        }
      />

      {!folds.ok ? (
        <SocialNotice reason={folds.reason} message={folds.message} />
      ) : folds.data.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No folds of this one yet. Yours would be the first.
        </p>
      ) : (
        <FoldGrid folds={folds.data} showPattern={false} layout="column" />
      )}
    </section>
  );
}
