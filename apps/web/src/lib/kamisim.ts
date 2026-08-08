import type { FoldDocument } from "@kamibase/core";

/**
 * A thin wrapper around Origami Simulator (MIT — Amanda Ghassaei, Erik Demaine,
 * Neil Gershenfeld).
 *
 * DESIGN.md §5.2 assumes there is "no documented public embed API" and plans a
 * vendored fork as Phase 1. That is right about the *documentation*, but the
 * simulator's `js/importer.js` already listens for
 * `{op: "importFold", fold}` on `window.message` and announces itself to its
 * parent with `{from: "OrigamiSimulator", status: "ready"}`. So the embed works
 * today against an unmodified copy, and the fork can wait until we actually
 * need the things the message API does not expose.
 *
 * What this wrapper can do: mount, wait for the handshake, load a FOLD
 * document (as many times as you like), and drive the fold amount, view mode,
 * run/pause, and camera.
 *
 * Those last four are *not* in the message API — upstream has no message for
 * any of them. They work because the simulator declares its state object with
 * a bare `globals = {}` (js/main.js:5, no `var`), which makes it a property of
 * the frame's `window`. We serve the simulator from our own origin (§5.2), so
 * the parent can reach it directly. Every control below is therefore a
 * same-origin property poke, and each one degrades to a no-op when the frame
 * is cross-origin or has not booted — hence `controllable` on the handle, so
 * the UI can hide controls it cannot actually drive rather than showing dead
 * ones.
 *
 * This is the cheap two-thirds of §5.2's `KamiSim` sketch, without the fork.
 * `exportFoldedState` still needs one, as does the headless run behind the L2
 * badge (§5.2 Phase 2) — a method that silently did nothing would be worse
 * than an absent one.
 */

/** Where the simulator is served from. Own-origin by default, per §5.2. */
export const SIMULATOR_BASE_URL =
  process.env["NEXT_PUBLIC_SIMULATOR_URL"] ?? "/sim/index.html";

/**
 * On boot the simulator loads a demo model of its own, which races — and beats
 * — the pattern we import, leaving the wrong model on screen. Its `?model=`
 * parameter selects the demo by CSS attribute match (`.demo[data-url='…']`),
 * so a value that matches no element suppresses the demo load entirely. That
 * is upstream's own switch, not a patch, and it keeps the vendored copy
 * unmodified.
 */
export const SIMULATOR_URL = `${SIMULATOR_BASE_URL}${
  SIMULATOR_BASE_URL.includes("?") ? "&" : "?"
}model=kamibase-no-demo`;

/** The simulator announces itself with this message once it can accept FOLD. */
interface ReadyMessage {
  readonly from: "OrigamiSimulator";
  readonly status: "ready";
}

function isReadyMessage(data: unknown): data is ReadyMessage {
  if (data === null || typeof data !== "object") return false;
  const record = data as Record<string, unknown>;
  return record["from"] === "OrigamiSimulator" && record["status"] === "ready";
}

export class KamiSimError extends Error {
  override readonly name = "KamiSimError";
  readonly reason: "timeout" | "no-window";

  constructor(reason: "timeout" | "no-window", message: string) {
    super(message);
    this.reason = reason;
  }
}

/** How the mesh is coloured: by paper side, or by how hard the paper is strained. */
export type ColorMode = "color" | "axialStrain";

/** The camera presets the simulator exposes. */
export type CameraView = "iso" | "x" | "y" | "z";

/**
 * The shape of the simulator's own state object, narrowed to what we drive.
 *
 * Everything is optional: this is someone else's internal object, reached by
 * property access rather than a contract, so a rename upstream should make a
 * control quietly stop working rather than throw into a render.
 */
interface SimulatorGlobals {
  creasePercent?: number;
  shouldChangeCreasePercent?: boolean;
  simulationRunning?: boolean;
  colorMode?: string;
  threeView?: {
    startSimulation?: () => void;
    pauseSimulation?: () => void;
    resetCamera?: () => void;
    resetModel?: () => void;
    setCameraIso?: () => void;
    setCameraX?: (sign: number) => void;
    setCameraY?: (sign: number) => void;
    setCameraZ?: (sign: number) => void;
  };
  model?: { reset?: () => void };
  controls?: { updateCreasePercent?: () => void };
}

