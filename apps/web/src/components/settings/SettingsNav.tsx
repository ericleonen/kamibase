import Link from "next/link";

const TABS: readonly { readonly href: string; readonly label: string }[] = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/account", label: "Account" },
  { href: "/settings/appearance", label: "Appearance" },
];

/**
 * Three settings pages, and a row saying so.
 *
 * Split by who the setting is about rather than by how it is stored. Profile is
 * what other people see. Account is the machinery: the address you sign in
 * with, who may see your work, what lands in your inbox, and the way out.
 * Appearance is about this browser and nothing else, which is why it is the one
 * page here that works signed out.
 */
export function SettingsNav({ current }: { readonly current: string }) {
  return (
    <nav
      aria-label="Settings"
      className="flex flex-wrap gap-1 rounded-full p-1"
      style={{ background: "var(--surface-sunken)" }}
    >
      {TABS.map(({ href, label }) => {
        const active = href === current;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="rounded-full px-4 py-1.5 text-sm font-semibold transition hover:opacity-80"
            style={
              active
                ? { background: "var(--text)", color: "var(--surface)" }
                : { color: "var(--text-muted)" }
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
