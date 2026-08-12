"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, PencilRuler, RefreshCw, RotateCcw, Upload } from "lucide-react";
import { guessPaperQuad, fromRgba, insetQuad, type Quad } from "@kamibase/vision";
import { CornerPicker } from "./CornerPicker";
import { ScanPreview } from "./ScanPreview";
import { loadMedia, type LoadedMedia } from "@/lib/scan/media";
import { scanImage } from "@/lib/scan/runner";
import { DEFAULT_TUNING, type ScanReport, type ScanTuning } from "@/lib/scan/types";
import { IMPORT_STORAGE_KEY, type ImportPayload } from "@/lib/upload/handoff";

/**
 * Photograph a creased sheet, get a crease pattern.
 *
 * The flow is three steps because the middle one cannot be skipped: the corners
 * of the paper decide every angle in the result, and no automatic detector is
 * reliable enough to be trusted without a look. So: pick a file, confirm the
 * corners, review what was found.
 *
 * It ends in the editor rather than at a published pattern. DESIGN.md §3.3 is
 * explicit that raster imports are best-effort with a human in the loop, and
 * this is that loop.
 */

type Step = "pick" | "corners" | "review";

const GRID_CHOICES: { label: string; value: ScanTuning["grid"] }[] = [
  { label: "Auto", value: "auto" },
  { label: "Off", value: "none" },
  { label: "8", value: 8 },
  { label: "16", value: 16 },
  { label: "32", value: 32 },
];

const ANGLE_CHOICES: { label: string; value: number }[] = [
  { label: "22.5°", value: 22.5 },
  { label: "45°", value: 45 },
  { label: "15°", value: 15 },
  { label: "Off", value: 0 },
];

