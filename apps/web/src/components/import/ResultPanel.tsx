"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, PencilRuler, SlidersHorizontal } from "lucide-react";
import { ORIGAMI_SIMULATOR_PALETTE, type EdgeAssignment } from "@kamibase/core";
import { ValidationBadge } from "@/components/ValidationBadge";
import { DOWNLOAD_FORMATS, FORMAT_LABELS } from "@/lib/downloads";
import type { ScanTuning } from "@/lib/scan/types";
import { percent, type Conversion } from "@/lib/upload/convert";

/**
 * What came out, however it got here.
 *
 * A converted file and a scanned photograph reach this point as the same
 * object, so they get the same panel: the pattern, its grade, what was guessed,
 * and the two things anybody wants next. The only source-specific parts are the
 * controls, because an SVG's style table and a photograph's sensitivity are
 * genuinely different questions.
 */

const ASSIGNMENT_CHOICES: { key: EdgeAssignment; label: string }[] = [
  { key: "M", label: "Mountain" },
  { key: "V", label: "Valley" },
  { key: "B", label: "Border" },
  { key: "F", label: "Flat" },
  { key: "C", label: "Cut" },
  { key: "U", label: "Unassigned" },
];

const GRIDS: { label: string; value: ScanTuning["grid"] }[] = [
  { label: "Auto", value: "auto" },
  { label: "Off", value: "none" },
  { label: "8", value: 8 },
  { label: "16", value: 16 },
  { label: "32", value: 32 },
];

const ANGLES = [22.5, 45, 15, 0];

const REVIEW = {
  publishable: { label: "Converted cleanly", tone: "#2b6a4d" },
  review: { label: "Needs a look", tone: "#8a6d1f" },
  blocked: { label: "Needs fixing", tone: "#b4261f" },
} as const;

export interface ScanControls {
  readonly tuning: ScanTuning;
  readonly onTune: (tuning: ScanTuning) => void;
  readonly overlay: boolean;
  readonly onOverlay: (overlay: boolean) => void;
  readonly onBackToCorners: () => void;
}