export interface KamiSimHandle {
  /** Send a FOLD document to the simulator; it collapses it immediately. */
  loadFold(fold: FoldDocument): void;
  /**
   * Whether the controls below can actually reach the simulator. False for a
   * cross-origin frame or one whose internals moved; the UI should hide the
   * controls rather than offer buttons that do nothing.
   */
  readonly controllable: boolean;
  /** Fold amount, 0 (flat) to 1 (fully folded). Clamped. */
  setFoldAmount(amount: number): void;
  /** Run or pause the solver. */
  setRunning(running: boolean): void;
  /** Colour the mesh by material or by axial strain. */
  setColorMode(mode: ColorMode): void;
  /** Re-run the solve from the flat sheet, discarding the current state. */
  resetSimulation(): void;
  /** Point the camera at a preset and undo any dragging. */
  setCameraView(view: CameraView): void;
  /** Stop listening. The caller owns the iframe element's lifetime. */
  dispose(): void;
}

export interface AttachOptions {
  /**
   * Milliseconds to wait for the ready handshake. Default 8000.
   *
   * This is a deadline for the simulator's *boot*, not for its solve — the
   * handshake fires before any pattern is imported. Booting is a local script
   * load, so 8s is already generous, and the number is really a bet about how
   * long someone will stare at a spinner before deciding the page is broken.
   * The old 20s was well past that.
   */
  readonly timeoutMs?: number;
  /**
   * Grace period after the iframe's `load` event before we assume the
   * handshake was missed and proceed anyway. Default 1500.
   */
  readonly graceMs?: number;
  readonly signal?: AbortSignal;
}

/** Resolve the origin to post to, for an absolute or a same-origin URL. */
export function simulatorOrigin(url: string = SIMULATOR_URL): string {
  try {
    return new URL(url, window.location.href).origin;
  } catch {
    return window.location.origin;
  }
}

/**
 * Wait for an already-rendered simulator iframe to finish booting, then return
 * a handle for loading patterns into it.
 *
 * Resolves once the simulator can accept a pattern, so a caller that gets a
 * handle can load one — and a caller that gets a `timeout` can fall back to a
 * still image instead of showing an empty frame forever (§5.3: "failure is
 * reported as 'this pattern didn't converge', never as a silent hang").
 *
 * The handshake is a *one-shot* message fired during the simulator's own init.
 * Anything that attaches a listener after that moment — a slow hydration, an
 * effect that re-runs — would wait for an announcement that already happened
 * and hang forever. So the iframe's `load` event plus a grace period is
 * treated as equivalent evidence: by then the simulator's DOM-ready handler
 * has run, and importing is idempotent anyway.
 */
export function attachSimulator(
  iframe: HTMLIFrameElement,
  options: AttachOptions = {},
): Promise<KamiSimHandle> {
  const timeoutMs = options.timeoutMs ?? 8_000;
  const graceMs = options.graceMs ?? 1_500;
  const targetOrigin = simulatorOrigin(iframe.src || SIMULATOR_URL);

  return new Promise<KamiSimHandle>((resolve, reject) => {
    let settled = false;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = (): void => {
      window.removeEventListener("message", onMessage);
      iframe.removeEventListener("load", onLoad);
      iframe.removeEventListener("error", onError);
      clearTimeout(timer);
      if (graceTimer !== undefined) clearTimeout(graceTimer);
      options.signal?.removeEventListener("abort", onAbort);
    };

    const succeed = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(createHandle(iframe, targetOrigin));
    };

    const fail = (message: string): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new KamiSimError("timeout", message));
    };

    const onMessage = (event: MessageEvent): void => {
      if (event.source !== iframe.contentWindow) return;
      if (!isReadyMessage(event.data)) return;
      succeed();
    };

    const onLoad = (): void => {
      graceTimer ??= setTimeout(succeed, graceMs);
    };

    /**
     * The frame could not be fetched at all — no copy vendored, a bad
     * NEXT_PUBLIC_SIMULATOR_URL, an offline visitor.
     *
     * Without this the failure is indistinguishable from a slow boot and the
     * visitor watches a spinner for the whole `timeoutMs` before the fallback
     * appears. We already know it will never arrive, so say so now: §5.3 asks
     * for failure to be reported, and a 20-second spinner reports nothing.
     */
    const onError = (): void =>
      fail("The simulator could not be loaded from this origin.");

    const onAbort = (): void => fail("simulator load aborted");

    const timer = setTimeout(
      () => fail(`The simulator did not respond within ${timeoutMs}ms.`),
      timeoutMs,
    );

    window.addEventListener("message", onMessage);
    iframe.addEventListener("load", onLoad);
    iframe.addEventListener("error", onError);
    // The frame may already have loaded before this ran.
    if (iframe.contentDocument?.readyState === "complete") onLoad();
    options.signal?.addEventListener("abort", onAbort);
  });
}

