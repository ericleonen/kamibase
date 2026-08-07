"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CurrentUser } from "@/lib/supabase/server";

/** Deterministic initial for the avatar. */
function initial(user: CurrentUser): string {
  return (user.name[0] ?? user.email[0] ?? "?").toUpperCase();
}

export function UserMenu({
  user,
  signOutAction,
}: {
  readonly user: CurrentUser;
  readonly signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex size-9 items-center justify-center rounded-full text-sm font-bold transition hover:opacity-85"
        style={{ background: "var(--brand)", color: "var(--text)" }}
        title={user.email}
      >
        {initial(user)}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl p-1.5 text-sm"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-card-hover)",
          }}
        >
          <div className="px-3 py-2">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
              {user.email}
            </p>
          </div>
          <div className="my-1 h-px" style={{ background: "var(--border)" }} />
          <Link
            href="/explore"
            role="menuitem"
            className="block rounded-xl px-3 py-2 hover:opacity-70"
            onClick={() => setOpen(false)}
          >
            Explore patterns
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="w-full rounded-xl px-3 py-2 text-left hover:opacity-70"
            >
              Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
