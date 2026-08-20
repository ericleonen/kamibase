import type { Metadata } from "next";
import Link from "next/link";
import { patterns } from "@/lib/patterns";

export const metadata: Metadata = {
  title: "Credits",
  description:
    "The people and projects Kamibase is built on: Origami Simulator, the " +
    "FOLD format, and the designers whose patterns are in the library.",
};

/**
 * Attribution, given room.
 *
 * This was a line of six point type at the bottom of every page, which is a
 * poor way to credit work the site could not exist without. Nobody reads a
 * footer, and the people named in that one wrote the simulator the 3D fold
 * view is, and the format every pattern here is stored in.
 */
export default async function CreditsPage() {
  const all = await patterns.list();

  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Credits</h1>
      <p className="mt-3 text-base" style={{ color: "var(--text-muted)" }}>
        Kamibase is mostly other people&rsquo;s work, arranged.
      </p>

      <div className="mt-10 space-y-8">
        <Entry
          title="Origami Simulator"
          by="Amanda Ghassaei, Erik Demaine and Neil Gershenfeld"
          href="https://origamisimulator.org/"
          licence="MIT"
        >
          Every 3D fold on this site is Origami Simulator, running in a frame
          and served from our own origin so it does not depend on anyone
          else&rsquo;s uptime. Its JavaScript is unmodified. Kamibase hides the
          simulator&rsquo;s own controls and drives it through the same message
          interface it already published, which is the only reason embedding it
          was a day of work rather than a year of it.
        </Entry>

        <Entry
          title="The FOLD format"
          by="Erik Demaine, Jason Ku and Robert Lang"
          href="https://github.com/edemaine/fold"
          licence="MIT"
        >
          FOLD is the interchange format for folded structures, and it is what
          made a database of crease patterns a tractable idea rather than a
          standards argument. Kamibase&rsquo;s own <code>.kami</code> files are a
          strict profile of it: every one is a valid FOLD document, and every
          pattern here exports as plain FOLD.
        </Entry>

        <Entry
          title={`The ${all.length} seeded patterns`}
          by="Kōryō Miura, and traditional"
          licence="Public domain"
        >
          The library starts with traditional bases, which belong to everybody,
          and with published mathematical and engineering patterns, of which the
          Miura fold is the best known. Nothing here is a living
          designer&rsquo;s competition model. Patterns are added by their
          designers or with permission, not scraped.
        </Entry>

        <Entry title="Open source" by="a great many people" licence="Various">
          The site runs on Next.js and React, is styled with Tailwind CSS, keeps
          accounts and folds in Supabase, and draws its icons from Lucide. The
          geometry, the validation and the photo pipeline are Kamibase&rsquo;s
          own, written in TypeScript with no native dependencies, which is why
          reading a photograph of a creased sheet happens in your browser and
          nothing is uploaded to do it.
        </Entry>
      </div>

      <p className="mt-10 text-sm" style={{ color: "var(--text-muted)" }}>
        Something credited wrongly, or not credited at all?{" "}
        <Link href="/about" className="font-semibold underline" style={{ color: "var(--text)" }}>
          Read why this exists
        </Link>
        , then tell us and it gets fixed.
      </p>
    </div>
  );
}

function Entry({
  title,
  by,
  href,
  licence,
  children,
}: {
  readonly title: string;
  readonly by: string;
  /** Omitted for entries that are not one project with one home page. */
  readonly href?: string;
  readonly licence: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-black tracking-tight">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer noopener" className="underline">
            {title}
          </a>
        ) : (
          title
        )}
      </h2>
      <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
        {by} · {licence}
      </p>
      <p className="mt-2 text-base leading-relaxed">{children}</p>
    </section>
  );
}
