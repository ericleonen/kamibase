"use client";

import { useActionState } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { SubmitButton } from "@/components/social/SubmitButton";
import type { AccountSettings } from "@/lib/social/account";
import {
  changeEmailAction,
  deleteAccountAction,
  resetPasswordAction,
  updateAccountAction,
  type AccountState,
} from "@/lib/social/account-actions";

const fieldStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
} as const;

/** Whatever the last save had to say. */
function Result({ state }: { readonly state: AccountState }) {
  if (state.error) {
    return (
      <p className="flex items-start gap-2 text-sm" style={{ color: "var(--danger)" }} role="alert">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        {state.error}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p
        className="flex items-start gap-2 text-sm"
        style={{ color: "var(--text-muted)" }}
        role="status"
      >
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        {state.notice}
      </p>
    );
  }
  return null;
}

function Switch({
  name,
  label,
  hint,
  defaultChecked,
}: {
  readonly name: string;
  readonly label: string;
  readonly hint: string;
  readonly defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-2">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 shrink-0"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs leading-snug" style={{ color: "var(--text-muted)" }}>
          {hint}
        </span>
      </span>
    </label>
  );
}

/**
 * Privacy and notifications: four switches and one save.
 *
 * Uncontrolled, with `defaultChecked` from the server. A checkbox is already
 * its own state; mirroring it into React would buy nothing except a way for the
 * two to disagree.
 */
export function PrivacyAndNotifications({
  settings,
  available,
}: {
  readonly settings: AccountSettings;
  /** False when `0003_settings.sql` has not been run on this database. */
  readonly available: boolean;
}) {
  const [state, formAction] = useActionState<AccountState, FormData>(updateAccountAction, {});

  return (
    <form action={formAction} className="space-y-4">
      {!available && (
        <p
          className="rounded-2xl p-3 text-sm"
          style={{ background: "var(--surface-sunken)", color: "var(--text-muted)" }}
        >
          This deployment has not run{" "}
          <code className="font-mono text-xs">supabase/migrations/0003_settings.sql</code> yet, so
          nothing here will save.
        </p>
      )}

      <section>
        <h3 className="text-sm font-bold">Who can see your work</h3>
        <Switch
          name="isPrivate"
          label="Private account"
          hint="Only people who follow you can see your folds. Your name and handle stay visible, so a link somebody already has still leads somewhere honest."
          defaultChecked={settings.isPrivate}
        />
      </section>

      <section>
        <h3 className="text-sm font-bold">Email me when</h3>
        <Switch
          name="notifyFollows"
          label="Somebody follows me"
          hint="Once per new follower."
          defaultChecked={settings.notifyFollows}
        />
        <Switch
          name="notifyFolds"
          label="Somebody I follow posts a fold"
          hint="One email per fold, from the people you chose to follow."
          defaultChecked={settings.notifyFolds}
        />
        <Switch
          name="notifyComments"
          label="Somebody comments on my fold"
          hint="Not for your own comments."
          defaultChecked={settings.notifyComments}
        />
      </section>

      <Result state={state} />
      <SubmitButton label="Save" pendingLabel="Saving…" />
    </form>
  );
}

/** Change the address the account signs in with. */
export function EmailForm({ current }: { readonly current: string }) {
  const [state, formAction] = useActionState<AccountState, FormData>(changeEmailAction, {});

  return (
    <form action={formAction} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Email address
        </span>
        <input
          name="email"
          type="email"
          required
          defaultValue={current}
          autoComplete="email"
          className="w-full max-w-sm rounded-xl px-3 py-2 text-sm"
          style={fieldStyle}
        />
      </label>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        A confirmation link goes to the new address. Nothing changes until you
        follow it.
      </p>
      <Result state={state} />
      <SubmitButton label="Change email" pendingLabel="Sending…" variant="outline" />
    </form>
  );
}

/** Send a reset link to the address on file. */
export function PasswordForm({ email }: { readonly email: string }) {
  const [state, formAction] = useActionState<AccountState, FormData>(
    async () => resetPasswordAction(),
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        A reset link goes to {email}, the address on this account. There is no
        field to type a different one, because that field would only be a way to
        mail somebody else&rsquo;s inbox.
      </p>
      <Result state={state} />
      <SubmitButton label="Send a reset link" pendingLabel="Sending…" variant="outline" />
    </form>
  );
}

/**
 * The way out.
 *
 * Typed confirmation rather than a second "are you sure": the point is to make
 * the person stop and read, and a dialog they can dismiss with the same reflex
 * that opened it does not do that.
 */
export function DeleteAccountForm() {
  const [state, formAction] = useActionState<AccountState, FormData>(deleteAccountAction, {});

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Your profile, your folds, your comments and the patterns you saved go
        with it, and none of it can be brought back. Export anything you want
        to keep first: every pattern's page has a .kami download.
      </p>
      <label className="block">
        <span className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Type <strong style={{ color: "var(--text)" }}>delete</strong> to confirm
        </span>
        <input
          name="confirm"
          type="text"
          autoComplete="off"
          className="w-full max-w-[12rem] rounded-xl px-3 py-2 text-sm"
          style={fieldStyle}
        />
      </label>
      <Result state={state} />
      <button
        type="submit"
        className="rounded-full px-4 py-2 text-sm font-bold transition hover:opacity-80"
        style={{ border: "1px solid var(--danger)", color: "var(--danger)" }}
      >
        Delete my account
      </button>
    </form>
  );
}
