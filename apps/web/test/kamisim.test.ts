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
