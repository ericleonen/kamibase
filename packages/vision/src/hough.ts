import type { EdgeMap } from "./edges.js";

/**
 * Finding straight creases with a Hough transform.
 *
 * Crease patterns are the ideal case for Hough: they are made of long straight
 * lines and almost nothing else. Every edge pixel votes for the family of lines
 * through it, and a real crease shows up as a spike where hundreds of its
 * pixels agree. Noise, paper fibre, and the odd shadow do not agree with
 * anything and stay in the mud.
 *
 * A line is stored the way the transform naturally produces it, as the distance
 * from the origin to the line and the angle of the line's normal:
 *
 *   x·cos(theta) + y·sin(theta) = rho
 *
 * That parameterisation is used rather than a gradient because it has no
 * singularity: a vertical crease is an ordinary point in (rho, theta) instead
 * of an infinite slope.
 */

export interface HoughLine {
  readonly rho: number;
  readonly theta: number;
  readonly votes: number;
}

export interface DetectedSegment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  /** Mean gradient magnitude along it. How confident the pixels were. */
  readonly strength: number;
  /** How many edge pixels backed it. */
  readonly support: number;
}

export interface HoughOptions {
  /** Angular resolution of the accumulator, in degrees. */
  readonly thetaStepDegrees?: number;
  /**
   * Only vote for angles near perpendicular to the pixel's own gradient.
   *
   * A pixel on a crease already knows which way the crease runs: the gradient
   * points across it. Voting for every angle anyway wastes most of the work and
   * smears the accumulator with votes that a pixel had no business casting.
   * Restricting it both speeds the transform up by an order of magnitude and
   * sharpens the peaks, which matters more.
   */
  readonly gradientWindowDegrees?: number;
  /** Shortest run of pixels that counts as a crease, in pixels. */
  readonly minLength?: number;
  /** How far apart two runs can be and still be one crease, in pixels. */
  readonly maxGap?: number;
  /** How far off a line a pixel can sit and still support it, in pixels. */
  readonly tolerance?: number;
  /** Most lines to consider. A guard against pathological images. */
  readonly maxLines?: number;
}

interface Resolved {
  thetaStep: number;
  gradientWindow: number;
  minLength: number;
  maxGap: number;
  tolerance: number;
  maxLines: number;
}

function resolve(options: HoughOptions, diagonal: number): Resolved {
  return {
    thetaStep: ((options.thetaStepDegrees ?? 0.5) * Math.PI) / 180,
    gradientWindow: ((options.gradientWindowDegrees ?? 12) * Math.PI) / 180,
    minLength: options.minLength ?? Math.max(12, diagonal * 0.05),
    maxGap: options.maxGap ?? Math.max(3, diagonal * 0.02),
    tolerance: options.tolerance ?? 2,
    maxLines: options.maxLines ?? 400,
  };
}

/**
 * Find straight segments.
 *
 * Peaks are taken in order of votes, and every pixel a peak claims is removed
 * from the pool before the next peak is considered. Without that, one crease
 * two pixels wide produces three near-identical lines and the caller has to
 * work out which of them was real.
 */
