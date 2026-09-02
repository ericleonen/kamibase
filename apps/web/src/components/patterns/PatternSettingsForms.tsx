"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Eye, EyeOff, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  deletePatternAction,
  setPatternPrivacyAction,
  updatePatternAction,
  type SaveState,
} from "@/lib/patterns/actions";
import {
  DESCRIPTION_MAX,
  DESIGNER_MAX,
  LICENSES,
  TITLE_MAX,
} from "@/lib/patterns/validate";

const fieldStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
} as const;

const labelClass = "mb-1 block text-xs font-medium";

/**
 * Everything about a pattern that is not its creases.
 *
 * One form, one Save, and no live saving: these are decisions rather than
 * settings — what a design is called, who worked it out, what anybody may do
 * with it — and a field that commits on blur turns a half-typed title into a
 * published one. The two controls below it, visibility and deletion, are
 * genuinely single actions, so they get a button each and no Save.
 */
export function PatternDetailsForm({
  slug,
  title,
  designer,
  description,
  license,
  difficulty,
  tags,
}: {
  readonly slug: string;
  readonly title: string;
  readonly designer: string;
  readonly description: string;
  readonly license: string;
  readonly difficulty?: number;
  readonly tags: readonly string[];
}) {
  const [state, formAction] = useActionState<SaveState, FormData>(updatePatternAction, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />

      <label className="block">
        <span className={labelClass} style={{ color: "var(--text-muted)" }}>
          Title
        </span>
        <input
          name="title"
          required
          maxLength={TITLE_MAX}
          defaultValue={title}
          className="w-full rounded-xl px-3 py-2 text-sm"
          style={fieldStyle}
        />
        {/*
          The one thing about this form that could surprise somebody: the
          address does not follow the name. Said here rather than discovered
          later, because a link that keeps working is the reason for it.
        */}
        <span className="mt-1 block text-xs" style={{ color: "var(--text-faint)" }}>
          The web address stays /p/{slug}, so links and folds keep working.
        </span>
      </label>

      <label className="block">
        <span className={labelClass} style={{ color: "var(--text-muted)" }}>
          Designer <span style={{ color: "var(--text-faint)" }}>(optional)</span>
        </span>
        <input
          name="designer"
          maxLength={DESIGNER_MAX}
          defaultValue={designer}
          placeholder="Whoever worked it out, if not you"
          className="w-full rounded-xl px-3 py-2 text-sm"
          style={fieldStyle}
        />
      </label>

      <label className="block">
        <span className={labelClass} style={{ color: "var(--text-muted)" }}>
          Notes <span style={{ color: "var(--text-faint)" }}>(optional)</span>
        </span>
        <textarea
          name="description"
          rows={4}
          maxLength={DESCRIPTION_MAX}
          defaultValue={description}
          placeholder="How it collapses, what paper suits it, what it turns into."
          className="w-full rounded-xl px-3 py-2 text-sm"
          style={fieldStyle}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass} style={{ color: "var(--text-muted)" }}>
            Licence
          </span>
          <select
            name="license"
            defaultValue={license}
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
          <span className={labelClass} style={{ color: "var(--text-muted)" }}>
            Difficulty <span style={{ color: "var(--text-faint)" }}>(1 to 10)</span>
          </span>
          <input
            name="difficulty"
            type="number"
            inputMode="numeric"
            min={1}
            max={10}
            defaultValue={difficulty ?? ""}
            placeholder="6"
            className="w-full rounded-xl px-3 py-2 text-sm"
            style={fieldStyle}
          />
        </label>
      </div>

      <label className="block">
        <span className={labelClass} style={{ color: "var(--text-muted)" }}>
          Tags <span style={{ color: "var(--text-faint)" }}>(comma separated)</span>
        </span>
        <input
          name="tags"
          defaultValue={tags.join(", ")}
          placeholder="tessellation, box-pleating, 32-grid"
          className="w-full rounded-xl px-3 py-2 text-sm"
          style={fieldStyle}
        />
      </label>

      <Outcome state={state} saved="Saved." />
      <SubmitButton idle="Save changes" busy="Saving…" primary />
    </form>
  );
}

