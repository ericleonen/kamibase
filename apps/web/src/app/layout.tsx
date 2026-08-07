import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000",
  ),
  title: {
    default: "Kamibase — a home for crease patterns",
    template: "%s · Kamibase",
  },
  description:
    "Share, search, fold and simulate crease patterns. A crease pattern is " +
    "structured data, not a picture.",
};

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header
          className="print-hidden sticky top-0 z-10 border-b backdrop-blur"
          style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface) 85%, transparent)" }}
        >
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Kamibase
            </Link>
            <Link
              href="/explore"
              className="text-sm hover:underline"
              style={{ color: "var(--text-muted)" }}
            >
              Explore
            </Link>
            <span
              className="ml-auto rounded-full border px-2.5 py-0.5 text-xs"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              Phase 1 · viewer + simulator
            </span>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
        <footer
          className="print-hidden mx-auto max-w-6xl px-5 py-10 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          <p>
            Crease patterns are stored as{" "}
            <code className="font-mono text-xs">.kami</code>, a strict profile of{" "}
            <a
              className="underline"
              href="https://github.com/edemaine/fold"
              target="_blank"
              rel="noreferrer noopener"
            >
              FOLD
            </a>
            . 3D folding by{" "}
            <a
              className="underline"
              href="https://origamisimulator.org/"
              target="_blank"
              rel="noreferrer noopener"
            >
              Origami Simulator
            </a>{" "}
            (MIT), Amanda Ghassaei, Erik Demaine and Neil Gershenfeld.
          </p>
        </footer>
      </body>
    </html>
  );
}
