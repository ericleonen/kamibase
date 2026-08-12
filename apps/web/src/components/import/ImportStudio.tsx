"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PencilRuler, Upload } from "lucide-react";
import { fromRgba, guessPaperQuad, insetQuad, type Quad } from "@kamibase/vision";
import type { EdgeAssignment } from "@kamibase/core";
import { CornerPicker } from "@/components/scan/CornerPicker";
import { ScanPreview } from "@/components/scan/ScanPreview";
import { CreasePatternViewer } from "@/components/CreasePatternViewer";
import { docFromGraph } from "@/lib/editor/model";
import { DOWNLOAD_FORMATS, FORMAT_LABELS, renderDownload } from "@/lib/downloads";
import { presentAssignments, renderViewerSvg } from "@/lib/render";
import { loadMedia, type LoadedMedia } from "@/lib/scan/media";
import { scanImage } from "@/lib/scan/runner";
import { DEFAULT_TUNING, type ScanReport, type ScanTuning } from "@/lib/scan/types";
import { IMPORT_STORAGE_KEY } from "@/lib/upload/handoff";
import {
  conversionFromScan,
  convertUpload,
  MAX_UPLOAD_BYTES,
  UPLOAD_ACCEPT,
  type Conversion,
  type ConversionResult,
} from "@/lib/upload/convert";
import { ResultPanel } from "./ResultPanel";

/**
 * One way in, for every kind of crease pattern.
 *
 * A `.cp` file and a photograph of the paper it was folded from are different
 * problems for about four hundred lines of code and the same thing for the
 * person holding them: something that is a crease pattern, and is not in
 * Kamibase yet. They used to be two pages, which meant guessing which one your
 * thing belonged to before you could start.
 *
 * So: one drop zone that takes anything. Files convert straight through.
 * Photographs and video take the extra step of confirming the paper's corners,
 * because those decide every angle in the result. Both end in the same review
 * panel and the same editor.
 */

const isMedia = (file: File): boolean =>
  file.type.startsWith("image/") || file.type.startsWith("video/");

type Stage = "empty" | "corners" | "result";

