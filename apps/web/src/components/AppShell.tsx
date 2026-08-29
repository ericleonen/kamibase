"use client";

import { usePathname } from "next/navigation";

/**
 * Routes that take the whole screen: the editor, wherever it is entered from.
 *
 * `/edit`, `/edit/import` and `/p/<id>/edit` are three doors into one tool, and
 * a tool that owns the viewport cannot have a site header above it and a
 * footer below it. The canvas would be whatever is left over, and the page
 * would scroll underneath a surface whose whole job is to pan.
 */
const FULLSCREEN = [/^\/edit(\/.*)?$/, /^\/p\/[^/]+\/edit\/?$/];

export function AppShell({
  header,
  footer,
  children,
}: {
  readonly header: React.ReactNode;
  readonly footer: React.ReactNode;
  readonly children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  if (FULLSCREEN.some((route) => route.test(pathname))) return <>{children}</>;

  return (
    <>
      {header}
      <main className="print-plain mx-auto max-w-[1600px] px-4 py-6">{children}</main>
      {footer}
    </>
  );
}
