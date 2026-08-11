import { describe, expect, it } from "vitest";
import {
  ParseError,
  classifyColor,
  classifyLayer,
  ingest,
  parseCp,
  parseFold,
  parseSvg,
  renderSvg,
} from "../src/index.js";
import { fixture } from "./helpers.js";

/** Wrap crease elements in a minimal document. */
function svg(body: string, attributes = 'viewBox="0 0 100 100"'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" ${attributes}>${body}</svg>`;
}

describe("parseSvg", () => {
  const parsed = parseSvg(fixture("square-x.svg"));

  it("reads the Origami Simulator palette", () => {
    expect(parsed.format).toBe("svg");
    expect(parsed.graph.assignments.join("")).toBe("BBBBMMMV");
    expect(parsed.warnings).toEqual([]);
  });

  it("reports the style table it classified from", () => {
    expect(parsed.styles.map((style) => [style.stroke, style.assignment])).toEqual([
      ["#000000", "B"],
      ["#ff0000", "M"],
      ["#0000ff", "V"],
    ]);
    expect(parsed.styles.every((style) => style.method === "color")).toBe(true);
    expect(parsed.confidence).toBeGreaterThan(0.9);
  });

  it("reads <title> as the pattern title", () => {
    expect(parsed.metadata.title).toBe("Square with an X");
  });

  /*
   * The strongest statement available about the converter: the same pattern,
   * written as an SVG and as a FOLD file, canonicalizes to the same bytes.
   * That covers the y flip, normalization and assignment mapping at once.
   */
  it("agrees with the FOLD fixture of the same pattern, hash for hash", () => {
    const fromSvg = ingest(parsed);
    const fromFold = ingest(parseFold(fixture("square-x.fold")));
    expect(fromSvg.contentHash).toBe(fromFold.contentHash);
    expect(fromSvg.grade.level).toBe("L1");
  });

  it("flips the y axis, because SVG grows downward and crease patterns do not", () => {
    const body = '<line x1="0" y1="0" x2="10" y2="2" stroke="#ff0000"/>';
    expect(parseSvg(svg(body)).graph.vertices).toEqual([
      [0, 0],
      [10, -2],
    ]);
    expect(parseSvg(svg(body), { flipY: false }).graph.vertices).toEqual([
      [0, 0],
      [10, 2],
    ]);
  });

  it("never writes a negative zero", () => {
    const parsedZero = parseSvg(svg('<line x1="0" y1="0" x2="10" y2="0" stroke="#000"/>'));
    expect(parsedZero.graph.vertices.every(([, y]) => !Object.is(y, -0))).toBe(true);
  });
});

describe("an Illustrator export", () => {
  const parsed = parseSvg(fixture("waterbomb-illustrator.svg"));

  it("finds the colours in the <style> block rather than on the elements", () => {
    expect(parsed.graph.assignments.join("")).toBe("BBBBMMVV");
    expect(parsed.styles.map((style) => style.stroke)).toEqual([
      "#000000",
      "#ff0000",
      "#0000ff",
    ]);
  });

  it("reads <line>, <polyline>, <rect> and <path> alike", () => {
    // Four paper edges from the <rect>, two <line> mountains, a <polyline>
    // diagonal and a <path> diagonal.
    expect(parsed.graph.edges.length).toBe(8);
  });

  it("applies group transforms", () => {
    // The mountain group is drawn at half scale inside scale(2), so its
    // creases have to land on the paper's mid-lines.
    const graph = ingest(parsed).graph;
    expect(graph.vertices).toContainEqual([0.5, 0.5]);
    expect(ingest(parsed).grade.level).toBe("L1");
  });

  it("raises the score when a layer name confirms the colour", () => {
    const mountains = parsed.styles.find((style) => style.stroke === "#ff0000")!;
    expect(mountains.layer).toBe("mountains");
    expect(mountains.confidence).toBeGreaterThan(0.97);
    expect(mountains.reason).toMatch(/layer name agrees/);
  });

  it("skips the background rectangle and says so", () => {
    expect(parsed.warnings.join("\n")).toMatch(/skipped 1 filled shape/);
  });

  it("ignores a print-only @media rule", () => {
    expect(parsed.warnings.join("\n")).toMatch(/@media print/);
  });

  it("credits the generator", () => {
    expect(parsed.metadata.creator).toBe("Adobe Illustrator 27.0.0");
  });
});

