import Link from "next/link";
import type { SocialFailure, SocialResult } from "@/lib/social";

/**
 * What to show where folds or comments would be, when they cannot load.
 *
 * A deploy with no Supabase keys and a deploy whose SQL has not been run are
 * both *unfinished* rather than broken, and both are states the person reading
 * the page can do something about. So they get a quiet setup note rather than
 * an error, and the rest of the page carries on as normal.
 */
export function SocialNotice({
  reason,
  message,
  tone = "quiet",
}: {
  readonly reason: SocialFailure;
  readonly message: string;
  readonly tone?: "quiet" | "loud";
}) {
  const setup = reason === "unconfigured" || reason === "not-migrated";

  return (
    <p
      className="rounded-xl p-3 text-sm"
      role={tone === "loud" ? "alert" : "status"}
      style={{
        background: setup ? "var(--surface-sunken)" : "var(--brand-soft)",
        color: "var(--text-muted)",
      }}
    >
      {message}
      {reason === "unconfigured" && (
        <>
          {" "}
          Everything else on Kamibase works without it:{" "}
          <Link href="/explore" className="underline">
            browse the patterns
          </Link>
          .
        </>
      )}
    </p>
  );
}

/** Render a failed result as a notice, or nothing at all when it succeeded. */
export function SocialResultNotice<T>({ result }: { readonly result: SocialResult<T> }) {
  if (result.ok) return null;
  return <SocialNotice reason={result.reason} message={result.message} />;
}
