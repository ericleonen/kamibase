import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera } from "lucide-react";
import { FoldGrid } from "@/components/social/FoldCard";
import { SocialNotice } from "@/components/social/SocialNotice";
import { patterns } from "@/lib/patterns";
import { listFoldsForPattern } from "@/lib/social";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const pattern = await patterns.get(id);
  return { title: pattern ? `Folds of ${pattern.title}` : "Folds" };
}

export default async function PatternFoldsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pattern = await patterns.get(id);
  if (!pattern) notFound();

  const folds = await listFoldsForPattern(pattern.id, 100);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href={`/p/${pattern.id}`}
          className="text-sm underline transition hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
        >
          {pattern.title}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Folds of this pattern</h1>
      </header>

      <Link
        href={`/p/${pattern.id}/fold`}
        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition hover:opacity-85"
        style={{ background: "var(--brand)", color: "var(--ink)" }}
      >
        <Camera className="size-4" aria-hidden />
        Share your fold
      </Link>

      {!folds.ok ? (
        <SocialNotice reason={folds.reason} message={folds.message} />
      ) : folds.data.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No folds of this one yet.
        </p>
      ) : (
        <FoldGrid folds={folds.data} showPattern={false} />
      )}
    </div>
  );
}
