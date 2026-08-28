import { isMailConfigured, sendEmail, type SendResult } from "@/lib/mail/send";
import { formatContactEmail, type ContactDraft } from "./validate";

/** Where the help form's messages land. */
function recipient(): string {
  return process.env.CONTACT_EMAIL ?? "ericleonen@gmail.com";
}

export function isContactConfigured(): boolean {
  return isMailConfigured();
}

export type { SendResult };

/**
 * A message from the help form, on its way to an inbox.
 *
 * The sender's own address goes in `reply_to`, never in `from`: sending as them
 * would be a forgery that SPF and DMARC exist to bounce. The body says who
 * wrote it either way.
 */
export async function sendContactEmail(draft: ContactDraft): Promise<SendResult> {
  const { subject, text } = formatContactEmail(draft);
  return sendEmail({ to: recipient(), subject, text, replyTo: draft.email });
}
