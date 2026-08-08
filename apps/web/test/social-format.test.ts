import { describe, expect, it } from "vitest";
import {
  compactCount,
  foldDetails,
  formatMinutes,
  initialOf,
  nameOf,
  relativeTime,
} from "@/lib/social/format";
import type { Fold, Profile } from "@/lib/social/types";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    handle: "miura_fan",
    displayName: "Miura Fan",
    bio: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function fold(overrides: Partial<Fold> = {}): Fold {
  return {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    patternId: "bird-base",
    photoUrl: "https://example.supabase.co/storage/v1/object/public/fold-photos/a/b.jpg",
    photoPath: "a/b.jpg",
    caption: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    author: profile(),
    ...overrides,
  };
}

describe("nameOf", () => {
  it("prefers the display name", () => {
    expect(nameOf(profile())).toBe("Miura Fan");
  });

  it("falls back to the handle rather than showing an empty byline", () => {
    expect(nameOf(profile({ displayName: "" }))).toBe("miura_fan");
    expect(nameOf(profile({ displayName: "   " }))).toBe("miura_fan");
  });
});

describe("initialOf", () => {
  it("is the first letter of whatever the name resolves to", () => {
    expect(initialOf(profile())).toBe("M");
    expect(initialOf(profile({ displayName: "" }))).toBe("M");
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-06-01T12:00:00.000Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it("says just now inside a minute", () => {
    expect(relativeTime(ago(30_000), now)).toBe("just now");
  });

  it("counts minutes, hours, days, weeks and years", () => {
    expect(relativeTime(ago(5 * 60_000), now)).toBe("5 minutes ago");
    expect(relativeTime(ago(3 * 3_600_000), now)).toBe("3 hours ago");
    expect(relativeTime(ago(2 * 86_400_000), now)).toBe("2 days ago");
    expect(relativeTime(ago(3 * 7 * 86_400_000), now)).toBe("3 weeks ago");
    expect(relativeTime(ago(400 * 86_400_000), now)).toBe("1 year ago");
  });

  it("does not say 1 hours", () => {
    expect(relativeTime(ago(3_600_000), now)).toBe("1 hour ago");
    expect(relativeTime(ago(86_400_000), now)).toBe("1 day ago");
  });

  it("returns nothing for a timestamp it cannot parse, rather than NaN", () => {
    expect(relativeTime("not a date", now)).toBe("");
  });

  it("takes `now` as an argument, so a server render and its hydration agree", () => {
    const iso = ago(3_600_000);
    expect(relativeTime(iso, now)).toBe(relativeTime(iso, now));
  });
});

describe("formatMinutes", () => {
  it("stays in minutes under an hour", () => {
    expect(formatMinutes(45)).toBe("45 min");
  });

  it("splits into hours and minutes", () => {
    expect(formatMinutes(60)).toBe("1 hr");
    expect(formatMinutes(150)).toBe("2 hr 30 min");
  });

  it("rolls over to days for the long ones", () => {
    expect(formatMinutes(60 * 24 * 3)).toBe("3 days");
  });
});

describe("foldDetails", () => {
  it("is empty when nothing optional was filled in", () => {
    expect(foldDetails(fold())).toBe("");
  });

  it("joins only the parts that are there", () => {
    expect(foldDetails(fold({ paper: "Tant", minutes: 45 }))).toBe("Tant · 45 min");
  });

  it("marks the difficulty as the folder's own", () => {
    expect(foldDetails(fold({ difficulty: 6 }))).toBe("felt like 6/10");
  });

  it("puts every field in order", () => {
    expect(foldDetails(fold({ paper: "Kami", sizeMm: 150, minutes: 90, difficulty: 4 }))).toBe(
      "Kami · 150 mm · 1 hr 30 min · felt like 4/10",
    );
  });
});

describe("compactCount", () => {
  it("leaves small numbers alone", () => {
    expect(compactCount(0)).toBe("0");
    expect(compactCount(999)).toBe("999");
  });

  it("shortens thousands so a follower chip never wraps", () => {
    expect(compactCount(1000)).toBe("1k");
    expect(compactCount(1200)).toBe("1.2k");
    expect(compactCount(12_000)).toBe("12k");
    expect(compactCount(1_500_000)).toBe("1.5M");
  });
});
