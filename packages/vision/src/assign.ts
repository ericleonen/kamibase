import {
  analyzeBoundary,
  buildVertexEdges,
  otherEnd,
  type CreaseGraph,
  type EdgeAssignment,
} from "@kamibase/core";

/**
 * Deciding which creases are mountains and which are valleys.
 *
 * This is the part a photograph genuinely cannot answer. A sheet that has been
 * folded and opened out again is flat: the creases are there, but which way
 * each one went is recorded in a fraction of a millimetre of paper memory that
 * survives neither the flattening nor the camera. Ask ten people to label a
 * photo of an unfolded bird base and they will use the geometry, not their
 * eyes.
 *
 * So does this. Maekawa's theorem says that at every interior vertex of a
 * flat-foldable crease pattern the mountains and valleys differ by exactly
 * two. That is a hard constraint linking every crease to its neighbours, and
 * for most real patterns it has very few solutions. Finding one is a search,
 * and the search is the whole method:
 *
 *   - the photograph proposes, weakly, through the shading of each crease
 *   - Maekawa disposes, strongly, through the constraint at every vertex
 *   - anything the two cannot settle is left `U`, unassigned
 *
 * DESIGN.md §3.3 describes the same division of labour with a vision model in
 * the proposing seat. The seat is empty and the interface is the same shape:
 * pass a `prior` and it is used, pass nothing and geometry decides alone.
 *
 * Two honest limits. Maekawa is necessary, not sufficient, so a solution here
 * is a candidate rather than a proof. And the constraint is invariant under
 * flipping every crease at once, because that is the same pattern seen from
 * the other side of the paper: without a prior to break it, the answer is
 * correct up to one global inversion.
 */

export interface AssignmentOptions {
  /**
   * Per-edge belief, -1 for valley through +1 for mountain, 0 for no opinion.
   * Indexed like `graph.edges`. Used to seed the search and to settle the
   * global flip.
   */
  readonly prior?: readonly number[];
  /**
   * Assignments that are already known and must not be searched over, indexed
   * like `graph.edges`. `M` or `V` pins that crease; anything else is free.
   *
   * This is what a *drawn* crease pattern gives you. A photograph has to infer
   * every assignment, because a flattened sheet does not record them; a red
   * line in a published PNG is not an inference, it is the designer saying
   * "mountain". Pinning those turns the search from "find any Maekawa-
   * consistent labelling" into "fill in the ones nobody stated", which is both
   * a far smaller problem and — because pinned creases break the global flip
   * symmetry — one with an answer that is not merely correct up to being
   * inside out.
   */
  readonly fixed?: readonly (EdgeAssignment | null | undefined)[];
  /** Independent searches to run. More restarts, more of the solution space. */
  readonly restarts?: number;
  /** Seed for the search's randomness, so a given photo gives a given answer. */
  readonly seed?: number;
}

export interface AssignmentResult {
  /**
   * One per edge, in `graph.edges` order. `B` is preserved. `U` appears only
   * where there was no constraint at all to reason from.
   */
  readonly assignments: readonly EdgeAssignment[];
  /** Per edge, 0 to 1. Low means the optimal solutions disagreed about it. */
  readonly confidence: readonly number[];
  /** Interior vertices where Maekawa holds under this assignment. */
  readonly satisfied: number;
  /** Interior vertices the assignment had to satisfy. */
  readonly total: number;
  /** Interior vertices with an odd number of creases, which Maekawa cannot fix. */
  readonly oddVertices: readonly number[];
  /**
   * Creases that equally good solutions disagreed about. They are still
   * assigned, so the caller gets a valid pattern, but their confidence is below
   * 1 and the UI should show them as uncertain.
   */
  readonly ambiguous: number;
  /**
   * True when every interior vertex came out satisfied. The pattern is then a
   * Maekawa-consistent candidate, which is not the same as flat-foldable.
   */
  readonly consistent: boolean;
}

