import { describe, expect, it } from "vitest";
import {
  addSegment,
  canRedo,
  canUndo,
  commit,
  docFromGraph,
  emptyPaper,
  graphFromDoc,
  initHistory,
  isDrawable,
  reassignSegment,
  redo,
  removeSegment,
  segmentAt,
  snapPoint,
  undo,
  type EditorDoc,
} from "@/lib/editor/model";

const M = { x1: 0, y1: 0, x2: 1, y2: 1, assignment: "M" } as const;

describe("emptyPaper", () => {
  it("is a closed unit square of boundary edges", () => {
    const doc = emptyPaper();
    expect(doc.length).toBe(4);
    expect(doc.every((s) => s.assignment === "B")).toBe(true);
    const graph = graphFromDoc(doc);
    expect(graph.vertices.length).toBe(4);
    expect(graph.edges.length).toBe(4);
  });
});

describe("addSegment", () => {
  it("appends a crease", () => {
    expect(addSegment(emptyPaper(), M).length).toBe(5);
  });

  it("ignores a zero-length crease", () => {
    const doc = emptyPaper();
    expect(addSegment(doc, { x1: 0.5, y1: 0.5, x2: 0.5, y2: 0.5, assignment: "M" })).toBe(doc);
  });

  it("replaces rather than stacks when drawing over an existing crease", () => {
    // Otherwise redrawing to change an assignment leaves a duplicate edge,
    // which is a §2.4.5 defect the user never asked for.
    const doc = addSegment(emptyPaper(), M);
    const again = addSegment(doc, { ...M, assignment: "V" });
    expect(again.length).toBe(5);
    expect(again.at(-1)?.assignment).toBe("V");
  });

  it("treats a reversed crease as the same crease", () => {
    const doc = addSegment(emptyPaper(), M);
    const reversed = addSegment(doc, { x1: 1, y1: 1, x2: 0, y2: 0, assignment: "V" });
    expect(reversed.length).toBe(5);
  });

  it("does not mutate the input", () => {
    const doc = emptyPaper();
    addSegment(doc, M);
    expect(doc.length).toBe(4);
  });
});

describe("removeSegment and reassignSegment", () => {
  it("removes by index", () => {
    expect(removeSegment(emptyPaper(), 0).length).toBe(3);
  });

  it("ignores an out-of-range index", () => {
    const doc = emptyPaper();
    expect(removeSegment(doc, 99)).toBe(doc);
    expect(removeSegment(doc, -1)).toBe(doc);
    expect(reassignSegment(doc, 99, "M")).toBe(doc);
  });

  it("reassigns one crease and leaves the rest alone", () => {
    const doc = reassignSegment(emptyPaper(), 1, "V");
    expect(doc[1]?.assignment).toBe("V");
    expect(doc.filter((s) => s.assignment === "B").length).toBe(3);
  });
});

describe("isDrawable", () => {
  it("rejects a crease shorter than the epsilon", () => {
    expect(isDrawable({ x1: 0, y1: 0, x2: 1e-9, y2: 0, assignment: "M" })).toBe(false);
    expect(isDrawable(M)).toBe(true);
  });
});

describe("snapPoint", () => {
  const doc: EditorDoc = emptyPaper();

  it("snaps to the grid when close enough", () => {
    const snapped = snapPoint([0.26, 0.24], doc, {
      divisions: 4,
      snapToVertices: false,
      radius: 0.05,
    });
    expect(snapped).toEqual([0.25, 0.25]);
  });

  it("leaves a point alone when the grid is too far away", () => {
    const snapped = snapPoint([0.4, 0.4], doc, {
      divisions: 4,
      snapToVertices: false,
      radius: 0.02,
    });
    expect(snapped).toEqual([0.4, 0.4]);
  });

  it("does not snap at all with the grid off", () => {
    expect(
      snapPoint([0.37, 0.61], doc, { divisions: 0, snapToVertices: false, radius: 0.05 }),
    ).toEqual([0.37, 0.61]);
  });

  it("prefers an existing vertex over the grid", () => {
    // A crease that lands on a neighbour's endpoint closes the vertex; one
    // that lands on the grid nearby leaves a T-junction (§2.4.6).
    const withCentre = addSegment(doc, { x1: 0.5, y1: 0.5, x2: 0.9, y2: 0.9, assignment: "M" });
    const snapped = snapPoint([0.52, 0.52], withCentre, {
      divisions: 8,
      snapToVertices: true,
      radius: 0.06,
    });
    expect(snapped).toEqual([0.5, 0.5]);
  });

  it("rounds to the canonical 9 decimal places", () => {
    const snapped = snapPoint([1 / 3, 2 / 3], doc, {
      divisions: 0,
      snapToVertices: false,
      radius: 0,
    });
    expect(snapped[0]).toBe(0.333333333);
    expect(String(snapped[0])).not.toContain("e");
  });

  it("never produces negative zero", () => {
    const snapped = snapPoint([-1e-12, 0], doc, {
      divisions: 0,
      snapToVertices: false,
      radius: 0,
    });
    expect(Object.is(snapped[0], -0)).toBe(false);
  });
});

