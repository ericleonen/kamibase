"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Box,
  ChevronDown,
  Download,
  Eraser,
  Hand,
  ImagePlus,
  Magnet,
  PaintBucket,
  Link2,
  PanelLeft,
  PanelRight,
  PenLine,
  Redo2,
  Trash2,
  Undo2,
  Unlink,
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
import { ConfirmDialog } from "@/components/ConfirmDialog";
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
import {
  ANGLE_PRESETS,
  GRID_PRESETS,
  MAX_DIVISIONS,
  describeDivisions,
  formatAngle,
  isGridVisible,
  normalizeGrid,
  type GridSpec,
} from "@/lib/editor/grid";
import {
  PAPER_ANGLE_PRESETS,
  normalizePaperAngle,
  rotatedExtent,
} from "@/lib/editor/paper";
import { renderDownload, DOWNLOAD_FORMATS, FORMAT_LABELS } from "@/lib/downloads";
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

const DEFAULT_GRID: GridSpec = { x: 8, y: 8, angleDegrees: 0 };
const GRID_KEY = "kamibase:editor:grid";

/** How long the 3D preview waits after the last change before re-solving. */
const PREVIEW_DEBOUNCE_MS = 700;

/** A reference image is held in memory as a data URL, so it needs a ceiling. */
const MAX_REFERENCE_BYTES = 20 * 1024 * 1024;

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
 * It takes the whole screen, the way every drawing tool does, and it is three
 * columns: what the paper is on the left, the paper in the middle, what the
 * paper does on the right. The rails are rails and not floating cards: they
 * are always the same width, they never sit on top of the drawing, and the
 * canvas is simply what is left, which is the arrangement every tool that has
 * ever had a properties panel converged on.
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
  const router = useRouter();
  const [history, setHistory] = useState(() => initHistory(initialDoc ?? emptyPaper()));
  const [tool, setTool] = useState<EditorTool>("draw");
  const [assignment, setAssignment] = useState<EdgeAssignment>("M");
  const [grid, setGrid] = useState<GridSpec>(DEFAULT_GRID);
  const [paperAngle, setPaperAngle] = useState(0);
  /*
   * Whether typing in one division field types in both.
   *
   * On by default because the overwhelming majority of grids are square, and
   * making somebody type 32 twice to get a 32 grid would be a worse default
   * than the five fixed buttons this replaced.
   */
  const [linkAxes, setLinkAxes] = useState(true);
  const [snapToVertices, setSnapToVertices] = useState(true);
  const [showMarks, setShowMarks] = useState(true);
  const [simulation, setSimulation] = useState<{ fold: FoldDocument; key: number } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(backdrop ?? null);
  const [referenceOpacity, setReferenceOpacity] = useState(0.35);
  const [leavingTo, setLeavingTo] = useState<string | null>(null);

  /*
   * The rails are in the flow on a wide screen and over the canvas on a narrow
   * one, so on a phone they start closed: a 17rem rail over a 360px screen is
   * the drawing surface.
   */
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    const sync = (): void => {
      setShowLeft(wide.matches);
      setShowRight(wide.matches);
    };
    sync();
    wide.addEventListener("change", sync);
    return () => wide.removeEventListener("change", sync);
  }, []);

  const panZoom = usePanZoom({
    /*
     * The turned sheet, not the sheet. A square on the diagonal spans √2, and
     * fitting the untuned 1 would crop its corners off the screen.
     */
    contentWidth: rotatedExtent(paperAngle),
    contentHeight: rotatedExtent(paperAngle),
    // The dock floats over the bottom of the canvas; the rails do not float
    // over anything, so they need no allowance here.
    padding: { top: 24, left: 24, bottom: 96, right: 24 },
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

  /*
   * The grid is remembered across sessions, and remembered globally rather
   * than per document.
   *
   * Globally because it is a property of how somebody works, not of the file:
   * a designer who lays out on a 32 grid lays out every pattern on one, and
   * having to say so again in each new document would be worse than the five
   * fixed buttons this replaced. It is read after mount rather than in the
   * initial state so that the server-rendered markup and the first client
   * render agree.
   */
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(GRID_KEY);
      if (stored) setGrid(normalizeGrid({ ...DEFAULT_GRID, ...JSON.parse(stored) }));
    } catch {
      // Unparseable or unavailable. The default grid is a fine answer.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(GRID_KEY, JSON.stringify(grid));
    } catch {
      // Private mode, or the quota is full. Not worth interrupting anyone.
    }
  }, [grid]);

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

  /*
   * Anything drawn since this document was opened.
   *
   * The autosave above is a draft in this browser, not a saved pattern, so
   * leaving really does lose something, and the classic dialog is the classic
   * dialog because it is the one everybody already knows how to answer.
   */
  const dirty = canUndo(history);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      // The browser writes its own wording here; all a page can do is ask.
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const leave = useCallback(
    (href: string) => {
      if (dirty) setLeavingTo(href);
      else router.push(href);
    },
    [dirty, router],
  );

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

  /*
   * The live preview's geometry.
   *
   * Debounced, and only while the right rail is open. Every re-solve throws the
   * simulator back to a flat sheet and works forward again, so pushing one per
   * stroke would show a permanently unfolding pattern; three quarters of a
   * second after the last change is long enough to be finished drawing and
   * short enough to still feel like a reaction.
   */
  const [previewFold, setPreviewFold] = useState<FoldDocument | null>(null);
  useEffect(() => {
    if (!showRight || analysis.skipped) return;
    const timer = setTimeout(() => {
      try {
        const result = ingest(analysis.graph, { metadata: { title } });
        setPreviewFold(toFold(result.document));
      } catch {
        // A pattern part-way through being drawn need not be ingestible. The
        // last one that was stays on screen, which is better than a gap.
      }
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [analysis.graph, analysis.skipped, showRight, title]);

  const openSimulation = useCallback(() => {
    const result = ingest(analysis.graph, { metadata: { title } });
    setSimulation((previous) => ({
      fold: toFold(result.document),
      // Remount rather than re-push: this is a separate simulator from the
      // preview's, and a fresh frame is the reliable way to start it.
      key: (previous?.key ?? 0) + 1,
    }));
  }, [analysis.graph, title]);

  const chooseReference = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > MAX_REFERENCE_BYTES) return;
    const readerInstance = new FileReader();
    readerInstance.onload = () => {
      const result = readerInstance.result;
      if (typeof result === "string" && result.startsWith("data:image/")) setReference(result);
    };
    readerInstance.readAsDataURL(file);
  }, []);

  const creaseCount = doc.length;
  const backTo = backHref ?? "/";

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col overflow-hidden overscroll-none"
      style={{ background: "var(--surface-sunken)" }}
    >
      <header
        className="relative z-30 flex h-12 shrink-0 items-center gap-1.5 px-2 sm:px-3"
        style={{ background: "var(--surface-raised)", borderBottom: "1px solid var(--border)" }}
      >
        <IconButton
          label={backHref ? "Back to the pattern" : "Back to Kamibase"}
          Icon={ArrowLeft}
          disabled={false}
          onClick={() => leave(backTo)}
        />

        <IconButton
          label={showLeft ? "Hide the paper settings" : "Show the paper settings"}
          Icon={PanelLeft}
          disabled={false}
          pressed={showLeft}
          onClick={() => setShowLeft((value) => !value)}
        />

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
            onClick={openSimulation}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-bold transition hover:opacity-85"
            style={{ background: "var(--brand)", color: "var(--ink)" }}
          >
            <Box className="size-4" aria-hidden />
            <span className="hidden sm:inline">Fold in 3D</span>
          </button>

          <IconButton
            label={showRight ? "Hide the checks" : "Show the checks"}
            Icon={PanelRight}
            disabled={false}
            pressed={showRight}
            onClick={() => setShowRight((value) => !value)}
          />
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {showLeft && (
          <Rail side="left" label="Paper settings">
            <Field label="Grid size" value={describeDivisions(grid)}>
              <Presets
                options={GRID_PRESETS.map((preset) => ({
                  label: preset.label,
                  active:
                    preset.spec.x === grid.x &&
                    preset.spec.y === grid.y &&
                    preset.spec.angleDegrees === grid.angleDegrees,
                  onSelect: () => setGrid(preset.spec),
                }))}
              />
              <div className="flex items-end gap-1.5">
                <NumberField
                  label="Across"
                  value={grid.x}
                  min={0}
                  max={MAX_DIVISIONS}
                  onChange={(value) =>
                    setGrid(normalizeGrid(linkAxes ? { ...grid, x: value, y: value } : { ...grid, x: value }))
                  }
                />
                <button
                  type="button"
                  onClick={() => {
                    // Turning the link on squares the grid immediately, rather
                    // than waiting for the next keystroke. Anything else leaves
                    // the control claiming the axes are linked while they differ.
                    if (!linkAxes) setGrid(normalizeGrid({ ...grid, y: grid.x }));
                    setLinkAxes(!linkAxes);
                  }}
                  aria-pressed={linkAxes}
                  title={linkAxes ? "Divisions are linked" : "Divisions are independent"}
                  className="flex h-9 w-7 shrink-0 items-center justify-center rounded-lg transition"
                  style={{
                    color: linkAxes ? "var(--text)" : "var(--text-faint)",
                    background: linkAxes ? "var(--surface-sunken)" : "transparent",
                  }}
                >
                  {linkAxes ? (
                    <Link2 className="size-4" aria-hidden />
                  ) : (
                    <Unlink className="size-4" aria-hidden />
                  )}
                </button>
                <NumberField
                  label="Down"
                  value={grid.y}
                  min={0}
                  max={MAX_DIVISIONS}
                  onChange={(value) =>
                    setGrid(normalizeGrid(linkAxes ? { ...grid, x: value, y: value } : { ...grid, y: value }))
                  }
                />
              </div>
            </Field>

            {isGridVisible(grid) && (
              <Field label="Grid angle" value={`${formatAngle(grid.angleDegrees)}°`}>
                <Presets
                  options={ANGLE_PRESETS.map((angle) => ({
                    label: `${formatAngle(angle)}°`,
                    active: grid.angleDegrees === angle,
                    onSelect: () => setGrid(normalizeGrid({ ...grid, angleDegrees: angle })),
                  }))}
                />
                <NumberField
                  value={grid.angleDegrees}
                  min={0}
                  max={180}
                  step={0.5}
                  onChange={(value) => setGrid(normalizeGrid({ ...grid, angleDegrees: value }))}
                />
              </Field>
            )}

            <Field
              label="Paper angle"
              value={`${formatAngle(paperAngle)}°`}
              note="Turns the sheet on screen. The pattern is unchanged."
            >
              <Presets
                options={PAPER_ANGLE_PRESETS.map((angle) => ({
                  label: `${formatAngle(angle)}°`,
                  active: paperAngle === angle,
                  onSelect: () => setPaperAngle(angle),
                }))}
              />
              <NumberField
                value={paperAngle}
                min={0}
                max={359.5}
                step={0.5}
                onChange={(value) => setPaperAngle(normalizePaperAngle(value))}
              />
            </Field>

            <Field
              label="Reference image"
              value={reference ? `${Math.round(referenceOpacity * 100)}%` : "None"}
            >
              {reference ? (
                <>
                  <Presets
                    options={[0.15, 0.35, 0.6, 0.8].map((value) => ({
                      label: `${Math.round(value * 100)}%`,
                      active: Math.abs(referenceOpacity - value) < 0.001,
                      onSelect: () => setReferenceOpacity(value),
                    }))}
                  />
                  <div className="flex items-end gap-1.5">
                    <NumberField
                      label="Opacity"
                      value={Math.round(referenceOpacity * 100)}
                      min={0}
                      max={100}
                      onChange={(value) => setReferenceOpacity(value / 100)}
                    />
                    <button
                      type="button"
                      onClick={() => setReference(null)}
                      title="Remove the reference image"
                      aria-label="Remove the reference image"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition hover:opacity-60"
                      style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </>
              ) : (
                <ImagePicker onPick={chooseReference} />
              )}
            </Field>
          </Rail>
        )}

        <div className="relative min-h-0 flex-1">
          <EditorCanvas
            doc={doc}
            tool={tool}
            assignment={assignment}
            snap={{ grid, snapToVertices }}
            vertexMarks={analysis.vertexMarks}
            showMarks={showMarks}
            paperAngle={paperAngle}
            panZoom={panZoom}
            {...(reference === null
              ? {}
              : { backdrop: reference, backdropOpacity: referenceOpacity })}
            onDraw={(segment) => apply((current) => addSegment(current, segment))}
            onErase={(index) => apply((current) => removeSegment(current, index))}
            onAssign={(index) => apply((current) => reassignSegment(current, index, assignment))}
          />

          {/*
           * Above the dock, not beside it. Beside it only works while the
           * canvas is wide, and the canvas is now the screen minus two rails:
           * at 1280 with both open, the dock reaches back far enough to sit on
           * top of these.
           */}
          <ZoomControls
            className="absolute bottom-20 left-3 sm:left-4"
            zoom={panZoom.zoom}
            onZoomIn={() => panZoom.zoomBy(ZOOM_STEP)}
            onZoomOut={() => panZoom.zoomBy(1 / ZOOM_STEP)}
            onFit={panZoom.fit}
          />

          {/*
           * The dock. Centred at the bottom, floating over the drawing, within
           * reach of both thumbs on a phone and of the pointer on a desktop,
           * and never between you and the paper the way a top toolbar is.
           */}
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-3">
            <div
              className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl p-1.5 sm:gap-1"
              style={{ background: "var(--surface-raised)", boxShadow: "var(--shadow-card-hover)" }}
              role="toolbar"
              aria-label="Drawing tools"
            >
              {TOOLS.map((entry) => (
                <DockButton
                  key={entry.key}
                  label={entry.label}
                  title={`${entry.label}: ${entry.hint} (${entry.hotkey.toUpperCase()})`}
                  active={tool === entry.key}
                  onClick={() => setTool(entry.key)}
                >
                  <entry.Icon className="size-[18px]" aria-hidden />
                </DockButton>
              ))}

              <Divider />

              {ASSIGNMENTS.map((entry) => (
                <DockButton
                  key={entry.key}
                  label={entry.label}
                  title={`${entry.label} (${entry.hotkey.toUpperCase()})`}
                  active={assignment === entry.key}
                  subtle
                  onClick={() => setAssignment(entry.key)}
                >
                  <span
                    aria-hidden
                    className="h-1.5 w-5 rounded-full"
                    style={{ background: ORIGAMI_SIMULATOR_PALETTE[entry.key] }}
                  />
                  <span className="text-[10px] font-bold">{entry.key}</span>
                </DockButton>
              ))}

              <Divider />

              {/*
               * Snapping belongs here rather than in a panel. It is a mode you
               * turn off for one crease and back on for the next, which makes
               * it a tool-bar thing in the way that "how many divisions" never
               * is.
               */}
              <DockButton
                label="Snap to existing vertices"
                title="Snap to existing vertices"
                active={snapToVertices}
                onClick={() => setSnapToVertices((value) => !value)}
              >
                <Magnet className="size-[18px]" aria-hidden />
              </DockButton>
            </div>
          </div>
        </div>

        {showRight && (
          <Rail side="right" label="Checks and 3D fold">
            <Field label={stale ? "Checks · updating" : "Checks"}>
              <div className="rounded-xl p-3 text-xs" style={{ background: "var(--surface-sunken)" }}>
                {analysis.skipped ? (
                  <p style={{ color: "var(--text-muted)" }}>
                    Paused above {LIVE_ANALYSIS_EDGE_LIMIT} creases.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    <li>
                      {analysis.errorCount === 0
                        ? "No structural defects"
                        : count(analysis.errorCount, "structural defect")}
                    </li>
                    {analysis.warningCount > 0 && (
                      <li>{count(analysis.warningCount, "warning")}</li>
                    )}
                    <li>{count(analysis.faceCount, "face")}</li>
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
              <Check
                label="Mark the vertices that fail"
                checked={showMarks}
                onChange={setShowMarks}
              />
            </Field>

            <Field label="3D fold" note="Click to open it full size.">
              {previewFold ? (
                <Simulator
                  fold={previewFold}
                  // Stable, so new geometry is pushed into the running
                  // simulator rather than remounting the iframe.
                  patternId="editor-preview"
                  title={title}
                  flatFoldable={analysis.flatFoldable}
                  variant="preview"
                  onOpen={openSimulation}
                  fallback={null}
                />
              ) : (
                <p
                  className="rounded-xl p-3 text-xs"
                  style={{ background: "var(--surface-sunken)", color: "var(--text-muted)" }}
                >
                  {analysis.skipped
                    ? `Paused above ${LIVE_ANALYSIS_EDGE_LIMIT} creases.`
                    : "Draw a crease and the fold appears here."}
                </p>
              )}
            </Field>
          </Rail>
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

      {leavingTo !== null && (
        <ConfirmDialog
          title="Leave the editor?"
          body="This pattern has not been exported. It stays as a draft in this browser, but nothing else keeps it."
          confirmLabel="Leave"
          cancelLabel="Keep drawing"
          onCancel={() => setLeavingTo(null)}
          onConfirm={() => {
            const href = leavingTo;
            setLeavingTo(null);
            router.push(href);
          }}
        />
      )}
    </div>
  );
}

/** "1 face", "4 faces". A panel of counts reads as sloppy without it. */
function count(quantity: number, noun: string): string {
  return `${quantity} ${quantity === 1 ? noun : `${noun}s`}`;
}

function flatFoldabilityLine(analysis: ReturnType<typeof analyse>): string {
  if (analysis.flatFoldable) return "Locally flat-foldable";
  const failing = analysis.vertexMarks.filter((mark) => !mark.ok).length;
  return failing === 1
    ? "1 vertex fails Maekawa or Kawasaki"
    : `${failing} vertices fail Maekawa or Kawasaki`;
}

/**
 * A rail.
 *
 * In the flow on a wide screen, over the canvas on a narrow one. Same element
 * either way, so nothing inside it is mounted twice, which matters, because
 * one of the things inside it is a WebGL simulator in an iframe.
 */
function Rail({
  side,
  label,
  children,
}: {
  readonly side: "left" | "right";
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <aside
      aria-label={label}
      className={`absolute inset-y-0 z-20 flex w-[17rem] shrink-0 flex-col gap-5 overflow-y-auto p-4 lg:relative lg:z-auto ${
        side === "left" ? "left-0" : "right-0 lg:w-[19rem]"
      }`}
      style={{
        background: "var(--surface-raised)",
        [side === "left" ? "borderRight" : "borderLeft"]: "1px solid var(--border)",
      }}
    >
      {children}
    </aside>
  );
}

/**
 * One setting, in the shape every setting takes.
 *
 * A name, what it currently says, the two or three answers worth one tap, and
 * the field for every other answer. The grid used to be chips and the angle
 * used to be a field with chips wedged beside it, which made two controls that
 * did the same job look like two different kinds of thing. This is the job,
 * once, and each setting fills it in.
 */
function Field({
  label,
  value,
  note,
  children,
}: {
  readonly label: string;
  /** What the setting reads as right now, shown at the end of the label row. */
  readonly value?: string;
  /** One line under the controls, for a setting that is not self-evident. */
  readonly note?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-baseline justify-between gap-2">
        <span
          className="text-xs font-bold uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </span>
        {value && (
          <span className="text-xs tabular-nums" style={{ color: "var(--text-faint)" }}>
            {value}
          </span>
        )}
      </h2>
      {children}
      {note && (
        <p className="text-[11px] leading-snug" style={{ color: "var(--text-faint)" }}>
          {note}
        </p>
      )}
    </section>
  );
}

/** The one-tap answers. Even columns, however many there are. */
function Presets({
  options,
}: {
  readonly options: readonly {
    readonly label: string;
    readonly active: boolean;
    readonly onSelect: () => void;
  }[];
}) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={option.onSelect}
          aria-pressed={option.active}
          className="min-h-9 rounded-lg px-1 text-xs font-bold tabular-nums transition"
          style={{
            background: option.active ? "var(--surface-sunken)" : "transparent",
            border: `1px solid ${option.active ? "var(--border-strong)" : "var(--border)"}`,
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DockButton({
  label,
  title,
  active,
  subtle,
  onClick,
  children,
}: {
  readonly label: string;
  readonly title: string;
  readonly active: boolean;
  readonly subtle?: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={label}
      aria-pressed={active}
      className="flex size-9 shrink-0 flex-col items-center justify-center gap-1 rounded-xl transition sm:size-10"
      style={
        subtle
          ? {
              background: active ? "var(--surface-sunken)" : "transparent",
              boxShadow: active ? "inset 0 0 0 1.5px var(--border-strong)" : "none",
            }
          : {
              background: active ? "var(--brand)" : "transparent",
              color: active ? "var(--ink)" : "var(--text-muted)",
            }
      }
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <span className="mx-1 h-7 w-px shrink-0" style={{ background: "var(--border)" }} aria-hidden />
  );
}

function IconButton({
  label,
  Icon,
  disabled,
  onClick,
  pressed,
}: {
  readonly label: string;
  readonly Icon: typeof Undo2;
  readonly disabled: boolean;
  readonly onClick: () => void;
  readonly pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      {...(pressed === undefined ? {} : { "aria-pressed": pressed })}
      className="flex size-9 shrink-0 items-center justify-center rounded-lg transition disabled:opacity-30"
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

/** Pick an image to trace over. It never leaves the browser. */
function ImagePicker({ onPick }: { readonly onPick: (file: File | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex min-h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-bold transition hover:opacity-60"
        style={{ border: "1px dashed var(--border-strong)", color: "var(--text-muted)" }}
      >
        <ImagePlus className="size-4" aria-hidden />
        Choose an image
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          onPick(file);
        }}
      />
    </>
  );
}

/**
 * A number field.
 *
 * `type="number"` rather than a slider or a stepper, because the value being
 * entered is one somebody already knows, "it is a 32 grid", and every other
 * control makes them arrive at a number they could have typed. It keeps the
 * text they are typing rather than the number it parses to, so that clearing
 * the field to type a new value does not fight back with a 0.
 */
function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  /** Only where two of these sit side by side and have to be told apart. */
  readonly label?: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);

  return (
    <label className="min-w-0 flex-1">
      {label && (
        <span
          className="mb-1 block text-[10px] font-bold uppercase tracking-wide"
          style={{ color: "var(--text-faint)" }}
        >
          {label}
        </span>
      )}
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={shown}
        onChange={(event) => {
          setDraft(event.target.value);
          const parsed = Number(event.target.value);
          if (event.target.value !== "" && Number.isFinite(parsed)) {
            onChange(Math.min(max, Math.max(min, parsed)));
          }
        }}
        onBlur={() => setDraft(null)}
        className="h-9 w-full rounded-lg px-2 text-sm font-bold tabular-nums"
        style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)" }}
      />
    </label>
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
