"use client";

import { useEffect, useRef, useState } from "react";
import type { FoldDocument } from "@kamibase/core";
import { attachSimulator, hasWebGl2, SIMULATOR_URL } from "@/lib/kamisim";

type Status = "checking" | "loading" | "ready" | "unavailable";

export interface SimulatorProps {
  readonly fold: FoldDocument;
  /** Stable identity for the pattern, so the effect does not re-run on re-render. */
  readonly patternId: string;
  readonly title: string;
  /** Rendered in place of the simulator when it cannot run. */
  readonly fallback: React.ReactNode;
}

/**
 * The 3D fold view: Origami Simulator in an iframe, handed the pattern as
 * FOLD once it is ready to receive one.
 *
 * §5.3 is explicit that simulation will not work for every pattern and that
 * the UI must say so rather than spin forever — hence the WebGL2 check, the
 * handshake timeout, and a fallback that shows the flat crease pattern with a
 * plain explanation instead of an empty frame.
 */
export function Simulator({ fold, patternId, title, fallback }: SimulatorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<Status>("checking");
  const [detail, setDetail] = useState<string>("");

  // Keep the payload in a ref so the effect can depend on the pattern's id
  // rather than on the object's identity. The simulator announces itself
  // exactly once, so an effect that re-runs would wait for a handshake that
  // has already happened and hang forever.
  const foldRef = useRef(fold);
  foldRef.current = fold;

  useEffect(() => {
    if (!hasWebGl2()) {
      setStatus("unavailable");
      setDetail("This browser does not support WebGL2, which the simulator requires.");
      return;
    }
    const iframe = iframeRef.current;
    if (!iframe) return;

    setStatus("loading");
    const controller = new AbortController();
    let cancelled = false;

    attachSimulator(iframe, { signal: controller.signal })
      .then((handle) => {
        if (cancelled) return;
        handle.loadFold(foldRef.current);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus("unavailable");
        setDetail(
          error instanceof Error
            ? `${error.message} Run \`pnpm --filter @kamibase/web vendor:simulator\` to serve it from this origin, or point NEXT_PUBLIC_SIMULATOR_URL at a deployed copy.`
            : "The simulator could not be reached.",
        );
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [patternId]);

  if (status === "unavailable") {
    return (
      <div className="space-y-4">
        <div
          className="rounded-lg border p-4 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
        >
          <p className="font-medium">This pattern can&apos;t be folded here right now.</p>
          <p className="mt-1" style={{ color: "var(--text-muted)" }}>
            {detail}
          </p>
        </div>
        {fallback}
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-lg border"
      style={{ borderColor: "var(--border)", background: "#000000" }}
    >
      {status !== "ready" && (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-sm"
          style={{ background: "var(--surface-raised)", color: "var(--text-muted)" }}
        >
          Loading the simulator…
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={SIMULATOR_URL}
        title={`3D fold simulation of ${title}`}
        className="block h-[70vh] w-full border-0"
        allow="fullscreen"
      />
    </div>
  );
}
