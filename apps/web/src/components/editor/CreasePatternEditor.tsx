"use client";

import Link from "next/link";
import { Box, Eraser, Hand, PaintBucket, PenLine, Redo2, Undo2 } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ORIGAMI_SIMULATOR_PALETTE,
  ingest,
  toFold,
  type EdgeAssignment,
  type FoldDocument,
} from "@kamibase/core";
import { Simulator } from "@/components/Simulator";
import { analyse, LIVE_ANALYSIS_EDGE_LIMIT } from "@/lib/editor/analysis";
import {
  addSegment,
  canRedo,
  canUndo,
  commit,
  emptyPaper,
  initHistory,
  reassignSegment,
  redo,
  removeSegment,
  undo,
  type EditorDoc,
} from "@/lib/editor/model";
import { renderDownload, DOWNLOAD_FORMATS, FORMAT_LABELS } from "@/lib/downloads";
import { EditorCanvas, type EditorTool } from "./EditorCanvas";

const ASSIGNMENTS: { key: EdgeAssignment; label: string; hotkey: string }[] = [
  { key: "M", label: "Mountain", hotkey: "m" },
  { key: "V", label: "Valley", hotkey: "v" },
  { key: "B", label: "Border", hotkey: "b" },
  { key: "F", label: "Flat", hotkey: "f" },
  { key: "U", label: "Unassigned", hotkey: "u" },
];

const TOOLS: {
  key: EditorTool;
  label: string;
  hotkey: string;
  hint: string;
  Icon: typeof PenLine;
}[] = [
  { key: "draw", label: "Draw", hotkey: "d", hint: "Drag to add a crease", Icon: PenLine },
  { key: "erase", label: "Erase", hotkey: "e", hint: "Tap a crease to delete it", Icon: Eraser },
  { key: "assign", label: "Paint", hotkey: "a", hint: "Tap a crease to recolour it", Icon: PaintBucket },
  { key: "pan", label: "Pan", hotkey: "h", hint: "Drag to move the paper", Icon: Hand },
];

const GRIDS = [0, 4, 8, 16, 22] as const;

export interface CreasePatternEditorProps {
  /** Starting geometry. Defaults to an empty square of paper. */
  readonly initialDoc?: EditorDoc;
  readonly title: string;
  /** Slug used for downloads and the autosave key. */
  readonly slug: string;
  /** When editing an existing pattern, where to go back to. */
  readonly backHref?: string;
  /**
   * A rectified image of what this was made from, as a data URL, shown under
   * the paper to trace over. Set when the pattern came from a photograph.
   */
  readonly backdrop?: string;
}

/**
 * The simple crease pattern editor of DESIGN.md §4.
 *
 * The bar it aims at is the one the design sets: "fix a converted file and make
 * a Miura-ori," not "design a competition-level insect." So there is a line
 * tool, an eraser, assignment painting, grid snapping, undo, live validation
 * and export. There is no polygon tool, no symmetry engine and no layer
 * ordering.
 *
 * Every check on screen is `@kamibase/core` running in the browser, which is
 * the point of §9: the editor's rules and the server's rules cannot drift,
 * because they are the same code.
 */
