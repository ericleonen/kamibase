import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/ContactForm";
import { isContactConfigured } from "@/lib/contact/send";

export const metadata: Metadata = {
  title: "Help",
  description: "Something broken, something missing, or something to say. Write in.",
};

/**
 * Rendered per request, for one line of it.
 *
 * `isContactConfigured()` reads an environment variable, and a prerendered page
 * would freeze the answer at build time: add the mail key to a running
 * deployment and the page would go on telling everybody the form does not
 * deliver until something happened to rebuild it. Nothing else here is dynamic,
 * and the page is four paragraphs and a form.
 */
export const dynamic = "force-dynamic";

/**
 * Where to write.
 *
 * Kamibase is one person's project, so this is not a support portal and does
 * not pretend to be one: no ticket numbers, no categories, no promise about
 * response times that a single inbox cannot keep. A form, and an honest note
 * about who is on the other end of it.
 */
export default function HelpPage() {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="text-3xl font-black tracking-tight text-balance sm:text-4xl">Help</h1>

      <p className="mt-4 text-base leading-relaxed" style={{ color: "var(--text-muted)" }}>
        A pattern that will not open, a fold that will not solve, a designer
        credited wrongly, a feature that should exist. It all goes to the same
        place, which is one person&rsquo;s inbox, so say what happened and what
        you expected and there will be a reply.
      </p>

      <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
        If it is a question about what Kamibase is for, <Link href="/about" className="font-semibold underline">the about page</Link>{" "}
        may already answer it, and the work this site is built on is listed in{" "}
        <Link href="/credits" className="font-semibold underline">the credits</Link>.
      </p>

      <div className="mt-8">
        <ContactForm configured={isContactConfigured()} />
      </div>
    </div>
  );
}
