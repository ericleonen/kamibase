import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CreaseGraph, EdgeAssignment } from "../src/index.js";

export const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

export function fixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf8");
}

export function fixtureJson<T = unknown>(name: string): T {
  return JSON.parse(fixture(name)) as T;
}

/**
 * Terse graph literal for tests: `graph([[0,0],[1,0]], [[0,1,"B"]])`.
 */
export function graph(
  vertices: readonly (readonly [number, number])[],
  edges: readonly (readonly [number, number, EdgeAssignment])[],
  faces?: readonly (readonly number[])[],
): CreaseGraph {
  return {
    vertices: vertices.map(([x, y]) => [x, y] as const),
    edges: edges.map(([a, b]) => [a, b] as const),
    assignments: edges.map(([, , assignment]) => assignment),
    ...(faces ? { faces: faces.map((face) => [...face]) } : {}),
  };
}

/** The unit square as four `B` edges, plus any extra vertices/edges. */
export function unitSquare(): {
  vertices: [number, number][];
  edges: [number, number, EdgeAssignment][];
} {
  return {
    vertices: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    edges: [
      [0, 1, "B"],
      [1, 2, "B"],
      [2, 3, "B"],
      [3, 0, "B"],
    ],
  };
}
