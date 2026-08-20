import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why Kamibase exists: crease patterns are scattered across dead links, " +
    "screenshots and one person's hard drive, and they are data.",
};

/**
 * Why the site exists.
 *
 * First person and specific, because the honest answer to "why does this
 * exist" is that somebody went looking for something and could not find it.
 * A mission statement written in the third person would say less and take
 * longer to say it.
 */
export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="text-3xl font-black tracking-tight text-balance sm:text-4xl">
        Crease patterns deserve better than a dead link
      </h1>

      <div className="mt-8 space-y-5 text-base leading-relaxed">
        <p>
          I have spent more time looking for crease patterns than folding them.
          Not because there are none. Because they are everywhere, and nowhere
          in particular.
        </p>

        <p>
          The pattern you want is a JPEG on a blog that has not been updated in
          nine years. It is an attachment on a forum thread where the host went
          under and left a row of broken image icons behind. It is a photograph
          of a laptop screen. It is in someone&rsquo;s Google Drive, shared with
          a link that a friend of a friend once had. It is on a Flickr account
          that is now private, or gone, and the only trace left is a
          three-hundred pixel thumbnail in a search result.
        </p>

        <p>
          When you do find one, it is a picture. So you print it, and it is the
          wrong scale, and the grid does not land on anything. You squint at a
          line that is either dark red or dark blue and decide, from the way the
          rest of the pattern behaves, that it must be a mountain. You count
          divisions off a blurry edge. You have no way to check whether what you
          are looking at even folds flat until you have folded it, which is the
          expensive way to find out that a scan lost a crease.
        </p>

        <p>
          None of this is anyone&rsquo;s fault. Designers put their work out on
          whatever was easy at the time, and what was easy at the time keeps
          shutting down. The formats that do carry real geometry, FOLD and{" "}
          <code>.cp</code> and ORIPA files, mostly sit in folders next to the
          programs that made them. There is no shortage of good work. There is
          just no shelf to keep it on.
        </p>

        <p>
          The strange part is that a crease pattern is not really a picture at
          all. It is a set of line segments, each with an assignment, on a
          square. That is a small amount of structured data. You can validate
          it, search it, scale it, fold it in a simulator, and convert it
          between every format anyone uses, and none of that is possible once it
          has been flattened into pixels.
        </p>

        <h2 className="pt-4 text-xl font-black tracking-tight">What this is for</h2>

        <p>
          Kamibase is an attempt at the shelf. One place where crease patterns
          live as geometry rather than as screenshots, where every pattern has a
          stable address, where you can search by what a pattern <em>is</em>{" "}
          rather than by what someone happened to title the image, and where a
          download gives you a file your software can open instead of something
          to print and squint at.
        </p>

        <p>
          It is early, and it is small. The library is seeded with traditional
          bases and published mathematical patterns while the rest is built.
          But that is the goal, and it is the only goal: a centralized database
          of origami crease patterns, so that the next person looking for one
          spends their time folding.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-2.5">
        <Link
          href="/explore"
          className="rounded-full px-5 py-2.5 text-sm font-bold transition hover:opacity-85"
          style={{ background: "var(--brand)", color: "var(--ink)" }}
        >
          Browse the library
        </Link>
        <Link
          href="/upload"
          className="rounded-full px-5 py-2.5 text-sm font-bold transition hover:opacity-70"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border-strong)",
          }}
        >
          Add a pattern
        </Link>
      </div>
    </div>
  );
}
