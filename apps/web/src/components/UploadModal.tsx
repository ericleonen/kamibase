"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Upload, X } from "lucide-react";
import { ACCEPTED, prepareUpload } from "@/lib/upload/prepare";
import { IMPORT_STORAGE_KEY } from "@/lib/upload/handoff";

/**
 * Pick a file, get an editor.
 *
 * Everything between those two things happens here without asking: the format
 * is detected, a photograph's corners are guessed, the detector runs on its
 * defaults. Nothing is reported back except a failure, because the editor
 * shows the result better than a summary of it could, and for a photograph the
 * photograph itself comes along underneath to check against.
 */
export function UploadModal({
  onClose,
  onReady,
}: {
  readonly onClose: () => void;
  readonly onReady: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  /*
   * Rendered into `body`, not where it is written. The header this is raised
   * from carries `backdrop-blur`, and a backdrop filter makes its element a
   * containing block for `position: fixed` descendants: left in place, the
   * overlay covers the header strip instead of the window.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    dialog.current?.focus();
    // A modal that leaves the page scrolling behind it reads as a mistake.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  async function accept(file: File | undefined): Promise<void> {
    if (!file) return;
    setError(null);
    setBusy(
      file.type.startsWith("video/")
        ? "Reading the video…"
        : file.type.startsWith("image/")
          ? "Finding the creases…"
          : "Converting…",
    );

    const result = await prepareUpload(file);
    if (!result.ok) {
      setError(result.error);
      setBusy(null);
      return;
    }

    try {
      window.sessionStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify(result.upload));
    } catch {
      setError("This browser would not hold the file long enough to open the editor.");
      setBusy(null);
      return;
    }
    onReady();
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgb(27 26 23 / 0.45)" }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
        tabIndex={-1}
        className="w-full max-w-lg rounded-3xl p-6 outline-none"
        style={{ background: "var(--surface-raised)", boxShadow: "var(--shadow-card-hover)" }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="upload-title" className="text-xl font-black tracking-tight">
              Upload
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              It opens in the editor when it is done.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 transition hover:opacity-70"
            style={{ background: "var(--surface-sunken)" }}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void accept(event.dataTransfer.files[0]);
          }}
          className="rounded-2xl px-6 py-10 text-center transition"
          style={{
            border: `2px dashed ${dragging ? "var(--brand)" : "var(--border-strong)"}`,
            background: dragging ? "var(--surface-sunken)" : "transparent",
          }}
        >
          <Upload className="mx-auto size-7" aria-hidden style={{ color: "var(--text-muted)" }} />
          <p className="mt-3 font-bold">Drop a file here</p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy !== null}
            className="mt-4 rounded-full px-5 py-2.5 text-sm font-bold transition hover:opacity-85 disabled:opacity-60"
            style={{ background: "var(--brand)", color: "var(--ink)" }}
          >
            {busy ?? "Choose a file"}
          </button>
        </div>

        <dl className="mt-5 space-y-2 text-sm">
          <Row
            terms=".fold .kami .cp .opx .svg"
            detail="Converted exactly, creases and all."
          />
          <Row
            terms="Photo or video"
            detail="Creases are found automatically and the photo sits under the canvas to trace."
          />
        </dl>

        {error && (
          <p
            className="mt-4 rounded-xl p-3 text-sm"
            role="alert"
            style={{ background: "var(--surface-sunken)", borderLeft: "3px solid #b4261f" }}
          >
            {error}
          </p>
        )}

        <input
          ref={input}
          type="file"
          accept={ACCEPTED}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void accept(file);
          }}
        />
      </div>
    </div>,
    document.body,
  );
}

function Row({ terms, detail }: { readonly terms: string; readonly detail: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <dt className="font-mono text-xs font-bold">{terms}</dt>
      <dd className="text-xs" style={{ color: "var(--text-muted)" }}>
        {detail}
      </dd>
    </div>
  );
}