describe("segmentAt", () => {
  const doc = addSegment(emptyPaper(), M);

  it("finds the crease under a point", () => {
    expect(segmentAt(doc, [0.5, 0.5], 0.02)).toBe(4);
    expect(segmentAt(doc, [0.5, 0], 0.02)).toBe(0);
  });

  it("returns -1 when nothing is close enough", () => {
    expect(segmentAt(doc, [0.5, 0.8], 0.02)).toBe(-1);
    expect(segmentAt([], [0.5, 0.5], 0.5)).toBe(-1);
  });

  it("picks the nearest of two candidates", () => {
    const crowded = addSegment(doc, { x1: 0, y1: 0.9, x2: 1, y2: 0.9, assignment: "V" });
    expect(crowded[segmentAt(crowded, [0.5, 0.895], 0.05)]?.assignment).toBe("V");
  });
});

describe("docFromGraph", () => {
  it("round-trips geometry back out of a graph", () => {
    const doc = addSegment(emptyPaper(), M);
    const round = docFromGraph(graphFromDoc(doc));
    expect(round.length).toBe(doc.length);
    expect(round.filter((s) => s.assignment === "M").length).toBe(1);
  });

  it("skips edges whose vertices are missing rather than throwing", () => {
    const broken = { vertices: [[0, 0]] as [number, number][], edges: [[0, 5]] as [number, number][], assignments: ["M" as const] };
    expect(docFromGraph(broken)).toEqual([]);
  });
});

describe("history", () => {
  it("starts with nothing to undo or redo", () => {
    const history = initHistory(emptyPaper());
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  it("undoes and redoes an edit", () => {
    let history = initHistory(emptyPaper());
    history = commit(history, addSegment(history.present, M));
    expect(history.present.length).toBe(5);

    history = undo(history);
    expect(history.present.length).toBe(4);
    expect(canRedo(history)).toBe(true);

    history = redo(history);
    expect(history.present.length).toBe(5);
  });

  it("drops the redo stack once a new edit lands", () => {
    let history = initHistory(emptyPaper());
    history = commit(history, addSegment(history.present, M));
    history = undo(history);
    history = commit(history, addSegment(history.present, { ...M, assignment: "V" }));
    expect(canRedo(history)).toBe(false);
  });

  it("ignores a commit that changes nothing", () => {
    const history = initHistory(emptyPaper());
    expect(commit(history, history.present)).toBe(history);
  });

  it("is a no-op at either end", () => {
    const history = initHistory(emptyPaper());
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });

  it("bounds the past so a long session cannot grow without limit", () => {
    let history = initHistory(emptyPaper());
    // Offset off y=0 so none of these lands on the boundary — an overlapping
    // crease is replaced rather than appended, which would confuse the count
    // this test is actually about.
    for (let i = 1; i <= 150; i += 1) {
      history = commit(
        history,
        addSegment(history.present, {
          x1: 0,
          y1: i / 200,
          x2: 1,
          y2: i / 200,
          assignment: "M",
        }),
      );
    }
    expect(history.past.length).toBeLessThanOrEqual(100);
    expect(history.present.length).toBe(154);
  });
});
