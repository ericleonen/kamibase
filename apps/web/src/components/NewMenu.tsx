"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Camera, PencilRuler, Plus, Upload } from "lucide-react";

const OPTIONS = [
  {
    href: "/upload",
    label: "Upload a file",
    hint: ".kami, .fold, .cp, .opx or .svg",
    Icon: Upload,
  },
  {
    href: "/scan",
    label: "Scan a photo",
    hint: "A photo of the unfolded paper",
    Icon: Camera,
  },
  {
    href: "/edit",
    label: "Draw from scratch",
    hint: "A blank square in the editor",
    Icon: PencilRuler,
  },
] as const;

/**
 * The three ways a pattern gets into Kamibase.
 *
 * "New" used to go straight to the editor, which quietly asserted that drawing
 * is the only way in. Converting a file people already have is the other half
 * of DESIGN.md §8.2, and the one that actually fills the library, so the
 * button asks rather than assumes.
 *
 * Scanning is the third, and for most folders it is the first: the pattern they
 * want to share is sitting on the table in front of them as a creased sheet of
 * paper rather than as a file.
 */
export function NewMenu() {
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
    <div className="relative shrink-0" ref={container}>
      {/* Icon-only on phones, where the search field needs every pixel. */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Add a crease pattern"
        className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition hover:opacity-70"
        style={{ border: "1px solid var(--border-strong)" }}
      >
        <Plus className="size-4" aria-hidden />
        <span className="hidden sm:inline">New</span>
        <span className="sr-only sm:hidden">Add a crease pattern</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl p-1.5 text-sm"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-card-hover)",
          }}
        >
          {OPTIONS.map((option) => (
            <Link
              key={option.href}
              href={option.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition hover:opacity-70"
            >
              <option.Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <span className="block font-semibold">{option.label}</span>
                <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                  {option.hint}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
