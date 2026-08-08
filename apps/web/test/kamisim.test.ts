/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import {
  attachSimulator,
  KamiSimError,
  SIMULATOR_BASE_URL,
  SIMULATOR_URL,
  simulatorOrigin,
} from "@/lib/kamisim";

/**
 * A stand-in for the simulator iframe. `contentWindow` has to be an object
 * identical to what the message event reports as its source, because that is
 * how the wrapper tells our simulator's messages from any other frame's.
 */
function fakeIframe(src = "/sim/index.html"): {
  iframe: HTMLIFrameElement;
  contentWindow: { postMessage: ReturnType<typeof vi.fn> };
} {
  const contentWindow = { postMessage: vi.fn() };
  // A real element, so the wrapper's load listener has something to attach to;
  // `src` is defined rather than assigned so jsdom does not try to navigate.
  const iframe = document.createElement("iframe");
  Object.defineProperty(iframe, "src", { value: src });
  Object.defineProperty(iframe, "contentWindow", { value: contentWindow });
  return { iframe, contentWindow };
}

function sendMessage(source: unknown, data: unknown): void {
  const event = new MessageEvent("message", { data });
  Object.defineProperty(event, "source", { value: source });
  window.dispatchEvent(event);
}

describe("SIMULATOR_URL", () => {
  it("suppresses the simulator's own demo model", () => {
    // Without this the simulator loads a demo at boot, which lands after our
    // import and replaces the pattern the visitor asked for.
    expect(SIMULATOR_URL).toContain("model=kamibase-no-demo");
    expect(SIMULATOR_URL.startsWith(SIMULATOR_BASE_URL)).toBe(true);
  });

  it("uses a single query separator", () => {
    expect(SIMULATOR_URL.match(/\?/g)?.length).toBe(1);
  });
});

describe("simulatorOrigin", () => {
  it("resolves a same-origin path to this origin", () => {
    expect(simulatorOrigin("/sim/index.html")).toBe(window.location.origin);
  });

  it("resolves an absolute URL to its origin", () => {
    expect(simulatorOrigin("https://sim.kamibase.org/index.html")).toBe(
      "https://sim.kamibase.org",
    );
  });

  it("falls back to this origin for nonsense", () => {
    expect(simulatorOrigin("::::")).toBe(window.location.origin);
  });
});

