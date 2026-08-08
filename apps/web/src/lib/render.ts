import { renderSvg, type CreaseGraph, type EdgeAssignment } from "@kamibase/core";

/** Assignments actually used by a pattern, in the viewer's toggle order. */
export function presentAssignments(graph: CreaseGraph): EdgeAssignment[] {
  const order: EdgeAssignment[] = ["M", "V", "B", "F", "U", "C", "J"];
  const present = new Set(graph.assignments);
  return order.filter((assignment) => present.has(assignment));
}

/** Thumbnail for cards and social previews. */
export function renderThumbnail(graph: CreaseGraph, title: string): string {
  return renderSvg(graph, {
    size: 480,
    padding: 12,
    strokeWidth: 1.2,
    background: null,
    title: `${title} crease pattern`,
    xmlDeclaration: true,
  });
}

/** Full-size render for the pattern page's viewer. */
export function renderViewerSvg(graph: CreaseGraph, title: string): string {
  return renderSvg(graph, {
    size: 1000,
    padding: 8,
    strokeWidth: 1.6,
    background: null,
    title: `${title} crease pattern`,
  });
}
