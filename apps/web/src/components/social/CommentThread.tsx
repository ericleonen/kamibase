import Link from "next/link";
import {
  listComments,
  nameOf,
  relativeTime,
  type CommentTarget,
} from "@/lib/social";
import { SectionHeading } from "@/components/Section";
import { deleteCommentAction } from "@/lib/social/actions";
import { getCurrentUser } from "@/lib/supabase/server";
import { Avatar } from "./Avatar";
import { CommentForm } from "./CommentForm";
import { SocialNotice } from "./SocialNotice";

/**
 * A comment thread under a pattern or a fold.
 *
 * Oldest first, because this is a conversation about how to fold something and
 * conversations read forwards. Nothing here is ranked or collapsed: at the size
 * a thread on a crease pattern actually reaches, hiding replies behind a "show
 * more" costs more than it saves.
 */
export async function CommentThread({
  target,
  heading = "Comments",
  bare = false,
}: {
  readonly target: CommentTarget;
  readonly heading?: string;
  /**
   * Use the thread's own heading rather than the page's section chrome.
   *
   * A fold's page is a single subject with a conversation under it, and a
   * capitalised rule there would be chrome around nothing. A pattern's page is
   * five things stacked, and there the thread has to look like one of them.
   */
  readonly bare?: boolean;
}) {
  const [result, user] = await Promise.all([listComments(target), getCurrentUser()]);

  const targetFields =
    target.kind === "pattern"
      ? { patternId: target.patternId }
      : { foldId: target.foldId };

  return (
    <section
      className={`print-hidden ${bare ? "space-y-4" : "border-t pt-7"}`}
      style={bare ? undefined : { borderColor: "var(--border)" }}
    >
      {!bare && (
        <SectionHeading
          title={heading}
          {...(result.ok ? { count: result.data.length } : {})}
        />
      )}
      {bare && (
        <h2 className="text-lg font-semibold tracking-tight">
          {heading}
          {result.ok && result.data.length > 0 && (
            <span className="ml-2 text-sm font-normal" style={{ color: "var(--text-muted)" }}>
              {result.data.length}
            </span>
          )}
        </h2>
      )}

      <div className="space-y-4">
      {!result.ok ? (
        <SocialNotice reason={result.reason} message={result.message} />
      ) : result.data.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No comments yet.
        </p>
      ) : (
        <ul className="space-y-4">
          {result.data.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <Link href={`/u/${comment.author.handle}`} className="shrink-0">
                <Avatar profile={comment.author} size="md" />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <Link
                    href={`/u/${comment.author.handle}`}
                    className="text-sm font-semibold hover:underline"
                  >
                    {nameOf(comment.author)}
                  </Link>
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                    {relativeTime(comment.createdAt)}
                  </span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">
                  {comment.body}
                </p>
                {user?.id === comment.author.id && (
                  <form action={deleteCommentAction} className="mt-1">
                    <input type="hidden" name="commentId" value={comment.id} />
                    {target.kind === "pattern" ? (
                      <input type="hidden" name="patternId" value={target.patternId} />
                    ) : (
                      <input type="hidden" name="foldId" value={target.foldId} />
                    )}
                    <button
                      type="submit"
                      className="text-xs underline transition hover:opacity-70"
                      style={{ color: "var(--text-faint)" }}
                    >
                      Delete
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {result.ok &&
        (user ? (
          <CommentForm {...targetFields} />
        ) : (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            <Link href="/login" className="font-semibold underline">
              Log in
            </Link>{" "}
            to join the conversation.
          </p>
        ))}
      </div>
    </section>
  );
}
