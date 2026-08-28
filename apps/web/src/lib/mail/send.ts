/**
 * Getting an email out of Kamibase.
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

export interface Email {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  /** Where a reply should go, when that is not the sender. */
  readonly replyTo?: string;
}

/**
 * Who mail comes from.
 *
 * `onboarding@resend.dev` is Resend's own sender, which works without a
 * verified domain but only delivers to the Resend account's own address. Fine
 * to start with, and the reason the real one is an environment variable.
 */
function sender(): string {
  return process.env.CONTACT_FROM ?? "Kamibase <onboarding@resend.dev>";
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export type SendResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export async function sendEmail(email: Email): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: "unconfigured" };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender(),
        to: [email.to],
        subject: email.subject,
        text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
      // Somebody is watching a spinner. Better to tell them it did not go than
      // to hold the request open while a provider decides.
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) return { ok: true };

    // The body is the provider's, so it goes to the console rather than to the
    // page: whoever runs this needs the real reason, and whoever is waiting
    // needs a sentence they can act on.
    console.warn("[kamibase] an email could not be sent:", response.status, await response.text());
    return { ok: false, reason: "rejected" };
  } catch (error: unknown) {
    console.warn("[kamibase] an email could not be sent:", error);
    return { ok: false, reason: "unreachable" };
  }
}