export function detectSegments(
  edges: EdgeMap,
  options: HoughOptions = {},
): readonly DetectedSegment[] {
  const { width, height, data, direction, magnitude } = edges;
  const diagonal = Math.hypot(width, height);
  const config = resolve(options, diagonal);

  const thetaBins = Math.max(1, Math.round(Math.PI / config.thetaStep));
  const rhoOffset = Math.ceil(diagonal);
  const rhoBins = rhoOffset * 2 + 1;

  const cos = new Float32Array(thetaBins);
  const sin = new Float32Array(thetaBins);
  for (let t = 0; t < thetaBins; t += 1) {
    const theta = (t * Math.PI) / thetaBins;
    cos[t] = Math.cos(theta);
    sin[t] = Math.sin(theta);
  }

  // Collect the edge pixels once. The transform walks them repeatedly and
  // scanning a million-pixel array each time would dominate the cost.
  const pixels: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[y * width + x] === 1) pixels.push(y * width + x);
    }
  }
  if (pixels.length === 0) return [];

  const accumulator = new Int32Array(thetaBins * rhoBins);
  const windowBins = Math.max(1, Math.round(config.gradientWindow / (Math.PI / thetaBins)));

  for (const index of pixels) {
    const x = index % width;
    const y = (index - x) / width;

    // The normal of the line through this pixel is its gradient direction, so
    // the plausible theta bins sit in a window around it.
    const gradient = direction[index] ?? 0;
    const centre = Math.round(
      (((gradient % Math.PI) + Math.PI) % Math.PI) / (Math.PI / thetaBins),
    );

    for (let offset = -windowBins; offset <= windowBins; offset += 1) {
      const t = (centre + offset + thetaBins) % thetaBins;
      const rho = Math.round(x * (cos[t] ?? 0) + y * (sin[t] ?? 0)) + rhoOffset;
      if (rho < 0 || rho >= rhoBins) continue;
      const cell = t * rhoBins + rho;
      accumulator[cell] = (accumulator[cell] ?? 0) + 1;
    }
  }

  // A run of `minLength` pixels is the smallest thing worth calling a crease,
  // and the votes it casts are spread across the window, so scale accordingly.
  const minVotes = Math.max(8, Math.round(config.minLength * 0.6));
  const peaks = findPeaks(accumulator, thetaBins, rhoBins, minVotes, config.maxLines);

  const consumed = new Uint8Array(width * height);
  const segments: DetectedSegment[] = [];

  for (const peak of peaks) {
    const theta = (peak.theta * Math.PI) / thetaBins;
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const rho = peak.rho - rhoOffset;

    // Everything still unclaimed that lies on this line and runs along it.
    const along: { t: number; index: number }[] = [];
    for (const index of pixels) {
      if (consumed[index] === 1) continue;
      const x = index % width;
      const y = (index - x) / width;
      if (Math.abs(x * c + y * s - rho) > config.tolerance) continue;

      const gradient = ((direction[index] ?? 0) % Math.PI + Math.PI) % Math.PI;
      if (angleDistance(gradient, theta) > config.gradientWindow) continue;

      along.push({ t: -x * s + y * c, index });
    }
    if (along.length === 0) continue;

    along.sort((a, b) => a.t - b.t);

    // Split into runs wherever the crease stops for longer than maxGap.
    let runStart = 0;
    for (let i = 1; i <= along.length; i += 1) {
      const broken =
        i === along.length || (along[i]!.t - along[i - 1]!.t) > config.maxGap;
      if (!broken) continue;

      const run = along.slice(runStart, i);
      runStart = i;

      const first = run[0]!;
      const last = run[run.length - 1]!;
      const length = last.t - first.t;
      if (length < config.minLength) continue;

      let strength = 0;
      for (const point of run) {
        strength += magnitude[point.index] ?? 0;
        consumed[point.index] = 1;
      }

      segments.push({
        x1: c * rho - s * first.t,
        y1: s * rho + c * first.t,
        x2: c * rho - s * last.t,
        y2: s * rho + c * last.t,
        strength: strength / run.length,
        support: run.length,
      });
    }
  }

  return segments;
}

interface Peak {
  theta: number;
  rho: number;
  votes: number;
}

/**
 * Accumulator cells worth following up, strongest first and spread out.
 *
 * The suppression window is what stops one crease producing a cluster of near
 * duplicates: a real line lights up its neighbouring cells too, and all of them
 * clear any sensible vote threshold.
 */
function findPeaks(
  accumulator: Int32Array,
  thetaBins: number,
  rhoBins: number,
  minVotes: number,
  maxLines: number,
): Peak[] {
  const candidates: Peak[] = [];

  for (let t = 0; t < thetaBins; t += 1) {
    for (let r = 1; r < rhoBins - 1; r += 1) {
      const votes = accumulator[t * rhoBins + r] ?? 0;
      if (votes < minVotes) continue;
      // Local maximum along rho, which is where duplicates cluster hardest.
      if ((accumulator[t * rhoBins + r - 1] ?? 0) > votes) continue;
      if ((accumulator[t * rhoBins + r + 1] ?? 0) > votes) continue;
      candidates.push({ theta: t, rho: r, votes });
    }
  }

  candidates.sort((a, b) => b.votes - a.votes);

  const thetaWindow = Math.max(1, Math.round(thetaBins / 90));
  const rhoWindow = 4;
  const accepted: Peak[] = [];

  for (const candidate of candidates) {
    if (accepted.length >= maxLines) break;
    const clash = accepted.some((peak) => {
      const dTheta = Math.min(
        Math.abs(peak.theta - candidate.theta),
        thetaBins - Math.abs(peak.theta - candidate.theta),
      );
      return dTheta <= thetaWindow && Math.abs(peak.rho - candidate.rho) <= rhoWindow;
    });
    if (!clash) accepted.push(candidate);
  }

  return accepted;
}

/** Smallest angle between two directions, treating opposite ones as the same. */
export function angleDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % Math.PI;
  return Math.min(diff, Math.PI - diff);
}
