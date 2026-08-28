"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/social/types";
import type { CurrentUser } from "@/lib/supabase/server";

/** Deterministic initial for the avatar. */
function initial(user: CurrentUser): string {
  return (user.name[0] ?? user.email[0] ?? "?").toUpperCase();
}

export function UserMenu({
  user,
  profile,
  signOutAction,
}: {
  readonly user: CurrentUser;
  /**
   * Absent when the social tables have not been created yet. The menu still
   * works; it just shows the initial rather than a picture, and hides the
   * links that would lead nowhere.
   */
  readonly profile?: Profile;
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

  const close = (): void => setOpen(false);

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex size-9 items-center justify-center overflow-hidden rounded-full text-sm font-bold transition hover:opacity-85"
        style={{ background: "var(--brand)", color: "var(--text)" }}
        title={user.email}
      >
        {profile?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage origin
          <img src={profile.avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          initial(user)
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="kami-pop absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl p-1.5 text-sm"
          style={{
            transformOrigin: "top right",
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-card-hover)",
          }}
        >
          <div className="px-3 py-2">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
              {profile ? `@${profile.handle}` : user.email}
            </p>
          </div>
          <div className="my-1 h-px" style={{ background: "var(--border)" }} />

          {profile && (
            <Link
              href={`/u/${profile.handle}`}
              role="menuitem"
              className="block rounded-xl px-3 py-2 hover:opacity-70"
              onClick={close}
            >
              Your profile
            </Link>
          )}
          <Link
            href="/feed"
            role="menuitem"
            className="block rounded-xl px-3 py-2 hover:opacity-70"
            onClick={close}
          >
            Your feed
          </Link>
          {/* No "Explore" here. It is a permanent link in the header two
              inches to the left, and a menu that repeats the toolbar is a menu
              you have to read past. */}
          <Link
            href="/settings/profile"
            role="menuitem"
            className="block rounded-xl px-3 py-2 hover:opacity-70"
            onClick={close}
          >
            Settings
          </Link>

          <div className="my-1 h-px" style={{ background: "var(--border)" }} />
          {/* In red, because it is the one item here that undoes something. It
              sits under a rule and at the bottom, where every menu on the web
              keeps the way out, and the colour is what stops it reading as a
              fourth place to go. */}
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="w-full rounded-xl px-3 py-2 text-left font-semibold hover:opacity-70"
              style={{ color: "var(--danger)" }}
            >
              Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
