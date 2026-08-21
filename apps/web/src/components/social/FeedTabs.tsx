"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type FeedTab = "following" | "discover";

const TABS: { readonly tab: FeedTab; readonly label: string; readonly href: string }[] = [
  { tab: "following", label: "Following", href: "/feed" },
  { tab: "discover", label: "Discover", href: "/feed?tab=discover" },
];

/**
 * Following ↔ Discover.
 *
 * One pill that slides, rather than two backgrounds that swap. The swap was
 * honest about what it was doing and told you nothing: a toggle whose two
 * states look like two unrelated screens leaves you working out which side you
 * are on. A thing that moves from one side to the other says it.
 *
 * It is a client component only so the pill can move on click instead of on
 * arrival. Fetching the other tab's folds takes a round trip, and a toggle that
 * waits for the server to agree before acknowledging the tap feels broken on
 * every connection slower than a desk.
 */
export function FeedTabs({ active }: { readonly active: FeedTab }) {
  const [chosen, setChosen] = useState<FeedTab | null>(null);
  const shown = chosen ?? active;

  // Once the navigation lands, the URL is the truth again, including when it
  // lands somewhere else: back, forward, or a redirect off this page.
  useEffect(() => setChosen(null), [active]);

  return (
    <nav
      className="relative grid grid-cols-2 rounded-full p-1"
      style={{ background: "var(--surface-sunken)" }}
    >
      {/*
       * The pill. One column wide, so `translateX(100%)` lands it exactly on
       * the second tab whatever the labels measure, and behind the text rather
       * than over it.
       */}
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{
          background: "var(--text)",
          transform: shown === "discover" ? "translateX(100%)" : "translateX(0)",
        }}
      />

      {TABS.map(({ tab, label, href }) => (
        <Link
          key={tab}
          href={href}
          onClick={() => setChosen(tab)}
          aria-current={shown === tab ? "page" : undefined}
          className="relative z-10 rounded-full px-4 py-1.5 text-center text-sm font-semibold transition-colors duration-300 motion-reduce:transition-none"
          style={{ color: shown === tab ? "var(--surface)" : "var(--text-muted)" }}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
