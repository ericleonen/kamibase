/**
 * Where this deployment lives, from the server's point of view.
 *
 * Two things need an absolute origin and neither can guess one: the
 * `emailRedirectTo` on a confirmation email, and `metadataBase` for Open Graph
 * tags. Getting it wrong is quiet and annoying, because a signup confirmation
 * link that points at `localhost:3000` looks fine in the dashboard and is
 * useless in somebody's inbox.
 *
 * Order of preference:
 *
 * 1. `NEXT_PUBLIC_SITE_URL`, if you set it. An explicit answer always wins,
 *    and it is the only option that survives a custom domain.
 * 2. On a Vercel *production* deployment, the project's stable production
 *    domain. Vercel exposes this as a system variable, so production links
 *    point at `kamibase-web.vercel.app` rather than at whichever
 *    deployment-specific hostname the request happened to arrive on.
 * 3. The request's own host, which is right for previews and for local
 *    development.
 *
 * Whatever comes out of here still has to be in Supabase's **Redirect URLs**
 * allowlist. Supabase does not error on a redirect it does not recognise; it
 * quietly substitutes the project's Site URL, which is `http://localhost:3000`
 * until somebody changes it. That single behaviour is behind almost every
 * "why does my confirmation email point at localhost" report.
 */

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * The origin this deployment knows about without looking at the request, or
 * `null` if it has to ask.
 */
export function configuredSiteUrl(): string | null {
  const explicit = process.env["NEXT_PUBLIC_SITE_URL"];
  if (explicit && explicit.trim() !== "") {
    const trimmed = withoutTrailingSlash(explicit.trim());
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }

  // Only for production. On a preview, the production domain would be the
  // wrong answer: a confirmation email from a preview branch should come back
  // to that preview, not to the live site.
  if (process.env["VERCEL_ENV"] === "production") {
    const production = process.env["VERCEL_PROJECT_PRODUCTION_URL"];
    if (production && production.trim() !== "") {
      return `https://${withoutTrailingSlash(production.trim())}`;
    }
  }

  return null;
}

/**
 * An absolute origin for `metadataBase`, which is read at module scope and so
 * cannot wait for a request. Falls back to this deployment's own hostname
 * before giving up and assuming local development.
 */
export function metadataSiteUrl(): string {
  const configured = configuredSiteUrl();
  if (configured) return configured;

  const deployment = process.env["VERCEL_URL"];
  if (deployment && deployment.trim() !== "") {
    return `https://${withoutTrailingSlash(deployment.trim())}`;
  }

  return "http://localhost:3000";
}

/**
 * The origin to send Supabase, given the headers of the request in hand.
 *
 * `host` is attacker-controlled in general, which is why it is the last
 * resort rather than the first: on Vercel it is set by the platform, and
 * locally it is how the site knows it is on port 3000. It only ever reaches
 * Supabase as a redirect target, and Supabase refuses any target that is not
 * on the allowlist.
 */
export function requestSiteUrl(headers: {
  get(name: string): string | null;
}): string {
  const configured = configuredSiteUrl();
  if (configured) return configured;

  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return metadataSiteUrl();

  const protocol =
    headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${withoutTrailingSlash(host)}`;
}
