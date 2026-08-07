import type { Metadata } from "next";
import { PatternCard } from "@/components/PatternCard";
import { patterns } from "@/lib/patterns";

export const metadata: Metadata = {
  title: "Explore",
  description: "Browse every crease pattern on Kamibase.",
};

/**
 * The discovery surface (DESIGN.md §8.1 `/explore`).
 *
 * Phase 1 is a plain grid grouped by technique — semantic and visual search
 * are Phase 5, and they need a corpus before they are worth anything.
 */
export default async function ExplorePage() {
  const all = await patterns.list();

  const byTechnique = new Map<string, typeof all>();
  for (const pattern of all) {
    const key = pattern.techniques[0] ?? "other";
    byTechnique.set(key, [...(byTechnique.get(key) ?? []), pattern]);
  }
  const groups = [...byTechnique.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Explore</h1>
        <p style={{ color: "var(--text-muted)" }}>
          {all.length} patterns. Search and filters arrive with Phase 5 —
          for now, grouped by technique.
        </p>
      </header>

      {groups.map(([technique, group]) => (
        <section key={technique} className="space-y-4">
          <h2 className="text-lg font-medium capitalize">
            {technique.replace(/-/g, " ")}{" "}
            <span className="text-sm font-normal" style={{ color: "var(--text-muted)" }}>
              ({group.length})
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {group.map((pattern) => (
              <PatternCard key={pattern.id} pattern={pattern} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
