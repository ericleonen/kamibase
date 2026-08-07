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

const config: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    // The pattern store is read at request time, so it has to ship with the
    // server bundle.
    "/**": ["./content/patterns/**/*"],
  },
  async headers() {
    return [
      {
        // The vendored simulator is third-party MIT code with its own needs:
        // it evaluates shader and matrix code at runtime, so it cannot live
        // under the app's CSP. It is same-origin, sandboxed by being framed
        // only by us, and handles no user input — but it does get its own,
        // looser policy rather than loosening the whole site's.
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
              "img-src 'self' data: blob:",
              "style-src 'self' 'unsafe-inline'",
              // Next's bootstrap and flight payload are inline scripts. The
              // correct fix is a per-request nonce from middleware, but that
              // forces dynamic rendering and would give up the prerendered
              // pattern pages. Phase 1 serves no user-supplied content, so the
              // trade is defensible — but uploads (Phase 2) must move to
              // nonces before anyone else's markup reaches this origin.
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
