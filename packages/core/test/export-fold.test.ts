import { describe, expect, it } from "vitest";
import {
  checkFoldDocument,
  ingest,
  parseCp,
  parseFold,
  toFold,
  toFoldJson,
  type KamiDocument,
} from "../src/index.js";
import { fixture, fixtureJson } from "./helpers.js";

const doc = fixtureJson<KamiDocument>("square-spokes.kami");

describe("toFold", () => {
  it("drops every kami: key", () => {
    const fold = toFold(doc) as Record<string, unknown>;
    expect(Object.keys(fold).filter((key) => key.startsWith("kami:"))).toEqual([]);
  });

  it("keeps the FOLD geometry byte for byte", () => {
    const fold = toFold(doc);
    expect(fold.vertices_coords).toEqual(doc.vertices_coords);
    expect(fold.edges_vertices).toEqual(doc.edges_vertices);
    expect(fold.edges_assignment).toEqual(doc.edges_assignment);
    expect(fold.edges_foldAngle).toEqual(doc.edges_foldAngle);
    expect(fold.faces_vertices).toEqual(doc.faces_vertices);
  });

  it("keeps the FOLD file and frame metadata", () => {
    const fold = toFold(doc);
    expect(fold.file_spec).toBe(1.2);
    expect(fold.file_title).toBe("Square with four spokes");
    expect(fold.frame_classes).toEqual(["creasePattern"]);
    expect(fold.frame_unit).toBe("unit");
  });

  it("leaves another tool's extension block alone by default", () => {
    const fold = toFold({ ...doc, "oripa:paperSize": 400 } as KamiDocument) as Record<
      string,
      unknown
    >;
    expect(fold["oripa:paperSize"]).toBe(400);
  });

  it("strips all extensions when asked", () => {
    const fold = toFold({ ...doc, "oripa:paperSize": 400 } as KamiDocument, {
      stripAllExtensions: true,
    }) as Record<string, unknown>;
    expect(fold["oripa:paperSize"]).toBeUndefined();
  });

  it("can keep named kami: keys for round-trip provenance", () => {
    const fold = toFold(doc, { keep: ["kami:id"] }) as Record<string, unknown>;
    expect(fold["kami:id"]).toBe("01J8XM4ZKQ7YV2N6R0BHTC3WFD");
    expect(fold["kami:license"]).toBeUndefined();
  });

  it("filters inside file_frames too", () => {
    const withFrames = {
      ...doc,
      file_frames: [
        {
          frame_classes: ["foldedForm"],
          "kami:simulation": { verified: true },
          vertices_coords: [[0, 0, 0]],
        },
      ],
    } as unknown as KamiDocument;
    const fold = toFold(withFrames);
    const frame = fold.file_frames?.[0] as Record<string, unknown>;
    expect(frame["kami:simulation"]).toBeUndefined();
    expect(frame["frame_classes"]).toEqual(["foldedForm"]);
  });

  it("can restamp file_creator", () => {
    expect(toFold(doc, { creator: "Kamibase export" }).file_creator).toBe(
      "Kamibase export",
    );
  });

  it("does not mutate the input document", () => {
    const before = JSON.stringify(doc);
    toFold(doc, { stripAllExtensions: true });
    expect(JSON.stringify(doc)).toBe(before);
  });

  it("produces a document the FOLD schema accepts", () => {
    expect(checkFoldDocument(toFold(doc)).ok).toBe(true);
  });

  it("produces a document our own .fold parser reads back identically", () => {
    const reparsed = parseFold(toFoldJson(doc));
    expect(reparsed.format).toBe("fold");
    expect(reparsed.graph.vertices).toEqual(
      doc.vertices_coords.map(([x, y]) => [x, y]),
    );
    expect(reparsed.graph.assignments).toEqual(doc.edges_assignment);
  });
});

describe("toFoldJson", () => {
  it("pretty-prints by default and ends with a newline", () => {
    const json = toFoldJson(doc);
    expect(json).toMatch(/^\{\n {2}"file_spec": 1.2/);
    expect(json.endsWith("\n")).toBe(true);
    expect(JSON.parse(json)).toEqual(toFold(doc));
  });

  it("emits canonical bytes when pretty is false", () => {
    const json = toFoldJson(doc, { pretty: false });
    expect(json).not.toMatch(/\n/);
    expect(JSON.parse(json)).toEqual(toFold(doc));
  });

  it("exports a converted .cp the same way", () => {
    const result = ingest(parseCp(fixture("miura.cp")));
    const json = toFoldJson(result.document);
    const parsedBack = JSON.parse(json) as Record<string, unknown>;
    expect(parsedBack["kami:contentHash"]).toBeUndefined();
    expect((parsedBack["edges_vertices"] as unknown[]).length).toBe(
      result.graph.edges.length,
    );
  });
});
