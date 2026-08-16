"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PencilRuler, Plus, Upload } from "lucide-react";
import { UploadModal } from "./UploadModal";

/**
 * The two ways to start: bring something, or draw something.
 *
 * Uploading used to be its own page with a review panel on the far side of it.
 * It is now a modal that converts and gets out of the way, because the editor
 * is where the work happens and everything before it is a detour.
 */
export function NewMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
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
    <>
      <div className="relative shrink-0" ref={container}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={open}
          title="Add a crease pattern"
          className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition hover:opacity-70"
          style={{ border: "1px solid var(--border-strong)" }}
        >
          <Plus className="size-4" aria-hidden />
          <span className="hidden sm:inline">New</span>
          <span className="sr-only sm:hidden">Add a crease pattern</span>
        </button>

        {open && (
          <div
            role="menu"
            className="absolute left-0 z-30 mt-2 w-60 overflow-hidden rounded-2xl p-1.5"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-card-hover)",
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setUploading(true);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:opacity-70"
            >
              <Upload className="size-4 shrink-0" aria-hidden />
              <span>
                <span className="block text-sm font-bold">Upload</span>
                <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                  A file, photo or video
                </span>
              </span>
            </button>

            <Link
              href="/edit"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:opacity-70"
            >
              <PencilRuler className="size-4 shrink-0" aria-hidden />
              <span>
                <span className="block text-sm font-bold">Draw</span>
                <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                  A blank square
                </span>
              </span>
            </Link>
          </div>
        )}
      </div>

      {uploading && (
        <UploadModal
          onClose={() => setUploading(false)}
          onReady={() => {
            setUploading(false);
            router.push("/edit/import");
          }}
        />
      )}
    </>
  );
}