export function ImportStudio() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("empty");
  const [filename, setFilename] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);

  /* Files. */
  const [text, setText] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, EdgeAssignment>>({});

  /* Photographs. */
  const [media, setMedia] = useState<LoadedMedia | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [quad, setQuad] = useState<Quad | null>(null);
  const [tuning, setTuning] = useState<ScanTuning>(DEFAULT_TUNING);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [overlay, setOverlay] = useState(true);

  const frame = media?.frames[frameIndex] ?? null;

  const reset = (): void => {
    setStage("empty");
    setText(null);
    setMedia(null);
    setQuad(null);
    setReport(null);
    setResult(null);
    setAssignments({});
    setError(null);
  };

  const guessCorners = useCallback((image: ImageData): Quad => {
    const gray = fromRgba(image.data, image.width, image.height);
    try {
      return guessPaperQuad(gray);
    } catch {
      return insetQuad(gray, 0.05);
    }
  }, []);

  const accept = useCallback(
    async (file: File | undefined): Promise<void> => {
      if (!file) return;
      setError(null);
      setResult(null);
      setReport(null);
      setFilename(file.name);

      if (file.size > MAX_UPLOAD_BYTES && !isMedia(file)) {
        setError(`${file.name} is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`);
        return;
      }

      if (isMedia(file)) {
        setBusy(file.type.startsWith("video/") ? "Reading the video…" : "Opening the photo…");
        try {
          const loaded = await loadMedia(file);
          setMedia(loaded);
          setText(null);
          setFrameIndex(0);
          const first = loaded.frames[0];
          if (first) setQuad(guessCorners(first.image));
          setStage("corners");
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "That file could not be read.");
        } finally {
          setBusy(null);
        }
        return;
      }

      try {
        setMedia(null);
        setAssignments({});
        setText(await file.text());
        setStage("result");
      } catch {
        setError(`${file.name} could not be read.`);
      }
    },
    [guessCorners],
  );

  /* Converting a file. Yields a frame first so "converting" can paint: the
   * crossing pass is O(E²) and a dense tessellation is not instant. */
  useEffect(() => {
    if (text === null) return;
    setBusy("Converting…");
    let cancelled = false;
    const timer = setTimeout(() => {
      const next = convertUpload(text, filename, { assignments });
      if (cancelled) return;
      setResult(next);
      setBusy(null);
    }, 16);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text, filename, assignments]);

  const runScan = useCallback(
    async (nextTuning: ScanTuning): Promise<void> => {
      if (!frame || !quad) return;
      setBusy("Finding creases…");
      setError(null);
      try {
        const run = await scanImage({
          width: frame.image.width,
          height: frame.image.height,
          // Copied rather than transferred: the same photo is scanned again
          // every time a control moves.
          pixels: new Uint8ClampedArray(frame.image.data),
          quad,
          tuning: nextTuning,
        });
        setReport(run.report);
        setResult(
          conversionFromScan(
            run.report.creases.map((crease) => ({
              x1: crease.x1,
              y1: crease.y1,
              x2: crease.x2,
              y2: crease.y2,
              assignment: crease.assignment,
            })),
            run.report.confidence,
            run.report.notes,
            filename,
          ),
        );
        setStage("result");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The scan failed.");
      } finally {
        setBusy(null);
      }
    },
    [frame, quad, filename],
  );

  /* Re-scan when a control settles. One scan is about a second, so firing per
   * slider tick would queue a dozen. */
  const scanned = useRef(false);
  useEffect(() => {
    if (stage !== "result" || !report) return;
    if (!scanned.current) {
      scanned.current = true;
      return;
    }
    const timer = setTimeout(() => void runScan(tuning), 350);
    return () => clearTimeout(timer);
    // `report` is deliberately not a dependency: it is what this produces.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tuning, stage, runScan]);

  const openInEditor = (conversion: Conversion): void => {
    try {
      window.sessionStorage.setItem(
        IMPORT_STORAGE_KEY,
        JSON.stringify({
          title: conversion.title,
          slug: conversion.slug,
          doc: docFromGraph(conversion.graph),
          source: conversion.format === "photo" ? "scan" : "convert",
          notes: conversion.reasons,
          confidence: conversion.confidence,
        }),
      );
    } catch {
      // Storage disabled. The editor says so rather than nothing happening.
    }
    router.push("/edit/import");
  };

  const download = (conversion: Conversion, format: (typeof DOWNLOAD_FORMATS)[number]): void => {
    const file = renderDownload(format, conversion.slug, conversion.document, conversion.graph);
    const url = URL.createObjectURL(new Blob([file.body], { type: file.contentType }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Add a crease pattern</h1>
        <Link
          href="/edit"
          className="flex items-center gap-1.5 text-sm font-semibold underline"
          style={{ color: "var(--text-muted)" }}
        >
          <PencilRuler className="size-3.5" aria-hidden />
          Draw one instead
        </Link>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void accept(event.dataTransfer.files[0]);
        }}
        className={`rounded-2xl transition ${stage === "empty" ? "p-8 text-center sm:p-12" : "p-3"}`}
        style={{
          border: `2px dashed ${dragging ? "var(--brand)" : "var(--border-strong)"}`,
          background: dragging ? "var(--surface-sunken)" : "transparent",
        }}
      >
        {stage === "empty" ? (
          <>
            <Upload className="mx-auto size-7" aria-hidden style={{ color: "var(--text-muted)" }} />
            <p className="mt-3 font-bold">Drop a file, a photo or a video</p>
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy !== null}
              className="mt-4 rounded-full px-5 py-2.5 text-sm font-bold transition hover:opacity-85 disabled:opacity-60"
              style={{ background: "var(--brand)", color: "var(--ink)" }}
            >
              {busy ?? "Choose"}
            </button>
            <p className="mt-4 text-xs" style={{ color: "var(--text-faint)" }}>
              <code>.fold</code> <code>.kami</code> <code>.cp</code> <code>.opx</code>{" "}
              <code>.svg</code>, or a photo of the creased paper. Nothing is uploaded.
            </p>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Upload className="size-4 shrink-0" aria-hidden style={{ color: "var(--text-muted)" }} />
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{filename}</span>
            {busy && (
              <span className="text-xs" role="status" style={{ color: "var(--text-muted)" }}>
                {busy}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                reset();
                input.current?.click();
              }}
              className="rounded-full px-3.5 py-1.5 text-xs font-bold transition hover:opacity-70"
              style={{ border: "1px solid var(--border-strong)" }}
            >
              Choose another
            </button>
          </div>
        )}

        <input
          ref={input}
          type="file"
          accept={UPLOAD_ACCEPT}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void accept(file);
          }}
        />
      </div>

      {error && (
        <p
          className="rounded-2xl p-3 text-sm"
          role="alert"
          style={{ background: "var(--surface-sunken)", borderLeft: "3px solid #b4261f" }}
        >
          {error}
        </p>
      )}

      {stage === "corners" && frame && quad && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <CornerPicker image={frame.image} quad={quad} onChange={setQuad} />
          <aside className="space-y-4">
            <div>
              <h2 className="font-bold">Drag the handles to the paper&rsquo;s corners</h2>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                They set every angle in the pattern. Arrow keys nudge.
              </p>
            </div>

            {media && media.kind === "video" && media.frames.length > 1 && (
              <label className="block space-y-1">
                <span className="text-xs font-bold">
                  Frame {frameIndex + 1} of {media.frames.length}
                  <span className="ml-1 font-normal" style={{ color: "var(--text-muted)" }}>
                    sharpest first
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={media.frames.length - 1}
                  step={1}
                  value={frameIndex}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setFrameIndex(next);
                    const picked = media.frames[next];
                    if (picked) setQuad(guessCorners(picked.image));
                  }}
                  className="kami-slider w-full"
                />
              </label>
            )}

            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void runScan(tuning)}
              className="w-full rounded-full px-4 py-2.5 text-sm font-bold transition hover:opacity-85 disabled:opacity-60"
              style={{ background: "var(--brand)", color: "var(--ink)" }}
            >
              {busy ?? "Find the creases"}
            </button>
          </aside>
        </div>
      )}

      {stage === "result" && result && !result.ok && (
        <div
          className="rounded-2xl p-3 text-sm"
          style={{ background: "var(--surface-sunken)", borderLeft: "3px solid #b4261f" }}
        >
          <p className="font-bold">{result.message}</p>
          {result.hint && (
            <p className="mt-1" style={{ color: "var(--text-muted)" }}>
              {result.hint}
            </p>
          )}
        </div>
      )}

      {stage === "result" && result?.ok && (
        <ResultPanel
          conversion={result}
          preview={
            report ? (
              <ScanPreview report={report} showPhoto={overlay} />
            ) : (
              <CreasePatternViewer
                svg={renderViewerSvg(result.graph, result.title)}
                present={presentAssignments(result.graph)}
                title={result.title}
              />
            )
          }
          assignments={assignments}
          onAssign={(key, assignment) =>
            setAssignments((current) => ({ ...current, [key]: assignment }))
          }
          {...(report
            ? {
                scan: {
                  tuning,
                  onTune: setTuning,
                  overlay,
                  onOverlay: setOverlay,
                  onBackToCorners: () => setStage("corners"),
                },
              }
            : {})}
          onOpenInEditor={() => openInEditor(result)}
          onDownload={(format) => download(result, format)}
        />
      )}
    </div>
  );
}