export function ScanStudio() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("pick");
  const [media, setMedia] = useState<LoadedMedia | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [quad, setQuad] = useState<Quad | null>(null);
  const [tuning, setTuning] = useState<ScanTuning>(DEFAULT_TUNING);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPhoto, setShowPhoto] = useState(true);

  const frame = media?.frames[frameIndex] ?? null;

  const guessCorners = useCallback((image: ImageData): Quad => {
    const gray = fromRgba(image.data, image.width, image.height);
    try {
      return guessPaperQuad(gray);
    } catch {
      return insetQuad(gray, 0.05);
    }
  }, []);

  async function onPick(file: File): Promise<void> {
    setError(null);
    setReport(null);
    setBusy(file.type.startsWith("video/") ? "Reading the video…" : "Opening the photo…");
    try {
      const loaded = await loadMedia(file);
      setMedia(loaded);
      setFrameIndex(0);
      const first = loaded.frames[0];
      if (first) setQuad(guessCorners(first.image));
      setStep("corners");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That file could not be read.");
    } finally {
      setBusy(null);
    }
  }

  const runScan = useCallback(
    async (nextTuning: ScanTuning): Promise<void> => {
      if (!frame || !quad) return;
      setBusy("Finding creases…");
      setError(null);
      try {
        const run = await scanImage({
          width: frame.image.width,
          height: frame.image.height,
          // Copied, not transferred: the same photo gets scanned again every
          // time a slider moves.
          pixels: new Uint8ClampedArray(frame.image.data),
          quad,
          tuning: nextTuning,
        });
        setReport(run.report);
        setStep("review");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The scan failed.");
      } finally {
        setBusy(null);
      }
    },
    [frame, quad],
  );

  /* Re-scan when a control changes, but only once the user has stopped moving
   * it. A scan is about a second, and firing one per slider tick would queue up
   * a dozen. */
  const firstReview = useRef(true);
  useEffect(() => {
    if (step !== "review") return;
    if (firstReview.current) {
      firstReview.current = false;
      return;
    }
    const timer = setTimeout(() => void runScan(tuning), 350);
    return () => clearTimeout(timer);
  }, [tuning, step, runScan]);

  /*
   * Out through the same door the file converter uses. A scan and a converted
   * `.cp` are the same thing by the time they reach here, a document that needs
   * a person to look at it, so they share one handoff and one review page
   * rather than each having its own.
   */
  function openInEditor(): void {
    if (!report) return;

    const payload: ImportPayload = {
      title: "Scanned pattern",
      slug: "scanned",
      doc: report.creases.map((crease) => ({
        x1: crease.x1,
        y1: crease.y1,
        x2: crease.x2,
        y2: crease.y2,
        assignment: crease.assignment,
      })),
      source: "scan",
      notes: report.notes,
      confidence: report.confidence,
    };

    try {
      window.sessionStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      setError("This browser would not hold the scan long enough to open the editor.");
      return;
    }
    router.push("/edit/import");
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Scan a crease pattern</h1>
        <p className="max-w-2xl text-sm" style={{ color: "var(--text-muted)" }}>
          Unfold the paper, flatten it, and photograph the whole sheet from
          above. Kamibase finds the creases, works out which are mountains and
          which are valleys, and opens the result in the editor for you to
          correct.
        </p>
      </header>

      <Steps current={step} />

      {error && (
        <p className="rounded-xl p-3 text-sm" role="alert" style={{ background: "var(--brand-soft)" }}>
          {error}
        </p>
      )}

      {step === "pick" && (
        <PickStep
          busy={busy}
          onChoose={() => fileInput.current?.click()}
        />
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void onPick(file);
        }}
      />

      {step === "corners" && frame && quad && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <CornerPicker image={frame.image} quad={quad} onChange={setQuad} />

          <aside className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">Put the handles on the corners</h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                The four corners of the paper decide every angle in the pattern,
                so this is worth a moment. Drag each one onto its corner. Arrow
                keys nudge; hold shift to move faster.
              </p>
            </div>

            {media && media.kind === "video" && media.frames.length > 1 && (
              <FramePicker
                media={media}
                index={frameIndex}
                onChange={(next) => {
                  setFrameIndex(next);
                  const picked = media.frames[next];
                  if (picked) setQuad(guessCorners(picked.image));
                }}
              />
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void runScan(tuning)}
                className="flex-1 rounded-full px-4 py-2.5 text-sm font-bold transition hover:opacity-85 disabled:opacity-60"
                style={{ background: "var(--brand)", color: "var(--ink)" }}
              >
                {busy ?? "Find the creases"}
              </button>
              <button
                type="button"
                onClick={() => frame && setQuad(guessCorners(frame.image))}
                title="Guess the corners again"
                className="rounded-full px-3 py-2.5 transition hover:opacity-70"
                style={{ border: "1px solid var(--border-strong)" }}
              >
                <RotateCcw className="size-4" aria-hidden />
                <span className="sr-only">Guess the corners again</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setMedia(null);
                setQuad(null);
                setStep("pick");
              }}
              className="text-xs underline"
              style={{ color: "var(--text-muted)" }}
            >
              Use a different photo
            </button>
          </aside>
        </div>
      )}

      {step === "review" && report && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-3">
            <ScanPreview report={report} showPhoto={showPhoto} />
            <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
              <input
                type="checkbox"
                checked={showPhoto}
                onChange={(event) => setShowPhoto(event.target.checked)}
              />
              Show the flattened photo underneath
            </label>
          </div>

          <aside className="space-y-5">
            <Findings report={report} />

            <div className="space-y-4">
              <h2 className="text-sm font-semibold">Tune it</h2>

              <Slider
                label="Sensitivity"
                hint="Higher finds fainter creases, and more things that are not creases."
                value={tuning.sensitivity}
                min={0}
                max={1}
                step={0.05}
                format={(value) => `${Math.round(value * 100)}%`}
                onChange={(sensitivity) => setTuning((t) => ({ ...t, sensitivity }))}
              />

              <Slider
                label="Shortest crease"
                hint="As a fraction of the paper's width."
                value={tuning.minLength}
                min={0.03}
                max={0.3}
                step={0.01}
                format={(value) => `${Math.round(value * 100)}%`}
                onChange={(minLength) => setTuning((t) => ({ ...t, minLength }))}
              />

              <Choice
                label="Snap angles to"
                options={ANGLE_CHOICES.map((choice) => ({
                  label: choice.label,
                  active: tuning.angleStep === choice.value,
                  onSelect: () => setTuning((t) => ({ ...t, angleStep: choice.value })),
                }))}
              />

              <Choice
                label="Grid"
                options={GRID_CHOICES.map((choice) => ({
                  label: choice.label,
                  active: tuning.grid === choice.value,
                  onSelect: () => setTuning((t) => ({ ...t, grid: choice.value })),
                }))}
              />
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={openInEditor}
                disabled={busy !== null}
                className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold transition hover:opacity-85 disabled:opacity-60"
                style={{ background: "var(--brand)", color: "var(--ink)" }}
              >
                <PencilRuler className="size-4" aria-hidden />
                Open in the editor
              </button>
              <button
                type="button"
                onClick={() => setStep("corners")}
                className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition hover:opacity-70"
                style={{ border: "1px solid var(--border-strong)" }}
              >
                <RefreshCw className="size-4" aria-hidden />
                Back to the corners
              </button>
            </div>

            {busy && (
              <p className="text-xs" role="status" style={{ color: "var(--text-muted)" }}>
                {busy}
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function Steps({ current }: { readonly current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "pick", label: "1. Photo" },
    { key: "corners", label: "2. Corners" },
    { key: "review", label: "3. Review" },
  ];

  return (
    <ol className="flex gap-2 text-xs">
      {steps.map((step) => (
        <li
          key={step.key}
          aria-current={step.key === current ? "step" : undefined}
          className="rounded-full px-3 py-1.5 font-semibold"
          style={
            step.key === current
              ? { background: "var(--text)", color: "var(--surface)" }
              : { background: "var(--surface-sunken)", color: "var(--text-muted)" }
          }
        >
          {step.label}
        </li>
      ))}
    </ol>
  );
}

function PickStep({
  busy,
  onChoose,
}: {
  readonly busy: string | null;
  readonly onChoose: () => void;
}) {
  return (
    <div
      className="rounded-2xl p-8 text-center"
      style={{ border: "1px dashed var(--border-strong)", background: "var(--surface-raised)" }}
    >
      <Camera className="mx-auto size-8" style={{ color: "var(--text-faint)" }} aria-hidden />
      <p className="mt-3 font-semibold">Photograph the unfolded sheet</p>
      <p className="mx-auto mt-1 max-w-md text-sm" style={{ color: "var(--text-muted)" }}>
        Square on, whole sheet in frame, light coming from one side rather than
        straight down. Raking light makes the creases cast shadows, which is
        what the detector is looking for.
      </p>

      <button
        type="button"
        onClick={onChoose}
        disabled={busy !== null}
        className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition hover:opacity-85 disabled:opacity-60"
        style={{ background: "var(--brand)", color: "var(--ink)" }}
      >
        <Upload className="size-4" aria-hidden />
        {busy ?? "Choose a photo or video"}
      </button>

      <p className="mt-3 text-xs" style={{ color: "var(--text-faint)" }}>
        A video works too. Kamibase picks the sharpest frame out of it, which
        usually beats a single handheld shot.
      </p>
    </div>
  );
}

function FramePicker({
  media,
  index,
  onChange,
}: {
  readonly media: LoadedMedia;
  readonly index: number;
  readonly onChange: (index: number) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold">
        Frame{" "}
        <span className="font-normal" style={{ color: "var(--text-muted)" }}>
          ({index + 1} of {media.frames.length}, sharpest first)
        </span>
      </label>
      <input
        type="range"
        min={0}
        max={media.frames.length - 1}
        step={1}
        value={index}
        onChange={(event) => onChange(Number(event.target.value))}
        className="kami-slider w-full"
      />
    </div>
  );
}

function Findings({ report }: { readonly report: ScanReport }) {
  const folds = report.creases.filter((crease) => crease.assignment !== "B");
  const unsure = folds.filter((crease) => crease.confidence < 0.999).length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat value={String(folds.length)} label="creases" />
        <Stat
          value={
            report.maekawaTotal === 0
              ? "0"
              : `${report.maekawaSatisfied}/${report.maekawaTotal}`
          }
          label="vertices OK"
        />
        <Stat value={String(unsure)} label="uncertain" />
      </div>

      <ul className="space-y-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
        {report.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ value, label }: { readonly value: string; readonly label: string }) {
  return (
    <div className="rounded-xl px-2 py-2" style={{ background: "var(--surface-sunken)" }}>
      <p className="text-base font-bold tabular-nums">{value}</p>
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
    </div>
  );
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  readonly label: string;
  readonly hint: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly format: (value: number) => string;
  readonly onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-baseline justify-between text-xs font-semibold">
        {label}
        <span className="font-normal tabular-nums" style={{ color: "var(--text-muted)" }}>
          {format(value)}
        </span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="kami-slider w-full"
      />
      <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
        {hint}
      </p>
    </div>
  );
}

function Choice({
  label,
  options,
}: {
  readonly label: string;
  readonly options: readonly { label: string; active: boolean; onSelect: () => void }[];
}) {
  return (
    <div className="space-y-1">
      <span className="block text-xs font-semibold">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={option.onSelect}
            aria-pressed={option.active}
            className="rounded-full px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
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

/** Shown under the studio, so the first-timer knows what a good photo is. */
export function ScanTips() {
  return (
    <section className="max-w-2xl space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
      <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
        What makes this work
      </h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          Flatten the sheet properly. A curled corner is a curved crease, and
          the detector only looks for straight ones.
        </li>
        <li>
          Light from one side. A lamp low and off to the left throws a shadow
          into every crease; a flash straight on erases all of them.
        </li>
        <li>
          Fill the frame with the paper, and keep the camera square on. The
          corner handles correct for a tilt, but they cannot recover detail that
          was never in the picture.
        </li>
        <li>
          A dark surface underneath helps the corners get found automatically,
          though you can always drag them.
        </li>
      </ul>
      <details className="rounded-xl p-3" style={{ background: "var(--surface-sunken)" }}>
        <summary className="cursor-pointer text-sm font-semibold" style={{ color: "var(--text)" }}>
          How does it know which creases are mountains?
        </summary>
        <div className="mt-2 space-y-2">
          <p>
            It does not read them off the photo, because they are not in the
            photo. A sheet that has been opened out again is flat, and which way
            each crease went survives neither the flattening nor the camera.
          </p>
          <p>
            It uses the geometry instead. Maekawa&rsquo;s theorem says that where
            creases meet inside a flat-foldable pattern, the mountains and the
            valleys differ by exactly two. That links every crease to its
            neighbours, and for most patterns it leaves very few possibilities.
            Kamibase searches for an assignment that satisfies it everywhere,
            using the faint shading along each crease only to break ties.
          </p>
          <p>
            Where several assignments fit equally well, the crease is drawn
            dashed and counted as uncertain rather than presented as known. And
            the whole pattern can be inside out, since a sheet seen from the
            other side satisfies the same theorem: check one crease you
            remember, and repaint if it is backwards.
          </p>
        </div>
      </details>
    </section>
  );
}
