import { describe, expect, it } from "vitest";
import {
  DEFAULT_LICENSE,
  DESCRIPTION_MAX,
  LICENSES,
  TAGS_MAX,
  TITLE_MAX,
  licenseTerms,
  normalizeTags,
  slugCandidates,
  slugify,
  validatePatternDraft,
} from "@/lib/patterns/validate";
import { readEditorDoc } from "@/lib/editor/model";

const draft = {
  title: "Hex twist",
  designer: "",
  description: "",
  license: DEFAULT_LICENSE,
  tags: "",
  difficulty: "",
};

describe("slugify", () => {
  it("turns a title into a route", () => {
    expect(slugify("Hex Twist Tessellation")).toBe("hex-twist-tessellation");
  });

  it("folds accents to their base letter rather than dropping them", () => {
    expect(slugify("Miura-ori Étoile")).toBe("miura-ori-etoile");
  });

  it("collapses punctuation and trims the ends", () => {
    expect(slugify("  ***Bird base (traditional)!  ")).toBe("bird-base-traditional");
  });

  it("is empty for a title with nothing a URL can carry", () => {
    expect(slugify("折り紙")).toBe("");
  });

  it("never produces something the database would refuse", () => {
    const shape = /^[a-z0-9][a-z0-9-]{0,79}$/;
    for (const title of ["Hex Twist", "  -leading-", "A".repeat(200), "22.5 degree grid"]) {
      const slug = slugify(title);
      if (slug !== "") expect(slug).toMatch(shape);
    }
  });
});

describe("slugCandidates", () => {
  it("offers the plain slug first and numbered ones after it", () => {
    expect(slugCandidates("Bird base", 3)).toEqual(["bird-base", "bird-base-2", "bird-base-3"]);
  });

  it("falls back to something legal when the title slugs to nothing", () => {
    expect(slugCandidates("折り紙", 2)).toEqual(["pattern", "pattern-2"]);
  });

  it("leaves room for the suffix on a very long title", () => {
    for (const slug of slugCandidates("word ".repeat(40), 8)) {
      expect(slug.length).toBeLessThanOrEqual(80);
      expect(slug).toMatch(/^[a-z0-9][a-z0-9-]{0,79}$/);
    }
  });
});

describe("normalizeTags", () => {
  it("splits on commas and lowercases", () => {
    expect(normalizeTags("Tessellation, Box-Pleating")).toEqual(["tessellation", "box-pleating"]);
  });

  it("drops blanks and duplicates, since one tag is one tag", () => {
    expect(normalizeTags("twist,, Twist , twist")).toEqual(["twist"]);
  });

  it("stops at the cap rather than saving a row the database would refuse", () => {
    const many = Array.from({ length: 40 }, (_, i) => `tag${i}`).join(",");
    expect(normalizeTags(many)).toHaveLength(TAGS_MAX);
  });
});

describe("validatePatternDraft", () => {
  it("needs a title", () => {
    const result = validatePatternDraft({ ...draft, title: "   " });
    expect(result).toMatchObject({ ok: false });
  });

  it("refuses a title that cannot become a web address", () => {
    const result = validatePatternDraft({ ...draft, title: "折り紙" });
    expect(result.ok).toBe(false);
  });

  it("refuses a title past the column's limit", () => {
    const result = validatePatternDraft({ ...draft, title: "x".repeat(TITLE_MAX + 1) });
    expect(result.ok).toBe(false);
  });

  it("refuses a description past the column's limit", () => {
    const result = validatePatternDraft({
      ...draft,
      description: "x".repeat(DESCRIPTION_MAX + 1),
    });
    expect(result.ok).toBe(false);
  });

  it("collapses whitespace in the title", () => {
    const result = validatePatternDraft({ ...draft, title: "  Hex   twist  " });
    expect(result.ok && result.value.title).toBe("Hex twist");
  });

  it("takes a difficulty from 1 to 10 and refuses anything else", () => {
    expect(validatePatternDraft({ ...draft, difficulty: "7" })).toMatchObject({
      ok: true,
      value: { difficulty: 7 },
    });
    expect(validatePatternDraft({ ...draft, difficulty: "11" }).ok).toBe(false);
    expect(validatePatternDraft({ ...draft, difficulty: "6.5" }).ok).toBe(false);
  });

  it("leaves difficulty off entirely when the field is blank", () => {
    const result = validatePatternDraft(draft);
    expect(result.ok && "difficulty" in result.value).toBe(false);
  });

  it("falls back to all rights reserved for a licence not on the list", () => {
    const result = validatePatternDraft({ ...draft, license: "WTFPL" });
    expect(result.ok && result.value.license).toBe(DEFAULT_LICENSE);
  });
});

describe("licenseTerms", () => {
  it("carries the permissions the SPDX id stands for", () => {
    expect(licenseTerms("CC0-1.0")).toMatchObject({ redistribution: "any" });
    expect(licenseTerms(DEFAULT_LICENSE)).toMatchObject({ redistribution: "none" });
  });

  it("treats an unknown licence as the most restrictive one", () => {
    expect(licenseTerms("nonsense")).toEqual(LICENSES[0]?.terms);
  });
});

describe("readEditorDoc", () => {
  const segment = { x1: 0, y1: 0, x2: 1, y2: 0, assignment: "B" };

  it("reads a well-formed segment list", () => {
    expect(readEditorDoc([segment])).toEqual([segment]);
  });

  it("is null for something that is not a list at all", () => {
    expect(readEditorDoc({ x1: 0 })).toBeNull();
    expect(readEditorDoc("[]")).toBeNull();
  });

  it("drops entries that are not four numbers and an assignment", () => {
    expect(
      readEditorDoc([
        segment,
        { ...segment, x1: "0" },
        { ...segment, assignment: "Z" },
        { ...segment, y2: Number.NaN },
        null,
      ]),
    ).toEqual([segment]);
  });

  it("drops coordinates far outside any sheet of paper", () => {
    expect(readEditorDoc([{ ...segment, x2: 1e30 }])).toEqual([]);
  });

  it("drops segments too short to be a crease", () => {
    expect(readEditorDoc([{ ...segment, x2: 0 }])).toEqual([]);
  });
});
