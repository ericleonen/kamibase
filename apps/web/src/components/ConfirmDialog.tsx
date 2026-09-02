"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * "Are you sure?", the ordinary way.
 *
 * Portalled to `body` for the same reason the upload modal is: a `backdrop-filter`
 * anywhere up the tree makes that element the containing block for `position:
 * fixed`, and the overlay would cover a strip of the page instead of the window.
 *
 * The confirming button is the one focused on open, because the reason anybody
 * sees this dialog is that they already asked to leave.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = "Stay",
  destructive = false,
  onConfirm,
  onCancel,
}: {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  /**
   * The confirming button is red rather than brand.
   *
   * For a dialog whose yes is unrecoverable. Leaving the editor is not that —
   * the draft is still in the browser — but deleting a pattern is, and a brand
   * button is the same button the site uses for "Save": it reads as the safe
   * one at exactly the moment it is not.
   */
  readonly destructive?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        // Escape is the safe answer: it cancels the leaving, it does not
        // confirm it.
        event.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    confirmRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onCancel, mounted]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="kami-scrim fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgb(27 26 23 / 0.45)" }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        className="kami-pop w-full max-w-sm rounded-2xl p-5"
        style={{ background: "var(--surface-raised)", boxShadow: "var(--shadow-card-hover)" }}
      >
        <h2 id="confirm-title" className="text-lg font-black tracking-tight">
          {title}
        </h2>
        <p id="confirm-body" className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          {body}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-bold transition hover:opacity-70"
            style={{ border: "1px solid var(--border-strong)" }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="rounded-full px-4 py-2 text-sm font-bold transition hover:opacity-85"
            style={
              destructive
                ? { background: "var(--danger)", color: "#ffffff" }
                : { background: "var(--brand)", color: "var(--ink)" }
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