/**
 * Reach the simulator's state object, or null if we cannot.
 *
 * Cross-origin access throws a SecurityError rather than returning undefined,
 * so the try/catch is the actual same-origin test — there is no way to ask
 * politely first.
 */
function readGlobals(iframe: HTMLIFrameElement): SimulatorGlobals | null {
  try {
    const frame = iframe.contentWindow as (Window & { globals?: SimulatorGlobals }) | null;
    return frame?.globals ?? null;
  } catch {
    return null;
  }
}

function createHandle(iframe: HTMLIFrameElement, targetOrigin: string): KamiSimHandle {
  let disposed = false;

  /**
   * Run `act` against the simulator's state, swallowing anything it throws.
   *
   * These calls cross into someone else's code on a user gesture. A control
   * that fails should leave the button looking inert, not tear down the React
   * tree that rendered it.
   */
  const withGlobals = (act: (globals: SimulatorGlobals) => void): void => {
    if (disposed) return;
    const globals = readGlobals(iframe);
    if (!globals) return;
    try {
      act(globals);
    } catch {
      // Upstream moved something. Nothing useful to do here.
    }
  };

  return {
    loadFold(fold: FoldDocument): void {
      if (disposed) return;
      const target = iframe.contentWindow;
      if (!target) {
        throw new KamiSimError("no-window", "the simulator iframe has no window");
      }
      target.postMessage({ op: "importFold", fold }, targetOrigin);
    },

    get controllable(): boolean {
      return !disposed && readGlobals(iframe) !== null;
    },

    setFoldAmount(amount: number): void {
      const clamped = Math.min(1, Math.max(0, amount));
      withGlobals((globals) => {
        globals.creasePercent = clamped;
        // The solver reads creasePercent once per frame, but only when this
        // flag is set — assigning the value alone changes nothing on screen.
        globals.shouldChangeCreasePercent = true;
        // Keeps the simulator's own (hidden) slider in step, so its readout
        // does not drift from ours if it is ever unhidden.
        globals.controls?.updateCreasePercent?.();
      });
    },

    setRunning(running: boolean): void {
      withGlobals((globals) => {
        // simulationRunning is set by these two rather than being the switch
        // itself; assigning it directly would desync the animation loop.
        if (running) globals.threeView?.startSimulation?.();
        else globals.threeView?.pauseSimulation?.();
      });
    },

    setColorMode(mode: ColorMode): void {
      withGlobals((globals) => {
        globals.colorMode = mode;
      });
    },

    resetSimulation(): void {
      withGlobals((globals) => {
        globals.model?.reset?.();
      });
    },

    setCameraView(view: CameraView): void {
      withGlobals((globals) => {
        const three = globals.threeView;
        if (!three) return;
        // resetModel undoes rotation applied by dragging the model itself,
        // which the camera presets do not touch — without it, "Front" lands
        // somewhere other than the front once the user has dragged.
        three.resetModel?.();
        if (view === "x") three.setCameraX?.(1);
        else if (view === "y") three.setCameraY?.(1);
        else if (view === "z") three.setCameraZ?.(1);
        else three.setCameraIso?.();
      });
    },

    dispose(): void {
      disposed = true;
    },
  };
}

/** WebGL2 is required (§5.3); without it the UI shows the still CP instead. */
export function hasWebGl2(): boolean {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}
