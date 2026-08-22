"use server";

import { sendContactEmail } from "./send";
import { looksAutomated, validateContact } from "./validate";

export interface ContactState {
  readonly error?: string;
  readonly sent?: boolean;
}

/**
 * The help form's one write.
 *
 * The honeypot is answered with success rather than with an error. A bot that
 * is told it failed tries again with the field cleared; a bot that is told it
 * worked goes away. Nobody real ever sees this branch, because nobody real can
 * see the field.
 */
export async function sendContactAction(
  _previous: ContactState,
  form: FormData,
): Promise<ContactState> {
  if (looksAutomated(form)) return { sent: true };

  const draft = validateContact(form);
  if (!draft.ok) return { error: draft.error };

  const result = await sendContactEmail(draft.value);
  if (result.ok) return { sent: true };

  return {
    error:
      result.reason === "unconfigured"
        ? "The contact form is not connected to an inbox on this deployment yet."
        : "That did not send. Try again in a minute — nothing was lost.",
  };
}
