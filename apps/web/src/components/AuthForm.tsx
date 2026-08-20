"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import type { AuthFormState } from "@/app/auth/actions";

function SubmitButton({ label }: { readonly label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60"
      style={{ background: "var(--brand)", color: "var(--text)" }}
    >
      {pending ? "One moment…" : label}
    </button>
  );
}

/**
 * A password field you can look at.
 *
 * Typing a password you cannot see, into a form that will only tell you
 * afterwards that it was wrong, is the one place a peek button earns its
 * keep, most of all on a phone keyboard. It starts hidden, and the toggle
 * says which state it is in rather than which state it would switch to.
 */
function PasswordField({
  minLength,
  autoComplete,
  hint,
}: {
  readonly minLength?: number;
  readonly autoComplete: string;
  readonly hint?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        Password
      </span>
      <span className="relative block">
        <input
          name="password"
          type={visible ? "text" : "password"}
          required
          {...(minLength === undefined ? {} : { minLength })}
          autoComplete={autoComplete}
          className="w-full rounded-xl py-2 pl-3 pr-11 text-sm"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          title={visible ? "Hide password" : "Show password"}
          // Not in the tab order: it sits between the password and the submit
          // button, and a keyboard user reaching for one should not land here.
          tabIndex={-1}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl transition hover:opacity-60"
          style={{ color: "var(--text-muted)" }}
        >
          {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </span>
      {hint && (
        <span className="mt-1 block text-xs" style={{ color: "var(--text-faint)" }}>
          {hint}
        </span>
      )}
    </label>
  );
}

export interface AuthFormProps {
  readonly mode: "login" | "signup";
  readonly action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  readonly configured: boolean;
  /** Where to go once signed in. Set when a page sent you here to log in. */
  readonly next?: string;
}

export function AuthForm({ mode, action, configured, next }: AuthFormProps) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(action, {});
  const isSignup = mode === "signup";
  const switchHref = next
    ? `${isSignup ? "/login" : "/signup"}?next=${encodeURIComponent(next)}`
    : isSignup
      ? "/login"
      : "/signup";

  return (
    <div
      className="mx-auto w-full max-w-sm rounded-2xl p-6"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <h1 className="text-2xl font-bold tracking-tight">
        {isSignup ? "Join Kamibase" : "Welcome back"}
      </h1>
      {isSignup && (
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Save patterns and post your folds.
        </p>
      )}

      {!configured && (
        <p
          className="mb-4 rounded-xl p-3 text-xs"
          style={{ background: "var(--surface-sunken)", color: "var(--text-muted)" }}
        >
          Accounts are not configured on this deployment yet.
        </p>
      )}

      <form action={formAction} className="mt-5 space-y-3">
        {next && <input type="hidden" name="next" value={next} />}
        {isSignup && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Name <span style={{ color: "var(--text-faint)" }}>(optional)</span>
            </span>
            <input
              name="name"
              type="text"
              autoComplete="name"
              className="w-full rounded-xl px-3 py-2 text-sm"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            />
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Email
          </span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-xl px-3 py-2 text-sm"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          />
        </label>

        <PasswordField
          autoComplete={isSignup ? "new-password" : "current-password"}
          {...(isSignup ? { minLength: 8, hint: "At least 8 characters." } : {})}
        />

        {state.error && (
          <p className="text-sm" role="alert" style={{ color: "#b4261f" }}>
            {state.error}
          </p>
        )}
        {state.notice && (
          <p
            className="rounded-xl p-3 text-sm"
            role="status"
            style={{ background: "var(--brand-soft)", color: "var(--text)" }}
          >
            {state.notice}
          </p>
        )}

        <SubmitButton label={isSignup ? "Create account" : "Log in"} />
      </form>

      <p className="mt-4 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        {isSignup ? "Already folding here? " : "New here? "}
        <Link
          href={switchHref}
          className="font-semibold underline"
          style={{ color: "var(--text)" }}
        >
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