/**
 * Public or not.
 *
 * A button rather than a switch, and it says what pressing it does rather than
 * what the state currently is. A toggle in a form with no Save has to answer
 * "is this the current setting or the thing I am about to do", and a labelled
 * button never raises the question.
 */
export function PatternVisibilityForm({
  slug,
  isPrivate,
}: {
  readonly slug: string;
  readonly isPrivate: boolean;
}) {
  const [state, formAction] = useActionState<SaveState, FormData>(
    setPatternPrivacyAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="private" value={isPrivate ? "false" : "true"} />

      <div
        className="flex items-start gap-2.5 rounded-xl p-3 text-sm"
        style={{ background: "var(--surface-sunken)" }}
      >
        {isPrivate ? (
          <EyeOff className="mt-0.5 size-4 shrink-0" style={{ color: "var(--brand-strong)" }} aria-hidden />
        ) : (
          <Eye className="mt-0.5 size-4 shrink-0" style={{ color: "var(--ok)" }} aria-hidden />
        )}
        <p style={{ color: "var(--text-muted)" }}>
          {isPrivate ? (
            <>
              <strong style={{ color: "var(--text)" }}>Private.</strong> Only you can
              see it. It is off Explore, out of search, and its page is a 404 to
              everybody else.
            </>
          ) : (
            <>
              <strong style={{ color: "var(--text)" }}>Public.</strong> Anybody can
              open it, fold it and download it.
            </>
          )}
        </p>
      </div>

      <Outcome state={state} saved={isPrivate ? "Published." : "Made private."} />
      <SubmitButton
        idle={isPrivate ? "Make it public" : "Make it private"}
        busy="Changing…"
      />
    </form>
  );
}

/**
 * The way out of the library, for a pattern of your own.
 *
 * A dialog rather than a typed confirmation. The account form asks somebody to
 * type "delete" because an account is one thing, unrecoverable, and taking
 * everything with it; a crease pattern is one of many, the geometry is still in
 * whatever `.kami` file its author exported, and making this as hard as closing
 * an account would be theatre. Anybody who wants it gone but not *gone* has the
 * button above this one.
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
    <form ref={form} action={formAction} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />

      <button
        type="button"
        onClick={() => setAsking(true)}
        disabled={pending}
        className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition hover:opacity-80 disabled:opacity-40"
        style={{ border: "1px solid var(--danger)", color: "var(--danger)" }}
      >
        <Trash2 className="size-3.5" aria-hidden />
        {pending ? "Deleting…" : "Delete this pattern"}
      </button>

      <Outcome state={state} />

      {asking && (
        <ConfirmDialog
          title={`Delete "${title}"?`}
          body={`It comes off the library and its page stops working, for everybody.${folds} This cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Keep it"
          destructive
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

/** What happened, in one line: the error, or the confirmation, or nothing. */
function Outcome({ state, saved }: { readonly state: SaveState; readonly saved?: string }) {
  const { pending } = useFormStatus();

  if (state.error) {
    return (
      <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
        {state.error}
      </p>
    );
  }
  if (!saved || !state.saved || pending) return null;
  return (
    <p role="status" className="flex items-center gap-1.5 text-sm" style={{ color: "var(--ok)" }}>
      <Check className="size-3.5" aria-hidden />
      {saved}
    </p>
  );
}

function SubmitButton({
  idle,
  busy,
  primary = false,
}: {
  readonly idle: string;
  readonly busy: string;
  readonly primary?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full px-4 py-2 text-sm font-bold transition hover:opacity-80 disabled:opacity-50"
      style={
        primary
          ? { background: "var(--brand)", color: "var(--ink)" }
          : { border: "1px solid var(--border-strong)" }
      }
    >
      {pending ? busy : idle}
    </button>
  );
}
