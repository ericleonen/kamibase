"use client";

import {
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CirclePause,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import {
  LIVE_ANALYSIS_EDGE_LIMIT,
  type EditorAnalysis,
  type VertexVerdict,
} from "@/lib/editor/analysis";

type Level = "ok" | "warn" | "bad" | "idle";

const LEVEL_COLOR: Record<Level, string> = {
  ok: "var(--ok)",
  warn: "var(--brand-strong)",
  bad: "var(--danger)",
  idle: "var(--text-muted)",
};

const LEVEL_ICON: Record<Level, typeof CircleCheck> = {
  ok: CircleCheck,
  warn: TriangleAlert,
  bad: CircleAlert,
  idle: CirclePause,
};

/**
 * One rule, its state, and how many vertices are in that state.
 *
 * The three rules a crease pattern is judged by here are the two local
 * flat-foldability theorems and the structural validator behind them, and the
 * panel says which of the three is unhappy rather than adding their complaints
 * up into one number. "Two vertices fail Kawasaki" tells you to go and look at
 * the angles; "two problems" tells you nothing you did not already suspect.
 */
interface Rule {
  readonly key: VertexVerdict | "structure";
  readonly label: string;
  readonly count: number;
  readonly level: Level;
  readonly hint: string;
}

/**
 * The live checks, as an instrument panel rather than a paragraph.
 *
 * It used to be a bulleted list of sentences — "No structural defects", "4
 * faces", "2 vertices fail Maekawa or Kawasaki" — which is a report, and a
 * report is something you read once. This is a thing to work against: a verdict
 * you can catch out of the corner of your eye while drawing, the three numbers
 * that describe the pattern, and a row per rule that names which one is unhappy
 * and how badly. Colour and icon carry the state so the words do not have to,
 * which is what lets there be fewer of them.
 */
export function ChecksPanel({
  analysis,
  stale,
  empty,
  showMarks,
  onShowMarksChange,
}: {
  readonly analysis: EditorAnalysis;
  /** The pattern has changed and this analysis is the previous one. */
  readonly stale: boolean;
  /** Nothing drawn yet, so there is nothing to be right or wrong about. */
  readonly empty: boolean;
  readonly showMarks: boolean;
  readonly onShowMarksChange: (value: boolean) => void;
}) {
  const failing = analysis.vertexMarks.filter((mark) => !mark.ok);
  const of = (verdict: VertexVerdict): number =>
    failing.filter((mark) => mark.verdict === verdict).length;

  const maekawa = of("maekawa");
  const kawasaki = of("kawasaki");
  const undecided = of("unknown");

  const rules: Rule[] = [
    {
      key: "structure",
      label: "Structure",
      count: analysis.errorCount,
      level: analysis.errorCount > 0 ? "bad" : "ok",
      hint: "Creases that cross without a vertex, stop mid-paper, or double up",
    },
    {
      key: "maekawa",
      label: "Maekawa",
      count: maekawa,
      level: maekawa > 0 ? "bad" : "ok",
      hint: "Mountains and valleys at a vertex must differ by exactly two",
    },
    {
      key: "kawasaki",
      label: "Kawasaki",
      count: kawasaki,
      level: kawasaki > 0 ? "bad" : "ok",
      hint: "Alternate angles around a vertex must sum to 180°",
    },
  ];
  if (undecided > 0) {
    rules.push({
      key: "unknown",
      label: "Unassigned",
      count: undecided,
      level: "warn",
      hint: "Vertices with creases that are not yet a mountain or a valley",
    });
  }

  const verdict = summarize(analysis, { empty, failing: failing.length });
  const VerdictIcon = LEVEL_ICON[verdict.level];
  const color = LEVEL_COLOR[verdict.level];

  return (
    <div className="space-y-2">
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2.5"
        style={{
          // A wash of the state's own colour, so the banner is legible at a
          // glance in both themes without a second token per state.
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
          color,
        }}
        role="status"
      >
        <VerdictIcon className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-xs font-bold">{verdict.label}</span>
        {stale && (
          <Loader2
            className="size-3.5 shrink-0 animate-spin opacity-70"
            aria-label="Rechecking"
          />
        )}
      </div>

      {!analysis.skipped && !empty && (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            <Stat value={analysis.graph.vertices.length} label="Vertices" />
            <Stat value={analysis.graph.edges.length} label="Creases" />
            <Stat value={analysis.faceCount} label="Faces" />
          </div>

          <ul className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
            {rules.map((rule, index) => {
              const Icon = rule.level === "warn" ? CircleHelp : LEVEL_ICON[rule.level];
              return (
                <li
                  key={rule.key}
                  title={rule.hint}
                  className="flex items-center gap-2 px-2.5 py-1.5 text-xs"
                  style={{
                    borderTop: index === 0 ? "none" : "1px solid var(--border)",
                  }}
                >
                  <Icon
                    className="size-3.5 shrink-0"
                    style={{ color: LEVEL_COLOR[rule.level] }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate font-semibold">{rule.label}</span>
                  <span
                    className="shrink-0 tabular-nums"
                    style={{
                      color: rule.count === 0 ? "var(--text-faint)" : LEVEL_COLOR[rule.level],
                    }}
                  >
                    {rule.count === 0 ? "—" : rule.count}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* The validator's own words, for the ones that are not a vertex count.
          Three, because a fourth is never the one being read and the rail has
          a simulator under it. */}
      {analysis.defects.length > 0 && (
        <ul className="space-y-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          {analysis.defects.slice(0, 3).map((defect, index) => (
            <li key={`${defect.code}-${index}`}>
              <strong style={{ color: "var(--text)" }}>{defect.rule}</strong> {defect.message}
            </li>
          ))}
        </ul>
      )}

      <label className="flex cursor-pointer items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={showMarks}
          onChange={(event) => onShowMarksChange(event.target.checked)}
          className="size-3.5 accent-current"
        />
        Mark failing vertices
      </label>
    </div>
  );
}

function Stat({ value, label }: { readonly value: number; readonly label: string }) {
  return (
    <div
      className="rounded-lg px-2 py-1.5 text-center"
      style={{ background: "var(--surface-sunken)" }}
    >
      <div className="text-sm font-bold tabular-nums leading-tight">{value}</div>
      <div
        className="truncate text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </div>
    </div>
  );
}

/** The one line at the top: the worst thing that is true, said shortly. */
function summarize(
  analysis: EditorAnalysis,
  { empty, failing }: { readonly empty: boolean; readonly failing: number },
): { readonly level: Level; readonly label: string } {
  if (analysis.skipped) {
    return { level: "idle", label: `Paused over ${LIVE_ANALYSIS_EDGE_LIMIT} creases` };
  }
  if (empty) return { level: "idle", label: "Nothing drawn yet" };
  if (analysis.errorCount > 0) {
    return {
      level: "bad",
      label: analysis.errorCount === 1 ? "1 structural defect" : `${analysis.errorCount} structural defects`,
    };
  }
  if (failing > 0) {
    return {
      level: "warn",
      label: failing === 1 ? "1 vertex will not fold flat" : `${failing} vertices will not fold flat`,
    };
  }
  return { level: "ok", label: "Folds flat" };
}
