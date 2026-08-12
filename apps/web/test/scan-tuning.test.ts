import { describe, expect, it } from "vitest";
import { DEFAULT_TUNING, tuningToOptions, type ScanTuning } from "@/lib/scan/types";
import { readImportPayload } from "@/lib/upload/handoff";

/**
 * The pure parts of the scan studio: what its controls mean, and what survives
 * the trip to the editor.
 *
 * The detection itself is tested in `@kamibase/vision`, against synthetic
 * photographs. What is left here is the translation layer, which is where the
 * mistakes are quiet: a slider wired backwards still moves.
 */

function tuning(overrides: Partial<ScanTuning> = {}): ScanTuning {
  return { ...DEFAULT_TUNING, ...overrides };
}

describe("tuningToOptions", () => {
  it("lowers the noise floor as sensitivity rises", () => {
    // Backwards here would mean the sensitivity slider finds fewer creases the
    // further right you drag it, which is the kind of bug people work around
    // rather than report.
    const cautious = tuningToOptions(tuning({ sensitivity: 0 }));
    const eager = tuningToOptions(tuning({ sensitivity: 1 }));

    expect(eager.edges.noiseFloorMultiple).toBeLessThan(cautious.edges.noiseFloorMultiple);
    expect(eager.edges.strongPercentile).toBeGreaterThan(cautious.edges.strongPercentile);
  });

  it("keeps the noise floor above 1, so a blank sheet stays blank at any setting", () => {
    for (const sensitivity of [0, 0.25, 0.5, 0.75, 1]) {
      expect(tuningToOptions(tuning({ sensitivity })).edges.noiseFloorMultiple).toBeGreaterThan(1);
    }
  });

  it("clamps a sensitivity outside 0 to 1 rather than inverting the floor", () => {
    expect(tuningToOptions(tuning({ sensitivity: 5 })).edges.noiseFloorMultiple).toBe(
      tuningToOptions(tuning({ sensitivity: 1 })).edges.noiseFloorMultiple,
    );
    expect(tuningToOptions(tuning({ sensitivity: -3 })).edges.noiseFloorMultiple).toBe(
      tuningToOptions(tuning({ sensitivity: 0 })).edges.noiseFloorMultiple,
    );
  });

  it("turns the grid choices into what the scanner expects", () => {
    expect(tuningToOptions(tuning({ grid: "none" })).grid).toBeNull();
    expect(tuningToOptions(tuning({ grid: "auto" })).grid).toBe("auto");
    expect(tuningToOptions(tuning({ grid: 16 })).grid).toBe(16);
  });

  it("passes an angle step of 0 straight through, which means do not snap", () => {
    expect(tuningToOptions(tuning({ angleStep: 0 })).angleStepDegrees).toBe(0);
    expect(tuningToOptions(tuning({ angleStep: 22.5 })).angleStepDegrees).toBe(22.5);
  });

  it("defaults to the 22.5 degree lattice, which is what origami uses", () => {
    expect(DEFAULT_TUNING.angleStep).toBe(22.5);
    expect(DEFAULT_TUNING.grid).toBe("auto");
  });
});

describe("the handoff to the editor", () => {
  const doc = [{ x1: 0, y1: 0, x2: 1, y2: 1, assignment: "M" }];

  it("carries the scan's caveats and confidence through", () => {
    const payload = readImportPayload(
      JSON.stringify({
        title: "Scanned pattern",
        slug: "scanned",
        doc,
        source: "scan",
        notes: ["1 crease could go either way."],
        confidence: 0.42,
      }),
    );

    expect(payload?.source).toBe("scan");
    expect(payload?.notes).toEqual(["1 crease could go either way."]);
    expect(payload?.confidence).toBeCloseTo(0.42);
  });

  it("still reads a converter payload that has none of those fields", () => {
    const payload = readImportPayload(JSON.stringify({ title: "T", slug: "s", doc }));
    expect(payload?.doc).toHaveLength(1);
    expect(payload?.source).toBeUndefined();
    expect(payload?.notes).toBeUndefined();
  });

  it("drops junk in the optional fields rather than rendering it", () => {
    // Session storage is user-writable, so this is untrusted input.
    const payload = readImportPayload(
      JSON.stringify({
        title: "T",
        slug: "s",
        doc,
        source: "somewhere-else",
        notes: ["fine", 42, null, { bad: true }],
        confidence: "high",
      }),
    );

    expect(payload?.source).toBeUndefined();
    expect(payload?.notes).toEqual(["fine"]);
    expect(payload?.confidence).toBeUndefined();
  });

  it("refuses a payload with no usable geometry", () => {
    expect(readImportPayload(JSON.stringify({ title: "T", slug: "s", doc: [] }))).toBeNull();
    expect(readImportPayload("not json")).toBeNull();
    expect(readImportPayload(null)).toBeNull();
  });
});
