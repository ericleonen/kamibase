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
 * What this wrapper can do: mount, wait for the handshake, and load a FOLD
 * document (as many times as you like).
 *
 * What it deliberately does *not* do: `setFoldAmount`, `setStrainVisible` and
 * `exportFoldedState` from §5.2's sketch. Upstream has no message for any of
 * them, and a method that silently did nothing would be worse than an absent
 * one. They need the fork — as does the headless run that produces the L2
 * badge (§5.2 Phase 2).
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

export interface KamiSimHandle {
  /** Send a FOLD document to the simulator; it collapses it immediately. */
  loadFold(fold: FoldDocument): void;
  /** Stop listening. The caller owns the iframe element's lifetime. */
  dispose(): void;
}

export interface AttachOptions {
  /** Milliseconds to wait for the ready handshake. Default 20000. */
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
  const timeoutMs = options.timeoutMs ?? 20_000;
  const graceMs = options.graceMs ?? 1_500;
  const targetOrigin = simulatorOrigin(iframe.src || SIMULATOR_URL);

  return new Promise<KamiSimHandle>((resolve, reject) => {
    let settled = false;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = (): void => {
      window.removeEventListener("message", onMessage);
      iframe.removeEventListener("load", onLoad);
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

    const onAbort = (): void => fail("simulator load aborted");

    const timer = setTimeout(
      () => fail(`The simulator did not respond within ${timeoutMs}ms.`),
      timeoutMs,
    );

    window.addEventListener("message", onMessage);
    iframe.addEventListener("load", onLoad);
    // The frame may already have loaded before this ran.
    if (iframe.contentDocument?.readyState === "complete") onLoad();
    options.signal?.addEventListener("abort", onAbort);
  });
}

function createHandle(iframe: HTMLIFrameElement, targetOrigin: string): KamiSimHandle {
  let disposed = false;
  return {
    loadFold(fold: FoldDocument): void {
      if (disposed) return;
      const target = iframe.contentWindow;
      if (!target) {
        throw new KamiSimError("no-window", "the simulator iframe has no window");
      }
      target.postMessage({ op: "importFold", fold }, targetOrigin);
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
