import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { CommentThread } from "@/components/social/CommentThread";
import { ProfileChip } from "@/components/social/Avatar";
import { SocialNotice } from "@/components/social/SocialNotice";
import { patterns } from "@/lib/patterns";
import { foldDetails, getFold, nameOf, relativeTime } from "@/lib/social";
import { deleteFoldAction } from "@/lib/social/actions";
import { getCurrentUser } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await getFold(id);
  if (!result.ok || !result.data) return { title: "Fold" };
  const fold = result.data;
  return {
    title: `A fold by ${nameOf(fold.author)}`,
    description: fold.caption || `${nameOf(fold.author)}'s fold of ${fold.patternId}.`,
    openGraph: { images: [{ url: fold.photoUrl }] },
  };
}

export default async function FoldPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getFold(id);

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <SocialNotice reason={result.reason} message={result.message} />
      </div>
    );
  }
  if (!result.data) notFound();

  const fold = result.data;
  const [pattern, user] = await Promise.all([
    patterns.get(fold.patternId),
    getCurrentUser(),
  ]);
  const details = foldDetails(fold);
  const isAuthor = user?.id === fold.author.id;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div
          className="overflow-hidden rounded-2xl"
          style={{ background: "var(--surface-sunken)", boxShadow: "var(--shadow-card)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage origin */}
          <img
            src={fold.photoUrl}
            alt={fold.caption || `A fold by ${nameOf(fold.author)}`}
            className="w-full"
          />
        </div>

        <div className="space-y-6">
          <div className="flex items-start justify-between gap-3">
            <ProfileChip
              profile={fold.author}
              size="lg"
              subtitle={relativeTime(fold.createdAt)}
            />
            {isAuthor && (
              <form action={deleteFoldAction}>
                <input type="hidden" name="foldId" value={fold.id} />
                <button
                  type="submit"
                  className="text-xs underline transition hover:opacity-70"
                  style={{ color: "var(--text-faint)" }}
                >
                  Delete
                </button>
              </form>
            )}
          </div>

          {fold.caption && <p className="whitespace-pre-wrap">{fold.caption}</p>}

          {details && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {details}
            </p>
          )}

          {/*
           * The pairing is the whole appeal (DESIGN.md §7): the folded result
           * and the crease pattern it came from, one click apart.
           */}
          {pattern ? (
            <Link
              href={`/p/${pattern.id}`}
              className="flex items-center gap-3 rounded-2xl p-3 transition hover:opacity-80"
              style={{ border: "1px solid var(--border)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- our own renderer */}
              <img
                src={`/p/${pattern.id}/thumbnail`}
                alt=""
                className="size-16 shrink-0 rounded-xl object-contain"
                style={{ background: "var(--surface-raised)" }}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Folded from
                </span>
                <span className="block truncate font-semibold">{pattern.title}</span>
                <span className="block truncate text-xs" style={{ color: "var(--text-muted)" }}>
                  {pattern.designer}
                </span>
              </span>
              <ArrowUpRight className="size-4 shrink-0" aria-hidden />
            </Link>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              The pattern this came from is no longer in the library.
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-2xl">
        <CommentThread target={{ kind: "fold", foldId: fold.id }} />
      </div>
    </div>
  );
}
