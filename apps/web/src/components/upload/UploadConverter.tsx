"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, PencilRuler, Upload } from "lucide-react";
import { ORIGAMI_SIMULATOR_PALETTE, type EdgeAssignment } from "@kamibase/core";
import { CreasePatternViewer } from "@/components/CreasePatternViewer";
import { ValidationBadge } from "@/components/ValidationBadge";
import { docFromGraph } from "@/lib/editor/model";
import { DOWNLOAD_FORMATS, FORMAT_LABELS, renderDownload } from "@/lib/downloads";
import { presentAssignments, renderViewerSvg } from "@/lib/render";
import { IMPORT_STORAGE_KEY } from "@/lib/upload/handoff";
import {
  convertUpload,
  percent,
  MAX_UPLOAD_BYTES,
  UPLOAD_ACCEPT,
  type Conversion,
  type ConversionResult,
} from "@/lib/upload/convert";

/** The assignments a person can pick in the style table. */
const ASSIGNMENT_CHOICES: { key: EdgeAssignment; label: string }[] = [
  { key: "M", label: "Mountain" },
  { key: "V", label: "Valley" },
  { key: "B", label: "Border" },
  { key: "F", label: "Flat / triangulation" },
  { key: "C", label: "Cut" },
  { key: "U", label: "Unassigned" },
];

const REVIEW_COPY = {
  publishable: {
    title: "Converted cleanly",
    body: "Every crease was read with confidence and the geometry is structurally sound.",
    tone: "#2b6a4d",
  },
  review: {
    title: "Converted, needs a look",
    body: "Some creases were inferred rather than stated. Open the editor and check the ones listed below.",
    tone: "#8a6d1f",
  },
  blocked: {
    title: "Converted, needs fixing",
    body: "This one is not ready to publish. Open it in the editor and repair what is flagged.",
    tone: "#b4261f",
  },
} as const;

interface Source {
  readonly text: string;
  readonly filename: string;
}

/**
 * The upload funnel of DESIGN.md §8.2, as far as Phase 2 goes without a
 * backend: drop a file, watch it convert, see exactly what was read and what
 * was guessed, then take it into the editor or download it in any format.
 *
 * The conversion runs here in the browser rather than on a server, which is
 * §9's shared core paying for itself: no upload, no job queue, no waiting, and
 * the grade on screen is the grade the server would give the same file.
 * Publishing is what still needs the backend, and that is Phase 2's remainder.
 */