/** A small deterministic generator, so the same photo yields the same answer. */
function rng(seed: number): () => number {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

export function inferAssignments(
  graph: CreaseGraph,
  options: AssignmentOptions = {},
): AssignmentResult {
  const restarts = options.restarts ?? 12;
  const random = rng(options.seed ?? 1);
  const edgeCount = graph.edges.length;

  const existing = graph.assignments;
  // Boundary creases are not folds and take no part in the count. Of the rest,
  // the ones the caller already knows are held fixed and only the remainder is
  // searched over.
  const pinned = new Map<number, boolean>();
  const foldable: number[] = [];
  for (let e = 0; e < edgeCount; e += 1) {
    if (existing[e] === "B") continue;
    const known = options.fixed?.[e];
    if (known === "M" || known === "V") pinned.set(e, known === "M");
    else foldable.push(e);
  }
  const anchored = pinned.size > 0;

  const slotOf = new Map<number, number>();
  foldable.forEach((edge, slot) => slotOf.set(edge, slot));

  const { boundaryVertices } = analyzeBoundary(graph);
  const incident = buildVertexEdges(graph);

  /**
   * Interior vertices, each with the slots of the free creases meeting it, plus
   * what the pinned ones there already contribute. `degree` counts both: it is
   * the vertex's fold degree, and Maekawa is a statement about all of it.
   */
  const vertices: { vertex: number; slots: number[]; fixedMountains: number; degree: number }[] =
    [];
  const oddVertices: number[] = [];

  graph.vertices.forEach((_, vertex) => {
    if (boundaryVertices.has(vertex)) return;
    const folds = (incident[vertex] ?? []).filter((edge) => existing[edge] !== "B");
    const slots = folds
      .map((edge) => slotOf.get(edge))
      .filter((slot): slot is number => slot !== undefined);
    let fixedMountains = 0;
    for (const edge of folds) if (pinned.get(edge) === true) fixedMountains += 1;

    if (folds.length === 0) return;
    if (folds.length % 2 !== 0) {
      // Maekawa needs |M - V| = 2 with M + V odd, which no integers satisfy.
      // The vertex is unsatisfiable whatever we assign, so it is reported and
      // kept out of the search rather than dragging every solution's cost up.
      oddVertices.push(vertex);
      return;
    }
    vertices.push({ vertex, slots, fixedMountains, degree: folds.length });
  });

  /** What a pinned crease is, and how sure of it the caller was. */
  const pinnedAssignments = (): { values: EdgeAssignment[]; confidence: number[] } => {
    const values = existing.map<EdgeAssignment>((value) => (value === "B" ? "B" : "U"));
    const confidence = new Array<number>(edgeCount).fill(0);
    for (const [edge, mountain] of pinned) {
      values[edge] = mountain ? "M" : "V";
      confidence[edge] = 1;
    }
    return { values, confidence };
  };

  if (foldable.length === 0 || vertices.length === 0) {
    const { values, confidence } = pinnedAssignments();
    let satisfied = 0;
    for (const entry of vertices) {
      if (Math.abs(2 * entry.fixedMountains - entry.degree) === 2) satisfied += 1;
    }
    return {
      assignments: values,
      confidence,
      satisfied,
      total: vertices.length,
      oddVertices,
      ambiguous: foldable.length,
      consistent: satisfied === vertices.length && oddVertices.length === 0,
    };
  }

  // Which vertices each slot touches, so a flip only recosts those.
  const touching: number[][] = foldable.map(() => []);
  vertices.forEach((entry, v) => {
    for (const slot of entry.slots) touching[slot]!.push(v);
  });

  const prior = foldable.map((edge) => options.prior?.[edge] ?? 0);

  const degree = vertices.map((entry) => entry.degree);
  const mountains = new Int32Array(vertices.length);

  const vertexCost = (v: number): number =>
    Math.abs(Math.abs(2 * (mountains[v] ?? 0) - (degree[v] ?? 0)) - 2);

  const state = new Uint8Array(foldable.length);
  let best: Uint8Array | null = null;
  let bestCost = Infinity;
  const optima: Uint8Array[] = [];

  for (let attempt = 0; attempt < restarts; attempt += 1) {
    // The first attempt starts from the prior, so a confident photograph is
    // followed where it leads. Later attempts randomise, which is what actually
    // explores the space.
    for (let slot = 0; slot < state.length; slot += 1) {
      const belief = prior[slot] ?? 0;
      state[slot] =
        attempt === 0 && belief !== 0
          ? belief > 0
            ? 1
            : 0
          : random() < 0.5
            ? 1
            : 0;
    }

    mountains.fill(0);
    vertices.forEach((entry, v) => {
      let count = entry.fixedMountains;
      for (const slot of entry.slots) if (state[slot] === 1) count += 1;
      mountains[v] = count;
    });

    let cost = 0;
    for (let v = 0; v < vertices.length; v += 1) cost += vertexCost(v);

    // Steepest descent, then a kick when it stalls. Plain hill climbing gets
    // stuck immediately on constraint problems like this one.
    let stall = 0;
    for (let step = 0; step < 4000 && cost > 0; step += 1) {
      let bestSlot = -1;
      let bestDelta = 0;

      for (let slot = 0; slot < state.length; slot += 1) {
        let delta = 0;
        for (const v of touching[slot]!) {
          const before = vertexCost(v);
          mountains[v] = (mountains[v] ?? 0) + (state[slot] === 1 ? -1 : 1);
          delta += vertexCost(v) - before;
          mountains[v] = (mountains[v] ?? 0) + (state[slot] === 1 ? 1 : -1);
        }
        if (delta < bestDelta) {
          bestDelta = delta;
          bestSlot = slot;
        }
      }

      if (bestSlot >= 0) {
        applyFlip(state, mountains, touching, bestSlot);
        cost += bestDelta;
        stall = 0;
        continue;
      }

      stall += 1;
      if (stall > 3) break;
      // Nothing improves. Flip a few creases at random and carry on from there.
      for (let kick = 0; kick < 3; kick += 1) {
        const slot = Math.floor(random() * state.length);
        const wasCost = touching[slot]!.reduce((sum, v) => sum + vertexCost(v), 0);
        applyFlip(state, mountains, touching, slot);
        const nowCost = touching[slot]!.reduce((sum, v) => sum + vertexCost(v), 0);
        cost += nowCost - wasCost;
      }
    }

    if (cost < bestCost) {
      bestCost = cost;
      best = Uint8Array.from(state);
      optima.length = 0;
      optima.push(canonical(state, anchored));
    } else if (cost === bestCost) {
      const shape = canonical(state, anchored);
      if (!optima.some((seen) => sameBits(seen, shape))) optima.push(shape);
    }
  }

  const solution = best ?? state;

  /*
   * The whole pattern can be turned over, which swaps every mountain and
   * valley and satisfies Maekawa just as well. Only the prior can say which
   * side we are looking at, so use it, and leave the result as found when it
   * has no opinion.
   *
   * Unless something is pinned. A crease the caller stated is a fact about
   * which side of the paper this is, so the symmetry is already broken and
   * flipping the free creases around it would contradict the very thing that
   * was known.
   */
  let agreement = 0;
  for (let slot = 0; slot < solution.length; slot += 1) {
    agreement += (solution[slot] === 1 ? 1 : -1) * (prior[slot] ?? 0);
  }
  const flipAll = !anchored && agreement < 0;

  /*
   * How firmly the constraint pins each crease down.
   *
   * Maekawa often has several solutions that fit equally well. Four creases
   * meeting at a symmetric vertex is the standard case: three mountains and one
   * valley satisfies it, and so does the same thing with any of the four
   * playing the valley. Nothing in the geometry prefers one.
   *
   * Reporting nothing in that case would be useless, and reporting one without
   * comment would be the confident guess DESIGN.md §3.4 forbids. So the answer
   * is a real, valid assignment plus a number saying how much the alternatives
   * agreed with it. A crease every solution agrees on scores 1; one that four
   * solutions split evenly over scores near a quarter, the editor draws it as
   * uncertain, and the notes say how many there are.
   *
   * Optima are compared after being aligned by global flip, since a solution
   * and its mirror are the same pattern seen from the other side, and treating
   * them as disagreeing would call every crease ambiguous.
   */
  const reference = canonical(solution, anchored);
  const mountainVotes = new Int32Array(foldable.length);

  for (const option of optima) {
    let same = 0;
    for (let slot = 0; slot < option.length; slot += 1) {
      if (option[slot] === reference[slot]) same += 1;
    }
    const aligned = anchored || same * 2 >= option.length ? option : flipBits(option);
    for (let slot = 0; slot < aligned.length; slot += 1) {
      if (aligned[slot] === 1) mountainVotes[slot] = (mountainVotes[slot] ?? 0) + 1;
    }
  }

  const { values: assignments, confidence } = pinnedAssignments();
  const total = Math.max(1, optima.length);
  let ambiguous = 0;

  foldable.forEach((edge, slot) => {
    const votes = mountainVotes[slot] ?? 0;
    const agreement = Math.max(votes, total - votes) / total;
    if (agreement < 1) ambiguous += 1;

    const isMountain = (solution[slot] === 1) !== flipAll;
    assignments[edge] = isMountain ? "M" : "V";

    // A prior that agrees raises the number and one that disagrees lowers it,
    // but neither overrules the constraint: the photograph is advising here,
    // not deciding.
    const belief = (flipAll ? -1 : 1) * (prior[slot] ?? 0) * (solution[slot] === 1 ? 1 : -1);
    confidence[edge] = Math.min(1, Math.max(0.1, agreement * (0.85 + 0.15 * belief)));
  });

  mountains.fill(0);
  vertices.forEach((entry, v) => {
    let count = entry.fixedMountains;
    for (const slot of entry.slots) if (solution[slot] === 1) count += 1;
    mountains[v] = count;
  });
  let satisfied = 0;
  for (let v = 0; v < vertices.length; v += 1) if (vertexCost(v) === 0) satisfied += 1;

  return {
    assignments,
    confidence,
    satisfied,
    total: vertices.length,
    oddVertices,
    ambiguous,
    consistent: satisfied === vertices.length && oddVertices.length === 0,
  };
}

function applyFlip(
  state: Uint8Array,
  mountains: Int32Array,
  touching: readonly number[][],
  slot: number,
): void {
  const delta = state[slot] === 1 ? -1 : 1;
  state[slot] = state[slot] === 1 ? 0 : 1;
  for (const v of touching[slot]!) mountains[v] = (mountains[v] ?? 0) + delta;
}

/**
 * Normalise the global flip so two mirror solutions compare equal.
 *
 * A no-op when creases are pinned: the mirror of an anchored solution is not
 * the same pattern seen from the other side, it is a different and wrong
 * answer, and folding the two together would hide a genuine disagreement.
 */
function canonical(state: Uint8Array, anchored: boolean): Uint8Array {
  if (anchored || state[0] === 1) return Uint8Array.from(state);
  return flipBits(state);
}

function flipBits(state: Uint8Array): Uint8Array {
  const out = new Uint8Array(state.length);
  for (let i = 0; i < state.length; i += 1) out[i] = state[i] === 1 ? 0 : 1;
  return out;
}

function sameBits(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/** Swap every mountain for a valley. The pattern seen from the other side. */
export function invertAssignments(
  assignments: readonly EdgeAssignment[],
): EdgeAssignment[] {
  return assignments.map((value) =>
    value === "M" ? "V" : value === "V" ? "M" : value,
  );
}
