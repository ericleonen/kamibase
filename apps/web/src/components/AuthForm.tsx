"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
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

export interface AuthFormProps {
  readonly mode: "login" | "signup";
  readonly action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  readonly configured: boolean;
  readonly setupHint: string;
  /** Where to go once signed in. Set when a page sent you here to log in. */
  readonly next?: string;
}

export function AuthForm({ mode, action, configured, setupHint, next }: AuthFormProps) {
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
      <p className="mt-1 mb-5 text-sm" style={{ color: "var(--text-muted)" }}>
        {isSignup
          ? "Save patterns, post your folds, and keep your collections."
          : "Sign in to your collections and folds."}
      </p>

      {!configured && (
        <p
          className="mb-4 rounded-xl p-3 text-xs"
          style={{ background: "var(--surface-sunken)", color: "var(--text-muted)" }}
        >
          Accounts are not configured on this deployment yet. {setupHint}
        </p>
      )}

      <form action={formAction} className="space-y-3">
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

        <label className="block">
          <span className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Password
          </span>
          <input
            name="password"
            type="password"
            required
            minLength={isSignup ? 8 : undefined}
            autoComplete={isSignup ? "new-password" : "current-password"}
            className="w-full rounded-xl px-3 py-2 text-sm"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          />
          {isSignup && (
            <span className="mt-1 block text-xs" style={{ color: "var(--text-faint)" }}>
              At least 8 characters.
            </span>
          )}
        </label>

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
