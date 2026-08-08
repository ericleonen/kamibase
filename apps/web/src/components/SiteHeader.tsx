import Link from "next/link";
import { Plus } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { getCurrentProfile } from "@/lib/social";
import { getCurrentUser } from "@/lib/supabase/server";
import { UserMenu } from "./UserMenu";

/** The folded-square mark. Same geometry language as the patterns themselves. */
function Logo() {
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-xl"
      style={{ background: "var(--brand)" }}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" strokeLinecap="round">
        <path d="M4 4h16v16H4z" stroke="var(--ink)" strokeWidth="1.6" />
        <path d="M4 4l16 16M12 4v16M4 12h16" stroke="var(--ink)" strokeWidth="1.1" opacity="0.55" />
      </svg>
    </span>
  );
}

export async function SiteHeader({ query }: { readonly query?: string }) {
  const user = await getCurrentUser();
  // Null when the social tables are not set up yet, which the menu handles by
  // falling back to the initial from the account's name.
  const profile = user ? await getCurrentProfile() : null;

  return (
    <header
      className="print-hidden sticky top-0 z-30 backdrop-blur"
      style={{
        background: "color-mix(in srgb, var(--surface) 88%, transparent)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <nav className="mx-auto flex max-w-[1600px] items-center gap-2 px-4 py-2.5 sm:gap-3">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <Logo />
          <span className="hidden sm:inline">Kamibase</span>
        </Link>

        <Link
          href="/explore"
          className="hidden rounded-full px-3.5 py-2 text-sm font-semibold transition hover:opacity-70 sm:block"
        >
          Explore
        </Link>

        <Link
          href="/feed"
          className="hidden rounded-full px-3.5 py-2 text-sm font-semibold transition hover:opacity-70 md:block"
        >
          Feed
        </Link>

        {/*
         * The editor's standalone entry point. Icon-only on phones, where the
         * search field needs every pixel it can get; labelled from `sm` up.
         */}
        <Link
          href="/edit"
          title="Draw a new crease pattern"
          className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition hover:opacity-70"
          style={{ border: "1px solid var(--border-strong)" }}
        >
          <Plus className="size-4" aria-hidden />
          <span className="hidden sm:inline">New</span>
          <span className="sr-only sm:hidden">Draw a new crease pattern</span>
        </Link>

        {/* A plain GET form, so search works with JavaScript disabled. */}
        <form action="/explore" className="min-w-0 flex-1">
          <label className="sr-only" htmlFor="site-search">
            Search patterns
          </label>
          <div
            className="flex items-center gap-2 rounded-full px-4 py-2"
            style={{ background: "var(--surface-sunken)" }}
          >
            <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="7" stroke="var(--text-muted)" strokeWidth="2" />
              <path d="M16.5 16.5L21 21" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              id="site-search"
              name="q"
              type="search"
              defaultValue={query ?? ""}
              placeholder="Search bases, tessellations, designers…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[color:var(--text-faint)]"
            />
          </div>
        </form>

        {user ? (
          <UserMenu
            user={user}
            signOutAction={signOut}
            {...(profile === null ? {} : { profile })}
          />
        ) : (
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href="/login"
              className="rounded-full px-3.5 py-2 text-sm font-semibold transition hover:opacity-70"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full px-3.5 py-2 text-sm font-semibold transition hover:opacity-85"
              style={{ background: "var(--brand)", color: "var(--ink)" }}
            >
              Sign up
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
