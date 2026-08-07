import { describe, expect, it } from "vitest";
import {
  CLASS_KEY,
  ParseError,
  decodeXmlDecoder,
  ingest,
  parseOpx,
} from "../src/index.js";
import { fixture } from "./helpers.js";

const wrap = (body: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<java version="1.6.0" class="java.beans.XMLDecoder">
 <object class="oripa.DataSet">
${body}
 </object>
</java>`;

const linesArray = (entries: string): string => `
  <void property="lines">
   <array class="oripa.geom.OriLineProxy" length="1">
${entries}
   </array>
  </void>`;

describe("decodeXmlDecoder", () => {
  it("decodes objects, properties and scalars", () => {
    const decoded = decodeXmlDecoder(
      wrap(`
  <void property="mainVersion"><int>1</int></void>
  <void property="paperSize"><double>400.0</double></void>
  <void property="title"><string>Hello</string></void>
  <void property="locked"><boolean>true</boolean></void>`),
    ) as Record<string, unknown>;
    expect(decoded[CLASS_KEY]).toBe("oripa.DataSet");
    expect(decoded["mainVersion"]).toBe(1);
    expect(decoded["paperSize"]).toBe(400);
    expect(decoded["title"]).toBe("Hello");
    expect(decoded["locked"]).toBe(true);
  });

  it("decodes an indexed array in index order, not document order", () => {
    const decoded = decodeXmlDecoder(
      wrap(`
  <void property="values">
   <array class="java.lang.Integer" length="3">
    <void index="2"><int>30</int></void>
    <void index="0"><int>10</int></void>
    <void index="1"><int>20</int></void>
   </array>
  </void>`),
    ) as Record<string, unknown>;
    expect(decoded["values"]).toEqual([10, 20, 30]);
  });

  it("throws on XML that is not an XMLDecoder document", () => {
    expect(() => decodeXmlDecoder("<svg><path d=\"M0 0\"/></svg>")).toThrow(ParseError);
  });
});

describe("parseOpx", () => {
  const parsed = parseOpx(fixture("square-x.opx"));

  it("reads the line list from an ORIPA DataSet", () => {
    expect(parsed.format).toBe("opx");
    expect(parsed.graph.edges.length).toBe(6);
    expect(parsed.graph.vertices.length).toBe(4);
    expect(parsed.warnings).toEqual([]);
  });

  it("maps ORIPA line types the same way .cp does", () => {
    expect(parsed.graph.assignments).toEqual(["B", "B", "B", "B", "M", "V"]);
  });

  it("keeps ORIPA's origin-centred coordinates", () => {
    expect(parsed.graph.vertices).toContainEqual([-200, -200]);
    expect(parsed.graph.vertices).toContainEqual([200, 200]);
  });

  it("reads the metadata ORIPA carries", () => {
    expect(parsed.metadata.title).toBe("Square with both diagonals");
    expect(parsed.metadata.paperSize).toBe(400);
    expect(parsed.metadata.creator).toBe("ORIPA");
  });

  it("normalizes to the unit square at ingest", () => {
    const result = ingest(parsed);
    expect(result.graph.vertices).toContainEqual([0, 0]);
    expect(result.graph.vertices).toContainEqual([1, 1]);
    expect(result.graph.vertices).toContainEqual([0.5, 0.5]);
    expect(result.grade.structural.errors).toEqual([]);
  });

  it("accepts the Point2D form some ORIPA versions write", () => {
    const withPoints = parseOpx(
      wrap(
        linesArray(`
    <void index="0">
     <object class="oripa.geom.OriLineProxy">
      <void property="type"><int>2</int></void>
      <void property="p0">
       <object class="java.awt.geom.Point2D$Double">
        <void property="x"><double>-100.0</double></void>
        <void property="y"><double>-100.0</double></void>
       </object>
      </void>
      <void property="p1">
       <object class="java.awt.geom.Point2D$Double">
        <void property="x"><double>100.0</double></void>
        <void property="y"><double>100.0</double></void>
       </object>
      </void>
     </object>
    </void>`),
      ),
    );
    expect(withPoints.graph.vertices).toEqual([
      [-100, -100],
      [100, 100],
    ]);
    expect(withPoints.graph.assignments).toEqual(["M"]);
  });

  it("marks an unknown line type U and says so", () => {
    const odd = parseOpx(
      wrap(
        linesArray(`
    <void index="0">
     <object class="oripa.geom.OriLineProxy">
      <void property="type"><int>9</int></void>
      <void property="x0"><double>0</double></void>
      <void property="y0"><double>0</double></void>
      <void property="x1"><double>1</double></void>
      <void property="y1"><double>1</double></void>
     </object>
    </void>`),
      ),
    );
    expect(odd.graph.assignments).toEqual(["U"]);
    expect(odd.warnings[0]).toMatch(/unknown line type 9/);
  });

  it("skips a line with no readable endpoints", () => {
    const broken = parseOpx(
      wrap(
        `
  <void property="lines">
   <array class="oripa.geom.OriLineProxy" length="2">
    <void index="0">
     <object class="oripa.geom.OriLineProxy">
      <void property="type"><int>2</int></void>
     </object>
    </void>
    <void index="1">
     <object class="oripa.geom.OriLineProxy">
      <void property="type"><int>2</int></void>
      <void property="x0"><double>0</double></void>
      <void property="y0"><double>0</double></void>
      <void property="x1"><double>1</double></void>
      <void property="y1"><double>1</double></void>
     </object>
    </void>
   </array>
  </void>`,
      ),
    );
    expect(broken.graph.edges.length).toBe(1);
    expect(broken.warnings[0]).toMatch(/lines\[0\].*no readable endpoints/);
  });

  it("throws when there is no lines property", () => {
    expect(() =>
      parseOpx(wrap(`  <void property="paperSize"><double>400.0</double></void>`)),
    ).toThrow(/does not look like an ORIPA DataSet/);
  });

  it("throws when the lines array is empty", () => {
    expect(() =>
      parseOpx(
        wrap(`
  <void property="lines">
   <array class="oripa.geom.OriLineProxy" length="0"></array>
  </void>`),
      ),
    ).toThrow(/no usable creases/);
  });

  it("throws on malformed XML", () => {
    expect(() => parseOpx("<java><object></java>")).toThrow(ParseError);
  });

  it("throws when handed a .cp file", () => {
    expect(() => parseOpx("1 0 0 1 0\n2 0 0 1 1")).toThrow(ParseError);
  });
});
