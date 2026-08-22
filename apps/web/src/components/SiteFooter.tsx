import Link from "next/link";

/**
 * The footer: four links, small, and out of the way.
 *
 * It has been a line of attributions, a four-column sitemap, and a sitemap with
 * the branding cut off it. Each version answered "what else is on this site?",
 * which is a question the header already answers for everything anyone
 * navigates to. What is left is the set of links that belong at the bottom of
 * a page precisely because they belong nowhere else: what this is, how to reach
 * a person, whose work it is built on, and the rules.
 *
 * No headings, because four links do not need to be filed under anything.
 */
const LINKS: readonly { readonly href: string; readonly label: string }[] = [
  { href: "/about", label: "About" },
  { href: "/help", label: "Help" },
  { href: "/credits", label: "Credits" },
  { href: "/terms", label: "Terms" },
];

export function SiteFooter() {
  return (
    <footer className="print-hidden mt-10" style={{ borderTop: "1px solid var(--border)" }}>
      <nav
        aria-label="Footer"
        className="mx-auto flex max-w-[1600px] flex-wrap justify-center gap-x-6 gap-y-2 px-4 py-8 text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        {LINKS.map(({ href, label }) => (
          <Link key={href} href={href} className="transition hover:opacity-60">
            {label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
