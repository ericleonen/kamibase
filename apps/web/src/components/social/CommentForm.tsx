"use client";

import { useActionState, useEffect, useRef } from "react";
import { COMMENT_MAX } from "@/lib/social/validate";
import { createCommentAction, type ActionState } from "@/lib/social/actions";
import { SubmitButton } from "./SubmitButton";

/**
 * The box at the bottom of a comment thread.
 *
 * `useActionState` keeps the error next to the field that caused it instead of
 * navigating away to report it. The textarea clears itself once the server has
 * accepted the comment, not when the button is pressed, so a failed post keeps
 * what you wrote.
 */
export function CommentForm({
  patternId,
  foldId,
  placeholder,
}: {
  readonly patternId?: string;
  readonly foldId?: string;
  readonly placeholder?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createCommentAction,
    {},
  );
  const form = useRef<HTMLFormElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    // The initial state is not a submission, so skip it. After that, a state
    // with no error means the comment landed.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!state.error) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={formAction} className="space-y-2">
      {patternId && <input type="hidden" name="patternId" value={patternId} />}
      {foldId && <input type="hidden" name="foldId" value={foldId} />}

      <label className="block">
        <span className="sr-only">Add a comment</span>
        <textarea
          name="body"
          rows={3}
          required
          maxLength={COMMENT_MAX}
          placeholder={placeholder ?? "Add a comment…"}
          className="w-full rounded-xl px-3 py-2 text-sm"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        />
      </label>

      {state.error && (
        <p className="text-sm" role="alert" style={{ color: "#b4261f" }}>
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <SubmitButton label="Post comment" pendingLabel="Posting…" />
      </div>
    </form>
  );
}
