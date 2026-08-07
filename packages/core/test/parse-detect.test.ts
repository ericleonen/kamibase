import { describe, expect, it } from "vitest";
import { ParseError, detectFormat, parse } from "../src/index.js";
import { fixture } from "./helpers.js";

describe("detectFormat", () => {
  it("recognizes .kami by its namespace", () => {
    expect(detectFormat(fixture("square-spokes.kami"))).toBe("kami");
  });

  it("recognizes plain FOLD", () => {
    expect(detectFormat(fixture("square-x.fold"))).toBe("fold");
  });

  it("recognizes ORIPA XML", () => {
    expect(detectFormat(fixture("square-x.opx"))).toBe("opx");
  });

  it("recognizes .cp from its line shape alone", () => {
    expect(detectFormat(fixture("crane.cp"))).toBe("cp");
    expect(detectFormat(fixture("miura.cp"))).toBe("cp");
    expect(detectFormat("1 0 0 1 0\n2 0 0 1 1")).toBe("cp");
  });

  it("ignores a leading byte order mark and whitespace", () => {
    expect(detectFormat("﻿\n  " + fixture("square-x.fold"))).toBe("fold");
  });

  it("does not trust the extension over the content", () => {
    expect(detectFormat(fixture("square-x.fold"), "actually-a.cp")).toBe("fold");
  });

  it("uses the extension when the content is ambiguous", () => {
    expect(detectFormat("", "empty.cp")).toBe("cp");
  });

  it("returns null for XML that is not ORIPA", () => {
    expect(detectFormat('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBeNull();
  });

  it("returns null for prose", () => {
    expect(detectFormat("this is not a crease pattern")).toBeNull();
  });

  it("does not call a partly-numeric file .cp", () => {
    expect(detectFormat("1 0 0 1 0\nhello there")).toBeNull();
  });
});

describe("parse", () => {
  it("dispatches on the detected format", () => {
    expect(parse(fixture("crane.cp")).format).toBe("cp");
    expect(parse(fixture("square-x.opx")).format).toBe("opx");
    expect(parse(fixture("square-x.fold")).format).toBe("fold");
    expect(parse(fixture("square-spokes.kami")).format).toBe("kami");
  });

  it("can be forced to a format", () => {
    expect(parse("1 0 0 1 0", { format: "cp" }).graph.edges.length).toBe(1);
  });

  it("throws when nothing matches", () => {
    expect(() => parse("not a crease pattern")).toThrow(ParseError);
    expect(() => parse("not a crease pattern")).toThrow(/could not detect the file format/);
  });
});
