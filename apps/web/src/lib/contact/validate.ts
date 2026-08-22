/**
 * Input rules for the help form.
 *
 * Pure functions with no transport in sight, in the same shape as the social
 * layer's validators, so they are unit-tested directly and reused by the form
 * and the server action. The rules exist to produce a sentence somebody can act
 * on, not to be the only guard: the action checks again before it sends.
 */

export type Validated<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export const NAME_MAX = 80;
export const SUBJECT_MAX = 120;
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 4000;
export const EMAIL_MAX = 254;

export interface ContactDraft {
  readonly name: string;
  readonly email: string;
  readonly subject: string;
  readonly message: string;
}

/**
 * Deliberately loose.
 *
 * A regular expression cannot tell you whether an address exists, and every
 * strict one on the internet rejects somebody's real address. This catches the
 * typo that matters — no `@`, nothing after it, a space in the middle — and
 * leaves the rest to the fact that a reply either arrives or does not.
 */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value);
}

/**
 * One field's worth of tidying.
 *
 * Control characters go, edge whitespace goes. The caller decides separately
 * what to do about newlines: they belong in a message and nowhere else, because
 * a subject line with a newline in it is two mail headers, which is how a
 * contact form becomes somebody else's relay.
 */
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

function tidy(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL_CHARACTERS, "").trim();
}

/**
 * A submitted form, checked.
 *
 * Newlines survive in the message and nowhere else. The subject becomes an
 * email header, and a header with a newline in it is two headers, which is how
 * a contact form turns into somebody else's mail relay.
 */
export function validateContact(form: FormData): Validated<ContactDraft> {
  const name = tidy(form.get("name")).replace(/[\r\n]+/g, " ");
  const email = tidy(form.get("email")).replace(/[\r\n]+/g, "");
  const subject = tidy(form.get("subject")).replace(/[\r\n]+/g, " ");
  const message = tidy(form.get("message"));

  if (!email) return { ok: false, error: "An email address, so there is somewhere to reply to." };
  if (email.length > EMAIL_MAX) return { ok: false, error: "That email address is too long." };
  if (!looksLikeEmail(email)) {
    return { ok: false, error: "That does not look like an email address." };
  }
  if (name.length > NAME_MAX) return { ok: false, error: `Keep the name under ${NAME_MAX} characters.` };
  if (subject.length > SUBJECT_MAX) {
    return { ok: false, error: `Keep the subject under ${SUBJECT_MAX} characters.` };
  }
  if (message.length < MESSAGE_MIN) {
    return { ok: false, error: "Say a little more than that, so the reply is worth reading." };
  }
  if (message.length > MESSAGE_MAX) {
    return { ok: false, error: `Keep the message under ${MESSAGE_MAX} characters.` };
  }

  return { ok: true, value: { name, email, subject, message } };
}

/**
 * A bot, probably.
 *
 * The form carries a field no human can see and no human will fill in. It is
 * not a CAPTCHA and it does not pretend to be: it costs nobody anything, it
 * stops the indiscriminate half of the problem, and the alternative is asking
 * every real person to identify a bicycle before they can report a bug.
 */
export function looksAutomated(form: FormData): boolean {
  return tidy(form.get("website")).length > 0;
}

/** The message, as it should read in an inbox. */
export function formatContactEmail(draft: ContactDraft): { subject: string; text: string } {
  const from = draft.name ? `${draft.name} <${draft.email}>` : draft.email;
  return {
    subject: draft.subject ? `Kamibase: ${draft.subject}` : "Kamibase: a message from the help form",
    text: [`From: ${from}`, "", draft.message, "", "—", "Sent from the Kamibase help form."].join(
      "\n",
    ),
  };
}
