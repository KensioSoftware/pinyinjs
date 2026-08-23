import { buildLattice, type Lattice } from "./lattice.js";
import type { ResolvedHints } from "./hints.js";
import type { RunLattice } from "./lattice-slice.js";

export { runLattice } from "./lattice-slice.js";
/**
 * Building the lattice one Han run is decoded over.
 *
 * A run is decoded on its own and the pieces are put back together, so this
 * is where a lattice is cut down to a run and the words are read back out of
 * it. `decode.ts` is what asks for one.
 */
import { decodeSpacing } from "./lattice-decode.js";
import type { Dictionary } from "../dictionary/dictionary.js";
import type { ReadingUnit } from "./locking.js";
import { applyEdgeRules, type EdgeRule } from "./rules.js";
import type { DecodedWord } from "./word.js";

/**
 * Gather the reading units into the words the boundaries make of them.
 *
 * Where the two decodes disagree the readings win, which is what "advisory"
 * means for the spacing decode: a boundary falling inside a reading unit is
 * dropped rather than allowed to break the unit up. 玩儿 read as `wánr` is one
 * syllable over two characters, and no spacing can be put between them.
 */
export function groupUnits<Unit extends ReadingUnit>(
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
export function wordFrom(
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
export function ruledLattice(
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
 * Cut a decode of the whole lattice down to the run inside it.
 *
 * Everything outside `at` and `to` was context rather than run — 汉字 a caller
 * put either side so that the decode could see them — and is dropped once it
 * has done its work. A unit is kept only where it lies wholly inside the run,
 * which is what `isJoinedAt` guarantees for the ones that cannot be cut.
 */
export function runGroups<Unit extends ReadingUnit>(
  { lattice, at, to }: RunLattice,
  units: readonly Unit[],
): readonly (readonly Unit[])[] {
  return groupUnits(
    units.filter((unit) => unit.from >= at && unit.to <= to),
    decodeSpacing(lattice).filter((from) => from >= at && from < to),
  );
}

/**
 * Decode a Han run with the lattice: the recommended path.
 *
 * Stages 1 to 3 of ALGORITHM.md end to end — build every candidate reading,
 * lock the positions that cannot vary, score the rest — where the greedy
 * baseline commits to the longest match at each position and never revisits it.
 *
 * `before` and `after` are 汉字 standing either side of the run that the decode
 * should see and not report: the 汉字 a number written in digits would have been
 * written with, and whatever carries on from it. A run is decoded on its own
 * without them, and a run reached that way has no idea what surrounded it —
 * 个人 alone is the word `gèrén`, while the 两 of 2个人 makes 两个 the word and
 * leaves 人 to itself, and 那条河长 ends where 那条河长三百公里 goes on to say
 * how long the river is.
 */