describe("attachSimulator", () => {
  it("resolves on the simulator's ready handshake", async () => {
    const { iframe, contentWindow } = fakeIframe();
    const pending = attachSimulator(iframe, { timeoutMs: 1000 });
    sendMessage(contentWindow, { from: "OrigamiSimulator", status: "ready" });
    const handle = await pending;
    expect(handle).toBeDefined();
    handle.dispose();
  });

  it("ignores messages from other frames", async () => {
    const { iframe, contentWindow } = fakeIframe();
    const pending = attachSimulator(iframe, { timeoutMs: 200 });
    sendMessage({ postMessage: vi.fn() }, { from: "OrigamiSimulator", status: "ready" });
    await expect(pending).rejects.toBeInstanceOf(KamiSimError);
    expect(contentWindow.postMessage).not.toHaveBeenCalled();
  });

  it("ignores messages that are not the handshake", async () => {
    const { iframe, contentWindow } = fakeIframe();
    const pending = attachSimulator(iframe, { timeoutMs: 200 });
    sendMessage(contentWindow, { from: "SomethingElse", status: "ready" });
    sendMessage(contentWindow, "ready");
    sendMessage(contentWindow, null);
    await expect(pending).rejects.toMatchObject({ reason: "timeout" });
  });

  it("times out rather than hanging forever", async () => {
    const { iframe } = fakeIframe();
    await expect(attachSimulator(iframe, { timeoutMs: 20 })).rejects.toMatchObject({
      name: "KamiSimError",
      reason: "timeout",
    });
  });

  it("fails immediately when the frame cannot be fetched", async () => {
    // No vendored copy, or a bad NEXT_PUBLIC_SIMULATOR_URL. Waiting out the
    // full timeout here would leave a spinner on screen for the whole of it,
    // when we already know the frame is never arriving.
    const { iframe } = fakeIframe();
    const pending = attachSimulator(iframe, { timeoutMs: 30_000 });
    iframe.dispatchEvent(new Event("error"));
    await expect(pending).rejects.toMatchObject({ reason: "timeout" });
  });

  it("waits seconds, not tens of seconds, by default", async () => {
    // The handshake covers the simulator's boot, not its solve, so the default
    // is a bet on how long someone will watch a spinner. Asserted with fake
    // timers because the honest version of this test would sit here for the
    // whole timeout to prove it.
    vi.useFakeTimers();
    try {
      const { iframe } = fakeIframe();
      const pending = attachSimulator(iframe);
      const settled = vi.fn();
      void pending.catch(settled);

      await vi.advanceTimersByTimeAsync(7_000);
      expect(settled).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2_000);
      expect(settled).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("proceeds on the iframe's load event when the handshake is missed", async () => {
    // The ready message is fired once, during the simulator's own init. If we
    // attach after that moment we would otherwise wait for an announcement
    // that already happened.
    const contentWindow = { postMessage: vi.fn() };
    const iframe = document.createElement("iframe");
    Object.defineProperty(iframe, "contentWindow", { value: contentWindow });

    const pending = attachSimulator(iframe, { timeoutMs: 5000, graceMs: 10 });
    iframe.dispatchEvent(new Event("load"));
    const handle = await pending;

    handle.loadFold({ vertices_coords: [], edges_vertices: [], edges_assignment: [] });
    expect(contentWindow.postMessage).toHaveBeenCalledTimes(1);
  });

  it("prefers the handshake over the load fallback, and only settles once", async () => {
    const contentWindow = { postMessage: vi.fn() };
    const iframe = document.createElement("iframe");
    Object.defineProperty(iframe, "contentWindow", { value: contentWindow });

    const pending = attachSimulator(iframe, { timeoutMs: 5000, graceMs: 10 });
    sendMessage(contentWindow, { from: "OrigamiSimulator", status: "ready" });
    iframe.dispatchEvent(new Event("load"));
    await expect(pending).resolves.toBeDefined();
    // A second settle would throw an unhandled rejection rather than fail here,
    // so give the grace timer a chance to fire before the test ends.
    await new Promise((resolve) => setTimeout(resolve, 30));
  });

  it("can be aborted", async () => {
    const { iframe } = fakeIframe();
    const controller = new AbortController();
    const pending = attachSimulator(iframe, { timeoutMs: 5000, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ reason: "timeout" });
  });

  it("posts the FOLD document to the simulator's origin, not to *", async () => {
    const { iframe, contentWindow } = fakeIframe("https://sim.kamibase.org/index.html");
    const pending = attachSimulator(iframe, { timeoutMs: 1000 });
    sendMessage(contentWindow, { from: "OrigamiSimulator", status: "ready" });
    const handle = await pending;

    const fold = { vertices_coords: [[0, 0]], edges_vertices: [], edges_assignment: [] };
    handle.loadFold(fold);
    expect(contentWindow.postMessage).toHaveBeenCalledWith(
      { op: "importFold", fold },
      "https://sim.kamibase.org",
    );
  });

  it("goes quiet after dispose", async () => {
    const { iframe, contentWindow } = fakeIframe();
    const pending = attachSimulator(iframe, { timeoutMs: 1000 });
    sendMessage(contentWindow, { from: "OrigamiSimulator", status: "ready" });
    const handle = await pending;
    handle.dispose();
    handle.loadFold({ vertices_coords: [], edges_vertices: [], edges_assignment: [] });
    expect(contentWindow.postMessage).not.toHaveBeenCalled();
  });
});

/**
 * A stand-in for the simulator's own state object.
 *
 * The shape mirrors the real one closely enough that these tests would notice
 * an upstream rename of the properties we poke: `creasePercent` plus the
 * `shouldChangeCreasePercent` flag that makes the solver read it, and the
 * `threeView` / `model` methods behind run, reset and the camera.
 */
function fakeGlobals() {
  return {
    creasePercent: 0.6,
    shouldChangeCreasePercent: false,
    colorMode: "color",
    threeView: {
      startSimulation: vi.fn(),
      pauseSimulation: vi.fn(),
      resetModel: vi.fn(),
      setCameraIso: vi.fn(),
      setCameraX: vi.fn(),
      setCameraY: vi.fn(),
      setCameraZ: vi.fn(),
    },
    model: { reset: vi.fn() },
    controls: { updateCreasePercent: vi.fn() },
  };
}

/** Attach to a frame whose `globals` we control, as a same-origin embed has. */
async function attachedTo(globals: unknown) {
  const contentWindow = { postMessage: vi.fn(), globals };
  const iframe = document.createElement("iframe");
  Object.defineProperty(iframe, "src", { value: "/sim/index.html" });
  Object.defineProperty(iframe, "contentWindow", { value: contentWindow });

  const pending = attachSimulator(iframe, { timeoutMs: 1000 });
  sendMessage(contentWindow, { from: "OrigamiSimulator", status: "ready" });
  return pending;
}

describe("the control surface", () => {
  it("reports itself controllable for a same-origin frame", async () => {
    const handle = await attachedTo(fakeGlobals());
    expect(handle.controllable).toBe(true);
  });

  it("is not controllable when the frame exposes no globals", async () => {
    // A cross-origin embed via NEXT_PUBLIC_SIMULATOR_URL looks like this. The
    // UI hides its controls rather than offering inert ones.
    const handle = await attachedTo(undefined);
    expect(handle.controllable).toBe(false);
  });

  it("is not controllable after dispose", async () => {
    const handle = await attachedTo(fakeGlobals());
    handle.dispose();
    expect(handle.controllable).toBe(false);
  });

  it("sets the fold amount and flags it for the solver", async () => {
    const globals = fakeGlobals();
    const handle = await attachedTo(globals);
    handle.setFoldAmount(0.25);
    expect(globals.creasePercent).toBe(0.25);
    // Without this flag the solver never reads the new value and the model
    // sits there unchanged, so the whole control silently does nothing.
    expect(globals.shouldChangeCreasePercent).toBe(true);
    expect(globals.controls.updateCreasePercent).toHaveBeenCalled();
  });

  it("clamps the fold amount to 0..1", async () => {
    const globals = fakeGlobals();
    const handle = await attachedTo(globals);
    handle.setFoldAmount(4);
    expect(globals.creasePercent).toBe(1);
    handle.setFoldAmount(-2);
    expect(globals.creasePercent).toBe(0);
  });

  it("runs and pauses through threeView, not by assigning the flag", async () => {
    const globals = fakeGlobals();
    const handle = await attachedTo(globals);
    handle.setRunning(false);
    expect(globals.threeView.pauseSimulation).toHaveBeenCalled();
    handle.setRunning(true);
    expect(globals.threeView.startSimulation).toHaveBeenCalled();
  });

  it("switches colour mode", async () => {
    const globals = fakeGlobals();
    const handle = await attachedTo(globals);
    handle.setColorMode("axialStrain");
    expect(globals.colorMode).toBe("axialStrain");
  });

  it("resets the solve", async () => {
    const globals = fakeGlobals();
    const handle = await attachedTo(globals);
    handle.resetSimulation();
    expect(globals.model.reset).toHaveBeenCalled();
  });

  it("undoes model rotation when picking a camera preset", async () => {
    // Dragging rotates the model, not the camera, so a preset that only moved
    // the camera would land somewhere other than the face it names.
    const globals = fakeGlobals();
    const handle = await attachedTo(globals);
    handle.setCameraView("z");
    expect(globals.threeView.resetModel).toHaveBeenCalled();
    expect(globals.threeView.setCameraZ).toHaveBeenCalledWith(1);
    handle.setCameraView("iso");
    expect(globals.threeView.setCameraIso).toHaveBeenCalled();
  });

  it("does nothing after dispose", async () => {
    const globals = fakeGlobals();
    const handle = await attachedTo(globals);
    handle.dispose();
    handle.setFoldAmount(0.1);
    handle.setRunning(false);
    expect(globals.creasePercent).toBe(0.6);
    expect(globals.threeView.pauseSimulation).not.toHaveBeenCalled();
  });

  it("survives a simulator whose internals moved", async () => {
    // Upstream is vendored at a moving ref, so a rename is a question of when.
    // A control that throws here would take the whole page down with it.
    const handle = await attachedTo({});
    expect(() => {
      handle.setFoldAmount(0.5);
      handle.setRunning(true);
      handle.resetSimulation();
      handle.setCameraView("iso");
    }).not.toThrow();
  });
});
