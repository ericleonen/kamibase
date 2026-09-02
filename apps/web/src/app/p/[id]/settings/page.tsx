import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PencilRuler } from "lucide-react";
import {
  DeletePatternButton,
  PatternDetailsForm,
  PatternVisibilityForm,
} from "@/components/patterns/PatternSettingsForms";
import { getOwnedPattern } from "@/lib/patterns/owner";
import { listFoldsForPattern } from "@/lib/social";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const pattern = await getOwnedPattern(id);
  return {
    title: pattern ? `${pattern.title} settings` : "Pattern not found",
    // Nothing here is for anybody but the owner, and half of it may be a draft.
    robots: { index: false, follow: false },
  };
}

/**
 * Everything you can change about one of your patterns without drawing.
 *
 * It exists because the alternatives were both wrong. A delete button on the
 * pattern's own page is a destructive control on a page whose job is to show a
 * design to strangers, and one tucked under a card in a grid is a control
 * nobody can find twice. A pattern has settings for the same reason an account
 * does: there is a small set of decisions about it that are not the thing
 * itself, and they belong together in a place with a name.
 *
 * Ordered by how often somebody comes here to do each: rename and re-tag, open
 * the creases, decide who can see it, and — once — throw it away.
 *
 * `getOwnedPattern` returning `null` covers "no such pattern", "not yours" and
 * "a seeded file nobody owns", and all three are a 404 here. A settings page
 * for something you cannot change is not a page.
 */
export default async function PatternSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pattern = await getOwnedPattern(id);
  if (!pattern) notFound();

  // Only to tell the delete dialog what it is about to strand. A failure to
  // count is not a reason to refuse to show the page.
  const folds = await listFoldsForPattern(pattern.id, 100);
  const foldCount = folds.ok ? folds.data.length : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <header className="space-y-3">
        <Link
          href={`/p/${pattern.id}`}
          className="inline-flex items-center gap-1.5 text-sm transition hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          {pattern.title}
        </Link>
        <h1 className="text-2xl font-black tracking-tight">Pattern settings</h1>
      </header>

      <Panel title="Details">
        <PatternDetailsForm
          slug={pattern.id}
          title={pattern.title}
          designer={pattern.designer === "Unknown" ? "" : pattern.designer}
          description={pattern.description ?? ""}
          license={pattern.license}
          {...(pattern.difficulty === undefined ? {} : { difficulty: pattern.difficulty })}
          tags={pattern.tags}
        />
      </Panel>

      <Panel title="Creases">
        {/*
         * Honest about what the editor does with an existing pattern: it opens
         * a working copy, and saving puts a new pattern on the site rather than
         * replacing this one. That is the right behaviour for somebody else's
         * design and the only possible one for a seeded file, and it is worth
         * saying out loud on the one page where you might expect otherwise.
         */}
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          The geometry is edited in the crease pattern editor. It opens a working
          copy, so saving from there puts a new pattern on the site and leaves
          this one alone.
        </p>
        <Link
          href={`/p/${pattern.id}/edit`}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition hover:opacity-70"
          style={{ border: "1px solid var(--border-strong)" }}
        >
          <PencilRuler className="size-3.5" aria-hidden />
          Open in the editor
        </Link>
      </Panel>

      <Panel title="Who can see it">
        <PatternVisibilityForm slug={pattern.id} isPrivate={pattern.isPrivate ?? false} />
      </Panel>

      <Panel title="Delete">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Take a copy first if you want one: the{" "}
          <a
            href={`/p/${pattern.id}/download/kami`}
            download
            className="font-semibold underline"
          >
            .kami file
          </a>{" "}
          is the whole pattern, and it opens again anywhere.
        </p>
        <DeletePatternButton
          slug={pattern.id}
          title={pattern.title}
          {...(foldCount > 0 ? { foldCount } : {})}
        />
      </Panel>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-t pt-6" style={{ borderColor: "var(--border)" }}>
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
