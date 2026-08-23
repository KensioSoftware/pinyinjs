/**
 * What a Han run is handed about the numbers around it.
 *
 * A run is decoded on its own, so the digits either side of it are invisible to
 * it unless something puts them there. This is what puts them there, as the
 * 汉字 they would have been written with.
 */
import type { NumeralSegment } from "../numerals/text.js";
import { toCharacters } from "../script/characters.js";
import type { DecodeContext } from "./lattice-slice.js";
import type { TextRun } from "./runs.js";

/**
 * How far past a number a run's decode is allowed to see, in characters.
 *
 * The same four {@link import("./edge-context.js").wordStartingAt} looks ahead
 * by, and for the same reason: four characters is as far as a rule can reach,
 * so carrying more would be lattice nobody reads. A prefix can only take words
 * away and never invent one, so cutting the run here costs the decode nothing
 * it would otherwise have had.
 */
const READS_AHEAD = 4;

/**
 * The 汉字 a number in front of a Han run stands for, for that run's decode.
 *
 * Only the last segment of the run before, because only that one touches the
 * Han: the D of 3D银行 comes between them, and a decode of 银行 that saw 三
 * beside it would be reading a text nobody wrote.
 */
export function numeralBefore(segments: readonly NumeralSegment[]): string {
  return segments.at(-1)?.hanzi ?? "";
}

/**
 * The same, for the number after a Han run: only the first segment of it.
 */
export function numeralAfter(segments: readonly NumeralSegment[]): string {
  return segments[0]?.hanzi ?? "";
}

/**
 * The 汉字 either side of a Han run, once the digits around it have been read.
 *
 * 那条河长300公里 is four runs, and the 长 ends the first of them, so a rule
 * asking what the 长 is measured in used to see nothing at all: the numeral is
 * one run away and the 公里 two. This hands the decode what the sentence would
 * have said spelled out, which is the number in front, and the number behind
 * with the Han that carries on from it.
 */
export function contextAround(
  runs: readonly TextRun[],
  read: readonly (readonly NumeralSegment[])[],
  at: number,
): DecodeContext {
  const said = numeralAfter(read[at + 1] ?? []);
  const following = runs[at + 2];
  return {
    before: numeralBefore(read[at - 1] ?? []),
    after:
      said === "" || following?.isHan !== true
        ? said
        : said + toCharacters(following.text).slice(0, READS_AHEAD).join(""),
  };
}
