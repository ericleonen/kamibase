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
 * One column on a phone, in the order somebody actually wants it — what it
 * is, what it looks like, what you can do with it, what is known about it, who
 * has folded it, what people said.
 *
 * Past `lg` that column splits. A crease pattern is square and a laptop is not,
 * so a square viewer in a reading column leaves two empty gutters and pushes
 * every fact below the fold. The pattern takes the left and everything written
 * about it takes a fixed rail on the right, which is the shape of every
 * catalogue page ever printed. The DOM order does not change — the placement is
 * explicit grid coordinates — so the phone keeps the order it had.
 *
 * The folds and the conversation stay in a reading column underneath, because
 * they are prose and photographs rather than a specification.
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
    <article className="print-plain mx-auto w-full max-w-3xl pb-16 lg:max-w-6xl">
      {/*
       * Placement is explicit so the DOM can stay in reading order: the header
       * is written first because that is what a phone should meet first, and
       * `lg:col-start-2 lg:row-start-1` is what moves it beside the pattern on
       * a wide screen instead of above it.
       */}
      <div className="print-plain grid gap-7 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-x-10 lg:gap-y-6">
        <header className="print-hidden space-y-3 lg:col-start-2 lg:row-start-1">
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
         * Capped in height in the one-column layout, where a square viewer
         * filling a 48rem measure would be 768px tall and swallow a laptop
         * screen. In the two-column one the cap comes off: the viewer is its
         * own column and being as tall as it is wide is the point. It sticks,
         * so the facts on the right scroll against a pattern that stays put.
         */}
        <div className="print-plain lg:sticky lg:top-20 lg:col-start-1 lg:row-start-1 lg:row-span-4">
          <CreasePatternViewer
            svg={svg}
            present={presentAssignments(pattern.graph)}
            title={pattern.title}
            frameClassName="aspect-square max-h-[32rem] w-full lg:max-h-none"
            {...(pattern.recommendedSizeMm === undefined
              ? {}
              : { printSizeMm: pattern.recommendedSizeMm })}
          />
        </div>

        {/* The two things anyone came here to do. */}
        <div className="print-hidden grid gap-2 sm:grid-cols-2 lg:col-start-2 lg:row-start-2 lg:grid-cols-1">
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

        <Section title="Details" className="print-hidden lg:col-start-2 lg:row-start-3">
        {/* Two columns of pairs when there is a page's width to put them in,
            one when there is not. A single long list of ten facts is a scroll
            and two columns of five is a glance, but two columns inside a 22rem
            sidebar is neither: every value wraps onto its own second line. */}
        <dl className="grid gap-x-8 gap-y-0 sm:grid-cols-2 lg:grid-cols-1">
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

        {/*
         * The content hash used to be printed here. It is the right thing for
         * two files to be compared by and the wrong thing to put in front of
         * somebody looking for a crease pattern: sixty-four characters of
         * nothing they can act on. It is still in the `.kami` file, which is
         * where a checksum belongs.
         */}
      </Section>

        <Section title="Download" className="print-hidden lg:col-start-2 lg:row-start-4">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
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

      </div>

      {/*
       * Back to one reading column. The pattern is the design; a fold is
       * somebody's execution of it. One pattern has many folds, and putting
       * them on the same page as the geometry is what makes this a place rather
       * than an archive (DESIGN.md §7).
       */}
      <div className="mx-auto mt-7 w-full max-w-3xl space-y-7">
        <PatternFolds patternId={pattern.id} />
        <CommentThread target={{ kind: "pattern", patternId: pattern.id }} />
      </div>
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
