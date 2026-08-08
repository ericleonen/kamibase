import { describe, expect, it } from "vitest";
import {
  AVATAR_MAX_BYTES,
  BIO_MAX,
  COMMENT_MAX,
  formatBytes,
  normalizeHandle,
  normalizeWebsite,
  objectPath,
  validateCommentBody,
  validateFoldDraft,
  validateHandle,
  validateImageUpload,
  validateProfileDraft,
} from "@/lib/social/validate";

describe("normalizeHandle", () => {
  it("lowercases and joins words with underscores", () => {
    expect(normalizeHandle("Eric Leonen")).toBe("eric_leonen");
  });

  it("turns dots and hyphens into underscores, so a pasted email local part works", () => {
    expect(normalizeHandle("eric.leonen-origami")).toBe("eric_leonen_origami");
  });

  it("drops characters a URL would have to escape", () => {
    expect(normalizeHandle("折り紙 folder!")).toBe("folder");
  });

  it("collapses runs of underscores and trims the ends", () => {
    expect(normalizeHandle("__eric___leonen__")).toBe("eric_leonen");
  });

  it("caps the length", () => {
    expect(normalizeHandle("a".repeat(60))).toHaveLength(24);
  });
});

describe("validateHandle", () => {
  it("accepts an ordinary handle", () => {
    const result = validateHandle("Miura_Fan");
    expect(result).toEqual({ ok: true, value: "miura_fan" });
  });

  it("rejects anything too short to be a URL segment", () => {
    const result = validateHandle("ab");
    expect(result.ok).toBe(false);
  });

  it("rejects a handle that is only punctuation, rather than storing an empty one", () => {
    expect(validateHandle("!!!").ok).toBe(false);
  });

  it("refuses handles that would shadow a route", () => {
    for (const reserved of ["explore", "settings", "feed", "login", "p", "u"]) {
      const result = validateHandle(reserved);
      expect(result.ok, reserved).toBe(false);
    }
  });
});

describe("normalizeWebsite", () => {
  it("treats an empty field as no link at all", () => {
    expect(normalizeWebsite("   ")).toEqual({ ok: true, value: undefined });
  });

  it("adds https:// to a bare domain", () => {
    const result = normalizeWebsite("langorigami.com");
    expect(result.ok && result.value).toBe("https://langorigami.com/");
  });

  it("keeps an explicit http link", () => {
    const result = normalizeWebsite("http://example.com/folds");
    expect(result.ok && result.value).toBe("http://example.com/folds");
  });

  it("rejects javascript: URLs, which would be stored XSS in an anchor", () => {
    // eslint-disable-next-line no-script-url -- that is the point of the test
    const result = normalizeWebsite("javascript:alert(1)");
    expect(result.ok).toBe(false);
  });

  it("rejects data: URLs for the same reason", () => {
    expect(normalizeWebsite("data:text/html;base64,PHNjcmlwdD4=").ok).toBe(false);
  });

  it("rejects something that is not a host", () => {
    expect(normalizeWebsite("not a website").ok).toBe(false);
  });
});

describe("validateProfileDraft", () => {
  const base = { handle: "folder_one", displayName: "Folder One", bio: "", website: "" };

  it("normalizes the handle and trims the name", () => {
    const result = validateProfileDraft({ ...base, handle: "Folder One", displayName: "  Eric  " });
    expect(result.ok && result.value.handle).toBe("folder_one");
    expect(result.ok && result.value.displayName).toBe("Eric");
  });

  it("omits the website entirely when it is blank", () => {
    const result = validateProfileDraft(base);
    expect(result.ok && "website" in result.value).toBe(false);
  });

  it("rejects a bio past the limit and says how long it is", () => {
    const result = validateProfileDraft({ ...base, bio: "x".repeat(BIO_MAX + 1) });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain(String(BIO_MAX + 1));
  });

  it("fails on the handle before anything else", () => {
    const result = validateProfileDraft({ ...base, handle: "no" });
    expect(!result.ok && result.error).toMatch(/at least/);
  });
});

