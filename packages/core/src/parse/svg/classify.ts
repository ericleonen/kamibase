/**
 * Style → crease assignment: the actual hard part of reading an SVG.
 *
 * DESIGN.md §3.3 lists the strategies and the order to run them in. This
 * module implements the three that need no network and no model:
 *
 * 1. **Colour**, matched in HSV with tolerance, against the Origami Simulator
 *    palette ("the de facto standard, and we adopt it exactly").
 * 2. **Layer and group names** — `mountain`, `valley`, `M`, `V`, 山 / 谷.
 * 3. **Stroke style** — dashed is usually valley, but it is ambiguous, so it
 *    scores low and only speaks when nothing else does.
 *
 * The fourth strategy, the vision-model fallback for unusual palettes, lives
 * outside `@kamibase/core` (§9: nothing here touches the network). It plugs in
 * through the `assignments` override on {@link classifyStyle}: a model, or a
 * person clicking through a colour table in the editor, supplies a map from
 * style key to assignment and the parser re-runs with it.
 *
 * Nothing here ever guesses M vs V. When no strategy is confident the crease
 * comes out `U`, per §3.4: "ambiguous edges are marked U rather than guessed
 * silently".
 */

import type { EdgeAssignment } from "../../graph/types.js";
import { hueDistance, parseColor, rgbToHsv } from "./color.js";

/** How an assignment was arrived at, reported to the upload UI. */
export type ClassifyMethod = "override" | "color" | "layer" | "dash" | "fallback";

/** Everything about an element's presentation that can carry meaning. */
export interface StyleFacts {
  /** Normalized `#rrggbb`, or `null` when the element has no stroke colour. */
  readonly stroke: string | null;
  readonly dashed: boolean;
  /** Nearest named ancestor group, e.g. an Inkscape layer label. */
  readonly layer: string | null;
}

export interface Classification {
  readonly assignment: EdgeAssignment;
  /** 0-1, in the sense of DESIGN.md §3.4. */
  readonly confidence: number;
  readonly method: ClassifyMethod;
  /** Human-readable justification, shown in the review UI. */
  readonly reason: string;
}

/**
 * Hue targets for the Origami Simulator palette.
 *
 * Cyan is not in that palette. It is what Kamibase's own renderer emits for
 * FOLD's `J` (join), so reading it back is round-tripping our own output; it
 * scores lower than the six standard colours because no other tool means
 * anything by it.
 */
const HUE_TARGETS: readonly { hue: number; assignment: EdgeAssignment; ceiling: number }[] =
  [
    { hue: 0, assignment: "M", ceiling: 0.97 },
    { hue: 60, assignment: "F", ceiling: 0.92 },
    { hue: 120, assignment: "C", ceiling: 0.92 },
    { hue: 180, assignment: "J", ceiling: 0.7 },
    { hue: 240, assignment: "V", ceiling: 0.97 },
    { hue: 300, assignment: "U", ceiling: 0.92 },
  ];

/** Hue tolerance in degrees. Wide enough for "reddish", narrow enough that
 * orange does not become mountain by accident. */
const HUE_TOLERANCE = 28;

/** Below this saturation a colour is grey, and hue is noise. */
const ACHROMATIC_SATURATION = 0.18;

const LAYER_RULES: readonly {
  pattern: RegExp;
  assignment: EdgeAssignment;
  confidence: number;
}[] = [
  { pattern: /(^|[^a-z])mountains?([^a-z]|$)|山折?り?/i, assignment: "M", confidence: 0.85 },
  { pattern: /(^|[^a-z])valleys?([^a-z]|$)|谷折?り?/i, assignment: "V", confidence: 0.85 },
  {
    pattern: /(^|[^a-z])(border|boundary|outline|contour|paper|edges?|frame)([^a-z]|$)|輪郭/i,
    assignment: "B",
    confidence: 0.8,
  },
  {
    pattern: /(^|[^a-z])(cut|slit|slits)([^a-z]|$)/i,
    assignment: "C",
    confidence: 0.75,
  },
  {
    pattern:
      /(^|[^a-z])(triangulation|facets?|flat|aux|auxiliary|construction|reference|guides?|grid)([^a-z]|$)|補助/i,
    assignment: "F",
    confidence: 0.7,
  },
  {
    pattern: /(^|[^a-z])(unassigned|unknown|undriven)([^a-z]|$)/i,
    assignment: "U",
    confidence: 0.7,
  },
  // Single letters last: "m" and "v" are common layer names in ORIPA exports,
  // but they are also the first letter of half the words above.
  { pattern: /^\s*m\s*$|^\s*mv?[-_ ]?m\s*$/i, assignment: "M", confidence: 0.6 },
  { pattern: /^\s*v\s*$/i, assignment: "V", confidence: 0.6 },
  { pattern: /^\s*b\s*$/i, assignment: "B", confidence: 0.6 },
];

/** A stable, human-readable key for a distinct style. */
export function styleKey(facts: StyleFacts): string {
  return [
    facts.stroke ?? "no-stroke",
    facts.dashed ? "dashed" : "solid",
    facts.layer ?? "",
  ].join("|");
}

