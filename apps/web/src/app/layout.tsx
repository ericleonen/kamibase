import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
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
  /* Light-only, so a visitor whose OS is dark still gets light form controls
   * and scrollbars. See the note in globals.css. */
  other: { "color-scheme": "light" },
};

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-[1600px] px-4 py-6">{children}</main>
        <footer
          className="print-hidden mx-auto max-w-[1600px] px-4 py-10 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          <p className="max-w-3xl">
            Patterns are stored as <code className="font-mono">.kami</code>, a
            strict profile of{" "}
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
            (MIT) — Amanda Ghassaei, Erik Demaine and Neil Gershenfeld. Crease
            colours follow the Origami Simulator convention.
          </p>
          <p className="mt-3">
            <Link href="/explore" className="underline">
              Explore
            </Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
