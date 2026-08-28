import Link from "next/link";
import { KamiMark } from "@/components/KamiMark";
import { SearchField } from "@/components/SearchField";
import { signOut } from "@/app/auth/actions";
import { getCurrentProfile } from "@/lib/social";
import { getCurrentUser } from "@/lib/supabase/server";
import { NewMenu } from "./NewMenu";
import { UserMenu } from "./UserMenu";

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
          <KamiMark className="size-8 shrink-0" />
          <span className="hidden sm:inline">Kamibase</span>
        </Link>

        <Link
          href="/explore"
          className="hidden rounded-full px-3.5 py-2 text-sm font-semibold transition hover:opacity-70 sm:block"
        >
          Explore
        </Link>

        {/* A feed of the people you follow is nobody's feed until you have an
            account, so it is not offered until you do. */}
        {user && (
          <Link
            href="/feed"
            className="hidden rounded-full px-3.5 py-2 text-sm font-semibold transition hover:opacity-70 md:block"
          >
            Feed
          </Link>
        )}

        {/* Bring a file or start blank. Either way the editor is the next screen. */}
        <NewMenu signedIn={user !== null} />

        {/* Still a plain GET form inside, so search works with JavaScript
            disabled; see SearchField for what JavaScript adds. */}
        <SearchField query={query ?? ""} />

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
