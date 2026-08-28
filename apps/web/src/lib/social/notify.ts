import { isMailConfigured, sendEmail } from "@/lib/mail/send";
import { metadataSiteUrl } from "@/lib/site-url";
import { adminClient } from "@/lib/supabase/admin";
import { getAccountSettings } from "./account";
import { nameOf } from "./format";
import type { Profile } from "./types";

/**
 * The three emails Kamibase sends about other people.
 *
 * Somebody followed you, somebody you follow posted a fold, somebody commented
 * on your work. That is the whole list, and it is short on purpose: an account
 * that emails about everything gets filtered, and then it cannot tell you the
 * one thing you did want to hear.
 *
 * Every one of them is best-effort and none of them can fail a write. A follow
 * that went through is a follow that went through, whether or not a mail
 * provider was reachable a moment later, so the send is fired off and its result
 * is logged rather than surfaced. The alternative is a "Follow" button that
 * reports failure because an SMTP host is down.
 *
 * Addresses live in `auth.users`, which the anon key cannot read, so this is
 * the one part of the social layer that needs the service role. Without that
 * key configured, nothing is sent and nothing breaks: see `supabase/admin`.
 */

/** Where a link in an email should point. */
function url(path: string): string {
  return new URL(path, metadataSiteUrl()).toString();
}

const SIGNATURE = (settings: string) =>
  ["", "—", `Turn this off: ${url(settings)}`].join("\n");

/**
 * An account's email address, if we are allowed to look it up.
 *
 * Returns null when the service role key is absent, which is also the signal
 * that this deployment has not opted into sending mail about other people.
 */
async function addressOf(userId: string): Promise<string | null> {
  const admin = adminClient();
  if (!admin) return null;
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  return data.user.email;
}

/** One notification, subject to the recipient's own preferences. */
async function notify(
  recipientId: string,
  wants: (settings: Awaited<ReturnType<typeof getAccountSettings>>) => boolean,
  compose: () => { subject: string; text: string },
): Promise<void> {
  if (!isMailConfigured()) return;
  const settings = await getAccountSettings(recipientId);
  if (!wants(settings)) return;
  const to = await addressOf(recipientId);
  if (!to) return;
  const { subject, text } = compose();
  await sendEmail({ to, subject, text });
}

/** Fire and forget: a notification must never fail the thing it is about. */
function detach(work: Promise<unknown>): void {
  void work.catch((error: unknown) => {
    console.warn("[kamibase] a notification could not be sent:", error);
  });
}

export function notifyFollowed(target: Profile, follower: Profile): void {
  detach(
    notify(
      target.id,
      (settings) => settings.notifyFollows,
      () => ({
        subject: `${nameOf(follower)} followed you on Kamibase`,
        text: [
          `${nameOf(follower)} (@${follower.handle}) is now following you.`,
          "",
          url(`/u/${follower.handle}`),
          SIGNATURE("/settings/account"),
        ].join("\n"),
      }),
    ),
  );
}

export function notifyNewFold(
  followerIds: readonly string[],
  author: Profile,
  foldId: string,
  patternTitle: string,
): void {
  /*
   * One email each, in sequence, capped.
   *
   * Sequential because a provider will rate-limit a burst and the fan-out is
   * small; capped because an account with ten thousand followers should not
   * turn one button press into ten thousand HTTP requests inside a server
   * action. Past the cap this needs a queue, and a queue is a different piece
   * of work than this one.
   */
  detach(
    (async () => {
      for (const id of followerIds.slice(0, FOLD_NOTIFICATION_CAP)) {
        await notify(
          id,
          (settings) => settings.notifyFolds,
          () => ({
            subject: `${nameOf(author)} folded ${patternTitle}`,
            text: [
              `${nameOf(author)} (@${author.handle}) posted a new fold of ${patternTitle}.`,
              "",
              url(`/f/${foldId}`),
              SIGNATURE("/settings/account"),
            ].join("\n"),
          }),
        );
      }
    })(),
  );
}

export const FOLD_NOTIFICATION_CAP = 200;

export function notifyComment(
  recipientId: string,
  author: Profile,
  where: string,
  href: string,
  body: string,
): void {
  if (recipientId === author.id) return; // Nobody needs telling they typed.
  detach(
    notify(
      recipientId,
      (settings) => settings.notifyComments,
      () => ({
        subject: `${nameOf(author)} commented on ${where}`,
        text: [
          `${nameOf(author)} (@${author.handle}) wrote:`,
          "",
          body.length > 400 ? `${body.slice(0, 400)}…` : body,
          "",
          url(href),
          SIGNATURE("/settings/account"),
        ].join("\n"),
      }),
    ),
  );
}
