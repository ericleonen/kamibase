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
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  PanelRightClose,
  PenLine,
  Redo2,
  Save,
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
import { Spinner } from "@/components/Loading";
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
import { EDITOR_MIN_WIDTH_QUERY, EditorTooSmall } from "./EditorTooSmall";
import { SavePatternDialog } from "./SavePatternDialog";

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
const RAILS_KEY = "kamibase:editor:rails";

/**
 * How wide each rail may be, in pixels.
 *
 * The minimum is not a nicety. The left rail holds two number fields and a link
 * button on one row, and the right holds a live simulator; below about 13rem
 * either of those wraps into something unusable, so the drag stops there rather
 * than letting somebody squeeze a panel into a state they then have to guess
 * their way out of. The maximum is the other end of the same argument: this is
 * a drawing tool, and the drawing is the middle.
 */
const LEFT_RAIL = { min: 208, max: 420, initial: 272 } as const;
const RIGHT_RAIL = { min: 248, max: 520, initial: 304 } as const;

/** A collapsed rail: one icon button wide, and nothing else. */
const COLLAPSED_RAIL = 44;

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
   * Whether anybody is logged in.
   *
   * Only the save dialog cares: drawing, checking, folding and exporting all
   * work signed out, and DESIGN.md §8.4 asks that they keep working. Saving is
   * the one thing that puts a pattern on the site under a name, so it is the
   * one thing that needs an account.
   */
  readonly signedIn?: boolean;
  /**
   * A rectified image of what this was made from, as a data URL, shown under
   * the paper to trace over. Set when the pattern came from a photograph.
   */
  readonly backdrop?: string;
}

/**
 * The door to the editor: wide enough, or a note explaining why not.
 *
 * Every way into the editor — `/edit`, `/edit/import`, `/p/:id/edit` — comes
 * through this component, so the check belongs here rather than in three pages
 * that could each forget it.
 *
 * Two mechanisms, doing two different jobs. The CSS one (`lg:hidden` on the
 * notice) is what a phone sees in its first paint, before any JavaScript has
 * run and whether or not any ever does. The `matchMedia` one decides whether to
 * mount the editor at all, which is the part that matters: the editor is a live
 * analysis loop and a WebGL simulator in an iframe, and hiding that with CSS
 * would leave a phone solving crease patterns it will never show anybody.
 *
 * Entry latches. Once somebody is in, narrowing the window does not throw them
 * out, because the thing on the other side of that unmount is their drawing.
 * They get cramped rails, which they can drag, and that is their business.
 */
