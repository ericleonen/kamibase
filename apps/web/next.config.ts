import type { NextConfig } from "next";

/**
 * The simulator is embedded in an iframe (see src/lib/kamisim.ts). DESIGN.md
 * §5.2 wants it served from our own origin; `pnpm vendor:simulator` puts a
 * copy under public/sim, and NEXT_PUBLIC_SIMULATOR_URL points at whatever is
 * actually deployed.
 */
const simulatorOrigin = (() => {
  const configured = process.env["NEXT_PUBLIC_SIMULATOR_URL"] ?? "/sim/index.html";
  if (configured.startsWith("/")) return null;
  try {
    return new URL(configured).origin;
  } catch {
    return null;
  }
})();

/**
 * Where avatars and fold photos are served from.
 *
 * Supabase Storage puts public objects on the project's own origin, so the
 * site's CSP has to name it or every uploaded photo renders as a broken image.
 * Absent (no keys on this deploy) it stays out of the policy entirely rather
 * than widening it for nothing.
 */
const supabaseOrigin = (() => {
  const configured = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "";
  if (configured === "") return null;
  try {
    return new URL(configured).origin;
  } catch {
    return null;
  }
})();

const imageSources = ["'self'", "data:", "blob:", ...(supabaseOrigin ? [supabaseOrigin] : [])];

const config: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    // The pattern store is read at request time, so it has to ship with the
    // server bundle.
    "/**": ["./content/patterns/**/*"],
  },
  experimental: {
    serverActions: {
      /**
       * Fold photos are uploaded through a server action, and the default cap
       * is 1MB. The browser downscales to a 1600px JPEG first, which normally
       * lands under 500KB, so this is headroom for the cases where it cannot
       * (a format `createImageBitmap` will not decode, a very detailed
       * tessellation) rather than the size we expect. Storage refuses anything
       * over 8MB regardless.
       */
      bodySizeLimit: "9mb",
    },
  },
  async headers() {
    return [
      {
        // The vendored simulator is third-party MIT code with its own needs:
        // it evaluates shader and matrix code at runtime, so it cannot live
        // under the app's CSP. It is same-origin, sandboxed by being framed
        // only by us, and handles no user input. It still gets its own looser
        // policy rather than loosening the whole site's.
        source: "/sim/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "connect-src 'self' blob:",
              "worker-src 'self' blob:",
              "frame-ancestors 'self'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
      {
        // Everything except /sim, which has its own policy above. Two CSP
        // headers on one response intersect rather than override, so the app's
        // policy has to be kept off the simulator's paths entirely.
        source: "/:path((?!sim/).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Uploaded avatars and fold photos come from Supabase Storage.
              `img-src ${imageSources.join(" ")}`,
              // The browser client is only used for auth state; the writes all
              // go through server actions, so this is the one cross-origin
              // connection the app makes.
              `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
              "style-src 'self' 'unsafe-inline'",
              // Next's bootstrap and flight payload are inline scripts. The
              // correct fix is a per-request nonce from middleware, but that
              // forces dynamic rendering and would give up the prerendered
              // pattern pages. Phase 1 serves no user-supplied content, so the
              // trade is defensible. Uploads (Phase 2) must move to nonces
              // before anyone else's markup reaches this origin.
              "script-src 'self' 'unsafe-inline'",
              // The simulator iframe runs third-party (MIT) code; it is
              // sandboxed at the element and confined to its own origin here.
              `frame-src 'self'${simulatorOrigin ? ` ${simulatorOrigin}` : ""}`,
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default config;
