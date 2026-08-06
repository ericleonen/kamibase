import { boundingBox } from "../geometry/vec.js";
import type { CreaseGraph, EdgeAssignment } from "../graph/types.js";

/**
 * The Origami Simulator palette (DESIGN.md §3.3).
 *
 * "Origami Simulator's convention is the de facto standard and we adopt it
 * exactly: red `#ff0000` = mountain, blue `#0000ff` = valley, black `#000000`
 * = border, yellow `#ffff00` = triangulation, green `#00ff00` = cut, magenta
 * `#ff00ff` = undriven."
 *
 * FOLD's `J` (join) has no colour in that palette; we render it cyan so it is
 * visible and obviously not one of the six standard colours.
 */
export const ORIGAMI_SIMULATOR_PALETTE: Readonly<Record<EdgeAssignment, string>> = {
  M: "#ff0000",
  V: "#0000ff",
  B: "#000000",
  F: "#ffff00",
  C: "#00ff00",
  U: "#ff00ff",
  J: "#00ffff",
};

/** Draw order: faint construction lines first, the paper edge on top. */
const DRAW_ORDER: readonly EdgeAssignment[] = ["F", "U", "J", "C", "V", "M", "B"];

export interface RenderSvgOptions {
  /** Width of the rendered box in px, before padding. Default `800`. */
  readonly size?: number;
  /** Padding in px around the pattern. Default `16`. */
  readonly padding?: number;
  /** Stroke width in px. Default `1.5`. */
  readonly strokeWidth?: number;
  /** Background fill, or `null` for a transparent SVG. Default `"#ffffff"`. */
  readonly background?: string | null;
  /** Per-assignment colour overrides on top of the standard palette. */
  readonly palette?: Partial<Record<EdgeAssignment, string>>;
  /**
   * Flip the y axis. Crease patterns use maths convention (y up), SVG uses y
   * down. Default `true`, so patterns render the way they were drawn.
   */
  readonly flipY?: boolean;
  /** Draw a dot at every vertex — handy in the editor's repair view. */
  readonly showVertices?: boolean;
  /** Fill computed faces with this colour (debugging face-finding). */
  readonly faceFill?: string;
  /** `<title>` element, for accessibility. */
  readonly title?: string;
  /** `<desc>` element. */
  readonly description?: string;
  /** Prefix the output with `<?xml …?>`. Default `false`. */
  readonly xmlDeclaration?: boolean;
}

/**
 * Render a crease pattern to a standalone SVG string — the `kami-render`
 * component of DESIGN.md §9, and the thing that produces thumbnails at ingest.
 *
 * Output is a single `<path>` per assignment rather than one element per edge,
 * which keeps dense tessellations (tens of thousands of creases) to a handful
 * of DOM nodes.
 */
export function renderSvg(graph: CreaseGraph, options: RenderSvgOptions = {}): string {
  const size = options.size ?? 800;
  const padding = options.padding ?? 16;
  const strokeWidth = options.strokeWidth ?? 1.5;
  const background = options.background === undefined ? "#ffffff" : options.background;
  const palette = { ...ORIGAMI_SIMULATOR_PALETTE, ...options.palette };
  const flipY = options.flipY ?? true;

  const { min, max } = boundingBox(graph.vertices);
  const spanX = Math.max(max[0] - min[0], Number.EPSILON);
  const spanY = Math.max(max[1] - min[1], Number.EPSILON);
  const scale = size / Math.max(spanX, spanY);
  const width = spanX * scale + padding * 2;
  const height = spanY * scale + padding * 2;

  const project = (index: number): [number, number] | null => {
    const vertex = graph.vertices[index];
    if (!vertex) return null;
    const x = (vertex[0] - min[0]) * scale + padding;
    const raw = (vertex[1] - min[1]) * scale + padding;
    return [x, flipY ? height - raw : raw];
  };

  const groups: string[] = [];

  if (options.faceFill && graph.faces) {
    const polygons = graph.faces
      .map((face) => {
        const points = face.map(project);
        if (points.some((p) => p === null)) return null;
        return (points as [number, number][])
          .map(([x, y]) => `${fmt(x)},${fmt(y)}`)
          .join(" ");
      })
      .filter((points): points is string => points !== null)
      .map((points) => `<polygon points="${points}"/>`);
    if (polygons.length > 0) {
      groups.push(
        `<g fill="${escapeAttribute(options.faceFill)}" stroke="none">${polygons.join("")}</g>`,
      );
    }
  }

  const byAssignment = new Map<EdgeAssignment, string[]>();
  graph.edges.forEach((edge, i) => {
    const assignment = graph.assignments[i] ?? "U";
    const a = project(edge[0]);
    const b = project(edge[1]);
    if (!a || !b) return;
    const commands = byAssignment.get(assignment) ?? [];
    commands.push(`M${fmt(a[0])} ${fmt(a[1])}L${fmt(b[0])} ${fmt(b[1])}`);
    byAssignment.set(assignment, commands);
  });

  for (const assignment of DRAW_ORDER) {
    const commands = byAssignment.get(assignment);
    if (!commands || commands.length === 0) continue;
    groups.push(
      `<path data-assignment="${assignment}" stroke="${escapeAttribute(
        palette[assignment],
      )}" d="${commands.join("")}"/>`,
    );
  }

  if (options.showVertices) {
    const dots = graph.vertices
      .map((_, i) => project(i))
      .filter((p): p is [number, number] => p !== null)
      .map(([x, y]) => `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(strokeWidth * 1.5)}"/>`);
    if (dots.length > 0) {
      groups.push(`<g fill="#333333" stroke="none">${dots.join("")}</g>`);
    }
  }

  const parts: string[] = [];
  if (options.xmlDeclaration) parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}" height="${fmt(
      height,
    )}" viewBox="0 0 ${fmt(width)} ${fmt(height)}">`,
  );
  if (options.title) parts.push(`<title>${escapeText(options.title)}</title>`);
  if (options.description) parts.push(`<desc>${escapeText(options.description)}</desc>`);
  if (background !== null) {
    parts.push(`<rect width="100%" height="100%" fill="${escapeAttribute(background)}"/>`);
  }
  parts.push(
    `<g fill="none" stroke-width="${fmt(strokeWidth)}" stroke-linecap="round">`,
    ...groups,
    "</g>",
    "</svg>",
  );
  return parts.join("");
}

/** Trim float noise out of the path data; 3 decimals is sub-pixel at any size. */
function fmt(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;");
}
