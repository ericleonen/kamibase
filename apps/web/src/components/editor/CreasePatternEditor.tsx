"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Box,
  ChevronDown,
  Download,
  Eraser,
  Hand,
  PaintBucket,
  PanelRight,
  PenLine,
  Redo2,
  Undo2,
  X,
} from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ORIGAMI_SIMULATOR_PALETTE,
  ingest,
  toFold,
  type EdgeAssignment,
  type FoldDocument,
} from "@kamibase/core";
import { Simulator } from "@/components/Simulator";
import { ZoomControls } from "@/components/viewport/ZoomControls";
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
import { useModifierLabel } from "@/lib/viewport/platform";
import { ZOOM_STEP, usePanZoom } from "@/lib/viewport/use-pan-zoom";
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
  {
    key: "assign",
    label: "Paint",
    hotkey: "a",
    hint: "Tap a crease to recolour it",
    Icon: PaintBucket,
  },
  { key: "pan", label: "Pan", hotkey: "h", hint: "Drag to move the paper", Icon: Hand },
];

const GRIDS = [0, 4, 8, 16, 22] as const;

/** The properties panel, in CSS pixels, so the fit can allow for it. */
const PANEL_WIDTH = 280;

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
 * It takes the whole screen, the way every drawing tool does. The page it used
 * to live on scrolled, which meant a canvas that fought the page for the wheel,
 * a toolbar that moved while you reached for it, and a drawing surface capped
 * at whatever was left over. Fullscreen removes the argument entirely: the
 * chrome floats over the canvas, the canvas is everything else, and scrolling
 * is panning because there is nothing else to scroll.
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
  const [simulation, setSimulation] = useState<{ fold: FoldDocument; key: number } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [backdropOpacity, setBackdropOpacity] = useState(0.35);
  const modifier = useModifierLabel();

  /*
   * The properties panel floats over the canvas, so on a phone it is closed
   * until asked for: a 17rem card over a 360px screen is the drawing surface.
   * Wide screens have room for both and start with it open.
   */
  const [showPanel, setShowPanel] = useState(false);
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    const sync = (): void => setShowPanel(wide.matches);
    sync();
    wide.addEventListener("change", sync);
    return () => wide.removeEventListener("change", sync);
  }, []);

  const panZoom = usePanZoom({
    // The paper is the unit square; the canvas is everything around it.
    contentWidth: 1,
    contentHeight: 1,
    /*
     * Fit into what is actually visible. The dock floats over the bottom of
     * the canvas and the panel over its right, so fitting to the whole box
     * would tuck the edges of the paper underneath them.
     */
    padding: {
      top: 24,
      left: 24,
      bottom: 96,
      right: showPanel ? PANEL_WIDTH + 24 : 24,
    },
    minZoom: 0.15,
    maxZoom: 60,
    // Nothing behind this screen to scroll, so the wheel is the canvas's.
    capturePlainWheel: true,
    touch: "capture",
    spaceToPan: true,
    dragToPan: tool === "pan",
  });

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
  const zoomRef = useRef(panZoom);
  zoomRef.current = panZoom;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        setHistory((current) => (event.shiftKey ? redo(current) : undo(current)));
        return;
      }
      if (event.key === "Escape") {
        setSimulation(null);
        return;
      }
      // ⌘/Ctrl+0, +, − are the browser's zoom on a normal page and the
      // canvas's zoom in a tool. Here the canvas wins, which is the whole
      // point of a fullscreen surface.
      if (event.key === "0") {
        event.preventDefault();
        zoomRef.current.fit();
        return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomRef.current.zoomBy(ZOOM_STEP);
        return;
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoomRef.current.zoomBy(1 / ZOOM_STEP);
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
    <div
      className="fixed inset-0 z-40 flex flex-col overflow-hidden overscroll-none"
      style={{ background: "var(--surface-sunken)" }}
    >
      {/*
       * The one piece of chrome that is not floating. A drawing tool needs a
       * fixed place for "where am I, and how do I get out", and a bar that
       * moves with the canvas is not it.
       */}
      <header
        className="relative z-30 flex h-12 shrink-0 items-center gap-1.5 px-2 sm:px-3"
        style={{ background: "var(--surface-raised)", borderBottom: "1px solid var(--border)" }}
      >
        <Link
          href={backHref ?? "/"}
          title={backHref ? "Back to the pattern" : "Back to Kamibase"}
          aria-label={backHref ? "Back to the pattern" : "Back to Kamibase"}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg transition hover:opacity-60"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold leading-tight">{title}</h1>
          <p className="truncate text-[11px] leading-tight" style={{ color: "var(--text-muted)" }}>
            {creaseCount} creases
            {saved && ` · saved ${saved}`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            label="Undo (⌘Z)"
            Icon={Undo2}
            disabled={!canUndo(history)}
            onClick={() => setHistory(undo)}
          />
          <IconButton
            label="Redo (⇧⌘Z)"
            Icon={Redo2}
            disabled={!canRedo(history)}
            onClick={() => setHistory(redo)}
          />
          <span className="mx-1 h-6 w-px" style={{ background: "var(--border)" }} aria-hidden />

          <ExportMenu onPick={download} />

          <button
            type="button"
            onClick={simulate}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-bold transition hover:opacity-85"
            style={{ background: "var(--brand)", color: "var(--ink)" }}
          >
            <Box className="size-4" aria-hidden />
            <span className="hidden sm:inline">{simulation ? "Refold" : "Fold in 3D"}</span>
          </button>

          <IconButton
            label={showPanel ? "Hide properties" : "Show properties"}
            Icon={PanelRight}
            disabled={false}
            pressed={showPanel}
            onClick={() => setShowPanel((value) => !value)}
          />
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <EditorCanvas
          doc={doc}
          tool={tool}
          assignment={assignment}
          snap={{ divisions: gridDivisions, snapToVertices }}
          gridDivisions={gridDivisions}
          vertexMarks={analysis.vertexMarks}
          showMarks={showMarks}
          panZoom={panZoom}
          {...(backdrop === undefined ? {} : { backdrop, backdropOpacity })}
          onDraw={(segment) => apply((current) => addSegment(current, segment))}
          onErase={(index) => apply((current) => removeSegment(current, index))}
          onAssign={(index) => apply((current) => reassignSegment(current, index, assignment))}
        />

        {/* Above the dock on a phone, beside it on a desktop. */}
        <ZoomControls
          className="absolute bottom-20 left-3 sm:bottom-4 sm:left-4"
          zoom={panZoom.zoom}
          onZoomIn={() => panZoom.zoomBy(ZOOM_STEP)}
          onZoomOut={() => panZoom.zoomBy(1 / ZOOM_STEP)}
          onFit={panZoom.fit}
        />

        {/*
         * The dock. Centred at the bottom, floating over the drawing, within
         * reach of both thumbs on a phone and of the pointer on a desktop —
         * and never between you and the paper the way a top toolbar is.
         */}
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-3">
          <div
            className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl p-1.5 sm:gap-1"
            style={{ background: "var(--surface-raised)", boxShadow: "var(--shadow-card-hover)" }}
            role="toolbar"
            aria-label="Drawing tools"
          >
            {TOOLS.map((entry) => {
              const active = tool === entry.key;
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => setTool(entry.key)}
                  title={`${entry.label} — ${entry.hint} (${entry.hotkey.toUpperCase()})`}
                  aria-label={entry.label}
                  aria-pressed={active}
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl transition sm:size-10"
                  style={{
                    background: active ? "var(--brand)" : "transparent",
                    color: active ? "var(--ink)" : "var(--text-muted)",
                  }}
                >
                  <entry.Icon className="size-[18px]" aria-hidden />
                </button>
              );
            })}

            <span
              className="mx-1 h-7 w-px shrink-0"
              style={{ background: "var(--border)" }}
              aria-hidden
            />

            {ASSIGNMENTS.map((entry) => {
              const active = assignment === entry.key;
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => setAssignment(entry.key)}
                  title={`${entry.label} (${entry.hotkey.toUpperCase()})`}
                  aria-label={entry.label}
                  aria-pressed={active}
                  className="flex size-9 shrink-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold transition sm:size-10"
                  style={{
                    background: active ? "var(--surface-sunken)" : "transparent",
                    boxShadow: active ? "inset 0 0 0 1.5px var(--border-strong)" : "none",
                  }}
                >
                  <span
                    aria-hidden
                    className="h-1.5 w-5 rounded-full"
                    style={{ background: ORIGAMI_SIMULATOR_PALETTE[entry.key] }}
                  />
                  {entry.key}
                </button>
              );
            })}
          </div>
        </div>

        {showPanel && (
          <aside
            className="absolute inset-x-3 bottom-24 z-20 flex max-h-[55%] flex-col gap-5 overflow-y-auto rounded-2xl p-4 sm:inset-x-auto sm:right-3 sm:top-3 sm:bottom-auto sm:max-h-[calc(100%-7.5rem)] sm:w-[var(--panel-width)]"
            style={{
              background: "var(--surface-raised)",
              boxShadow: "var(--shadow-card-hover)",
              // The width the fit allows for, so the two cannot drift apart.
              ["--panel-width" as string]: `${PANEL_WIDTH}px`,
            }}
            aria-label="Pattern properties"
          >
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
                      border: `1px solid ${
                        gridDivisions === divisions ? "var(--border-strong)" : "var(--border)"
                      }`,
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
                        : `${analysis.errorCount} structural ${
                            analysis.errorCount === 1 ? "defect" : "defects"
                          }`}
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

            <Group title="Gestures">
              <ul className="space-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
                <li>Space + drag, middle-drag or two fingers to pan</li>
                <li>Scroll to pan, {modifier} + scroll or pinch to zoom</li>
                <li>Shift while drawing to hold 45°</li>
                <li>0 to fit, + and − to zoom</li>
              </ul>
            </Group>
          </aside>
        )}

        {simulation && (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-6"
            style={{ background: "rgb(27 26 23 / 0.45)" }}
          >
            <section
              className="flex max-h-full w-full max-w-3xl flex-col gap-3 overflow-y-auto rounded-2xl p-4"
              style={{ background: "var(--surface-raised)", boxShadow: "var(--shadow-card-hover)" }}
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
                  aria-label="Close the 3D fold"
                  className="flex size-8 items-center justify-center rounded-full transition hover:opacity-70"
                  style={{ border: "1px solid var(--border)" }}
                >
                  <X className="size-4" aria-hidden />
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
          </div>
        )}
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

