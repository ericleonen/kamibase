import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { SiteFooter } from "@/components/SiteFooter";
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
        {/*
         * The chrome is passed in rather than rendered here, so the shell can
         * drop it for the editor without any of it becoming a client
         * component: `SiteHeader` still runs on the server and reads the
         * session, it just does so as a prop.
         */}
        <AppShell header={<SiteHeader />} footer={<SiteFooter />}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
