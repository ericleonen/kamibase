import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms",
  description: "What you can expect from Kamibase, and what it expects from you.",
};

/**
 * Terms of use.
 *
 * Written to be read, which for a site this size means plain sentences and no
 * defined terms in capital letters. It says what the site does with what you
 * put in it, whose work the patterns are, and what happens when something
 * breaks. It is not a lawyer's document and does not pretend to be one; a
 * project that grows into needing one should get one.
 */
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="text-3xl font-black tracking-tight text-balance sm:text-4xl">Terms of use</h1>
      <p className="mt-3 text-sm" style={{ color: "var(--text-faint)" }}>
        Last updated 22 August 2026
      </p>

      <div className="mt-8 space-y-8 text-base leading-relaxed">
        <Section title="The short version">
          <p>
            Kamibase is a library of origami crease patterns. Use it, fold from
            it, download from it. Do not pass off other people&rsquo;s designs as
            your own, do not upload things you have no right to upload, and do
            not expect a free site run by one person to be there forever without
            interruption.
          </p>
        </Section>

        <Section title="Designs belong to their designers">
          <p>
            A crease pattern is somebody&rsquo;s work. Having the geometry in a
            file does not transfer any right to it: the licence shown on a
            pattern&rsquo;s page is the licence you have, and where a pattern is
            here by permission, that permission is for Kamibase rather than for
            everyone who downloads it.
          </p>
          <p>
            If a design of yours is here and you would rather it were not, or is
            credited wrongly, write in through{" "}
            <Link href="/help" className="font-semibold underline">
              the help page
            </Link>{" "}
            and it will be taken down or corrected. No process, no form to fill
            in twice.
          </p>
        </Section>

        <Section title="What you upload">
          <p>
            You keep everything you upload. Posting a pattern, a photograph of a
            fold or a comment gives Kamibase permission to store it and show it
            to the people the site shows it to, and nothing else — it is not
            sold, not licensed on, and not used to train anything.
          </p>
          <p>
            Upload only what is yours to upload, or what its owner has said you
            may. Anything else can be removed without notice, along with the
            account that posted it.
          </p>
        </Section>

        <Section title="Accounts and behaviour">
          <p>
            An account is free and not required for most of the site. Keep your
            password to yourself; you are responsible for what happens under your
            account.
          </p>
          <p>
            The usual things are not allowed: harassment, impersonation,
            scraping the site at a rate that costs somebody money, and using it
            to distribute anything unlawful. Accounts doing any of that get
            closed.
          </p>
        </Section>

        <Section title="No warranty, and no promises about uptime">
          <p>
            Kamibase is provided as it is. The validation, the flat-foldability
            checks and the 3D simulation are useful and are sometimes wrong: a
            pattern that passes every check can still fail in paper, and one that
            fails a check can still be a perfectly good design. Fold accordingly.
          </p>
          <p>
            The site may be slow, down, or changed. Features can disappear.
            Nothing here is a service you have paid for, and to the extent the
            law allows, no liability is accepted for what you lose by relying on
            it. Export anything you would be sorry to lose — every pattern
            downloads as FOLD, SVG or OPX, and the editor exports the same.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            These terms will change as the site does. The date at the top is when
            they last did, and continuing to use Kamibase after that is how you
            accept the current version. Anything that materially changes what
            happens to your work will be said plainly rather than buried in a
            revision.
          </p>
        </Section>

        <Section title="Getting in touch">
          <p>
            Questions about any of this, takedown requests, or anything else go
            through{" "}
            <Link href="/help" className="font-semibold underline">
              the help page
            </Link>
            .
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