export interface ClassifyOptions {
  /** Per-style-key overrides: the hook for a vision model or a human review. */
  readonly assignments?: Readonly<Record<string, EdgeAssignment>>;
  /** Assignment for styles no strategy could read. Default `"U"`. */
  readonly unknownAssignment?: EdgeAssignment;
}

/** Run the strategy stack over one distinct style. */
export function classifyStyle(
  facts: StyleFacts,
  options: ClassifyOptions = {},
): Classification {
  const override = options.assignments?.[styleKey(facts)];
  if (override !== undefined) {
    return {
      assignment: override,
      confidence: 1,
      method: "override",
      reason: "assigned by hand",
    };
  }

  const color = facts.stroke === null ? null : classifyColor(facts.stroke);
  const layer = facts.layer === null ? null : classifyLayer(facts.layer);

  /*
   * A chromatic stroke outranks everything: someone who drew a crease in red
   * meant mountain, whatever the group it ended up in is called.
   */
  if (color && !color.achromatic) {
    if (!layer) {
      return {
        assignment: color.assignment,
        confidence: color.confidence,
        method: "color",
        reason: color.reason,
      };
    }
    if (color.assignment === layer.assignment) {
      return {
        assignment: color.assignment,
        confidence: Math.min(0.99, Math.max(color.confidence, layer.confidence) + 0.05),
        method: "color",
        reason: `${color.reason}, and the layer name agrees`,
      };
    }
    return {
      assignment: color.assignment,
      confidence: color.confidence * 0.85,
      method: "color",
      reason: `${color.reason}, but the layer name suggests ${layer.assignment}`,
    };
  }

  /*
   * Black is not a claim. It is the default ink, so in a monochrome drawing
   * the layer name and then the stroke style are the only evidence there is,
   * and both beat reading every line as a paper edge.
   */
  if (layer) {
    return {
      assignment: layer.assignment,
      confidence: layer.confidence,
      method: "layer",
      reason: color
        ? `${layer.reason}; the stroke is ${facts.stroke ?? "unset"}, which says nothing`
        : layer.reason,
    };
  }

  if (facts.dashed) {
    return {
      assignment: "V",
      confidence: 0.45,
      method: "dash",
      reason: "dashed, which is usually a valley in print, but often is not",
    };
  }

  if (color) {
    return {
      assignment: color.assignment,
      confidence: color.confidence,
      method: "color",
      reason: color.reason,
    };
  }

  return {
    assignment: options.unknownAssignment ?? "U",
    confidence: 0,
    method: "fallback",
    reason: "no colour, layer name or stroke style identified this crease",
  };
}

interface ColorClassification {
  readonly assignment: EdgeAssignment;
  readonly confidence: number;
  readonly reason: string;
  /** Grey, so the hue carries no information. */
  readonly achromatic: boolean;
}

/** The colour heuristic of §3.3, in HSV with tolerance. */
export function classifyColor(hex: string): ColorClassification | null {
  const rgb = parseColor(hex);
  if (!rgb) return null;
  const { h, s, v } = rgbToHsv(rgb);

  if (s < ACHROMATIC_SATURATION) {
    // Near-white on a white page is either an invisible line or a highlight;
    // either way it is not a claim about the crease.
    if (v > 0.85) return null;
    const confidence = v < 0.3 ? 0.9 : 0.6;
    return {
      assignment: "B",
      confidence,
      reason:
        v < 0.3
          ? `${hex} is black, the boundary colour`
          : `${hex} is grey; read as a boundary, but greys are not part of the palette`,
      achromatic: true,
    };
  }

  let best: { target: (typeof HUE_TARGETS)[number]; distance: number } | null = null;
  for (const target of HUE_TARGETS) {
    const distance = hueDistance(h, target.hue);
    if (distance > HUE_TOLERANCE) continue;
    if (!best || distance < best.distance) best = { target, distance };
  }
  if (!best) return null;

  // Full confidence for the exact palette colour, falling off with hue error
  // and with washed-out or dark strokes.
  const hueError = best.distance / HUE_TOLERANCE;
  const purity = Math.min(1, s / 0.6) * Math.min(1, v / 0.45);
  const confidence = clamp(
    best.target.ceiling - 0.35 * hueError - 0.25 * (1 - purity),
    0.35,
    best.target.ceiling,
  );

  return {
    assignment: best.target.assignment,
    confidence,
    reason:
      best.distance < 1
        ? `${hex} is the palette colour for ${best.target.assignment}`
        : `${hex} is within ${Math.round(best.distance)}° of the ${best.target.assignment} palette colour`,
    achromatic: false,
  };
}

/** The layer/group-name heuristic of §3.3. */
export function classifyLayer(
  name: string,
): { assignment: EdgeAssignment; confidence: number; reason: string } | null {
  for (const rule of LAYER_RULES) {
    if (rule.pattern.test(name)) {
      return {
        assignment: rule.assignment,
        confidence: rule.confidence,
        reason: `the group is called "${name.trim()}"`,
      };
    }
  }
  return null;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
