import { writeSyllable, type Syllable } from "../syllable/syllable.js";
import { allEdges, type Lattice, type LatticeEdge } from "./lattice.js";

/**
 * A stretch of characters together with how it is read.
 *
 * The unit the reading decode works in, and deliberately not "one syllable per
 * character": 玩儿 is one unit of two characters reading `wánr`, and no smaller
 * piece of it is meaningful.
 */
export interface ReadingUnit {
  readonly from: number;
  readonly to: number;
  readonly reading: readonly Syllable[];
}

/**
 * What the projection found at every character position.
 */
export interface ReadingProjection {
  /**
   * The unit a position is locked to, or undefined where it is still open.
   *
   * Indexed by character position. A locked position reads the same way on
   * every path through the lattice, so no amount of scoring can change it.
   */
  readonly locked: readonly (ReadingUnit | undefined)[];
  /** How many positions locked. */
  readonly lockedPositions: number;
  readonly positions: number;
}

/**
 * How an edge's reading is identified when two edges are compared.
 *
 * The span is part of the identity because a reading that spans two characters
 * is a different claim from the same syllables spread over one character each:
 * 玩儿 as `wánr` and 玩 as `wán` followed by 儿 as `ér` do not agree, so a
 * position either of them covers is not locked.
 */
export function unitKey(unit: ReadingUnit): string {
  const written = unit.reading
    .map((syllable) => writeSyllable(syllable))
    .join(" ");
  return `${String(unit.from)}:${String(unit.to)}:${written}`;
}

/**
 * Split an edge into the units it contributes.
 *
 * An edge whose reading has one syllable per character makes a claim about each
 * character separately, so it splits. Anything else — 儿化, or a character with
 * no reading at all — makes one claim about the whole span.
 */
export function unitsOf(edge: LatticeEdge): readonly ReadingUnit[] {
  if (edge.reading.length !== edge.to - edge.from) {
    return [{ from: edge.from, to: edge.to, reading: edge.reading }];
  }
  return edge.reading.map((syllable, offset) => ({
    from: edge.from + offset,
    to: edge.from + offset + 1,
    reading: [syllable],
  }));
}

/**
 * Project the lattice onto readings and lock the positions that cannot vary.
 *
 * Stage 2 of ALGORITHM.md, and the step that buys accuracy and speed together.
 * Every edge in the lattice lies on some path, because single-character edges
 * make every position reachable from both ends, so the question "how many
 * distinct readings survive across all paths?" is answered by counting the
 * distinct readings claimed at each position and nothing more.
 *
 * A position answering one is locked. A unit is only honoured when it is the
 * sole claim at *every* position it covers, so a two-character reading is never
 * locked in on the strength of one of its halves.
 */
export function projectReadings(lattice: Lattice): ReadingProjection {
  const positions = lattice.characters.length;
  const claims: Set<string>[] = Array.from(
    { length: positions },
    () => new Set<string>(),
  );
  // Keyed rather than kept per position, so that two edges making the same
  // claim are recognised as one claim wherever each of them was seen.
  const byKey = new Map<string, ReadingUnit>();

  for (const edge of allEdges(lattice)) {
    for (const unit of unitsOf(edge)) {
      const key = unitKey(unit);
      byKey.set(key, unit);
      for (let at = unit.from; at < unit.to; at++) {
        claims[at]?.add(key);
      }
    }
  }

  const sole = claims.map((held) =>
    /* c8 ignore next -- a set of one always has a first member */
    held.size === 1 ? ([...held][0] ?? "") : undefined,
  );
  const locked = sole.map((key) => {
    const unit = key === undefined ? undefined : byKey.get(key);
    if (unit === undefined) {
      return;
    }
    for (let at = unit.from; at < unit.to; at++) {
      /* c8 ignore next 3 -- unreachable while every position has a
         single-character edge: a claim spanning more than one character always
         has that edge's claim beside it, so it is never the sole one. */
      if (sole[at] !== key) {
        return;
      }
    }
    return unit;
  });

  return {
    locked,
    lockedPositions: locked.filter((unit) => unit !== undefined).length,
    positions,
  };
}

/**
 * Whether every position in a stretch is locked.
 */
export function isSettled(
  projection: ReadingProjection,
  from: number,
  to: number,
): boolean {
  for (let at = from; at < to; at++) {
    if (projection.locked[at] === undefined) {
      return false;
    }
  }
  return true;
}

/**
 * The units a settled stretch reads as, taken straight from the locks.
 */
export function settledUnits(
  projection: ReadingProjection,
  from: number,
  to: number,
): readonly ReadingUnit[] {
  const units: ReadingUnit[] = [];
  let at = from;
  while (at < to) {
    const unit = projection.locked[at];
    /* c8 ignore next 3 -- the caller has checked every position is locked */
    if (unit === undefined) {
      break;
    }
    units.push(unit);
    at = unit.to;
  }
  return units;
}