export function CreasePatternEditor({
  initialDoc,
  title,
  slug,
  backHref,
  backdrop,
}: CreasePatternEditorProps) {
  const [history, setHistory] = useState(() => initHistory(initialDoc ?? emptyPaper()));
  const [tool, setTool] = useState<EditorTool>("draw");
  const [assignment, setAssignment] = useState<EdgeAssignment>("M");
  const [gridDivisions, setGridDivisions] = useState(8);
  const [snapToVertices, setSnapToVertices] = useState(true);
  const [showMarks, setShowMarks] = useState(true);
  const [simulation, setSimulation] = useState<{ fold: FoldDocument; key: number } | null>(
    null,
  );
  const [saved, setSaved] = useState<string | null>(null);
  const [backdropOpacity, setBackdropOpacity] = useState(0.35);
  /*
   * On a phone the control panel is pinned to the bottom of the viewport, so
   * every row it grows costs drawing surface. Enough of them and the toolbar
   * covers the canvas outright, which is exactly what it did before this was
   * collapsed by default. Wide screens have a real sidebar and no such
   * conflict, so everything stays open there.
   */
  const [showMore, setShowMore] = useState(false);
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    const sync = (): void => setShowMore(wide.matches);
    sync();
    wide.addEventListener("change", sync);
    return () => wide.removeEventListener("change", sync);
  }, []);

  const doc = history.present;

  /*
   * Analysis runs against a deferred copy of the document, so a fast drag
   * never waits on the O(E²) planarize pass. React keeps painting the stroke
   * and the checks catch up a frame later.
   */
  const deferredDoc = useDeferredValue(doc);
  const analysis = useMemo(() => analyse(deferredDoc), [deferredDoc]);
  const stale = deferredDoc !== doc;

  const apply = useCallback((next: (current: EditorDoc) => EditorDoc) => {
    setHistory((current) => commit(current, next(current.present)));
  }, []);

  /* Autosave. localStorage rather than the IndexedDB §4 asks for: this is a
   * single small document, and a synchronous key/value store is the right size
   * of tool for it. IndexedDB earns its keep when there are many drafts. */
  const storageKey = `kamibase:editor:${slug}`;
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(doc));
        setSaved(new Date().toLocaleTimeString());
      } catch {
        // Private mode, or the quota is full. Losing autosave is not worth
        // interrupting someone mid-drawing over.
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [doc, storageKey]);

  /* Keyboard shortcuts. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        setHistory((current) => (event.shiftKey ? redo(current) : undo(current)));
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();
      const assignmentMatch = ASSIGNMENTS.find((entry) => entry.hotkey === key);
      if (assignmentMatch) {
        setAssignment(assignmentMatch.key);
        return;
      }
      const toolMatch = TOOLS.find((entry) => entry.hotkey === key);
      if (toolMatch) setTool(toolMatch.key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const download = useCallback(
    (format: (typeof DOWNLOAD_FORMATS)[number]) => {
      const result = ingest(analysis.graph, { metadata: { title } });
      const file = renderDownload(format, slug, result.document, result.graph);
      const url = URL.createObjectURL(new Blob([file.body], { type: file.contentType }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    },
    [analysis.graph, slug, title],
  );

  const simulate = useCallback(() => {
    const result = ingest(analysis.graph, { metadata: { title } });
    setSimulation((previous) => ({
      fold: toFold(result.document),
      // Remount rather than re-push: the simulator announces itself once, so a
      // fresh frame is the reliable way to load changed geometry into it.
      key: (previous?.key ?? 0) + 1,
    }));
  }, [analysis.graph, title]);

  const creaseCount = doc.length;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">{title}</h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {creaseCount} creases
            {saved && ` · saved ${saved}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {backHref && (
            <Link
              href={backHref}
              className="rounded-full px-4 py-2 text-sm font-bold transition hover:opacity-70"
              style={{ border: "1px solid var(--border-strong)" }}
            >
              Back
            </Link>
          )}
          <button
            type="button"
            onClick={simulate}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition hover:opacity-85"
            style={{ background: "var(--brand)", color: "var(--ink)" }}
          >
            <Box className="size-4" aria-hidden />
            {simulation ? "Refold" : "Fold in 3D"}
          </button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-4">
          <EditorCanvas
            doc={doc}
            tool={tool}
            assignment={assignment}
            snap={{ divisions: gridDivisions, snapToVertices, radius: 0.035 }}
            gridDivisions={gridDivisions}
            vertexMarks={analysis.vertexMarks}
            showMarks={showMarks}
            {...(backdrop === undefined ? {} : { backdrop, backdropOpacity })}
            onDraw={(segment) => apply((current) => addSegment(current, segment))}
            onErase={(index) => apply((current) => removeSegment(current, index))}
            onAssign={(index) =>
              apply((current) => reassignSegment(current, index, assignment))
            }
          />

          {/* Kept to the canvas's own width so the two stack as one column. */}
          {simulation && (
            <section
              className="mx-auto w-full space-y-3 rounded-2xl p-4"
              style={{
                maxWidth: "min(100%, 68vh)",
                background: "var(--surface-raised)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <h2
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}
                >
                  3D fold
                </h2>
                <button
                  type="button"
                  onClick={() => setSimulation(null)}
                  className="rounded-full px-3 py-1.5 text-xs font-bold transition hover:opacity-70"
                  style={{ border: "1px solid var(--border)" }}
                >
                  Close
                </button>
              </div>
              <Simulator
                key={simulation.key}
                fold={simulation.fold}
                patternId={`editor-${simulation.key}`}
                title={title}
                flatFoldable={analysis.flatFoldable}
                fallback={
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    The simulator is not available here.
                  </p>
                }
              />
            </section>
          )}
        </div>

        {/*
         * The controls. On phones a bar pinned to the bottom of the viewport,
         * where thumbs are; on a wide screen a proper panel beside the canvas.
         * A toolbar *above* a canvas on a small screen means reaching across
         * your own drawing to use it.
         */}
        <aside
          className="sticky bottom-0 z-20 -mx-4 space-y-4 px-4 pt-3 pb-4 lg:static lg:z-auto lg:mx-0 lg:space-y-5 lg:rounded-2xl lg:p-4"
          style={{
            background: "var(--surface-raised)",
            borderTop: "1px solid var(--border)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <Group
            title="Crease"
            action={
              <div className="flex gap-1.5">
                <IconButton
                  label="Undo"
                  Icon={Undo2}
                  disabled={!canUndo(history)}
                  onClick={() => setHistory(undo)}
                />
                <IconButton
                  label="Redo"
                  Icon={Redo2}
                  disabled={!canRedo(history)}
                  onClick={() => setHistory(redo)}
                />
              </div>
            }
          >
            <div className="grid grid-cols-5 gap-2">
              {ASSIGNMENTS.map((entry) => {
                const active = assignment === entry.key;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => setAssignment(entry.key)}
                    title={`${entry.label} (${entry.hotkey.toUpperCase()})`}
                    aria-pressed={active}
                    className="flex min-h-12 flex-col items-center justify-center gap-1.5 rounded-xl text-[11px] font-bold transition"
                    style={{
                      background: active ? "var(--surface-sunken)" : "transparent",
                      border: `1px solid ${active ? "var(--border-strong)" : "var(--border)"}`,
                    }}
                  >
                    <span
                      aria-hidden
                      className="h-1 w-6 rounded-full"
                      style={{ background: ORIGAMI_SIMULATOR_PALETTE[entry.key] }}
                    />
                    {entry.key}
                  </button>
                );
              })}
            </div>
          </Group>

          <Group title="Tool">
            <div className="grid grid-cols-4 gap-2">
              {TOOLS.map((entry) => {
                const active = tool === entry.key;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => setTool(entry.key)}
                    title={`${entry.hint} (${entry.hotkey.toUpperCase()})`}
                    aria-pressed={active}
                    className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-bold transition"
                    style={{
                      background: active ? "var(--brand)" : "transparent",
                      color: active ? "var(--ink)" : "inherit",
                      border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
                    }}
                  >
                    <entry.Icon className="size-4" aria-hidden />
                    {entry.label}
                  </button>
                );
              })}
            </div>
          </Group>

          {/* Everything below the fold on a phone: the essentials are above. */}
          <button
            type="button"
            onClick={() => setShowMore((value) => !value)}
            aria-expanded={showMore}
            className="min-h-10 w-full rounded-xl text-xs font-bold uppercase tracking-wide lg:hidden"
            style={{ background: "var(--surface-sunken)", color: "var(--text-muted)" }}
          >
            {showMore ? "Hide" : "Grid, checks & export"}
          </button>

          {showMore && (
            <div className="space-y-5">
              {backdrop && (
                <Group title="Tracing image">
                  <input
                    type="range"
                    min={0}
                    max={0.8}
                    step={0.05}
                    value={backdropOpacity}
                    onChange={(event) => setBackdropOpacity(Number(event.target.value))}
                    aria-label="Tracing image strength"
                    className="kami-slider w-full"
                  />
                </Group>
              )}

              <Group title="Grid divisions">
                {/* One row, so the panel's height does not change with a
                    label's width. */}
                <div className="grid grid-cols-5 gap-1.5">
                  {GRIDS.map((divisions) => (
                    <button
                      key={divisions}
                      type="button"
                      onClick={() => setGridDivisions(divisions)}
                      aria-pressed={gridDivisions === divisions}
                      title={divisions === 0 ? "No grid" : `${divisions}×${divisions} grid`}
                      className="min-h-9 rounded-full px-1 text-xs font-bold transition"
                      style={{
                        background:
                          gridDivisions === divisions ? "var(--surface-sunken)" : "transparent",
                        border: `1px solid ${gridDivisions === divisions ? "var(--border-strong)" : "var(--border)"}`,
                      }}
                    >
                      {divisions === 0 ? "None" : divisions}
                    </button>
                  ))}
                </div>
                <div className="mt-2.5 space-y-2">
                  <Check
                    label="Snap to existing vertices"
                    checked={snapToVertices}
                    onChange={setSnapToVertices}
                  />
                  <Check
                    label="Flat-foldability warnings"
                    checked={showMarks}
                    onChange={setShowMarks}
                  />
                </div>
              </Group>

              <Group title={stale ? "Checks · updating" : "Checks"}>
                <div
                  className="rounded-xl p-3 text-xs"
                  style={{ background: "var(--surface-sunken)" }}
                >
                  {analysis.skipped ? (
                    <p style={{ color: "var(--text-muted)" }}>
                      Paused above {LIVE_ANALYSIS_EDGE_LIMIT} creases.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      <li>
                        {analysis.errorCount === 0
                          ? "No structural defects"
                          : `${analysis.errorCount} structural ${analysis.errorCount === 1 ? "defect" : "defects"}`}
                      </li>
                      {analysis.warningCount > 0 && <li>{analysis.warningCount} warnings</li>}
                      <li>{analysis.faceCount} faces</li>
                      <li>{flatFoldabilityLine(analysis)}</li>
                    </ul>
                  )}
                  {analysis.defects.length > 0 && (
                    <ul className="mt-2.5 space-y-1.5" style={{ color: "var(--text-muted)" }}>
                      {analysis.defects.slice(0, 4).map((defect, index) => (
                        <li key={`${defect.code}-${index}`}>
                          <strong style={{ color: "var(--text)" }}>{defect.rule}</strong>{" "}
                          {defect.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Group>

              <Group title="Export">
                <div className="grid grid-cols-4 gap-2">
                  {DOWNLOAD_FORMATS.map((format) => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => download(format)}
                      className="min-h-10 rounded-xl font-mono text-xs transition hover:opacity-70"
                      style={{ border: "1px solid var(--border)" }}
                    >
                      {FORMAT_LABELS[format]}
                    </button>
                  ))}
                </div>
              </Group>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function flatFoldabilityLine(analysis: ReturnType<typeof analyse>): string {
  if (analysis.flatFoldable) return "Locally flat-foldable";
  const failing = analysis.vertexMarks.filter((mark) => !mark.ok).length;
  return failing === 1
    ? "1 vertex fails Maekawa or Kawasaki"
    : `${failing} vertices fail Maekawa or Kawasaki`;
}

/** A titled block in the control panel. One place decides the spacing. */
function Group({
  title,
  action,
  children,
}: {
  readonly title: string;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
        <h2
          className="text-xs font-bold uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function IconButton({
  label,
  Icon,
  disabled,
  onClick,
}: {
  readonly label: string;
  readonly Icon: typeof Undo2;
  readonly disabled: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-full transition disabled:opacity-30"
      style={{ border: "1px solid var(--border-strong)" }}
    >
      <Icon className="size-3.5" aria-hidden />
    </button>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