export function CreasePatternEditor(props: CreasePatternEditorProps) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (entered) return;
    const query = window.matchMedia(EDITOR_MIN_WIDTH_QUERY);
    const sync = (): void => {
      if (query.matches) setEntered(true);
    };
    sync();
    // Rotating a tablet is the common way across this line.
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [entered]);

  if (entered) return <Editor {...props} />;

  return (
    <>
      <EditorTooSmall
        className="lg:hidden"
        {...(props.backHref === undefined ? {} : { backHref: props.backHref })}
      />
      {/* A wide screen that has not hydrated yet: the editor's own background,
          so the frame before it mounts is not a flash of white. */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10 hidden lg:block"
        style={{ background: "var(--surface-sunken)" }}
      />
    </>
  );
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
 * never sit on top of the drawing, they are as wide as you drag them, and the
 * canvas is simply what is left, which is the arrangement every tool that has
 * ever had a properties panel converged on.
 *
 * Every check on screen is `@kamibase/core` running in the browser, which is
 * the point of §9: the editor's rules and the server's rules cannot drift,
 * because they are the same code.
 */
function Editor({
  initialDoc,
  title,
  slug,
  backHref,
  backdrop,
  signedIn = false,
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(backdrop ?? null);
  const [referenceOpacity, setReferenceOpacity] = useState(0.35);
  const [leavingTo, setLeavingTo] = useState<string | null>(null);

  /*
   * The rails: in the flow beside the canvas, never over it, and as wide as
   * they were last dragged to.
   *
   * The right one has no collapse, because the checks and the 3D fold are the
   * editor telling you about what you are drawing, and a panel you have to open
   * to find out whether the thing you just drew is broken is a panel that is
   * closed at the moment it matters. The left one does, because "what the paper
   * is" is a decision you make at the start and then leave alone.
   *
   * There is no narrow-screen arrangement of any of this, because there is no
   * narrow screen: `CreasePatternEditor` above does not mount the editor below
   * 64rem.
   */
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [leftWidth, setLeftWidth] = useState<number>(LEFT_RAIL.initial);
  const [rightWidth, setRightWidth] = useState<number>(RIGHT_RAIL.initial);

  /*
   * Rail widths are remembered, and remembered globally, for the same reason
   * the grid is: how wide somebody wants their panels is a fact about them and
   * their screen, not about the pattern they happen to have open.
   */
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RAILS_KEY);
      if (!stored) return;
      const parsed: unknown = JSON.parse(stored);
      if (typeof parsed !== "object" || parsed === null) return;
      const { left, right } = parsed as { left?: unknown; right?: unknown };
      if (typeof left === "number") setLeftWidth(clamp(left, LEFT_RAIL.min, LEFT_RAIL.max));
      if (typeof right === "number") setRightWidth(clamp(right, RIGHT_RAIL.min, RIGHT_RAIL.max));
    } catch {
      // Unparseable or unavailable. The default widths are a fine answer.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(RAILS_KEY, JSON.stringify({ left: leftWidth, right: rightWidth }));
    } catch {
      // Private mode, or the quota is full. Not worth interrupting anyone.
    }
  }, [leftWidth, rightWidth]);

  /*
   * The angle the sheet is actually drawn at, which chases the angle it has
   * been asked for.
   *
   * The turn is animated in React rather than in CSS because it is not only a
   * transform: a turned square needs a bigger box, so the viewport's fit
   * depends on the angle too. Easing one and stepping the other would give a
   * sheet that swings round while the zoom jumps under it. One eased number
   * feeds both, and they move together.
   */
  const turnedAngle = useTurn(paperAngle);

  const panZoom = usePanZoom({
    /*
     * The turned sheet, not the sheet. A square on the diagonal spans √2, and
     * fitting the untuned 1 would crop its corners off the screen.
     */
    contentWidth: rotatedExtent(turnedAngle),
    contentHeight: rotatedExtent(turnedAngle),
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
   * The divisions are remembered across sessions, and remembered globally
   * rather than per document. The angle is not.
   *
   * Divisions are a property of how somebody works, not of the file: a designer
   * who lays out on a 32 grid lays out every pattern on one, and having to say
   * so again in each new document would be worse than the five fixed buttons
   * this replaced. A lattice angle is the opposite — it belongs to the design
   * in front of you. Remembering it means the 60° you needed once for one
   * pattern is waiting, unasked for and unexplained, on top of the next blank
   * sheet you open. So every document starts square, and turning the lattice is
   * a thing you do on purpose.
   *
   * Read after mount rather than in the initial state, so the server-rendered
   * markup and the first client render agree.
   */
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(GRID_KEY);
      if (!stored) return;
      const { x, y } = JSON.parse(stored) as { x?: unknown; y?: unknown };
      setGrid(
        normalizeGrid({
          ...DEFAULT_GRID,
          ...(typeof x === "number" ? { x } : {}),
          ...(typeof y === "number" ? { y } : {}),
        }),
      );
    } catch {
      // Unparseable or unavailable. The default grid is a fine answer.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(GRID_KEY, JSON.stringify({ x: grid.x, y: grid.y }));
    } catch {
      // Private mode, or the quota is full. Not worth interrupting anyone.
    }
  }, [grid.x, grid.y]);

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
    if (analysis.skipped) return;
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
  }, [analysis.graph, analysis.skipped, title]);

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

        {/* The rails collapse from their own edges, not from up here: a button
            in the top bar for a panel on the left of the screen is a control
            that lives nowhere near the thing it controls. */}
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

          {/*
           * Fold and Save, in that order, and only one of them filled in.
           * Folding is what you do while drawing and saving is what you do
           * when you have finished, so saving is the end of the row and the
           * one that looks like the end.
           */}
          <button
            type="button"
            onClick={openSimulation}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-bold transition hover:opacity-70"
            style={{ border: "1px solid var(--border-strong)" }}
          >
            <Box className="size-4" aria-hidden />
            <span className="hidden sm:inline">Fold in 3D</span>
          </button>

          <button
            type="button"
            onClick={() => setSaving(true)}
            disabled={creaseCount === 0}
            title="Save this pattern to Kamibase"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-bold transition hover:opacity-85 disabled:opacity-40"
            style={{ background: "var(--brand)", color: "var(--ink)" }}
          >
            <Save className="size-4" aria-hidden />
            <span className="hidden sm:inline">Save</span>
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <Rail
          side="left"
          label="Paper settings"
          width={leftWidth}
          min={LEFT_RAIL.min}
          max={LEFT_RAIL.max}
          onResize={setLeftWidth}
          collapsed={leftCollapsed}
          onToggle={() => setLeftCollapsed((value) => !value)}
        >
          <Field label="Grid size">
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
            <Field label="Grid angle">
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

          <Field label="Reference image">
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

        <div className="relative min-h-0 flex-1">
          <EditorCanvas
            doc={doc}
            tool={tool}
            assignment={assignment}
            snap={{ grid, snapToVertices }}
            vertexMarks={analysis.vertexMarks}
            showMarks={showMarks}
            paperAngle={turnedAngle}
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

        <Rail
          side="right"
          label="Checks and 3D fold"
          width={rightWidth}
          min={RIGHT_RAIL.min}
          max={RIGHT_RAIL.max}
          onResize={setRightWidth}
          /* No `onToggle`: this one does not close. See the note above. */
        >
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
              <div
                className="flex items-center gap-2.5 rounded-xl p-3 text-xs"
                style={{ background: "var(--surface-sunken)", color: "var(--text-muted)" }}
              >
                {/*
                 * Three states, and the difference between them matters. An
                 * empty sheet is waiting for you; a sheet with creases on it
                 * is waiting for the solver, and a spinner is what says so
                 * during the debounce and the first solve; a pattern past the
                 * live limit is not coming at all.
                 */}
                {analysis.skipped ? (
                  <span>Paused above {LIVE_ANALYSIS_EDGE_LIMIT} creases.</span>
                ) : creaseCount > 0 ? (
                  <>
                    <Spinner size="sm" />
                    <span role="status">Warming up the 3D fold…</span>
                  </>
                ) : (
                  <span>Draw a crease and the fold appears here.</span>
                )}
              </div>
            )}
          </Field>
        </Rail>

        {simulation && (
          <div
            className="kami-scrim absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-6"
            style={{ background: "rgb(27 26 23 / 0.45)" }}
          >
            <section
              className="kami-pop flex max-h-full w-full max-w-3xl flex-col gap-3 overflow-y-auto rounded-2xl p-4"
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

      {saving && (
        <SavePatternDialog
          doc={doc}
          defaultTitle={title}
          signedIn={signedIn}
          onClose={() => setSaving(false)}
        />
      )}

      {leavingTo !== null && (
        <ConfirmDialog
          title="Leave the editor?"
          body="This pattern has not been saved or exported. It stays as a draft in this browser, but nothing else keeps it."
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** How long a quarter turn takes, and the floor for a nudge of half a degree. */
const TURN_MS_PER_DEGREE = 2.6;
const TURN_MIN_MS = 110;
const TURN_MAX_MS = 340;

/**
 * An angle that eases toward its target instead of jumping to it.
 *
 * Paper does not teleport. Tapping 45° used to replace the drawing with the
 * same drawing at a different angle, and the eye had to work out what had
 * happened; a sheet that swings round tells you before you have thought about
 * it. Duration scales with the distance, so nudging half a degree in the number
 * field is not the same gesture as a quarter turn, and it always goes the short
 * way round: 350° to 0° is ten degrees forward, not three hundred and fifty
 * back.
 *
 * Every frame is a render of the canvas, which is why this is capped in the
 * third of a second: the alternative, a CSS transition, cannot also ease the
 * viewport's fit, and a sheet turning inside a box that resizes in one step
 * looks worse than no animation at all.
 */
function useTurn(target: number): number {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  shownRef.current = shown;

  useEffect(() => {
    const from = shownRef.current;
    // The short way round, in (-180, 180].
    const delta = ((((target - from) % 360) + 540) % 360) - 180;
    if (Math.abs(delta) < 0.01) {
      setShown(target);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(target);
      return;
    }

    const duration = clamp(Math.abs(delta) * TURN_MS_PER_DEGREE, TURN_MIN_MS, TURN_MAX_MS);
    const started = performance.now();
    let frame = 0;

    const step = (now: number): void => {
      const t = Math.min(1, (now - started) / duration);
      // Ease out cubic: quick to leave, gentle to arrive.
      const eased = 1 - (1 - t) ** 3;
      setShown(t === 1 ? target : from + delta * eased);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return shown;
}

/**
 * A rail: a column beside the canvas, as wide as it was last dragged to.
 *
 * Given an `onToggle`, it also collapses to a bar holding the button that
 * brings it back. The button is on the rail rather than in the toolbar because
 * that is where the rail is: a panel that opens from its own edge is a door,
 * and a panel that opens from a switch across the room is a light.
 */
function Rail({
  side,
  label,
  width,
  min,
  max,
  onResize,
  collapsed = false,
  onToggle,
  children,
}: {
  readonly side: "left" | "right";
  readonly label: string;
  /** Expanded width, in pixels. Ignored while collapsed. */
  readonly width: number;
  readonly min: number;
  readonly max: number;
  readonly onResize: (width: number) => void;
  readonly collapsed?: boolean;
  /** Omit for a rail that is simply always open. */
  readonly onToggle?: () => void;
  readonly children: React.ReactNode;
}) {
  const left = side === "left";
  const Icon = collapsed
    ? left
      ? PanelLeftOpen
      : PanelRight
    : left
      ? PanelLeftClose
      : PanelRightClose;

  /*
   * A drag has to be instant and a collapse has to be smooth, and they are the
   * same property. So the transition is on unless the pointer is on the handle:
   * easing a width that is following a finger would leave the rail lagging
   * behind the edge you are holding.
   */
  const [dragging, setDragging] = useState(false);

  /*
   * The contents outlive the collapse by one animation.
   *
   * Unmounting them on the click would empty the panel and *then* narrow it,
   * which is two events where there was one gesture. Kept mounted at their full
   * width inside an `overflow-hidden` rail, they slide out behind the edge
   * instead. They are unmounted when the transition lands, because the right
   * rail holds a running simulator and a WebGL context solving a pattern nobody
   * can see is a fan spinning for nothing.
   */
  const [showContents, setShowContents] = useState(!collapsed);
  useEffect(() => {
    if (!collapsed) setShowContents(true);
  }, [collapsed]);

  return (
    <aside
      aria-label={label}
      className="relative z-20 flex shrink-0 flex-col overflow-hidden"
      style={{
        width: collapsed ? COLLAPSED_RAIL : width,
        background: "var(--surface-raised)",
        [left ? "borderRight" : "borderLeft"]: "1px solid var(--border)",
        transition: dragging ? "none" : "width 240ms cubic-bezier(0.2, 0, 0, 1)",
      }}
      onTransitionEnd={(event) => {
        if (event.propertyName === "width" && collapsed) setShowContents(false);
      }}
    >
      {onToggle && (
        // Always against the inner edge, never centred: a collapsed rail is
        // exactly one button wide, so "end" and "centre" are the same place,
        // and the button has nowhere to jump to on the way there.
        <div className={`flex shrink-0 p-1.5 ${left ? "justify-end" : "justify-start"}`}>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            title={collapsed ? `Show the ${label.toLowerCase()}` : `Hide the ${label.toLowerCase()}`}
            aria-label={
              collapsed ? `Show the ${label.toLowerCase()}` : `Hide the ${label.toLowerCase()}`
            }
            className="flex size-8 shrink-0 items-center justify-center rounded-lg transition hover:opacity-60"
            style={{ color: "var(--text-muted)" }}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        </div>
      )}

      {showContents && (
        <div
          aria-hidden={collapsed}
          className={`flex min-h-0 flex-1 shrink-0 flex-col gap-5 overflow-y-auto px-4 pb-4 ${
            onToggle ? "pt-1" : "pt-4"
          }`}
          // Pinned to the open width so the settings inside do not reflow into
          // a 44px column on their way out of view.
          style={{
            width,
            opacity: collapsed ? 0 : 1,
            transition: dragging ? "none" : "opacity 160ms ease-out",
          }}
        >
          {children}
        </div>
      )}

      {/* Nothing to drag while it is a 44px bar; the button is the control. */}
      {!collapsed && (
        <ResizeHandle
          side={side}
          label={`Resize the ${label.toLowerCase()}`}
          width={width}
          min={min}
          max={max}
          onResize={onResize}
          onDraggingChange={setDragging}
        />
      )}
    </aside>
  );
}

/**
 * The drag handle between a rail and the canvas.
 *
 * A window splitter: `role="separator"` with a tab stop and arrow keys, because
 * "make the panel wider" should not be a mouse-only idea. The pointer listeners
 * go on the window rather than the handle, since the pointer leaves a six pixel
 * strip on the first frame of any real drag, and the body's cursor and
 * selection are pinned for the duration so the drag does not paint a blue
 * streak across the panel it is resizing.
 */
function ResizeHandle({
  side,
  label,
  width,
  min,
  max,
  onResize,
  onDraggingChange,
}: {
  readonly side: "left" | "right";
  readonly label: string;
  readonly width: number;
  readonly min: number;
  readonly max: number;
  readonly onResize: (width: number) => void;
  /** So the rail can drop its width transition for the duration of a drag. */
  readonly onDraggingChange?: (dragging: boolean) => void;
}) {
  /** Positive is "wider", whichever edge of the screen the rail is on. */
  const widen = (delta: number): number => (side === "left" ? delta : -delta);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;

    const move = (moveEvent: PointerEvent): void => {
      onResize(clamp(startWidth + widen(moveEvent.clientX - startX), min, max));
    };
    const stop = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
      onDraggingChange?.(false);
    };

    onDraggingChange?.(true);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    document.body.style.setProperty("cursor", "col-resize");
    document.body.style.setProperty("user-select", "none");
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(width)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={startDrag}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const step = (event.shiftKey ? 48 : 16) * (event.key === "ArrowLeft" ? -1 : 1);
        onResize(clamp(width + widen(step), min, max));
      }}
      title={label}
      className={`group absolute inset-y-0 z-30 w-1.5 cursor-col-resize ${
        side === "left" ? "-right-[3px]" : "-left-[3px]"
      }`}
    >
      {/* Invisible until it is wanted: a permanent line down both sides of the
          canvas is two more things to look at while drawing. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
        style={{ background: "var(--brand)" }}
      />
    </div>
  );
}

/**
 * One setting, in the shape every setting takes.
 *
 * A name, the two or three answers worth one tap, and the field for every other
 * answer. The grid used to be chips and the angle used to be a field with chips
 * wedged beside it, which made two controls that did the same job look like two
 * different kinds of thing. This is the job, once, and each setting fills it in.
 *
 * There is no readout at the end of the label row any more. It said "8 × 8" one
 * line above a pair of fields reading 8 and 8, and "45°" one line above a field
 * reading 45: a second, smaller, less precise copy of the control's own value,
 * which is a thing to keep in sync and nothing to read.
 */
function Field({
  label,
  note,
  children,
}: {
  readonly label: string;
  /** One line under the controls, for a setting that is not self-evident. */
  readonly note?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2
        className="text-xs font-bold uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
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

/**
 * The one-tap answers.
 *
 * Even columns, as many per row as fit. Not one row of `options.length`, which
 * is what this used to be: five angle presets in a rail dragged down to its
 * 13rem minimum leaves 30 pixels a button, and "22.5°" is wider than that, so
 * the longest label on the panel was the one hanging out of its own border.
 * `auto-fit` with a floor wide enough for that label wraps to a second row
 * instead, which is the honest thing for a row that has run out of room.
 */
const PRESET_MIN_WIDTH = "3.1rem";

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
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${PRESET_MIN_WIDTH}, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={option.onSelect}
          aria-pressed={option.active}
          className="min-h-9 overflow-hidden rounded-lg px-1 text-xs font-bold tabular-nums transition"
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
          className="kami-pop absolute right-0 z-40 mt-1 w-44 overflow-hidden rounded-xl p-1.5"
          style={{
            transformOrigin: "top right",
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
