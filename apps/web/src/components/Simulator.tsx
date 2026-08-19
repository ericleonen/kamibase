"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Boxes,
  Layers,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import type { FoldDocument } from "@kamibase/core";
import {
  attachSimulator,
  hasWebGl2,
  SIMULATOR_URL,
  type CameraView,
  type ColorMode,
  type KamiSimHandle,
} from "@/lib/kamisim";

type Status = "checking" | "loading" | "ready" | "unavailable";

/** The simulator boots at 60% folded; our slider has to agree from the start. */
const DEFAULT_FOLD = 0.6;

const CAMERA_VIEWS: { readonly view: CameraView; readonly label: string }[] = [
  { view: "iso", label: "3/4" },
  { view: "z", label: "Front" },
  { view: "x", label: "Side" },
  { view: "y", label: "Top" },
];

export interface SimulatorProps {
  readonly fold: FoldDocument;
  /** Stable identity for the pattern, so the effect does not re-run on re-render. */
  readonly patternId: string;
  readonly title: string;
  /** Rendered in place of the simulator when it cannot run. */
  readonly fallback: React.ReactNode;
  /** Warn that the solver may not settle. Shown inside the frame, in context. */
  readonly flatFoldable?: boolean;
  /**
   * `"preview"` is the small live one: no controls, no camera presets, no
   * fullscreen button, and the whole frame is a button. It is a picture of the
   * fold that happens to be moving, and everything you would want to do to it
   * is somewhere else.
   */
  readonly variant?: "full" | "preview";
  /** Preview only: what clicking the frame does. */
  readonly onOpen?: () => void;
}

/**
 * The 3D fold view: Origami Simulator in an iframe, wearing Kamibase's own
 * controls.
 *
 * Upstream's control bar is hidden by the vendor script and everything here
 * drives the simulator through the handle from `@/lib/kamisim` instead. That
 * is worth the extra surface for three reasons: upstream's bar is styled for
 * its own site and lands in the middle of ours; its toggles are images from
 * the demo asset bundle we prune, so they render broken; and its slider is the
 * one control that matters most, which makes it the one worth owning.
 *
 * §5.3 is explicit that simulation will not work for every pattern and that
 * the UI must say so rather than spin forever. Hence the WebGL2 check, the
 * handshake timeout, and a fallback that shows the flat crease pattern with a
 * plain explanation instead of an empty frame.
 */