export function UploadConverter() {
  const router = useRouter();
  const [source, setSource] = useState<Source | null>(null);
  const [assignments, setAssignments] = useState<Record<string, EdgeAssignment>>({});
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [converting, setConverting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  /*
   * Conversion is synchronous and, on a dense tessellation, not instant: the
   * crossing pass is O(E²). Handing the browser a frame to paint "converting"
   * before starting is the difference between a slow page and a frozen one.
   */
  useEffect(() => {
    if (!source) {
      setResult(null);
      return;
    }
    setConverting(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      const next = convertUpload(source.text, source.filename, { assignments });
      if (cancelled) return;
      setResult(next);
      setConverting(false);
    }, 16);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source, assignments]);

  const accept = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setReadError(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setReadError(
        `${file.name} is ${Math.round(file.size / 1024 / 1024)}MB. The converter reads files up to ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`,
      );
      return;
    }
    try {
      const text = await file.text();
      setAssignments({});
      setSource({ text, filename: file.name });
    } catch {
      setReadError(`${file.name} could not be read.`);
    }
  }, []);

  const openInEditor = useCallback(
    (conversion: Conversion) => {
      try {
        window.sessionStorage.setItem(
          IMPORT_STORAGE_KEY,
          JSON.stringify({
            title: conversion.title,
            slug: conversion.slug,
            doc: docFromGraph(conversion.graph),
          }),
        );
      } catch {
        // Private browsing with storage disabled. Better to land in an empty
        // editor with a message than to do nothing when the button is pressed.
      }
      router.push("/edit/import");
    },
    [router],
  );

  const download = useCallback(
    (conversion: Conversion, format: (typeof DOWNLOAD_FORMATS)[number]) => {
      const file = renderDownload(format, conversion.slug, conversion.document, conversion.graph);
      const url = URL.createObjectURL(new Blob([file.body], { type: file.contentType }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    },
    [],
  );

  const loaded = source !== null && (converting || result !== null);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          Add a crease pattern
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Drop a <code>.fold</code>, <code>.kami</code>, <code>.cp</code>,{" "}
          <code>.opx</code> or <code>.svg</code> file. It is converted, validated and
          graded here in your browser: nothing is uploaded.
        </p>
      </header>

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
        className={`rounded-2xl transition ${loaded ? "p-3" : "p-6 text-center sm:p-10"}`}
        style={{
          border: `2px dashed ${dragging ? "var(--brand)" : "var(--border-strong)"}`,
          background: dragging ? "var(--surface-sunken)" : "transparent",
        }}
      >
        {/*
         * Once a pattern is on screen the drop zone stops being the subject of
         * the page and becomes a control, so it shrinks to a bar rather than
         * pushing the conversion below the fold. It still takes a drop.
         */}
        {loaded ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Upload className="size-4 shrink-0" aria-hidden style={{ color: "var(--text-muted)" }} />
            <span className="min-w-0 flex-1 truncate font-mono text-xs">
              {source?.filename}
            </span>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="rounded-full px-3.5 py-1.5 text-xs font-bold transition hover:opacity-70"
              style={{ border: "1px solid var(--border-strong)" }}
            >
              Choose another file
            </button>
          </div>
        ) : (
          <>
            <Upload className="mx-auto size-7" aria-hidden style={{ color: "var(--text-muted)" }} />
            <p className="mt-3 font-bold">Drop a crease pattern here</p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              or
            </p>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="mt-3 rounded-full px-5 py-2.5 text-sm font-bold transition hover:opacity-85"
              style={{ background: "var(--brand)", color: "var(--ink)" }}
            >
              Choose a file
            </button>
            <p className="mt-4 text-xs" style={{ color: "var(--text-faint)" }}>
              Photos and scans are not converted yet. Would rather start from a blank
              square?{" "}
              <Link href="/edit" className="underline">
                Open the editor
              </Link>
              .
            </p>
          </>
        )}
        <input
          ref={input}
          type="file"
          accept={UPLOAD_ACCEPT}
          className="sr-only"
          onChange={(event) => void accept(event.target.files?.[0])}
        />
      </div>

      {readError && <Notice tone="#b4261f">{readError}</Notice>}

      {converting && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Converting {source?.filename}…
        </p>
      )}

      {!converting && result && !result.ok && (
        <Notice tone="#b4261f">
          <p className="font-bold">{result.message}</p>
          {result.hint && <p className="mt-1">{result.hint}</p>}
        </Notice>
      )}

      {!converting && result?.ok && (
        <ConversionReport
          conversion={result}
          assignments={assignments}
          onAssign={(key, assignment) =>
            setAssignments((current) => ({ ...current, [key]: assignment }))
          }
          onOpenInEditor={() => openInEditor(result)}
          onDownload={(format) => download(result, format)}
        />
      )}
    </div>
  );
}