describe("a monochrome Inkscape export", () => {
  const parsed = parseSvg(fixture("kite-inkscape.svg"));

  it("falls back to layer names when every stroke is black", () => {
    const byAssignment = new Map(
      parsed.styles.map((style) => [style.assignment, style] as const),
    );
    expect(byAssignment.get("M")?.layer).toBe("Mountain folds");
    expect(byAssignment.get("M")?.method).toBe("layer");
    expect(byAssignment.get("B")?.layer).toBe("Paper edge");
  });

  it("reads a dashed unnamed layer as a low-confidence valley", () => {
    const dashed = parsed.styles.find((style) => style.dashed)!;
    expect([dashed.assignment, dashed.method]).toEqual(["V", "dash"]);
    expect(dashed.confidence).toBeLessThan(0.5);
    // Guessing on one crease in five has to drag the document's score down.
    expect(parsed.confidence).toBeLessThan(0.85);
  });

  it("skips a hidden layer", () => {
    // The "Notes" layer is display:none, so its rule line must not appear.
    expect(parsed.graph.edges.length).toBe(8);
  });

  it("recognizes Inkscape", () => {
    expect(parsed.metadata.creator).toBe("Inkscape");
  });
});

describe("assignment overrides", () => {
  it("re-reads the file with a corrected style map", () => {
    const parsed = parseSvg(fixture("kite-inkscape.svg"));
    const dashed = parsed.styles.find((style) => style.dashed)!;
    const corrected = parseSvg(fixture("kite-inkscape.svg"), {
      assignments: { [dashed.key]: "M" },
    });
    const style = corrected.styles.find((entry) => entry.key === dashed.key)!;
    expect([style.assignment, style.method, style.confidence]).toEqual(["M", "override", 1]);
    expect(corrected.confidence).toBeGreaterThan(parsed.confidence);
  });
});