describe("validateFoldDraft", () => {
  const empty = { caption: "", paper: "", sizeMm: "", minutes: "", difficulty: "" };

  it("accepts a fold with nothing but a photo, which is the point", () => {
    const result = validateFoldDraft(empty);
    expect(result).toEqual({ ok: true, value: { caption: "" } });
  });

  it("keeps the optional fields it was given", () => {
    const result = validateFoldDraft({
      caption: "  Took two goes.  ",
      paper: "Tant",
      sizeMm: "150",
      minutes: "45",
      difficulty: "6",
    });
    expect(result).toEqual({
      ok: true,
      value: { caption: "Took two goes.", paper: "Tant", sizeMm: 150, minutes: 45, difficulty: 6 },
    });
  });

  it("rejects a difficulty outside 1 to 10", () => {
    expect(validateFoldDraft({ ...empty, difficulty: "11" }).ok).toBe(false);
    expect(validateFoldDraft({ ...empty, difficulty: "0" }).ok).toBe(false);
  });

  it("rejects a fractional time rather than silently rounding it", () => {
    const result = validateFoldDraft({ ...empty, minutes: "12.5" });
    expect(!result.ok && result.error).toMatch(/whole number/);
  });

  it("rejects text in a number field", () => {
    expect(validateFoldDraft({ ...empty, sizeMm: "a lot" }).ok).toBe(false);
  });

  it("rejects paper sizes no origami uses, in either direction", () => {
    expect(validateFoldDraft({ ...empty, sizeMm: "1" }).ok).toBe(false);
    expect(validateFoldDraft({ ...empty, sizeMm: "5000" }).ok).toBe(false);
  });
});

describe("validateCommentBody", () => {
  it("trims", () => {
    expect(validateCommentBody("  hello  ")).toEqual({ ok: true, value: "hello" });
  });

  it("rejects whitespace only", () => {
    expect(validateCommentBody("   \n ").ok).toBe(false);
  });

  it("rejects one past the limit", () => {
    expect(validateCommentBody("x".repeat(COMMENT_MAX + 1)).ok).toBe(false);
    expect(validateCommentBody("x".repeat(COMMENT_MAX)).ok).toBe(true);
  });
});

describe("validateImageUpload", () => {
  it("accepts a JPEG and reports the extension to store it under", () => {
    const result = validateImageUpload({ type: "image/jpeg", size: 1000 }, AVATAR_MAX_BYTES);
    expect(result).toEqual({
      ok: true,
      value: { type: "image/jpeg", size: 1000, extension: "jpg" },
    });
  });

  it("accepts PNG and WebP", () => {
    expect(validateImageUpload({ type: "image/png", size: 10 }, AVATAR_MAX_BYTES).ok).toBe(true);
    expect(validateImageUpload({ type: "image/webp", size: 10 }, AVATAR_MAX_BYTES).ok).toBe(true);
  });

  it("rejects a format the bucket would refuse anyway", () => {
    const result = validateImageUpload({ type: "image/gif", size: 10 }, AVATAR_MAX_BYTES);
    expect(!result.ok && result.error).toMatch(/JPEG, PNG or WebP/);
  });

  it("rejects an SVG, which is a script vector rather than a photo", () => {
    expect(validateImageUpload({ type: "image/svg+xml", size: 10 }, AVATAR_MAX_BYTES).ok).toBe(
      false,
    );
  });

  it("names both sizes when the file is too big", () => {
    const result = validateImageUpload({ type: "image/jpeg", size: 9_000_000 }, AVATAR_MAX_BYTES);
    expect(!result.ok && result.error).toContain("8.6MB");
    expect(!result.ok && result.error).toContain("2.0MB");
  });

  it("rejects an empty pick rather than uploading zero bytes", () => {
    expect(validateImageUpload({ type: "image/jpeg", size: 0 }, AVATAR_MAX_BYTES).ok).toBe(false);
    expect(validateImageUpload(null, AVATAR_MAX_BYTES).ok).toBe(false);
  });

  it("is case-insensitive about the MIME type", () => {
    expect(validateImageUpload({ type: "IMAGE/JPEG", size: 10 }, AVATAR_MAX_BYTES).ok).toBe(true);
  });
});

describe("objectPath", () => {
  it("puts the uploader's id first, which is what the storage policy checks", () => {
    expect(objectPath("11111111-2222-3333-4444-555555555555", "abc", "jpg")).toBe(
      "11111111-2222-3333-4444-555555555555/abc.jpg",
    );
  });
});

describe("formatBytes", () => {
  it("scales to the unit a person would use", () => {
    expect(formatBytes(512)).toBe("512B");
    expect(formatBytes(2048)).toBe("2KB");
    expect(formatBytes(3_500_000)).toBe("3.3MB");
  });
});
