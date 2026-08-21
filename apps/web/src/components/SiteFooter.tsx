import Link from "next/link";
import { getCurrentProfile } from "@/lib/social";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * The footer: links, and the headers they need to be scannable. Nothing else.
 *
 * It used to be one line of attributions, then it was a full sitemap with the
 * mark, the tagline and a closing line about geometry underneath. Both were the
 * wrong size. Somebody who has scrolled to the end of a page has finished with
 * it, and the useful thing to hand them is somewhere else to go, not a second
 * copy of the header's branding and a sentence about how the site works.
 *
 * A server component, so the columns can tell the truth about whether there is
 * an account: offering "Your profile" to a signed-out visitor is the kind of
 * dead link that makes a list of links worse than no list at all.
 */
export async function SiteFooter() {
  const user = await getCurrentUser();
  const profile = user ? await getCurrentProfile() : null;

  return (
    <footer
      className="print-hidden mt-8"
      style={{ background: "var(--surface-raised)", borderTop: "1px solid var(--border)" }}
    >
      <nav
        aria-label="Footer"
        className="mx-auto grid max-w-[1600px] grid-cols-2 gap-x-6 gap-y-8 px-4 py-10 sm:grid-cols-4"
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
          <Item href="/scan">Scan a photo</Item>
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
