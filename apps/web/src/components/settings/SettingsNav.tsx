"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
 *
 * The same sliding pill as the feed's Following ↔ Discover, and for the same
 * reason: three backgrounds that swap tell you where you are only if you were
 * already watching, while a thing that travels from one tab to the next says
 * it. Equal columns, so `translateX` by whole multiples lands on each tab
 * whatever the labels measure — "Appearance" is half again as wide as
 * "Profile", and a pill sized to its own text would need measuring at runtime.
 *
 * A client component only so the pill can move on click rather than on arrival.
 * Settings pages read the session, so the navigation is a round trip, and a
 * toggle that waits for the server before acknowledging the tap feels broken on
 * anything slower than a desk.
 */
export function SettingsNav({ current }: { readonly current: string }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const shown = chosen ?? current;
  const index = Math.max(
    0,
    TABS.findIndex((tab) => tab.href === shown),
  );

  // Once the navigation lands the URL is the truth again, including when it
  // lands somewhere else: back, forward, or a redirect off this page.
  useEffect(() => setChosen(null), [current]);

  return (
    <nav
      aria-label="Settings"
      className="relative grid grid-cols-3 rounded-full p-1"
      style={{ background: "var(--surface-sunken)" }}
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc(33.333%-0.1667rem)] rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{
          background: "var(--text)",
          transform: `translateX(${index * 100}%)`,
        }}
      />

      {TABS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setChosen(href)}
          aria-current={shown === href ? "page" : undefined}
          className="relative z-10 rounded-full px-4 py-1.5 text-center text-sm font-semibold transition-colors duration-300 motion-reduce:transition-none"
          style={{ color: shown === href ? "var(--surface)" : "var(--text-muted)" }}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
