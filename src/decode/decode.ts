import type { Dictionary } from "../dictionary/dictionary.js";
import { scoreReadings, type ScoredUnit } from "./confidence.js";
import { buildLattice, cutPoints, type Lattice } from "./lattice.js";
import {
  isSettled,
  projectReadings,
  type ReadingProjection,
  type ReadingUnit,
  settledUnits,
  unitsOf,
} from "./locking.js";
import { readingCost, shortestPath, spacingCost } from "./viterbi.js";
import type { DecodedWord, ScoredWord } from "./word.js";

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
 * Gather the reading units into the words the boundaries make of them.
 *
 * Where the two decodes disagree the readings win, which is what "advisory"
 * means for the spacing decode: a boundary falling inside a reading unit is
 * dropped rather than allowed to break the unit up. 玩儿 read as `wánr` is one
 * syllable over two characters, and no spacing can be put between them.
 */
function groupUnits<Unit extends ReadingUnit>(
  units: readonly Unit[],
  boundaries: readonly number[],
): readonly (readonly Unit[])[] {
  const starts = new Set(units.map((unit) => unit.from));
  const kept = new Set(boundaries.filter((at) => starts.has(at)));
  const groups: Unit[][] = [];
  let held: Unit[] = [];

  for (const unit of units) {
    if (kept.has(unit.from) && held.length > 0) {
      groups.push(held);
      held = [];
    }
    held.push(unit);
  }
  if (held.length > 0) {
    groups.push(held);
  }

  return groups;
}

/**
 * Assemble one word from the units the boundaries kept together.
 */
function wordFrom(
  dictionary: Dictionary,
  lattice: Lattice,
  group: readonly ReadingUnit[],
): DecodedWord {
  const first = group[0];
  const last = group.at(-1);
  /* c8 ignore next 3 -- a group is only made by pushing a unit into it */
  if (first === undefined || last === undefined) {
    throw new Error("a word must cover at least one reading unit");
  }
  const text = lattice.characters.slice(first.from, last.to).join("");
  const entry = dictionary.lookup(text);

  return {
    text,
    reading: group.flatMap((unit) => [...unit.reading]),
    isProperNoun: entry?.isProperNoun ?? false,
    partOfSpeech: entry?.partOfSpeech ?? "",
    isKnown: entry !== undefined,
  };
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
  const units = decodeReadings(lattice, projectReadings(lattice));
  return groupUnits(units, decodeSpacing(lattice)).map((group) =>
    wordFrom(dictionary, lattice, group),
  );
}

/**
 * Decode a Han run, keeping what each reading was chosen over.
 *
 * The same decode as {@link decodeRun}, and the same words, with the losing
 * candidates kept rather than discarded. Separate because the extra sweep is
 * only worth running for a caller that will use the answer — rendering
 * uncertain readings differently, or reporting them.
 */
export function decodeRunScored(
  dictionary: Dictionary,
  run: string,
): readonly ScoredWord[] {
  const lattice = buildLattice(dictionary, run);
  const units = scoreReadings(lattice, projectReadings(lattice));

  return groupUnits<ScoredUnit>(units, decodeSpacing(lattice)).map((group) => ({
    word: wordFrom(dictionary, lattice, group),
    confidence: group.flatMap((unit) =>
      unit.reading.map(() => ({
        isLocked: unit.isLocked,
        alternatives: unit.alternatives,
      })),
    ),
  }));
}
