/**
 * The colour arithmetic the SVG converter needs.
 *
 * DESIGN.md §3.3 asks for matching "in HSV space with tolerance, so 'reddish'
 * works", which means the parser has to understand every way an SVG can spell
 * a colour before it can compare two of them.
 */

/** sRGB components, 0-255. */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Hue in degrees `[0,360)`, saturation and value in `[0,1]`. */
export interface Hsv {
  readonly h: number;
  readonly s: number;
  readonly v: number;
}

/**
 * The CSS named colours a crease pattern plausibly uses. Not the full list of
 * 148: the rest are decoration, and an unrecognized name falls through to the
 * layer-name and dash strategies rather than being silently mapped to
 * something close.
 */
const NAMED_COLORS: Readonly<Record<string, string>> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  lime: "#00ff00",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  cyan: "#00ffff",
  aqua: "#00ffff",
  magenta: "#ff00ff",
  fuchsia: "#ff00ff",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  darkgray: "#a9a9a9",
  darkgrey: "#a9a9a9",
  lightgray: "#d3d3d3",
  lightgrey: "#d3d3d3",
  maroon: "#800000",
  darkred: "#8b0000",
  crimson: "#dc143c",
  orange: "#ffa500",
  gold: "#ffd700",
  olive: "#808000",
  darkgreen: "#006400",
  teal: "#008080",
  navy: "#000080",
  darkblue: "#00008b",
  royalblue: "#4169e1",
  dodgerblue: "#1e90ff",
  purple: "#800080",
  violet: "#ee82ee",
  pink: "#ffc0cb",
  brown: "#a52a2a",
};

/**
 * Parse a CSS colour into sRGB, or `null` for `none`, `transparent`,
 * `currentColor`, a paint server reference (`url(#gradient)`) or anything
 * unrecognized. Callers treat `null` as "this style says nothing about the
 * assignment", which is the honest reading.
 */
export function parseColor(input: string): Rgb | null {
  const value = input.trim().toLowerCase();
  if (value === "" || value === "none" || value === "transparent") return null;

  const named = NAMED_COLORS[value];
  if (named) return parseColor(named);

  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (/^[0-9a-f]{3,4}$/.test(hex)) {
      return {
        r: expand(hex[0]!),
        g: expand(hex[1]!),
        b: expand(hex[2]!),
      };
    }
    if (/^[0-9a-f]{6}$/.test(hex) || /^[0-9a-f]{8}$/.test(hex)) {
      return {
        r: Number.parseInt(hex.slice(0, 2), 16),
        g: Number.parseInt(hex.slice(2, 4), 16),
        b: Number.parseInt(hex.slice(4, 6), 16),
      };
    }
    return null;
  }

  const functional = value.match(/^(rgba?|hsla?)\s*\(([^)]*)\)$/);
  if (!functional) return null;
  const args = functional[2]!
    .split(/[\s,/]+/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
  if (args.length < 3) return null;

  if (functional[1]!.startsWith("rgb")) {
    const channels = args.slice(0, 3).map((arg) => {
      const number = Number.parseFloat(arg);
      if (!Number.isFinite(number)) return Number.NaN;
      return arg.endsWith("%") ? (number / 100) * 255 : number;
    });
    if (channels.some((channel) => Number.isNaN(channel))) return null;
    return {
      r: clampChannel(channels[0]!),
      g: clampChannel(channels[1]!),
      b: clampChannel(channels[2]!),
    };
  }

  const h = Number.parseFloat(args[0]!);
  const s = Number.parseFloat(args[1]!) / 100;
  const l = Number.parseFloat(args[2]!) / 100;
  if (![h, s, l].every(Number.isFinite)) return null;
  return hslToRgb(h, s, l);
}

/** Normalized `#rrggbb`, the form used as a style-table key. */
export function toHex(color: Rgb): string {
  const hex = (value: number): string =>
    clampChannel(value).toString(16).padStart(2, "0");
  return `#${hex(color.r)}${hex(color.g)}${hex(color.b)}`;
}

export function rgbToHsv(color: Rgb): Hsv {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;

  let h = 0;
  if (chroma > 0) {
    if (max === r) h = ((g - b) / chroma) % 6;
    else if (max === g) h = (b - r) / chroma + 2;
    else h = (r - g) / chroma + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : chroma / max, v: max };
}

/** Shortest distance between two hues, in degrees `[0,180]`. */
export function hueDistance(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
}

function expand(digit: string): number {
  const value = Number.parseInt(digit, 16);
  return value * 16 + value;
}

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function hslToRgb(hue: number, s: number, l: number): Rgb {
  const h = ((hue % 360) + 360) % 360;
  const chroma = (1 - Math.abs(2 * l - 1)) * Math.min(1, Math.max(0, s));
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - chroma / 2;
  const [r, g, b] =
    h < 60
      ? [chroma, x, 0]
      : h < 120
        ? [x, chroma, 0]
        : h < 180
          ? [0, chroma, x]
          : h < 240
            ? [0, x, chroma]
            : h < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];
  return {
    r: clampChannel((r + m) * 255),
    g: clampChannel((g + m) * 255),
    b: clampChannel((b + m) * 255),
  };
}
