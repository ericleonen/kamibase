"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { renderSvg } from "@kamibase/core";
import { graphFromDoc, type EditorDoc } from "@/lib/editor/model";
import { savePatternAction, type SaveState } from "@/lib/patterns/actions";
import {
  DEFAULT_LICENSE,
  DESCRIPTION_MAX,
  DESIGNER_MAX,
  LICENSES,
  TITLE_MAX,
} from "@/lib/patterns/validate";

const fieldStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
} as const;

export interface SavePatternDialogProps {
  /** The pattern being saved, as the editor holds it. */
  readonly doc: EditorDoc;
  /** Prefills the title, so a named draft does not have to be renamed. */
  readonly defaultTitle: string;
  /** False when nobody is logged in, which is the one thing that blocks a save. */
  readonly signedIn: boolean;
  readonly onClose: () => void;
}

/**
 * Save this pattern to Kamibase.
 *
 * Two halves: what is about to be saved, and what is known about it. The
 * preview is not decoration. Saving is the one action in the editor whose
 * result other people see, and the geometry that reaches the database is the
 * geometry, not the canvas: same renderer, no grid, no reference image, no
 * half-drawn stroke. If what is in this box is not the pattern, the way back is
 * one button and nothing has been written.
 *
 * The form is deliberately short. A title is the only thing required, because
 * a save form that asks for eight fields is a save form people work around by
 * never saving. Everything else can be filled in later by editing the pattern.
 */
export function SavePatternDialog({
  doc,
  defaultTitle,
  signedIn,
  onClose,
}: SavePatternDialogProps) {
  const [state, formAction] = useActionState<SaveState, FormData>(savePatternAction, {});
  const [mounted, setMounted] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      // The editor listens for Escape too, to close the 3D fold. This dialog
      // is on top of it, so it takes the key.
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown, true);
    titleRef.current?.select();
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [mounted, onClose]);

  /*
   * The preview's geometry, built from the segments rather than from the
   * editor's live analysis. Analysis pauses on very dense patterns, and a
   * preview that goes blank on exactly the patterns worth being careful about
   * would be worse than none. This is the same builder the parsers use and it
   * does no planarizing, so it is cheap enough to run on open.
   */
  const svg = useMemo(
    () =>
      renderSvg(graphFromDoc(doc), {
        size: 480,
        padding: 8,
        // Heavier than a card thumbnail, because this is shown at about
        // 200px and a hairline at that size is a pattern you cannot check.
        strokeWidth: 3,
        background: null,
        title: `${defaultTitle} crease pattern`,
      }),
    [doc, defaultTitle],
  );

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgb(27 26 23 / 0.45)" }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-pattern-title"
        className="flex max-h-full w-full max-w-2xl flex-col overflow-y-auto rounded-2xl p-5"
        style={{ background: "var(--surface-raised)", boxShadow: "var(--shadow-card-hover)" }}
      >
        <h2 id="save-pattern-title" className="text-lg font-black tracking-tight">
          Save to Kamibase
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          {doc.length} creases. It gets its own page, and anyone can fold it.
        </p>

        <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
          {/* Rendered by `@kamibase/core`, which is what makes it a preview of
              the file rather than a screenshot of the canvas. */}
          <div
            className="flex aspect-square w-full items-center justify-center rounded-xl p-2 [&>svg]:h-full [&>svg]:w-full"
            style={{ background: "var(--surface-sunken)" }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />

          {signedIn ? (
            <form action={formAction} className="space-y-3">
              {/*
               * The segments, not a finished file. The server runs the real
               * ingest over them, so what lands in the database is canonical
               * and graded there rather than here.
               */}
              <input type="hidden" name="geometry" value={JSON.stringify(doc)} />

              <label className="block">
                <span className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  Title
                </span>
                <input
                  ref={titleRef}
                  name="title"
                  required
                  maxLength={TITLE_MAX}
                  defaultValue={defaultTitle}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={fieldStyle}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  Designer <span style={{ color: "var(--text-faint)" }}>(optional)</span>
                </span>
                <input
                  name="designer"
                  maxLength={DESIGNER_MAX}
                  placeholder="Whoever worked it out, if not you"
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={fieldStyle}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  Notes <span style={{ color: "var(--text-faint)" }}>(optional)</span>
                </span>
                <textarea
                  name="description"
                  rows={3}
                  maxLength={DESCRIPTION_MAX}
                  placeholder="How it collapses, what paper suits it, what it turns into."
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={fieldStyle}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    Licence
                  </span>
                  <select
                    name="license"
                    defaultValue={DEFAULT_LICENSE}
                    className="w-full rounded-xl px-3 py-2 text-sm"
                    style={fieldStyle}
                  >
                    {LICENSES.map((option) => (
                      <option key={option.spdx} value={option.spdx}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    Difficulty <span style={{ color: "var(--text-faint)" }}>(1 to 10)</span>
                  </span>
                  <input
                    name="difficulty"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={10}
                    placeholder="6"
                    className="w-full rounded-xl px-3 py-2 text-sm"
                    style={fieldStyle}
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  Tags <span style={{ color: "var(--text-faint)" }}>(comma separated)</span>
                </span>
                <input
                  name="tags"
                  placeholder="tessellation, box-pleating, 32-grid"
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={fieldStyle}
                />
              </label>

              {state.error && (
                <p className="text-sm" role="alert" style={{ color: "#b4261f" }}>
                  {state.error}
                </p>
              )}

              <Buttons onClose={onClose} />
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Saving a pattern puts it on the site under your name, so it needs an
                account. Your drawing stays in this browser while you log in, and
                exporting it to a file needs no account at all.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/login"
                  className="rounded-full px-4 py-2 text-sm font-bold transition hover:opacity-85"
                  style={{ background: "var(--brand)", color: "var(--ink)" }}
                >
                  Log in
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full px-4 py-2 text-sm font-bold transition hover:opacity-70"
                  style={{ border: "1px solid var(--border-strong)" }}
                >
                  Back to the editor
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The two ways out.
 *
 * Its own component because `useFormStatus` only reports on a form it is
 * rendered inside, and both buttons want to know: saving takes a round trip
 * through a full ingest, and a second click during it would try to save the
 * pattern twice.
 */
function Buttons({ onClose }: { readonly onClose: () => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
      <button
        type="button"
        onClick={onClose}
        disabled={pending}
        className="rounded-full px-4 py-2 text-sm font-bold transition hover:opacity-70 disabled:opacity-40"
        style={{ border: "1px solid var(--border-strong)" }}
      >
        Back to the editor
      </button>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full px-4 py-2 text-sm font-bold transition hover:opacity-85 disabled:opacity-60"
        style={{ background: "var(--brand)", color: "var(--ink)" }}
      >
        {pending ? "Saving…" : "Save pattern"}
      </button>
    </div>
  );
}