/** A titled block in the properties panel. One place decides the spacing. */
function Group({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        className="mb-2 text-xs font-bold uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function IconButton({
  label,
  Icon,
  disabled,
  onClick,
  pressed,
  className = "",
}: {
  readonly label: string;
  readonly Icon: typeof Undo2;
  readonly disabled: boolean;
  readonly onClick: () => void;
  readonly pressed?: boolean;
  readonly className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      {...(pressed === undefined ? {} : { "aria-pressed": pressed })}
      className={`flex size-9 items-center justify-center rounded-lg transition disabled:opacity-30 ${className}`}
      style={{
        background: pressed ? "var(--surface-sunken)" : "transparent",
        color: "var(--text-muted)",
      }}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

/** Export, as a menu rather than four buttons taking up the bar. */
function ExportMenu({
  onPick,
}: {
  readonly onPick: (format: (typeof DOWNLOAD_FORMATS)[number]) => void;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Export this pattern"
        className="flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-bold transition hover:opacity-60"
        style={{ color: "var(--text-muted)" }}
      >
        <Download className="size-4" aria-hidden />
        <span className="hidden md:inline">Export</span>
        <ChevronDown className="size-3.5" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 w-44 overflow-hidden rounded-xl p-1.5"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-card-hover)",
          }}
        >
          {DOWNLOAD_FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              onClick={() => {
                onPick(format);
                setOpen(false);
              }}
              className="flex w-full items-center rounded-lg px-3 py-2 text-left font-mono text-xs transition hover:opacity-60"
            >
              {FORMAT_LABELS[format]}
            </button>
          ))}
        </div>
      )}
    </div>
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
