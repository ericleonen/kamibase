"use client";

import { useFormStatus } from "react-dom";

/**
 * A submit button that knows when its own form is in flight.
 *
 * `useFormStatus` has to be read from inside the form, which is why this is its
 * own component rather than a prop on each one. The forms themselves stay
 * server-rendered and work with JavaScript off; this only adds the pending
 * state on top.
 */
export function SubmitButton({
  label,
  pendingLabel,
  variant = "brand",
  className = "",
  title,
}: {
  readonly label: string;
  readonly pendingLabel?: string;
  readonly variant?: "brand" | "outline" | "quiet";
  readonly className?: string;
  readonly title?: string;
}) {
  const { pending } = useFormStatus();

  const styles =
    variant === "brand"
      ? { background: "var(--brand)", color: "var(--ink)" }
      : variant === "outline"
        ? { border: "1px solid var(--border-strong)" }
        : { color: "var(--text-muted)" };

  return (
    <button
      type="submit"
      disabled={pending}
      title={title ?? label}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-80 disabled:opacity-60 ${className}`}
      style={styles}
    >
      {pending ? (pendingLabel ?? "One moment…") : label}
    </button>
  );
}
