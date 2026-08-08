import {
  graphFromSegments,
  projectOntoSegment,
  type CreaseGraph,
  type EdgeAssignment,
  type Segment,
} from "@kamibase/core";

/**
 * The editor's document.
 *
 * A flat list of segments rather than a vertex-indexed graph. DESIGN.md §4
 * wants "immutable geometry snapshots with structural sharing → free
 * undo/redo", and a segment list gives exactly that: every edit returns a new
 * array, undo is keeping the old one, and nothing has to re-index.
 *
 * The graph is *derived*. `graphFromSegments` is the same function the parsers
 * use, so what the editor holds and what an imported `.cp` produces are the
 * same thing by construction rather than by agreement.
 *
 * Coordinates are the unit square, matching `.kami`'s normalized space
 * (DESIGN.md §2.4.3), so nothing needs rescaling on the way out.
 */
export interface EditorSegment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly assignment: EdgeAssignment;
}

export type EditorDoc = readonly EditorSegment[];

/** The paper edge of a fresh document: a unit square with `B` on all sides. */
export function emptyPaper(): EditorDoc {
  return [
    { x1: 0, y1: 0, x2: 1, y2: 0, assignment: "B" },
    { x1: 1, y1: 0, x2: 1, y2: 1, assignment: "B" },
    { x1: 1, y1: 1, x2: 0, y2: 1, assignment: "B" },
    { x1: 0, y1: 1, x2: 0, y2: 0, assignment: "B" },
  ];
}

/** Read an existing pattern's geometry into editable segments. */
export function docFromGraph(graph: CreaseGraph): EditorDoc {
  return graph.edges.flatMap((edge, i) => {
    const a = graph.vertices[edge[0]];
    const b = graph.vertices[edge[1]];
    if (!a || !b) return [];
    return [
      {
        x1: a[0],
        y1: a[1],
        x2: b[0],
        y2: b[1],
        assignment: graph.assignments[i] ?? "U",
      },
    ];
  });
}

/** The derived graph, via the same builder the parsers use. */
export function graphFromDoc(doc: EditorDoc): CreaseGraph {
  return graphFromSegments(doc as readonly Segment[]).graph;
}

/* -------------------------------------------------------------------------- */
/* Editing operations. Every one returns a new document.                       */
/* -------------------------------------------------------------------------- */

const MIN_LENGTH = 1e-6;

/** True when a segment is long enough to be worth keeping. */
export function isDrawable(segment: EditorSegment): boolean {
  return Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1) > MIN_LENGTH;
}

/**
 * Add a crease.
 *
 * A segment covering the same pair of endpoints replaces the old one rather
 * than stacking on it. Otherwise drawing over a crease to change its
 * assignment would silently leave a duplicate edge behind, which is a §2.4.5
 * defect nobody asked for.
 */
export function addSegment(doc: EditorDoc, segment: EditorSegment): EditorDoc {
  if (!isDrawable(segment)) return doc;
  const kept = doc.filter((existing) => !sameEndpoints(existing, segment));
  return [...kept, segment];
}

export function removeSegment(doc: EditorDoc, index: number): EditorDoc {
  if (index < 0 || index >= doc.length) return doc;
  return doc.filter((_, i) => i !== index);
}

export function reassignSegment(
  doc: EditorDoc,
  index: number,
  assignment: EdgeAssignment,
): EditorDoc {
  if (index < 0 || index >= doc.length) return doc;
  return doc.map((segment, i) => (i === index ? { ...segment, assignment } : segment));
}

function sameEndpoints(a: EditorSegment, b: EditorSegment, epsilon = 1e-9): boolean {
  const forward =
    Math.abs(a.x1 - b.x1) < epsilon &&
    Math.abs(a.y1 - b.y1) < epsilon &&
    Math.abs(a.x2 - b.x2) < epsilon &&
    Math.abs(a.y2 - b.y2) < epsilon;
  const reversed =
    Math.abs(a.x1 - b.x2) < epsilon &&
    Math.abs(a.y1 - b.y2) < epsilon &&
    Math.abs(a.x2 - b.x1) < epsilon &&
    Math.abs(a.y2 - b.y1) < epsilon;
  return forward || reversed;
}

/* -------------------------------------------------------------------------- */
/* Snapping and hit-testing                                                    */
/* -------------------------------------------------------------------------- */

export interface SnapOptions {
  /** n×n grid. 0 disables grid snapping. */
  readonly divisions: number;
  /** Also snap to the endpoints of existing creases. */
  readonly snapToVertices: boolean;
  /** Snap radius in unit coordinates. */
  readonly radius: number;
}

/**
 * Snap a point to the grid or to an existing vertex.
 *
 * Existing vertices win over the grid: a crease that lands exactly on a
 * neighbour's endpoint is the difference between a closed vertex and a
 * T-junction the validator will flag (§2.4.6), and it is the thing a person
 * drawing with a fingertip cannot hit by hand.
 */
export function snapPoint(
  point: readonly [number, number],
  doc: EditorDoc,
  options: SnapOptions,
): [number, number] {
  if (options.snapToVertices) {
    let best: [number, number] | null = null;
    let bestDistance = options.radius;
    for (const segment of doc) {
      for (const candidate of [
        [segment.x1, segment.y1] as [number, number],
        [segment.x2, segment.y2] as [number, number],
      ]) {
        const distance = Math.hypot(candidate[0] - point[0], candidate[1] - point[1]);
        if (distance < bestDistance) {
          best = candidate;
          bestDistance = distance;
        }
      }
    }
    if (best) return best;
  }

  if (options.divisions > 0) {
    const step = 1 / options.divisions;
    const snapped: [number, number] = [
      Math.round(point[0] / step) * step,
      Math.round(point[1] / step) * step,
    ];
    if (Math.hypot(snapped[0] - point[0], snapped[1] - point[1]) <= options.radius) {
      return [round9(snapped[0]), round9(snapped[1])];
    }
  }

  return [round9(point[0]), round9(point[1])];
}

function round9(value: number): number {
  const rounded = Math.round(value * 1e9) / 1e9;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Index of the segment nearest `point`, or -1 if none is within `radius`. */
export function segmentAt(
  doc: EditorDoc,
  point: readonly [number, number],
  radius: number,
): number {
  let best = -1;
  let bestDistance = radius;
  doc.forEach((segment, index) => {
    const { distance } = projectOntoSegment(
      [point[0], point[1]],
      [segment.x1, segment.y1],
      [segment.x2, segment.y2],
    );
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

/* -------------------------------------------------------------------------- */
/* Undo / redo                                                                 */
/* -------------------------------------------------------------------------- */

export interface History {
  readonly past: readonly EditorDoc[];
  readonly present: EditorDoc;
  readonly future: readonly EditorDoc[];
}

/** Bounded so a long session cannot grow the heap without limit. */
const HISTORY_LIMIT = 100;

export function initHistory(doc: EditorDoc): History {
  return { past: [], present: doc, future: [] };
}

export function commit(history: History, next: EditorDoc): History {
  if (next === history.present) return history;
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
  };
}

export function undo(history: History): History {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future].slice(0, HISTORY_LIMIT),
  };
}

export function redo(history: History): History {
  const next = history.future[0];
  if (next === undefined) return history;
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: history.future.slice(1),
  };
}

export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

export function canRedo(history: History): boolean {
  return history.future.length > 0;
}
