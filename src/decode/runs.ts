import type { NumeralContext } from "../numerals/text.js";
import { toCharacters } from "../script/characters.js";

/**
 * A stretch of text that is either all Han or all something else.
 */
export interface TextRun {
  readonly text: string;
  /** Whether the run is Han, and so has a reading to decode. */
  readonly isHan: boolean;
}

/**
 * Characters the decoder has a reading for.
 *
 * Punctuation, Latin letters, digits and whitespace all pass through untouched;
 * reading digits aloud is the numerals package's job, not this one's.
 */
const HAN = /\p{Script=Han}/u;

/**
 * Split text into Han runs and everything else.
 *
 * The first stage of the pipeline, and the reason the rest of it never has to
 * think about mixed content: `我要去北京。` becomes one Han run and one piece of
 * punctuation, and only the first goes near the dictionary.
 *
 * Runs are returned in order and concatenate back to the input exactly, so a
 * conversion can rebuild the text around what it changed.
 */
export function splitRuns(text: string): readonly TextRun[] {
  const runs: TextRun[] = [];
  let current = "";
  let currentIsHan: boolean | undefined;

  for (const character of toCharacters(text)) {
    const isHan = HAN.test(character);
    if (currentIsHan === undefined) {
      currentIsHan = isHan;
    } else if (isHan !== currentIsHan) {
      runs.push({ text: current, isHan: currentIsHan });
      current = "";
      currentIsHan = isHan;
    }
    current += character;
  }

  if (currentIsHan !== undefined) {
    runs.push({ text: current, isHan: currentIsHan });
  }

  return runs;
}

/**
 * The Han either side of a run, as the two characters a number goes on.
 *
 * A number's context, bar one syllable of it. The characters decide how it is
 * read — 年 makes 1998 a year, 个 makes 3 a count and 2 两, and 第 makes 2 an
 * ordinal — and characters are all they are, so this is known before anything
 * has been decoded. Which is what lets the numbers be read first and the decode
 * of the Han after them see what the digits stood for.
 */
export function surroundingCharacters(
  runs: readonly TextRun[],
  at: number,
): NumeralContext {
  const previous = runs[at - 1];
  const next = runs[at + 1];
  return {
    following: next?.isHan === true ? (toCharacters(next.text)[0] ?? "") : "",
    preceding:
      previous?.isHan === true
        ? (toCharacters(previous.text).at(-1) ?? "")
        : "",
  };
}
