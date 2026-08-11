import { describe, expect, it } from "vitest";
import { convertUpload, slugFromFilename, titleFromFilename } from "@/lib/upload/convert";
import { readImportPayload } from "@/lib/upload/handoff";

const WATERBOMB_CP = [
  "1 0 0 1 0",
  "1 1 0 1 1",
  "1 1 1 0 1",
  "1 0 1 0 0",
  "3 0 0 1 1",
  "3 1 0 0 1",
  "2 0 0.5 1 0.5",
  "2 0.5 0 0.5 1",
].join("\n");

/** A square with both diagonals, in the Origami Simulator palette. */
const PALETTE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="0" y="0" width="100" height="100" fill="none" stroke="#000000"/>
  <line x1="0" y1="0" x2="100" y2="100" stroke="#ff0000"/>
  <line x1="100" y1="0" x2="0" y2="100" stroke="#0000ff"/>
</svg>`;

/**
 * The same square in black ink, where the only thing distinguishing the
 * creases from the paper edge is that they are dashed.
 */
const MONOCHROME_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="0" y="0" width="100" height="100" fill="none" stroke="#000000"/>
  <line x1="0" y1="0" x2="100" y2="100" stroke="#000000" stroke-dasharray="4 4"/>
  <line x1="100" y1="0" x2="0" y2="100" stroke="#000000" stroke-dasharray="4 4"/>
</svg>`;

describe("convertUpload", () => {
  it("converts a .cp file and grades it", () => {
    const result = convertUpload(WATERBOMB_CP, "waterbomb base.cp");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.format).toBe("cp");
    expect(result.grade.level).toBe("L1");
    expect(result.slug).toBe("waterbomb-base");
    expect(result.title).toBe("Waterbomb base");
    // The centre and the four edge midpoints come from planarization.
    expect(result.graph.vertices.length).toBe(9);
  });

  it("trusts a format that states its assignments", () => {
    const result = convertUpload(WATERBOMB_CP, "waterbomb.cp");
    expect(result.ok && result.confidence).toBe(1);
    expect(result.ok && result.review).toBe("publishable");
    expect(result.ok && result.reasons).toEqual([]);
  });

  it("records how the file was converted, in kami:provenance", () => {
    const result = convertUpload(PALETTE_SVG, "square.svg");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const provenance = result.document["kami:provenance"];
    expect(provenance?.convertedFrom).toMatchObject({
      format: "svg",
      converter: "kamibase-web@0.1",
      reviewedByHuman: false,
    });
    expect(provenance?.convertedFrom?.confidence).toBeGreaterThan(0.9);
  });

  it("reads an SVG in the standard palette without asking anyone anything", () => {
    const result = convertUpload(PALETTE_SVG, "square.svg");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.review).toBe("publishable");
    expect(result.styles.map((style) => [style.stroke, style.assignment])).toEqual([
      ["#000000", "B"],
      ["#ff0000", "M"],
      ["#0000ff", "V"],
    ]);
  });

  it("asks for a review when an SVG had to be guessed at", () => {
    const result = convertUpload(MONOCHROME_SVG, "mystery.svg");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.confidence).toBeLessThan(0.95);
    expect(result.review).toBe("review");
    expect(result.reasons.join(" ")).toMatch(/confidence/);
  });

  it("blocks publishing when the palette is unreadable", () => {
    const orange = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect x="0" y="0" width="100" height="100" fill="none" stroke="#ff8000"/>
      <line x1="0" y1="0" x2="100" y2="100" stroke="#ff8000"/>
    </svg>`;
    const result = convertUpload(orange, "unreadable.svg");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.confidence).toBe(0);
    expect(result.review).toBe("blocked");
    // Nothing was guessed: every crease came back unassigned, per §3.4.
    expect(new Set(result.graph.assignments)).toEqual(new Set(["U"]));
  });

  it("re-reads the file when a style is reassigned by hand", () => {
    const first = convertUpload(MONOCHROME_SVG, "mystery.svg");
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const dashed = first.styles.find((style) => style.dashed)!;
    const second = convertUpload(MONOCHROME_SVG, "mystery.svg", {
      assignments: { [dashed.key]: "M" },
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    expect(second.graph.assignments).toContain("M");
    expect(second.confidence).toBeGreaterThan(first.confidence);
    expect(second.review).toBe("publishable");
  });

  it("refuses a file it cannot identify, and says what it takes", () => {
    const result = convertUpload("a photo, but as words", "sketch.png");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/could not tell what kind of file/);
    expect(result.hint).toMatch(/\.fold, \.kami, \.cp, \.opx and \.svg/);
  });

  it("explains a file that is the right format but unreadable", () => {
    const result = convertUpload('<svg xmlns="http://www.w3.org/2000/svg"></svg>', "empty.svg");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/SVG, but it could not be read/);
    expect(result.message).not.toMatch(/svg: svg:/);
  });

  it("keeps a broken pattern rather than throwing it away", () => {
    // One crease, no boundary: L0 at best, so publishing is blocked, but the
    // geometry is still handed to the editor to be repaired (§8.2).
    const result = convertUpload("2 0 0 1 1", "one-crease.cp");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.review).toBe("blocked");
    expect(result.graph.edges.length).toBe(1);
  });
});

describe("filenames", () => {
  it("makes a slug", () => {
    expect(slugFromFilename("Bird Base (1).cp")).toBe("bird-base-1");
    expect(slugFromFilename("....svg")).toBe("imported-pattern");
    expect(slugFromFilename("Miura_ori-32.fold")).toBe("miura-ori-32");
  });

  it("makes a title", () => {
    expect(titleFromFilename("bird_base-32.cp")).toBe("Bird base 32");
    expect(titleFromFilename(".kami")).toBe("Imported pattern");
  });
});

describe("readImportPayload", () => {
  const doc = [{ x1: 0, y1: 0, x2: 1, y2: 0, assignment: "B" }];

  it("reads a payload the converter wrote", () => {
    const payload = readImportPayload(JSON.stringify({ title: "T", slug: "t", doc }));
    expect(payload?.doc.length).toBe(1);
    expect(payload?.title).toBe("T");
  });

  it("treats anything malformed as nothing to import", () => {
    expect(readImportPayload(null)).toBeNull();
    expect(readImportPayload("not json")).toBeNull();
    expect(readImportPayload("[]")).toBeNull();
    expect(readImportPayload(JSON.stringify({ title: "T", slug: "t", doc: [] }))).toBeNull();
    expect(
      readImportPayload(JSON.stringify({ title: 1, slug: "t", doc })),
    ).toBeNull();
  });

  it("drops segments that are not segments", () => {
    const payload = readImportPayload(
      JSON.stringify({
        title: "T",
        slug: "t",
        doc: [...doc, { x1: 0, y1: 0, x2: 1, y2: 1, assignment: "nope" }, null],
      }),
    );
    expect(payload?.doc.length).toBe(1);
  });
});
