import Link from "next/link";
import { getCurrentProfile } from "@/lib/social";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * The footer, as a map of the site.
 *
 * It used to be one line of attributions, which is a strange thing to put at
 * the bottom of every page: it is the credit due to other people's work, and
 * burying it in six point type under a crease pattern serves neither them nor
 * anybody looking for it. That has a page of its own now.
 *
 * What belongs here is what a footer is for. Somebody who has scrolled to the
 * end of a page has finished with it, and the useful thing to hand them is
 * everywhere else they could go.
 *
 * A server component, so the columns can tell the truth about whether there is
 * an account: offering "Your profile" to a signed-out visitor is the kind of
 * dead link that makes a sitemap worse than no sitemap.
 */
export async function SiteFooter() {
  const user = await getCurrentUser();
  const profile = user ? await getCurrentProfile() : null;

  return (
    <footer
      className="print-hidden mt-8"
      style={{ background: "var(--surface-raised)", borderTop: "1px solid var(--border)" }}
    >
      <div className="mx-auto max-w-[1600px] px-4 py-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
          <div className="lg:w-72 lg:shrink-0">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              <Mark />
              Kamibase
            </Link>
            <p className="mt-2 max-w-xs text-sm" style={{ color: "var(--text-muted)" }}>
              A centralized database of origami crease patterns.
            </p>
          </div>

          <nav
            aria-label="Site map"
            className="grid flex-1 grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4"
          >
            <Column title="Browse">
              <Item href="/explore">All patterns</Item>
              <Item href="/explore?sort=creases">Most creases</Item>
              <Item href="/explore?foldable=1">Flat-foldable</Item>
              {user && <Item href="/feed">Feed</Item>}
            </Column>

            <Column title="Create">
              <Item href="/edit">Draw a pattern</Item>
              <Item href="/upload">Upload a file</Item>
              <Item href="/upload">Scan a photo</Item>
            </Column>

            <Column title="Account">
              {user ? (
                <>
                  {profile && <Item href={`/u/${profile.handle}`}>Your profile</Item>}
                  <Item href="/settings/profile">Settings</Item>
                </>
              ) : (
                <>
                  <Item href="/login">Log in</Item>
                  <Item href="/signup">Create an account</Item>
                </>
              )}
            </Column>

            <Column title="Kamibase">
              <Item href="/about">About</Item>
              <Item href="/credits">Credits</Item>
            </Column>
          </nav>
        </div>

        <p
          className="mt-10 border-t pt-6 text-xs"
          style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}
        >
          Every pattern here is stored as geometry, not as a picture of one.
        </p>
      </div>
    </footer>
  );
}

function Column({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div>
      <h2
        className="mb-3 text-xs font-bold uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        {title}
      </h2>
      <ul className="space-y-2 text-sm">{children}</ul>
    </div>
  );
}

function Item({ href, children }: { readonly href: string; readonly children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="transition hover:opacity-60">
        {children}
      </Link>
    </li>
  );
}

/** The same folded square as the header's, at the same size. */
function Mark() {
  return (
    <span
      aria-hidden
      className="flex size-7 shrink-0 items-center justify-center rounded-lg"
      style={{ background: "var(--brand)" }}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" strokeLinecap="round">
        <path d="M4 4h16v16H4z" stroke="var(--ink)" strokeWidth="1.6" />
        <path d="M4 4l16 16M12 4v16M4 12h16" stroke="var(--ink)" strokeWidth="1.1" opacity="0.55" />
      </svg>
    </span>
  );
}