export function ResultPanel({
  conversion,
  preview,
  assignments,
  onAssign,
  scan,
  onOpenInEditor,
  onDownload,
}: {
  readonly conversion: Conversion;
  readonly preview: ReactNode;
  readonly assignments: Readonly<Record<string, EdgeAssignment>>;
  readonly onAssign: (key: string, assignment: EdgeAssignment) => void;
  readonly scan?: ScanControls;
  readonly onOpenInEditor: () => void;
  readonly onDownload: (format: (typeof DOWNLOAD_FORMATS)[number]) => void;
}) {
  const review = REVIEW[conversion.review];
  const flatFoldable = conversion.grade.flatFold?.flatFoldable ?? false;
  const defects = conversion.grade.structural.defects;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-2">
        {preview}
        {scan && (
          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
            <input
              type="checkbox"
              checked={scan.overlay}
              onChange={(event) => scan.onOverlay(event.target.checked)}
            />
            Show the photo underneath
          </label>
        )}
      </div>

      <aside className="space-y-4">
        <section>
          <h2 className="text-lg font-black tracking-tight">{conversion.title}</h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {conversion.format === "photo" ? "PHOTO" : conversion.format.toUpperCase()} ·{" "}
            {conversion.graph.edges.length} creases · {conversion.graph.vertices.length} vertices
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ValidationBadge level={conversion.grade.level} flatFoldable={flatFoldable} />
            <span
              className="flex items-center gap-1.5 text-xs font-bold"
              style={{ color: review.tone }}
            >
              {conversion.review === "publishable" ? (
                <CheckCircle2 className="size-3.5" aria-hidden />
              ) : (
                <AlertTriangle className="size-3.5" aria-hidden />
              )}
              {review.label}
              {conversion.confidence < 1 && ` · ${percent(conversion.confidence)}`}
            </span>
          </div>
        </section>

        <section className="space-y-2">
          <button
            type="button"
            onClick={onOpenInEditor}
            className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition hover:opacity-85"
            style={{ background: "var(--brand)", color: "var(--ink)" }}
          >
            <PencilRuler className="size-4" aria-hidden />
            Open in the editor
          </button>
          <div className="grid grid-cols-4 gap-1.5">
            {DOWNLOAD_FORMATS.map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => onDownload(format)}
                className="min-h-9 rounded-xl font-mono text-xs transition hover:opacity-70"
                style={{ border: "1px solid var(--border)" }}
              >
                {FORMAT_LABELS[format]}
              </button>
            ))}
          </div>
        </section>

        {conversion.reasons.length > 0 && (
          <Details summary="What was guessed">
            {conversion.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </Details>
        )}

        {scan && <ScanTuner scan={scan} />}

        {conversion.styles.length > 0 && (
          <section className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Styles in this SVG
            </h3>
            {conversion.styles.map((style) => (
              <div
                key={style.key}
                className="rounded-xl p-2 text-xs"
                style={{ border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block size-3.5 shrink-0 rounded-sm"
                    style={{
                      background: style.stroke ?? "transparent",
                      border: "1px solid var(--border-strong)",
                      ...(style.dashed ? { borderStyle: "dashed" as const } : {}),
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono">
                    {style.stroke ?? "no colour"}
                    {style.dashed && " dashed"}
                    {style.layer && ` · ${style.layer}`}
                  </span>
                  <span style={{ color: "var(--text-faint)" }}>{style.segmentCount}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <label className="sr-only" htmlFor={`style-${style.key}`}>
                    Assignment for {style.stroke ?? "unstyled"} creases
                  </label>
                  <select
                    id={`style-${style.key}`}
                    value={assignments[style.key] ?? style.assignment}
                    onChange={(event) => onAssign(style.key, event.target.value as EdgeAssignment)}
                    className="min-h-8 rounded-lg px-1.5 py-1 text-xs"
                    style={{
                      border: "1px solid var(--border-strong)",
                      background: "var(--surface)",
                      color: ORIGAMI_SIMULATOR_PALETTE[assignments[style.key] ?? style.assignment],
                      fontWeight: 700,
                    }}
                  >
                    {ASSIGNMENT_CHOICES.map((choice) => (
                      <option key={choice.key} value={choice.key}>
                        {choice.label}
                      </option>
                    ))}
                  </select>
                  <span className="min-w-0 flex-1" style={{ color: "var(--text-faint)" }}>
                    {style.method === "override" ? "yours" : percent(style.confidence)}
                  </span>
                </div>
              </div>
            ))}
          </section>
        )}

        {defects.length > 0 && (
          <Details summary={`${defects.length} defect${defects.length === 1 ? "" : "s"}`}>
            {defects.slice(0, 8).map((defect, index) => (
              <li key={`${defect.code}-${index}`}>
                <strong style={{ color: "var(--text)" }}>{defect.rule}</strong> {defect.message}
              </li>
            ))}
          </Details>
        )}

        {conversion.warnings.length > 0 && (
          <Details summary="Conversion log">
            {conversion.warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </Details>
        )}
      </aside>
    </div>
  );
}

/**
 * Everything secondary is collapsed.
 *
 * The defect list and the conversion log are worth having and are not worth the
 * two screens of scrolling they used to cost between the pattern and the button
 * everybody presses next.
 */
function Details({
  summary,
  open = false,
  children,
}: {
  readonly summary: string;
  readonly open?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <details open={open} className="rounded-xl p-2.5 text-xs" style={{ background: "var(--surface-sunken)" }}>
      <summary className="cursor-pointer font-bold">{summary}</summary>
      <ul className="mt-1.5 space-y-1 pl-1" style={{ color: "var(--text-muted)" }}>
        {children}
      </ul>
    </details>
  );
}

function ScanTuner({ scan }: { readonly scan: ScanControls }) {
  const { tuning, onTune } = scan;

  return (
    <details className="rounded-xl p-2.5 text-xs" style={{ background: "var(--surface-sunken)" }}>
      <summary className="flex cursor-pointer items-center gap-1.5 font-bold">
        <SlidersHorizontal className="size-3.5" aria-hidden />
        Adjust the detection
      </summary>

      <div className="mt-3 space-y-3">
        <Slider
          label="Sensitivity"
          value={tuning.sensitivity}
          min={0}
          max={1}
          step={0.05}
          onChange={(sensitivity) => onTune({ ...tuning, sensitivity })}
        />
        <Slider
          label="Shortest crease"
          value={tuning.minLength}
          min={0.03}
          max={0.3}
          step={0.01}
          onChange={(minLength) => onTune({ ...tuning, minLength })}
        />

        <Chips
          label="Angles"
          options={ANGLES.map((value) => ({
            label: value === 0 ? "Off" : `${value}°`,
            active: tuning.angleStep === value,
            onSelect: () => onTune({ ...tuning, angleStep: value }),
          }))}
        />
        <Chips
          label="Grid"
          options={GRIDS.map((choice) => ({
            label: choice.label,
            active: tuning.grid === choice.value,
            onSelect: () => onTune({ ...tuning, grid: choice.value }),
          }))}
        />

        <button
          type="button"
          onClick={scan.onBackToCorners}
          className="w-full rounded-full px-3 py-1.5 font-bold transition hover:opacity-70"
          style={{ border: "1px solid var(--border-strong)" }}
        >
          Back to the corners
        </button>
      </div>
    </details>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-baseline justify-between font-bold">
        {label}
        <span className="font-normal tabular-nums" style={{ color: "var(--text-muted)" }}>
          {Math.round(value * 100)}%
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="kami-slider w-full"
      />
    </label>
  );
}

function Chips({
  label,
  options,
}: {
  readonly label: string;
  readonly options: readonly { label: string; active: boolean; onSelect: () => void }[];
}) {
  return (
    <div className="space-y-1">
      <span className="block font-bold">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={option.onSelect}
            aria-pressed={option.active}
            className="rounded-full px-2.5 py-1 font-bold transition hover:opacity-80"
            style={
              option.active
                ? { background: "var(--text)", color: "var(--surface)" }
                : { border: "1px solid var(--border)", color: "var(--text-muted)" }
            }
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
