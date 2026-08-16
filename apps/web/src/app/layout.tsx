import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { metadataSiteUrl } from "@/lib/site-url";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(metadataSiteUrl()),
  title: {
    default: "Kamibase: a home for crease patterns",
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
          className="print-hidden mx-auto max-w-[1600px] px-4 py-6 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          <p className="max-w-3xl">
            <Link href="/explore" className="underline">
              Explore
            </Link>{" "}
            ·{" "}
            <a
              className="underline"
              href="https://github.com/edemaine/fold"
              target="_blank"
              rel="noreferrer noopener"
            >
              FOLD
            </a>{" "}
            ·{" "}
            <a
              className="underline"
              href="https://origamisimulator.org/"
              target="_blank"
              rel="noreferrer noopener"
            >
              Origami Simulator
            </a>{" "}
            (MIT), by Amanda Ghassaei, Erik Demaine and Neil Gershenfeld
          </p>
        </footer>
      </body>
    </html>
  );
}