function ConversionReport({
  conversion,
  assignments,
  onAssign,
  onOpenInEditor,
  onDownload,
}: {
  readonly conversion: Conversion;
  readonly assignments: Readonly<Record<string, EdgeAssignment>>;
  readonly onAssign: (key: string, assignment: EdgeAssignment) => void;
  readonly onOpenInEditor: () => void;
  readonly onDownload: (format: (typeof DOWNLOAD_FORMATS)[number]) => void;
}) {
  const copy = REVIEW_COPY[conversion.review];
  const flatFoldable = conversion.grade.flatFold?.flatFoldable ?? false;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-3">
        <CreasePatternViewer
          svg={renderViewerSvg(conversion.graph, conversion.title)}
          present={presentAssignments(conversion.graph)}
          title={conversion.title}
        />
      </div>

      <aside className="space-y-4">
        <section>
          <h2 className="text-lg font-black tracking-tight">{conversion.title}</h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {conversion.format.toUpperCase()} · {conversion.graph.edges.length} creases ·{" "}
            {conversion.graph.vertices.length} vertices
          </p>
          <div className="mt-2">
            <ValidationBadge level={conversion.grade.level} flatFoldable={flatFoldable} />
          </div>
        </section>

        <section
          className="rounded-2xl p-3 text-sm"
          style={{ background: "var(--surface-sunken)", borderLeft: `3px solid ${copy.tone}` }}
        >
          <p className="flex items-center gap-1.5 font-bold" style={{ color: copy.tone }}>
            {conversion.review === "publishable" ? (
              <CheckCircle2 className="size-4" aria-hidden />
            ) : (
              <AlertTriangle className="size-4" aria-hidden />
            )}
            {copy.title}
            {conversion.confidence < 1 && ` · ${percent(conversion.confidence)} confidence`}
          </p>
          <p className="mt-1" style={{ color: "var(--text-muted)" }}>
            {copy.body}
          </p>
          {conversion.reasons.length > 0 && (
            <ul className="mt-2 space-y-1" style={{ color: "var(--text-muted)" }}>
              {conversion.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
        </section>

        {conversion.styles.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              How this SVG was read
            </h3>
            <p className="mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
              One row per style the file draws in. Change one and the file is read again.
            </p>
            <ul className="space-y-1.5">
              {conversion.styles.map((style) => (
                <li
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
                        ...(style.dashed
                          ? { borderStyle: "dashed" as const }
                          : {}),
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
                      onChange={(event) =>
                        onAssign(style.key, event.target.value as EdgeAssignment)
                      }
                      className="min-h-8 rounded-lg px-1.5 py-1 text-xs"
                      style={{
                        border: "1px solid var(--border-strong)",
                        background: "var(--surface)",
                        color: ORIGAMI_SIMULATOR_PALETTE[
                          assignments[style.key] ?? style.assignment
                        ],
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
                      {style.method === "override"
                        ? "set by you"
                        : `${percent(style.confidence)} · ${style.reason}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {conversion.warnings.length > 0 && (
          <section
            className="rounded-2xl p-3 text-xs"
            style={{ background: "var(--surface-sunken)" }}
          >
            <h3 className="mb-1 font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              What the converter did
            </h3>
            <ul className="space-y-1" style={{ color: "var(--text-muted)" }}>
              {conversion.warnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          </section>
        )}

        {conversion.grade.structural.defects.length > 0 && (
          <section
            className="rounded-2xl p-3 text-xs"
            style={{ background: "var(--surface-sunken)" }}
          >
            <h3 className="mb-1 font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Defects
            </h3>
            <ul className="space-y-1" style={{ color: "var(--text-muted)" }}>
              {conversion.grade.structural.defects.slice(0, 6).map((defect, index) => (
                <li key={`${defect.code}-${index}`}>
                  <strong style={{ color: "var(--text)" }}>{defect.rule}</strong>{" "}
                  {defect.message}
                </li>
              ))}
            </ul>
          </section>
        )}

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
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            Publishing to the library needs an account and the upload backend, which is
            still being built. Downloading and editing work today.
          </p>
        </section>
      </aside>
    </div>
  );
}

function Notice({
  tone,
  children,
}: {
  readonly tone: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-3 text-sm"
      style={{ background: "var(--surface-sunken)", borderLeft: `3px solid ${tone}` }}
    >
      {children}
    </div>
  );
}
