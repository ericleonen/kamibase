"use client";

import { useActionState } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { SubmitButton } from "@/components/social/SubmitButton";
import { sendContactAction, type ContactState } from "@/lib/contact/actions";
import {
  MESSAGE_MAX,
  NAME_MAX,
  SUBJECT_MAX,
  EMAIL_MAX,
} from "@/lib/contact/validate";

const fieldStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
} as const;

/**
 * Write to whoever runs this.
 *
 * A form rather than an address on the page, because an address on a public
 * page is an address in a scraper's list by the end of the week. The message
 * goes to a server action, which sends it on with the sender's address as the
 * reply-to, so answering is one click and the address never appears in HTML.
 *
 * Two fields are required and two are not. Every optional field on a contact
 * form is a small tax on somebody who has already decided to tell you
 * something, and the only things actually needed are what they want to say and
 * where the answer goes.
 */
export function ContactForm({ configured }: { readonly configured: boolean }) {
  const [state, formAction] = useActionState<ContactState, FormData>(sendContactAction, {});

  if (state.sent) {
    return (
      <div
        className="flex gap-3 rounded-2xl p-4"
        style={{ background: "var(--brand-soft)", border: "1px solid var(--border)" }}
      >
        <CircleCheck className="mt-0.5 size-5 shrink-0" style={{ color: "var(--brand-strong)" }} aria-hidden />
        <div>
          <p className="font-semibold">Sent.</p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            It goes to a person, not a queue, so the reply comes when they read it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {!configured && (
        <p
          className="rounded-2xl p-3 text-sm"
          style={{ background: "var(--surface-sunken)", color: "var(--text-muted)" }}
        >
          Heads up: this deployment has no mail service connected yet, so the form
          will not deliver.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" hint="Optional">
          <input
            name="name"
            type="text"
            maxLength={NAME_MAX}
            autoComplete="name"
            className="w-full rounded-xl px-3 py-2 text-sm"
            style={fieldStyle}
          />
        </Field>

        <Field label="Your email">
          <input
            name="email"
            type="email"
            required
            maxLength={EMAIL_MAX}
            autoComplete="email"
            placeholder="So there is somewhere to reply"
            className="w-full rounded-xl px-3 py-2 text-sm"
            style={fieldStyle}
          />
        </Field>
      </div>

      <Field label="Subject" hint="Optional">
        <input
          name="subject"
          type="text"
          maxLength={SUBJECT_MAX}
          placeholder="A broken pattern, a bug, an idea…"
          className="w-full rounded-xl px-3 py-2 text-sm"
          style={fieldStyle}
        />
      </Field>

      <Field label="Message">
        <textarea
          name="message"
          required
          rows={7}
          maxLength={MESSAGE_MAX}
          placeholder="What happened, what you expected, and a link if there is one."
          className="w-full resize-y rounded-xl px-3 py-2 text-sm"
          style={fieldStyle}
        />
      </Field>

      {/*
        The honeypot. Hidden from sight and from the accessibility tree, out of
        the tab order, and named after something a bot cannot resist filling in.
      */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
      />

      {state.error && (
        <p className="flex items-start gap-2 text-sm" style={{ color: "#b42318" }} role="alert">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}

      <SubmitButton label="Send" pendingLabel="Sending…" />
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
        {hint && (
          <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
