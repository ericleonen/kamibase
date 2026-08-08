import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The module reads process.env when it is called rather than at import, but
 * each case still gets a clean registry so nothing leaks between them.
 */
async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return import("@/lib/site-url");
}

const KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "VERCEL_ENV",
  "VERCEL_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
] as const;

const CLEAR = Object.fromEntries(KEYS.map((key) => [key, undefined])) as Record<
  string,
  string | undefined
>;

/** A stand-in for the Headers object a request hands over. */
function headers(entries: Record<string, string>) {
  return { get: (name: string) => entries[name.toLowerCase()] ?? null };
}

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();
});

describe("configuredSiteUrl", () => {
  it("prefers an explicit NEXT_PUBLIC_SITE_URL", async () => {
    const site = await load({ ...CLEAR, NEXT_PUBLIC_SITE_URL: "https://kamibase.app" });
    expect(site.configuredSiteUrl()).toBe("https://kamibase.app");
  });

  it("trims a trailing slash, so origins never end up doubled", async () => {
    const site = await load({ ...CLEAR, NEXT_PUBLIC_SITE_URL: "https://kamibase.app/" });
    expect(site.configuredSiteUrl()).toBe("https://kamibase.app");
  });

  it("adds a scheme to a bare domain rather than producing a relative URL", async () => {
    const site = await load({ ...CLEAR, NEXT_PUBLIC_SITE_URL: "kamibase-web.vercel.app" });
    expect(site.configuredSiteUrl()).toBe("https://kamibase-web.vercel.app");
  });

  it("uses Vercel's stable production domain on a production deployment", async () => {
    // Not VERCEL_URL: that is the deployment-specific hostname, and a
    // confirmation email should outlive the deployment that sent it.
    const site = await load({
      ...CLEAR,
      VERCEL_ENV: "production",
      VERCEL_URL: "kamibase-web-9f2a1c.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "kamibase-web.vercel.app",
    });
    expect(site.configuredSiteUrl()).toBe("https://kamibase-web.vercel.app");
  });

  it("does not use the production domain on a preview deployment", async () => {
    // A preview's confirmation link has to come back to the preview.
    const site = await load({
      ...CLEAR,
      VERCEL_ENV: "preview",
      VERCEL_PROJECT_PRODUCTION_URL: "kamibase-web.vercel.app",
    });
    expect(site.configuredSiteUrl()).toBeNull();
  });

  it("is null with nothing set, so the caller falls back to the request", async () => {
    const site = await load(CLEAR);
    expect(site.configuredSiteUrl()).toBeNull();
  });

  it("ignores an empty string, which is what an unset Vercel variable looks like", async () => {
    const site = await load({ ...CLEAR, NEXT_PUBLIC_SITE_URL: "" });
    expect(site.configuredSiteUrl()).toBeNull();
  });
});

describe("requestSiteUrl", () => {
  it("uses the configured origin over anything in the headers", async () => {
    const site = await load({ ...CLEAR, NEXT_PUBLIC_SITE_URL: "https://kamibase.app" });
    expect(site.requestSiteUrl(headers({ host: "evil.example" }))).toBe(
      "https://kamibase.app",
    );
  });

  it("falls back to the forwarded host, which is right for previews", async () => {
    const site = await load({ ...CLEAR, VERCEL_ENV: "preview" });
    expect(
      site.requestSiteUrl(
        headers({ "x-forwarded-host": "kamibase-web-git-x.vercel.app", "x-forwarded-proto": "https" }),
      ),
    ).toBe("https://kamibase-web-git-x.vercel.app");
  });

  it("keeps localhost on http, so a dev link is actually clickable", async () => {
    const site = await load(CLEAR);
    expect(site.requestSiteUrl(headers({ host: "localhost:3000" }))).toBe(
      "http://localhost:3000",
    );
  });

  it("assumes https for a real host with no forwarded scheme", async () => {
    const site = await load(CLEAR);
    expect(site.requestSiteUrl(headers({ host: "kamibase-web.vercel.app" }))).toBe(
      "https://kamibase-web.vercel.app",
    );
  });

  it("does not fall over when there is no host header at all", async () => {
    const site = await load(CLEAR);
    expect(site.requestSiteUrl(headers({}))).toBe("http://localhost:3000");
  });
});

describe("metadataSiteUrl", () => {
  it("is the configured origin when there is one", async () => {
    const site = await load({ ...CLEAR, NEXT_PUBLIC_SITE_URL: "https://kamibase.app" });
    expect(site.metadataSiteUrl()).toBe("https://kamibase.app");
  });

  it("falls back to this deployment's own hostname on a preview", async () => {
    const site = await load({
      ...CLEAR,
      VERCEL_ENV: "preview",
      VERCEL_URL: "kamibase-web-git-x.vercel.app",
    });
    expect(site.metadataSiteUrl()).toBe("https://kamibase-web-git-x.vercel.app");
  });

  it("assumes local development last, and returns something new URL() accepts", async () => {
    const site = await load(CLEAR);
    expect(site.metadataSiteUrl()).toBe("http://localhost:3000");
    expect(() => new URL(site.metadataSiteUrl())).not.toThrow();
  });
});
