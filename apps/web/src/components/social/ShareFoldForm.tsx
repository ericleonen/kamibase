"use client";

import { useActionState } from "react";
import { FOLD_PHOTO_MAX_EDGE } from "@/lib/social/image";
import { CAPTION_MAX, PAPER_MAX } from "@/lib/social/validate";
import { createFoldAction, type ActionState } from "@/lib/social/actions";
import { ImagePicker } from "./ImagePicker";
import { SubmitButton } from "./SubmitButton";

const fieldStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
} as const;

function Field({
  label,
  name,
  placeholder,
  hint,
  type = "text",
  min,
  max,
  maxLength,
}: {
  readonly label: string;
  readonly name: string;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly type?: "text" | "number";
  readonly min?: number;
  readonly max?: number;
  readonly maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <input
        name={name}
        type={type}
        placeholder={placeholder ?? ""}
        {...(min === undefined ? {} : { min })}
        {...(max === undefined ? {} : { max })}
        {...(maxLength === undefined ? {} : { maxLength })}
        {...(type === "number" ? { inputMode: "numeric" as const } : {})}
        className="w-full rounded-xl px-3 py-2 text-sm"
        style={fieldStyle}
      />
      {hint && (
        <span className="mt-1 block text-xs" style={{ color: "var(--text-faint)" }}>
          {hint}
        </span>
      )}
    </label>
  );
}

/**
 * Post a fold of a pattern.
 *
 * A photo is the only thing required. Paper, size, time and difficulty are all
 * optional on purpose: asking a beginner to fill in six fields before they can
 * show what they folded is how a site ends up with nothing but expert posts,
 * and beginner folds of famous crease patterns are exactly the content
 * DESIGN.md §7 is after.
 */
export function ShareFoldForm({
  patternId,
  patternTitle,
}: {
  readonly patternId: string;
  readonly patternTitle: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(createFoldAction, {});

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="patternId" value={patternId} />

      <ImagePicker
        name="photo"
        label="Photo of your fold"
        required
        maxEdge={FOLD_PHOTO_MAX_EDGE}
      />

      <label className="block">
        <span className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Notes <span style={{ color: "var(--text-faint)" }}>(optional)</span>
        </span>
        <textarea
          name="caption"
          rows={3}
          maxLength={CAPTION_MAX}
          placeholder={`How did ${patternTitle} go? Anything you would do differently?`}
          className="w-full rounded-xl px-3 py-2 text-sm"
          style={fieldStyle}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Paper"
          name="paper"
          placeholder="Kami, tissue foil, Tant…"
          maxLength={PAPER_MAX}
        />
        <Field label="Size (mm)" name="sizeMm" type="number" min={10} max={2000} placeholder="150" />
        <Field label="Time (minutes)" name="minutes" type="number" min={1} placeholder="45" />
        <Field
          label="Difficulty you felt"
          name="difficulty"
          type="number"
          min={1}
          max={10}
          placeholder="6"
        />
      </div>

      {state.error && (
        <p className="text-sm" role="alert" style={{ color: "#b4261f" }}>
          {state.error}
        </p>
      )}

      <SubmitButton label="Post fold" pendingLabel="Uploading…" className="w-full sm:w-auto" />
    </form>
  );
}
