import type { ValidationLevel } from "@kamibase/core";

const LEVELS: Record<ValidationLevel, { label: string; hint: string; tone: string }> = {
  invalid: {
    label: "Unreadable",
    hint: "No usable geometry. This file could not be read as a crease pattern.",
    tone: "#b4261f",
  },
  L0: {
    label: "L0 Parsed",
    hint: "Geometry is present but has structural defects; stored, but unverified.",
    tone: "#b4261f",
  },
  L1: {
    label: "L1 Clean",
    hint: "Passes every structural rule: normalized, closed boundary, no crossings without a vertex.",
    tone: "#2b6a4d",
  },
  L2: {
    label: "L2 Simulatable",
    hint: "A headless simulator run reached a stable folded state.",
    tone: "#2b6a4d",
  },
  L3: {
    label: "L3 Verified",
    hint: "Locally flat-foldable: Maekawa and Kawasaki hold at every interior vertex.",
    tone: "#1f5fb4",
  },
};

export function ValidationBadge({
  level,
  flatFoldable,
}: {
  readonly level: ValidationLevel;
  readonly flatFoldable: boolean;
}) {
  const info = LEVELS[level];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        title={info.hint}
        className="rounded-full border px-2.5 py-0.5 text-xs font-medium"
        style={{ borderColor: info.tone, color: info.tone }}
      >
        {info.label}
      </span>
      <span
        title={
          flatFoldable
            ? "Maekawa and Kawasaki hold at every interior vertex. This is a local check, so it does not prove the whole pattern folds flat."
            : "At least one interior vertex fails Maekawa or Kawasaki. Plenty of excellent crease patterns are not flat-foldable; this is information, not a verdict on quality."
        }
        className="rounded-full border px-2.5 py-0.5 text-xs"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        {flatFoldable ? "Locally flat-foldable" : "Not flat-foldable"}
      </span>
    </div>
  );
}
