import { formatContactEmail, type ContactDraft } from "./validate";

/**
 * Getting a message from the help form into an inbox.
 *
 * Resend over its HTTP API rather than an SDK or SMTP. One `fetch` is the whole
 * integration, which means no dependency to keep current, nothing to bundle,
 * and no connection pooling to think about on a platform that may run this in a
 * function that lives for two hundred milliseconds.
 *
 * Everything is read from the environment at call time rather than at module
 * load, so a deployment that adds the key does not need a rebuild to start
 * delivering, and a preview build without one still boots.
 */

/** Where the form's messages land. */
function recipient(): string {
  return process.env.CONTACT_EMAIL ?? "ericleonen@gmail.com";
}

/**
 * Who they come from.
 *
 * Not the person who filled the form in: sending as them would be a forgery
 * that SPF and DMARC will bounce. Their address goes in `reply_to`, so hitting
 * reply does the obvious thing, and the body says who wrote it either way.
 * `onboarding@resend.dev` is Resend's own sender, which works without a
 * verified domain and only delivers to the account's own address — fine for
 * this, and the reason the real one is an environment variable.
 */
function sender(): string {
  return process.env.CONTACT_FROM ?? "Kamibase <onboarding@resend.dev>";
}

export function isContactConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export type SendResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export async function sendContactEmail(draft: ContactDraft): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: "unconfigured" };

  const { subject, text } = formatContactEmail(draft);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender(),
        to: [recipient()],
        reply_to: draft.email,
        subject,
        text,
      }),
      // A person is watching a spinner. Better to tell them it did not go than
      // to hold the request open while a provider decides.
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) return { ok: true };

    // The body is the provider's, so it goes to the console rather than to the
    // page: whoever runs this needs the real reason, and whoever filled the
    // form in needs a sentence they can act on.
    console.warn("[kamibase] the help form could not send:", response.status, await response.text());
    return { ok: false, reason: "rejected" };
  } catch (error: unknown) {
    console.warn("[kamibase] the help form could not send:", error);
    return { ok: false, reason: "unreachable" };
  }
}
