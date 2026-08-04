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
