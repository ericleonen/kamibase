import { describe, expect, it } from "vitest";
import { ParseError, ingest, parseCp, toCp } from "../src/index.js";
import { fixture } from "./helpers.js";

describe("parseCp", () => {
  it("reads the documented line types", () => {
    const parsed = parseCp(
      ["1 0 0 1 0", "2 0 0 1 1", "3 1 0 0 1"].join("\n"),
    );
    expect(parsed.format).toBe("cp");
    expect(parsed.graph.assignments).toEqual(["B", "M", "V"]);
    expect(parsed.graph.vertices.length).toBe(4);
    expect(parsed.warnings).toEqual([]);
  });

  it("accepts ORIPA's extra types: 0 unassigned, 4 auxiliary", () => {
    const parsed = parseCp(["0 0 0 1 0", "4 0 0 1 1"].join("\n"));
    expect(parsed.graph.assignments).toEqual(["U", "F"]);
    expect(parsed.warnings).toEqual([]);
  });

  it("keeps source coordinates rather than normalizing", () => {
    const parsed = parseCp("1 -200 -200 200 -200");
    expect(parsed.graph.vertices).toEqual([
      [-200, -200],
      [200, -200],
    ]);
  });

  it("skips blank lines and comments", () => {
    const parsed = parseCp(
      [
        "# a comment",
        "",
        "   ",
        "1 0 0 1 0  # trailing comment",
        "// another comment",
        "2 0 0 1 1",
      ].join("\n"),
    );
    expect(parsed.graph.edges.length).toBe(2);
    expect(parsed.warnings).toEqual([]);
  });

  it("handles CRLF and lone CR line endings", () => {
    expect(parseCp("1 0 0 1 0\r\n2 0 0 1 1\r\n").graph.edges.length).toBe(2);
    expect(parseCp("1 0 0 1 0\r2 0 0 1 1").graph.edges.length).toBe(2);
  });

  it("accepts comma and tab separated fields", () => {
    const parsed = parseCp("1,0,0,1,0\n2\t0\t0\t1\t1");
    expect(parsed.graph.edges.length).toBe(2);
  });

  it("accepts scientific notation and negative coordinates", () => {
    const parsed = parseCp("2 -1e2 -1E2 1e2 1e2");
    expect(parsed.graph.vertices).toEqual([
      [-100, -100],
      [100, 100],
    ]);
  });

  it("warns and skips a line with too few fields", () => {
    const parsed = parseCp(["1 0 0 1 0", "2 0 0 1"].join("\n"));
    expect(parsed.graph.edges.length).toBe(1);
    expect(parsed.warnings[0]).toMatch(/line 2: expected 5 fields/);
  });

  it("warns and skips a line with a non-numeric field", () => {
    const parsed = parseCp(["1 0 0 1 0", "2 0 0 banana 1"].join("\n"));
    expect(parsed.graph.edges.length).toBe(1);
    expect(parsed.warnings[0]).toMatch(/line 2: non-numeric/);
  });

  it("warns about, but keeps, trailing fields", () => {
    const parsed = parseCp("1 0 0 1 0 99 extra");
    expect(parsed.graph.edges.length).toBe(1);
    expect(parsed.warnings[0]).toMatch(/ignored 2 trailing field/);
  });

  it("marks an unknown line type U rather than guessing", () => {
    const parsed = parseCp("7 0 0 1 0");
    expect(parsed.graph.assignments).toEqual(["U"]);
    expect(parsed.warnings[0]).toMatch(/unknown line type 7/);
  });

  it("honours unknownTypeAssignment", () => {
    expect(parseCp("7 0 0 1 0", { unknownTypeAssignment: "F" }).graph.assignments).toEqual(
      ["F"],
    );
  });

  it("drops a zero-length crease", () => {
    const parsed = parseCp(["1 0 0 1 0", "2 0.5 0.5 0.5 0.5"].join("\n"));
    expect(parsed.graph.edges.length).toBe(1);
    expect(parsed.warnings.join("\n")).toMatch(/zero-length/);
  });

  it("collapses a duplicated crease", () => {
    const parsed = parseCp(["2 0 0 1 1", "2 1 1 0 0"].join("\n"));
    expect(parsed.graph.edges.length).toBe(1);
    expect(parsed.warnings.join("\n")).toMatch(/duplicate edge/);
  });

  it("throws on an empty file", () => {
    expect(() => parseCp("")).toThrow(ParseError);
    expect(() => parseCp("")).toThrow(/no usable crease lines/);
  });

  it("throws on a file of only comments", () => {
    expect(() => parseCp("# nothing here\n# really")).toThrow(ParseError);
  });

  it("throws when handed a FOLD document by mistake", () => {
    expect(() => parseCp('{"vertices_coords": []}')).toThrow(ParseError);
  });

  it("does not choke on a 5000-line adversarial file", () => {
    const lines: string[] = [];
    for (let i = 0; i < 5000; i += 1) lines.push(`2 0 ${i / 5000} 1 ${i / 5000}`);
    const parsed = parseCp(lines.join("\n"));
    expect(parsed.graph.edges.length).toBe(5000);
  });
});

describe("the crane fixture", () => {
  const parsed = parseCp(fixture("crane.cp"));

  it("reads all 24 hand-written creases", () => {
    expect(parsed.warnings).toEqual([]);
    expect(parsed.graph.edges.length).toBe(24);
  });

  it("is already in the unit square", () => {
    for (const [x, y] of parsed.graph.vertices) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
  });
});

describe("toCp", () => {
  it("round-trips a parsed pattern", () => {
    const original = parseCp(fixture("waterbomb.cp"));
    const again = parseCp(toCp(original));
    expect(again.graph.vertices).toEqual(original.graph.vertices);
    expect(again.graph.assignments).toEqual(original.graph.assignments);
  });

  it("round-trips through ingest without changing the content hash", () => {
    const first = ingest(parseCp(fixture("miura.cp")));
    const second = ingest(parseCp(toCp({ graph: first.graph })));
    expect(second.contentHash).toBe(first.contentHash);
  });
});
