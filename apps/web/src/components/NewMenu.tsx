"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { PencilRuler, Plus, Upload } from "lucide-react";
import { UploadModal } from "./UploadModal";

/**
 * The two ways to start: bring something, or draw something.
 *
 * Uploading used to be its own page with a review panel on the far side of it.
 * It is now a modal that converts and gets out of the way, because the editor
 * is where the work happens and everything before it is a detour.
 *
 * Signed out, the button is still here and still disabled. Hiding it would
 * leave nothing to explain, and "add a pattern" is the thing an account is
 * for, so it stays visible and says why it will not open.
 */
export function NewMenu({ signedIn }: { readonly signedIn: boolean }) {
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

  if (!signedIn) return <LockedNewButton />;

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
            className="kami-pop absolute left-0 z-30 mt-2 w-60 overflow-hidden rounded-2xl p-1.5"
            style={{
              transformOrigin: "top left",
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

/**
 * The signed-out button: dimmed, and it explains itself.
 *
 * `aria-disabled` rather than `disabled`. A disabled button takes no pointer
 * events and no focus in most browsers, so it could be neither hovered for the
 * reason nor reached by keyboard, which would leave someone with a grey button
 * and no way to find out why. This one still hovers, still focuses, and a tap
 * toggles the same note on a phone, where there is no hover to have.
 */
function LockedNewButton() {
  const [showing, setShowing] = useState(false);
  const noteId = useId();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showing) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (!container.current?.contains(event.target as Node)) setShowing(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setShowing(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showing]);

  return (
    <div
      className="relative shrink-0"
      ref={container}
      onPointerEnter={(event) => {
        // Touch fires enter on tap too, and then the click would close it
        // again. Hover is a mouse idea, so only a mouse opens it this way.
        if (event.pointerType === "mouse") setShowing(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setShowing(false);
      }}
      /*
       * Focus is tracked on the container, not the button. React's onFocus and
       * onBlur bubble, so tabbing from the button onto the note's own link
       * keeps the note open instead of unmounting the link mid-tab.
       */
      onFocus={(event) => {
        /*
         * Keyboard focus only. A tap focuses the button *and* clicks it, so
         * opening on every focus would have the click toggle it straight back
         * shut, and the note would never appear on a phone.
         */
        if (event.target instanceof Element && event.target.matches(":focus-visible")) {
          setShowing(true);
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setShowing(false);
      }}
    >
      <button
        type="button"
        aria-disabled="true"
        aria-describedby={showing ? noteId : undefined}
        onClick={() => setShowing((value) => !value)}
        className="flex cursor-not-allowed items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold"
        style={{ border: "1px solid var(--border)", color: "var(--text-faint)" }}
      >
        <Plus className="size-4" aria-hidden />
        <span className="hidden sm:inline">New</span>
        <span className="sr-only sm:hidden">Add a crease pattern</span>
      </button>

      {showing && (
        <div
          id={noteId}
          className="absolute left-0 z-30 mt-2 w-56 rounded-xl p-3 text-xs"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-card-hover)",
          }}
        >
          <p style={{ color: "var(--text-muted)" }}>
            Log in to add a crease pattern.
          </p>
          <Link href="/login" className="mt-1.5 inline-block font-bold underline">
            Log in
          </Link>
        </div>
      )}
    </div>
  );
}
