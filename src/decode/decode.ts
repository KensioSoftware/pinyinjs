import type { Dictionary } from "../dictionary/dictionary.js";
import { buildLattice, cutPoints, type Lattice } from "./lattice.js";
import {
  projectReadings,
  type ReadingProjection,
  type ReadingUnit,
  unitsOf,
} from "./locking.js";
import { readingCost, shortestPath, spacingCost } from "./viterbi.js";
import type { DecodedWord } from "./word.js";

/**
 * Whether every position in a stretch is locked.
 */
function isSettled(
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
function settledUnits(
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

/**
 * Decode the run's readings, scoring only where the readings are still open.
 *
 * The asymmetry ALGORITHM.md calls for. A stretch between two cut points whose
 * positions all locked reads the same way on every path, so its readings are
 * read off the locks and no shortest path is run over it at all. Only the
 * stretches with a genuine choice in them are decoded.
 */
export function decodeReadings(
  lattice: Lattice,
  projection: ReadingProjection,
): readonly ReadingUnit[] {
  const cuts = cutPoints(lattice);
  const units: ReadingUnit[] = [];

  for (const [index, from] of cuts.entries()) {
    const to = cuts[index + 1];
    if (to === undefined) {
      break;
    }
    if (isSettled(projection, from, to)) {
      units.push(...settledUnits(projection, from, to));
      continue;
    }
    for (const edge of shortestPath(lattice, from, to, readingCost)) {
      units.push(...unitsOf(edge));
    }
  }

  return units;
}

/**
 * Where a decode would put the word boundaries, as character positions.
 *
 * Run over the whole lattice rather than the open stretches, because spacing
 * stays ambiguous where readings do not: 研究生命起源 reads identically whether
 * it splits 研究生/命 or 研究/生命, so every position in it locks, and the
 * spacing question is still open.
 */
export function decodeSpacing(lattice: Lattice): readonly number[] {
  return shortestPath(lattice, 0, lattice.characters.length, spacingCost).map(
    (edge) => edge.from,
  );
}

/**
 * Assemble words from the readings and the boundaries that survive them.
 *
 * Where the two decodes disagree the readings win, which is what "advisory"
 * means for the spacing decode: a boundary falling inside a reading unit is
 * dropped rather than allowed to break the unit up. 玩儿 read as `wánr` is one
 * syllable over two characters, and no spacing can be put between them.
 */
function wordsFrom(
  dictionary: Dictionary,
  lattice: Lattice,
  units: readonly ReadingUnit[],
  boundaries: readonly number[],
): readonly DecodedWord[] {
  const starts = new Set(units.map((unit) => unit.from));
  const kept = new Set(boundaries.filter((at) => starts.has(at)));
  const words: DecodedWord[] = [];
  let held: ReadingUnit[] = [];

  const flush = (): void => {
    const first = held[0];
    const last = held.at(-1);
    if (first === undefined || last === undefined) {
      return;
    }
    const text = lattice.characters.slice(first.from, last.to).join("");
    const entry = dictionary.lookup(text);
    words.push({
      text,
      reading: held.flatMap((unit) => [...unit.reading]),
      isProperNoun: entry?.isProperNoun ?? false,
      partOfSpeech: entry?.partOfSpeech ?? "",
      isKnown: entry !== undefined,
    });
    held = [];
  };

  for (const unit of units) {
    if (kept.has(unit.from)) {
      flush();
    }
    held.push(unit);
  }
  flush();

  return words;
}

/**
 * Decode a Han run with the lattice: the recommended path.
 *
 * Stages 1 to 3 of ALGORITHM.md end to end — build every candidate reading,
 * lock the positions that cannot vary, score the rest — where the greedy
 * baseline commits to the longest match at each position and never revisits it.
 */
export function decodeRun(
  dictionary: Dictionary,
  run: string,
): readonly DecodedWord[] {
  const lattice = buildLattice(dictionary, run);
  const projection = projectReadings(lattice);
  const units = decodeReadings(lattice, projection);
  return wordsFrom(dictionary, lattice, units, decodeSpacing(lattice));
}
