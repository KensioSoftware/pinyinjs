import type { Dictionary } from "../dictionary/dictionary.js";
import { toCharacters } from "../script/characters.js";
import { scoreReadings, type ScoredUnit } from "./confidence.js";
import { type ResolvedHints, shiftHints } from "./hints.js";
import { allEdges, buildLattice, cutPoints, type Lattice } from "./lattice.js";
import {
  isSettled,
  projectReadings,
  type ReadingProjection,
  type ReadingUnit,
  settledUnits,
  unitsOf,
} from "./locking.js";
import { READING_RULES } from "./reading-rules.js";
import { applyEdgeRules, type EdgeRule } from "./rules.js";
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
 * The lattice a run decodes over: stage 1 built, then stage 4 applied.
 *
 * The rules run between building and decoding rather than over the output,
 * which is the whole point of them — they change what the decode gets to choose
 * between, so everything downstream sees one lattice rather than a decode and
 * a list of corrections to it.
 */
function ruledLattice(
  dictionary: Dictionary,
  run: string,
  rules: readonly EdgeRule[],
  hints: ResolvedHints | undefined,
): Lattice {
  return applyEdgeRules(
    buildLattice(dictionary, run, hints),
    dictionary,
    rules,
  );
}

/**
 * A lattice to decode over, and where in it the run itself starts.
 */
interface RunLattice {
  readonly lattice: Lattice;
  readonly at: number;
}

/**
 * Whether any reading in the lattice would hold the two sides of a join
 * together.
 *
 * A reading of one syllable per character can be cut anywhere; anything else —
 * 儿化, a character with no reading — is a single claim about its whole span,
 * so a claim spanning the join cannot be reported for the run alone. 1点儿事
 * is that case: 一点儿 is one `yìdiǎnr` over the 一 the context supplied and
 * the 点儿 the run did.
 */
function isJoinedAt(lattice: Lattice, at: number): boolean {
  return allEdges(lattice).some(
    (edge) =>
      edge.from < at &&
      edge.to > at &&
      edge.reading.length !== edge.to - edge.from,
  );
}

/**
 * The lattice a run decodes over, with whatever context stands in front of it.
 *
 * The context is dropped where a reading would hold it to the run, leaving the
 * run decoded on its own, which is what it would have been before there was any
 * context to give.
 */
function runLattice(
  dictionary: Dictionary,
  run: string,
  rules: readonly EdgeRule[],
  before: string,
  hints: ResolvedHints | undefined,
): RunLattice {
  const alone = (): RunLattice => ({
    lattice: ruledLattice(dictionary, run, rules, hints),
    at: 0,
  });
  if (before === "") {
    return alone();
  }
  const held = toCharacters(before).length;
  // The context is decoded with the run, so every hint position moves along
  // with it. Shifting a copy keeps the caller's positions relative to the run
  // they were given for.
  const lattice = ruledLattice(
    dictionary,
    before + run,
    rules,
    hints === undefined ? undefined : shiftHints(hints, held),
  );
  const at = held;
  return isJoinedAt(lattice, at) ? alone() : { lattice, at };
}

/**
 * Cut a decode of the whole lattice down to the run at the end of it.
 *
 * Everything before `at` was context rather than run — 汉字 a caller put in
 * front so that the decode could see them — and is dropped once it has done its
 * work.
 */
function runGroups<Unit extends ReadingUnit>(
  { lattice, at }: RunLattice,
  units: readonly Unit[],
): readonly (readonly Unit[])[] {
  return groupUnits(
    units.filter((unit) => unit.from >= at),
    decodeSpacing(lattice).filter((from) => from >= at),
  );
}

/**
 * Decode a Han run with the lattice: the recommended path.
 *
 * Stages 1 to 3 of ALGORITHM.md end to end — build every candidate reading,
 * lock the positions that cannot vary, score the rest — where the greedy
 * baseline commits to the longest match at each position and never revisits it.
 *
 * `before` is 汉字 standing in front of the run that the decode should see and
 * not report: the 汉字 a number written in digits would have been written with.
 * A run is decoded on its own without it, and a run reached that way has no idea
 * what preceded it — 个人 alone is the word `gèrén`, while the 两 of 2个人 makes
 * 两个 the word and leaves 人 to itself.
 */
export function decodeRun(
  dictionary: Dictionary,
  run: string,
  rules: readonly EdgeRule[] = READING_RULES,
  before = "",
  hints?: ResolvedHints,
): readonly DecodedWord[] {
  const held = runLattice(dictionary, run, rules, before, hints);
  const { lattice } = held;
  const units = decodeReadings(lattice, projectReadings(lattice));
  return runGroups(held, units).map((group) =>
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
 *
 * `before` is the context {@link decodeRun} takes, and means the same here: it
 * is decoded with the run and reported with neither words nor confidence of its
 * own.
 */
export function decodeRunScored(
  dictionary: Dictionary,
  run: string,
  rules: readonly EdgeRule[] = READING_RULES,
  before = "",
  hints?: ResolvedHints,
): readonly ScoredWord[] {
  const held = runLattice(dictionary, run, rules, before, hints);
  const { lattice } = held;
  const units = scoreReadings(lattice, projectReadings(lattice));

  return runGroups<ScoredUnit>(held, units).map((group) => ({
    word: wordFrom(dictionary, lattice, group),
    confidence: group.flatMap((unit) =>
      unit.reading.map(() => ({
        isLocked: unit.isLocked,
        alternatives: unit.alternatives,
      })),
    ),
  }));
}
