"use client";

import { useActionState, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { deletePatternAction, type SaveState } from "@/lib/patterns/actions";

/**
 * The way out of the library, for a pattern of your own.
 *
 * A dialog rather than a typed confirmation. The account form asks somebody to
 * type "delete" because an account is one thing, unrecoverable, and taking
 * everything with it; a crease pattern is one of many, the geometry is still in
 * whatever `.kami` file its author exported, and the editor's draft of it is
 * still in their browser. Making this as hard as closing an account would be
 * theatre.
 *
 * The button is quiet and the dialog is not, which is the right way round: a
 * red button at the bottom of every page you own is a thing to hit by accident,
 * and a dialog is only read by somebody who meant to open it.
 */
export function DeletePatternButton({
  slug,
  title,
  foldCount,
}: {
  readonly slug: string;
  readonly title: string;
  /** Folds of this pattern, so the dialog can say what survives it. */
  readonly foldCount?: number;
}) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(
    deletePatternAction,
    {},
  );
  const [asking, setAsking] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  const folds =
    foldCount && foldCount > 0
      ? ` ${foldCount === 1 ? "One fold" : `${foldCount} folds`} of it stay on their own pages, showing the name it had.`
      : "";

  return (
    <form ref={form} action={formAction} className="contents">
      <input type="hidden" name="slug" value={slug} />

      <button
        type="button"
        onClick={() => setAsking(true)}
        disabled={pending}
        className="flex items-center gap-1.5 text-sm transition hover:opacity-70 disabled:opacity-40"
        style={{ color: "var(--danger)" }}
      >
        <Trash2 className="size-3.5" aria-hidden />
        {pending ? "Deleting…" : "Delete this pattern"}
      </button>

      {state.error && (
        <p role="alert" className="mt-1 text-sm" style={{ color: "var(--danger)" }}>
          {state.error}
        </p>
      )}

      {asking && (
        <ConfirmDialog
          title={`Delete "${title}"?`}
          body={`It comes off the library and its page stops working, for everybody.${folds} This cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Keep it"
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            form.current?.requestSubmit();
          }}
        />
      )}
    </form>
  );
}