export function Simulator({
  fold,
  patternId,
  title,
  fallback,
  flatFoldable = true,
  variant = "full",
  onOpen,
}: SimulatorProps) {
  const preview = variant === "preview";
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<KamiSimHandle | null>(null);
  const sliderId = useId();

  const [status, setStatus] = useState<Status>("checking");
  const [detail, setDetail] = useState<string>("");
  const [controllable, setControllable] = useState(false);
  const [foldAmount, setFoldAmount] = useState(DEFAULT_FOLD);
  const [running, setRunning] = useState(true);
  const [colorMode, setColorMode] = useState<ColorMode>("color");
  const [fullscreen, setFullscreen] = useState(false);

  // Keep the payload in a ref so the effect can depend on the pattern's id
  // rather than on the object's identity. The simulator announces itself
  // exactly once, so an effect that re-runs would wait for a handshake that
  // has already happened and hang forever.
  const foldRef = useRef(fold);
  foldRef.current = fold;

  /*
   * Geometry that changes after the handshake.
   *
   * The editor's preview is live: it is showing the pattern being drawn, so
   * new geometry arrives while the simulator is already running. Pushing it
   * through the existing handle keeps the camera and the WebGL context, which
   * remounting the iframe on every stroke would throw away, along with about
   * a second of warm-up each time.
   *
   * The ref is what stops the first push from being a duplicate of the load
   * the handshake already did.
   */
  const loadedRef = useRef<FoldDocument | null>(null);
  useEffect(() => {
    if (status !== "ready" || loadedRef.current === fold) return;
    loadedRef.current = fold;
    handleRef.current?.loadFold(fold);
  }, [fold, status]);

  useEffect(() => {
    if (!hasWebGl2()) {
      setStatus("unavailable");
      setDetail(
        "This browser doesn't support WebGL2, which the 3D fold needs. The flat crease pattern is below.",
      );
      return;
    }
    const iframe = iframeRef.current;
    if (!iframe) return;

    setStatus("loading");
    const controller = new AbortController();
    let cancelled = false;

    attachSimulator(iframe, { signal: controller.signal })
      .then((handle) => {
        if (cancelled) {
          handle.dispose();
          return;
        }
        handle.loadFold(foldRef.current);
        loadedRef.current = foldRef.current;
        handleRef.current = handle;
        setControllable(handle.controllable);
        // Adopt the simulator's own starting state rather than pushing ours
        // onto it, so the controls read true the moment they appear.
        setFoldAmount(DEFAULT_FOLD);
        setRunning(true);
        setColorMode("color");
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus("unavailable");
        // Two audiences, two messages. The visitor gets something actionable
        // for them (reload, or use the flat pattern below) because the fix
        // ("vendor the simulator") is not theirs to make and the raw timeout
        // reads as a bug on their end. The operator gets the real cause and
        // the command, in the console where they are already looking.
        setDetail(
          "The 3D simulator didn't load. Reloading the page usually sorts it, and the flat crease pattern is below either way.",
        );
        console.warn(
          "[kamibase] the simulator did not start:",
          error instanceof Error ? error.message : error,
          "\nServe it from this origin with `pnpm --filter @kamibase/web vendor:simulator`, or point NEXT_PUBLIC_SIMULATOR_URL at a deployed copy.",
        );
      });

    return () => {
      cancelled = true;
      controller.abort();
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, [patternId]);

  // Fullscreen can also be left with Escape, which fires no click of ours.
  useEffect(() => {
    const onChange = (): void => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const onFoldChange = useCallback((value: number) => {
    setFoldAmount(value);
    handleRef.current?.setFoldAmount(value);
  }, []);

  const toggleRunning = useCallback(() => {
    setRunning((previous) => {
      const next = !previous;
      handleRef.current?.setRunning(next);
      return next;
    });
  }, []);

  const chooseColorMode = useCallback((mode: ColorMode) => {
    setColorMode(mode);
    handleRef.current?.setColorMode(mode);
  }, []);

  const reset = useCallback(() => {
    handleRef.current?.resetSimulation();
    // Reset restarts the solve, so the model is moving again whether or not it
    // was paused.
    handleRef.current?.setRunning(true);
    setRunning(true);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frameRef.current?.requestFullscreen();
  }, []);

  if (status === "unavailable") {
    // The preview is a supporting view. When it cannot run, it says so in one
    // line and gets out of the way rather than putting a warning panel and a
    // fallback drawing into a 200 pixel slot.
    if (preview) {
      return (
        <p
          className="rounded-xl p-3 text-xs"
          style={{ background: "var(--surface-sunken)", color: "var(--text-muted)" }}
        >
          The 3D fold is not available here.
        </p>
      );
    }
    return (
      <div className="space-y-4">
        <div
          className="flex gap-3 rounded-[var(--radius-card)] border p-4 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--brand-soft)" }}
        >
          <TriangleAlert
            className="mt-0.5 size-5 shrink-0"
            style={{ color: "var(--brand-strong)" }}
            aria-hidden
          />
          <div>
            <p className="font-semibold">This pattern can&apos;t be folded here right now.</p>
            <p className="mt-1" style={{ color: "var(--text-muted)" }}>
              {detail}
            </p>
          </div>
        </div>
        {fallback}
      </div>
    );
  }

  const busy = status !== "ready";

  return (
    <div
      ref={frameRef}
      className="overflow-hidden rounded-[var(--radius-card)] bg-white"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="relative">
        <iframe
          ref={iframeRef}
          src={SIMULATOR_URL}
          title={`3D fold simulation of ${title}`}
          className={`block w-full border-0 ${
            preview
              ? "h-52"
              : fullscreen
                ? "h-[calc(100vh-5.5rem)]"
                : "h-[58vh] min-h-[22rem]"
          }`}
          allow="fullscreen"
        />

        {/*
          The preview's one interaction. Over the iframe rather than beside it,
          because an iframe swallows every pointer event that lands on it: a
          button underneath would never be clicked, and dragging the model here
          would be a rotation nobody can undo without the controls that are
          deliberately absent.
        */}
        {preview && onOpen && (
          <button
            type="button"
            onClick={onOpen}
            className="group absolute inset-0 flex items-end justify-center pb-2 transition"
            aria-label="Open the 3D fold"
            title="Open the 3D fold"
          >
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-bold opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
              style={{ background: "var(--surface-raised)", boxShadow: "var(--shadow-card)" }}
            >
              Open
            </span>
          </button>
        )}

        {busy && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-sm"
            style={{ background: "var(--surface)", color: "var(--text-muted)" }}
          >
            <span
              className="size-7 animate-spin rounded-full border-2"
              style={{
                borderColor: "var(--border-strong)",
                borderTopColor: "var(--brand-strong)",
              }}
              aria-hidden
            />
            <span role="status">Warming up the solver…</span>
          </div>
        )}

        {/* Camera presets sit on the canvas, where the model is. */}
        {!busy && controllable && !preview && (
          <div className="absolute right-3 top-3 flex gap-1 rounded-full bg-white/90 p-1 backdrop-blur"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            {CAMERA_VIEWS.map(({ view, label }) => (
              <button
                key={view}
                type="button"
                onClick={() => handleRef.current?.setCameraView(view)}
                className="rounded-full px-2.5 py-1 text-xs font-semibold transition hover:opacity-60"
                style={{ color: "var(--text-muted)" }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {!busy && !preview && (
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Exit fullscreen" : "Fold fullscreen"}
            title={fullscreen ? "Exit fullscreen" : "Fold fullscreen"}
            className="absolute bottom-3 right-3 rounded-full bg-white/90 p-2 backdrop-blur transition hover:opacity-70"
            style={{ boxShadow: "var(--shadow-card)", color: "var(--text-muted)" }}
          >
            {fullscreen ? (
              <Minimize2 className="size-4" aria-hidden />
            ) : (
              <Maximize2 className="size-4" aria-hidden />
            )}
          </button>
        )}
      </div>

      {/*
        The control bar. Hidden entirely when the simulator is not reachable
        from this origin, because every control in it would be inert. That is
        §5.3's
        rule about not pretending, applied to the chrome as well as the solve.
      */}
      {controllable && !preview && (
        <div className="border-t" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
            <div className="flex min-w-[15rem] flex-1 items-center gap-3">
              <button
                type="button"
                onClick={toggleRunning}
                aria-label={running ? "Pause the solver" : "Run the solver"}
                title={running ? "Pause the solver" : "Run the solver"}
                className="flex size-9 shrink-0 items-center justify-center rounded-full transition hover:opacity-85"
                style={{ background: "var(--brand)", color: "var(--ink)" }}
              >
                {running ? (
                  <Pause className="size-4 fill-current" aria-hidden />
                ) : (
                  <Play className="size-4 fill-current" aria-hidden />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <label
                    htmlFor={sliderId}
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Fold
                  </label>
                  <span
                    className="text-xs font-semibold tabular-nums"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {Math.round(foldAmount * 100)}%
                  </span>
                </div>
                <input
                  id={sliderId}
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(foldAmount * 100)}
                  onChange={(event) => onFoldChange(Number(event.target.value) / 100)}
                  className="kami-slider mt-1 w-full"
                  aria-label="Fold amount, from flat to fully folded"
                />
                <div
                  className="mt-0.5 flex justify-between text-[0.65rem]"
                  style={{ color: "var(--text-faint)" }}
                >
                  <span>Flat</span>
                  <span>Folded</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Material vs strain. Two states, so a segmented pair reads
                  faster than a dropdown and keeps both labels visible. */}
              <div
                className="flex rounded-full p-0.5"
                style={{ background: "var(--surface-sunken)" }}
                role="group"
                aria-label="Mesh colouring"
              >
                <ModeButton
                  active={colorMode === "color"}
                  onClick={() => chooseColorMode("color")}
                  icon={<Layers className="size-3.5" aria-hidden />}
                  label="Paper"
                  title="Colour the mesh by which side of the paper faces you"
                />
                <ModeButton
                  active={colorMode === "axialStrain"}
                  onClick={() => chooseColorMode("axialStrain")}
                  icon={<Boxes className="size-3.5" aria-hidden />}
                  label="Strain"
                  title="Colour the mesh by how far the paper is stretched"
                />
              </div>

              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:opacity-70"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                title="Start the solve again from the flat sheet"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Reset
              </button>
            </div>
          </div>

          <p
            className="border-t px-4 py-2 text-xs"
            style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}
          >
            Drag to rotate · scroll to zoom
            {!flatFoldable &&
              " · this pattern fails a local flat-foldability check, so the solver may not settle, which is normal for 3D designs"}
          </p>
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
  title,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition"
      style={
        active
          ? { background: "var(--surface)", color: "var(--text)", boxShadow: "var(--shadow-card)" }
          : { color: "var(--text-muted)" }
      }
    >
      {icon}
      {label}
    </button>
  );
}
