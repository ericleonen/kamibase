import { describe, expect, it } from "vitest";
import {
  ORIGAMI_SIMULATOR_PALETTE,
  ingest,
  parseCp,
  renderSvg,
  type EdgeAssignment,
} from "../src/index.js";
import { fixture, graph } from "./helpers.js";

const allAssignments = graph(
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0.5, 0.5],
    [0.5, 0],
    [0, 0.5],
  ],
  [
    [0, 1, "B"],
    [1, 2, "B"],
    [2, 3, "B"],
    [3, 0, "B"],
    [4, 0, "M"],
    [4, 1, "V"],
    [4, 2, "F"],
    [4, 3, "U"],
    [4, 5, "C"],
    [4, 6, "J"],
  ],
);

function pathFor(svg: string, assignment: EdgeAssignment): string | undefined {
  return svg.match(new RegExp(`<path data-assignment="${assignment}"[^>]*>`))?.[0];
}

describe("the Origami Simulator palette", () => {
  it("is exactly the one DESIGN.md §3.3 specifies", () => {
    expect(ORIGAMI_SIMULATOR_PALETTE.M).toBe("#ff0000");
    expect(ORIGAMI_SIMULATOR_PALETTE.V).toBe("#0000ff");
    expect(ORIGAMI_SIMULATOR_PALETTE.B).toBe("#000000");
    expect(ORIGAMI_SIMULATOR_PALETTE.F).toBe("#ffff00");
    expect(ORIGAMI_SIMULATOR_PALETTE.C).toBe("#00ff00");
    expect(ORIGAMI_SIMULATOR_PALETTE.U).toBe("#ff00ff");
  });

  it("colours mountain red, valley blue and boundary black", () => {
    const svg = renderSvg(allAssignments);
    expect(pathFor(svg, "M")).toContain('stroke="#ff0000"');
    expect(pathFor(svg, "V")).toContain('stroke="#0000ff"');
    expect(pathFor(svg, "B")).toContain('stroke="#000000"');
  });

  it("colours the rest of the assignments too", () => {
    const svg = renderSvg(allAssignments);
    expect(pathFor(svg, "F")).toContain('stroke="#ffff00"');
    expect(pathFor(svg, "C")).toContain('stroke="#00ff00"');
    expect(pathFor(svg, "U")).toContain('stroke="#ff00ff"');
    expect(pathFor(svg, "J")).toContain('stroke="#00ffff"');
  });

  it("accepts per-assignment overrides", () => {
    const svg = renderSvg(allAssignments, { palette: { M: "#800000" } });
    expect(pathFor(svg, "M")).toContain('stroke="#800000"');
    expect(pathFor(svg, "V")).toContain('stroke="#0000ff"');
  });

  it("draws the paper edge last so it sits on top", () => {
    const svg = renderSvg(allAssignments);
    expect(svg.indexOf('data-assignment="B"')).toBeGreaterThan(
      svg.indexOf('data-assignment="M"'),
    );
  });
});

describe("renderSvg", () => {
  it("emits one path per assignment, not one element per edge", () => {
    const svg = renderSvg(allAssignments);
    // Ten edges across all seven assignments -> seven paths.
    expect(svg.match(/<path /g)?.length).toBe(7);
    expect(svg).not.toContain("<line");
  });

  it("sizes the viewBox to the pattern plus padding", () => {
    const svg = renderSvg(allAssignments, { size: 100, padding: 10 });
    expect(svg).toContain('width="120" height="120"');
    expect(svg).toContain('viewBox="0 0 120 120"');
  });

  it("preserves aspect ratio for non-square paper", () => {
    const wide = graph(
      [
        [0, 0],
        [1, 0],
        [1, 0.5],
        [0, 0.5],
      ],
      [
        [0, 1, "B"],
        [1, 2, "B"],
        [2, 3, "B"],
        [3, 0, "B"],
      ],
    );
    expect(renderSvg(wide, { size: 100, padding: 0 })).toContain(
      'width="100" height="50"',
    );
  });

  it("flips the y axis by default so patterns are not upside down", () => {
    const line = graph(
      [
        [0, 0],
        [1, 1],
      ],
      [[0, 1, "M"]],
    );
    const flipped = renderSvg(line, { size: 100, padding: 0 });
    expect(pathFor(flipped, "M")).toContain('d="M0 100L100 0"');
    const unflipped = renderSvg(line, { size: 100, padding: 0, flipY: false });
    expect(pathFor(unflipped, "M")).toContain('d="M0 0L100 100"');
  });

  it("draws a background by default and can be made transparent", () => {
    expect(renderSvg(allAssignments)).toContain('<rect width="100%" height="100%"');
    expect(renderSvg(allAssignments, { background: null })).not.toContain("<rect");
  });

  it("can draw vertices and faces for the repair view", () => {
    const result = ingest(parseCp(fixture("waterbomb.cp")));
    const svg = renderSvg(result.graph, {
      showVertices: true,
      faceFill: "#eeeeee",
    });
    expect(svg).toContain("<circle");
    expect(svg).toContain("<polygon");
    expect(svg).toContain('fill="#eeeeee"');
  });

  it("omits the faces layer when there are no faces", () => {
    expect(renderSvg(allAssignments, { faceFill: "#eeeeee" })).not.toContain("<polygon");
  });

  it("adds title and desc when given", () => {
    const svg = renderSvg(allAssignments, {
      title: "Crane <by> Eric & co",
      description: "a & b",
    });
    expect(svg).toContain("<title>Crane &lt;by&gt; Eric &amp; co</title>");
    expect(svg).toContain("<desc>a &amp; b</desc>");
  });

  it("escapes quotes in attribute values", () => {
    const svg = renderSvg(allAssignments, { background: '"><script>' });
    expect(svg).toContain('fill="&quot;&gt;&lt;script&gt;"');
    expect(svg).not.toContain("<script>");
  });

  it("can prepend an XML declaration for standalone files", () => {
    expect(renderSvg(allAssignments, { xmlDeclaration: true })).toMatch(
      /^<\?xml version="1\.0" encoding="UTF-8"\?><svg/,
    );
  });

  it("renders an empty graph without throwing", () => {
    expect(() => renderSvg(graph([], []))).not.toThrow();
    expect(renderSvg(graph([], []))).toContain("<svg");
  });

  it("renders every fixture", () => {
    for (const name of ["crane.cp", "miura.cp", "waterbomb.cp"]) {
      const result = ingest(parseCp(fixture(name)));
      const svg = renderSvg(result.graph, { title: name });
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
      expect(svg).toContain('stroke="#000000"');
    }
  });
});
