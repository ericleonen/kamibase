import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The config module reads process.env at import time, so each case re-imports
 * it with a fresh module registry.
 */
async function loadConfig(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return import("@/lib/supabase/config");
}

const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

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

describe("isSupabaseConfigured", () => {
  it("is false when nothing is set, so the site still works without auth", async () => {
    const config = await loadConfig({
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
    });
    expect(config.isSupabaseConfigured()).toBe(false);
  });

  it("is false when only one half is set", async () => {
    const urlOnly = await loadConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
    });
    expect(urlOnly.isSupabaseConfigured()).toBe(false);

    const keyOnly = await loadConfig({
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
    });
    expect(keyOnly.isSupabaseConfigured()).toBe(false);
  });

  it("is true with a URL and a publishable key", async () => {
    const config = await loadConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc",
    });
    expect(config.isSupabaseConfigured()).toBe(true);
    expect(config.SUPABASE_PUBLISHABLE_KEY).toBe("sb_publishable_abc");
  });

  it("still accepts the legacy anon-key name", async () => {
    const config = await loadConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
    });
    expect(config.isSupabaseConfigured()).toBe(true);
    expect(config.SUPABASE_PUBLISHABLE_KEY).toBe("anon-key");
  });

  it("prefers the publishable key when both are set", async () => {
    const config = await loadConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc",
    });
    expect(config.SUPABASE_PUBLISHABLE_KEY).toBe("sb_publishable_abc");
  });

  it("names both variables in the setup hint, so the UI can just print it", async () => {
    const config = await loadConfig({});
    expect(config.SUPABASE_SETUP_HINT).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(config.SUPABASE_SETUP_HINT).toContain(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  });
});

describe("the server client", () => {
  it("returns null rather than throwing when auth is unconfigured", async () => {
    await loadConfig({
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
    });
    const { createClient, getCurrentUser } = await import("@/lib/supabase/server");
    await expect(createClient()).resolves.toBeNull();
    await expect(getCurrentUser()).resolves.toBeNull();
  });
});