describe("colours outside the palette", () => {
  const parsed = parseSvg(
    svg(
      '<line x1="0" y1="0" x2="100" y2="0" stroke="#ff8000"/>' +
        '<line x1="0" y1="0" x2="0" y2="100" stroke="#000000"/>',
    ),
  );

  it("marks them U rather than guessing (§3.4)", () => {
    const orange = parsed.styles.find((style) => style.stroke === "#ff8000")!;
    expect([orange.assignment, orange.method, orange.confidence]).toEqual(["U", "fallback", 0]);
  });

  it("names the styles it could not read", () => {
    expect(parsed.warnings.join("\n")).toMatch(/#ff8000 \(1 creases\)/);
  });

  it("honours unknownAssignment", () => {
    const forced = parseSvg(
      svg('<line x1="0" y1="0" x2="100" y2="0" stroke="#ff8000"/>'),
      { unknownAssignment: "F" },
    );
    expect(forced.graph.assignments).toEqual(["F"]);
  });

  it("matches reddish, not just red", () => {
    expect(classifyColor("#e8112d")?.assignment).toBe("M");
    expect(classifyColor("#1f3fbf")?.assignment).toBe("V");
    // Orange is nobody's mountain.
    expect(classifyColor("#ff8000")).toBeNull();
  });

  it("reads every spelling of a colour", () => {
    for (const red of ["#f00", "#FF0000", "rgb(255,0,0)", "rgb(100%, 0%, 0%)", "red"]) {
      expect(classifyColor(red)?.assignment, red).toBe("M");
    }
    expect(classifyColor("hsl(240, 100%, 50%)")?.assignment).toBe("V");
    expect(classifyColor("none")).toBeNull();
    expect(classifyColor("url(#gradient)")).toBeNull();
  });

  it("reads white as no information at all, not as a crease colour", () => {
    expect(classifyColor("#ffffff")).toBeNull();
  });
});

describe("layer names", () => {
  it("recognizes the usual vocabulary, in two languages", () => {
    expect(classifyLayer("Mountain")?.assignment).toBe("M");
    expect(classifyLayer("valley folds")?.assignment).toBe("V");
    expect(classifyLayer("山折り")?.assignment).toBe("M");
    expect(classifyLayer("谷")?.assignment).toBe("V");
    expect(classifyLayer("Paper outline")?.assignment).toBe("B");
    expect(classifyLayer("cut lines")?.assignment).toBe("C");
    expect(classifyLayer("construction")?.assignment).toBe("F");
  });

  it("says nothing about a layer called Layer 1", () => {
    expect(classifyLayer("Layer 1")).toBeNull();
    expect(classifyLayer("g4521")).toBeNull();
  });

  it("does not let a layer name override a colour that disagrees", () => {
    const parsed = parseSvg(
      svg('<g id="valleys"><line x1="0" y1="0" x2="100" y2="0" stroke="#ff0000"/></g>'),
    );
    const style = parsed.styles[0]!;
    expect(style.assignment).toBe("M");
    expect(style.confidence).toBeLessThan(0.9);
    expect(style.reason).toMatch(/layer name suggests V/);
  });
});

describe("path data", () => {
  const line = (d: string): ReturnType<typeof parseSvg> =>
    parseSvg(svg(`<path d="${d}" stroke="#ff0000" fill="none"/>`));

  it("handles relative commands, H/V and Z", () => {
    const parsed = line("M 0 0 h 100 v 100 H 0 Z");
    expect(parsed.graph.edges.length).toBe(4);
    expect(parsed.graph.vertices.length).toBe(4);
  });

  it("treats extra moveto arguments as implicit linetos", () => {
    expect(line("M0,0 100,0 100,100").graph.edges.length).toBe(2);
  });

  it("starts a new subpath at every M, without joining them", () => {
    expect(line("M0,0 L100,0 M0,100 L100,100").graph.edges.length).toBe(2);
  });

  it("flattens curves and warns that it did", () => {
    const parsed = line("M0,0 C 0,50 100,50 100,100");
    expect(parsed.graph.edges.length).toBeGreaterThan(1);
    expect(parsed.warnings.join("\n")).toMatch(/approximated 1 curve/);
  });

  it("flattens an elliptical arc", () => {
    const parsed = line("M0,0 A 50 50 0 0 1 100,0");
    expect(parsed.graph.edges.length).toBeGreaterThan(2);
    // Sweep 1 bulges upward in SVG's downward y, so downward once flipped.
    expect(Math.max(...parsed.graph.vertices.map(([, y]) => y))).toBeGreaterThan(40);
  });

  it("keeps what it read when the data runs out mid-command", () => {
    expect(line("M0,0 L100,0 L100").graph.edges.length).toBe(1);
  });
});

describe("transforms", () => {
  const at = (transform: string): readonly (readonly number[])[] =>
    parseSvg(
      svg(
        `<g transform="${transform}"><line x1="0" y1="0" x2="10" y2="0" stroke="#f00"/></g>`,
      ),
      { flipY: false },
    ).graph.vertices;

  it("applies translate, scale and matrix", () => {
    expect(at("translate(5, 7)")).toEqual([
      [5, 7],
      [15, 7],
    ]);
    expect(at("scale(2)")).toEqual([
      [0, 0],
      [20, 0],
    ]);
    expect(at("matrix(1 0 0 1 3 4)")).toEqual([
      [3, 4],
      [13, 4],
    ]);
  });

  it("applies rotate about a point", () => {
    const [a, b] = at("rotate(90, 0, 0)") as [readonly number[], readonly number[]];
    expect(a[0]).toBeCloseTo(0);
    expect(b[0]).toBeCloseTo(0);
    expect(b[1]).toBeCloseTo(10);
  });

  it("composes nested transforms", () => {
    const vertices = parseSvg(
      svg(
        '<g transform="translate(10,0)"><g transform="scale(2)">' +
          '<line x1="0" y1="0" x2="5" y2="0" stroke="#f00"/></g></g>',
      ),
      { flipY: false },
    ).graph.vertices;
    expect(vertices).toEqual([
      [10, 0],
      [20, 0],
    ]);
  });
});

describe("what an SVG cannot say", () => {
  it("warns when nothing was read as the paper edge", () => {
    const parsed = parseSvg(svg('<line x1="0" y1="0" x2="100" y2="0" stroke="#ff0000"/>'));
    expect(parsed.warnings.join("\n")).toMatch(/no boundary creases/);
  });

  it("warns about <use> rather than silently dropping the geometry", () => {
    const parsed = parseSvg(
      svg(
        '<line x1="0" y1="0" x2="100" y2="0" stroke="#000"/><use href="#anything" x="10"/>',
      ),
    );
    expect(parsed.warnings.join("\n")).toMatch(/skipped 1 <use> element/);
  });

  it("reports elements it cannot read as creases", () => {
    const parsed = parseSvg(
      svg('<line x1="0" y1="0" x2="100" y2="0" stroke="#000"/><circle r="5"/>'),
    );
    expect(parsed.warnings.join("\n")).toMatch(/skipped 1 <circle> element/);
  });

  it("throws when there is no <svg> root", () => {
    expect(() => parseSvg("<html><body>not a drawing</body></html>")).toThrow(ParseError);
  });

  it("throws when the drawing has no strokes", () => {
    expect(() => parseSvg(svg('<rect width="10" height="10" fill="#fff"/>'))).toThrow(
      /no stroked lines/,
    );
  });

  it("throws on XML that is not well formed", () => {
    expect(() => parseSvg("<svg><line")).toThrow(ParseError);
  });
});

describe("round trip through the renderer", () => {
  /*
   * `renderSvg` is what Kamibase hands out as a download, so reading one back
   * has to return the pattern that was exported. It is also the only end-to-end
   * check of the palette in both directions.
   */
  const original = ingest(parseCp(fixture("crane.cp")));
  const returned = ingest(parseSvg(renderSvg(original.graph, { size: 1000 })));

  it("preserves every assignment", () => {
    expect(returned.graph.assignments).toEqual(original.graph.assignments);
  });

  it("preserves the geometry to within the renderer's precision", () => {
    expect(returned.graph.vertices.length).toBe(original.graph.vertices.length);
    original.graph.vertices.forEach((vertex, i) => {
      const other = returned.graph.vertices[i]!;
      expect(other[0]).toBeCloseTo(vertex[0], 5);
      expect(other[1]).toBeCloseTo(vertex[1], 5);
    });
  });

  it("still grades L1", () => {
    expect(returned.grade.level).toBe("L1");
  });
});

describe("confidence", () => {
  it("is the length-weighted mean, so a long uncertain crease costs more", () => {
    const parsed = parseSvg(
      svg(
        '<line x1="0" y1="0" x2="100" y2="0" stroke="#ff0000"/>' +
          '<line x1="0" y1="10" x2="1" y2="10" stroke="#ff8000"/>',
      ),
    );
    // 100 units at 0.97 against 1 unit at 0, so barely below the palette score.
    expect(parsed.confidence).toBeGreaterThan(0.95);

    const reversed = parseSvg(
      svg(
        '<line x1="0" y1="0" x2="1" y2="0" stroke="#ff0000"/>' +
          '<line x1="0" y1="10" x2="100" y2="10" stroke="#ff8000"/>',
      ),
    );
    expect(reversed.confidence).toBeLessThan(0.05);
  });
});
