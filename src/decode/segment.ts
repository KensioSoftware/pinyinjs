import { readNumbersIn } from "../numerals/text.js";
import { toCharacters } from "../script/characters.js";
import type { Dictionary } from "../dictionary/dictionary.js";
import type { Syllable } from "../syllable/syllable.js";
import { decodeRun } from "./decode.js";
import { READING_RULES } from "./reading-rules.js";
import { splitRuns, surroundingCharacters } from "./runs.js";

/**
 * One word of a segmented text, or one stretch that was never Han.
 */
export interface Segment {
  /** The characters, exactly as the text writes them. */
  readonly text: string;
  /**
   * Where it starts, in code points from the start of the text.
   *
   * Code points rather than UTF-16 units, so a character outside the basic
   * plane counts as the one character it is. 𠮷 is a surname and one position.
   */
  readonly at: number;
  /**
   * The 普通话 reading, or empty for a stretch that was never Han.
   *
   * Not one syllable per character: 玩儿 is `wánr`. Where a text needs its
   * readings written out rather than inspected, `convertPieces` is the one
   * that lines syllables up with the characters they read.
   */
  readonly reading: readonly Syllable[];
  /** jieba's tag, or the empty string where there is none. */
  readonly partOfSpeech: string;
  readonly isProperNoun: boolean;
  /**
   * Whether the dictionary holds an entry for exactly these characters.
   *
   * Not the same as "is a word": a single character standing on its own is
   * known, because the dictionary has an entry for the character. What it is
   * false for is a stretch that was never Han, and a Han character no source
   * has a reading for at all.
   */
  readonly isKnown: boolean;
}

/**
 * A stretch of text with no reading: punctuation, Latin, digits, whitespace.
 */
function unread(text: string, at: number): Segment {
  return {
    text,
    at,
    reading: [],
    partOfSpeech: "",
    isProperNoun: false,
    isKnown: false,
  };
}

/**
 * Split a text into the words the decoder finds in it.
 *
 * Segmentation is not a feature this package added; it is what converting has
 * always had to do first, because the unit a reading belongs to is the word.
 * 行 is `xíng`, `háng`, `héng` or `hàng` and nothing about the character says
 * which — only 银行 and 行长 do. This exposes the answer the decoder already
 * works out, which was previously thrown away at the boundary: `convert`
 * returns a string and `convertPieces` returns syllables, and neither says
 * where the words were.
 *
 * ```ts
 * segment(dictionary, "我要去北京。").map((found) => found.text);
 * // ["我", "要", "去", "北京", "。"]
 * ```
 *
 * **Every stretch of the text comes back, in order**, including the stretches
 * that were never Han, so `segment(d, text).map((f) => f.text).join("")` is
 * the text again. A caller wanting only the words can filter on `isKnown`, and
 * one wanting to highlight in place has `at`.
 *
 * The boundaries are the ones `convert` uses, down to the number in front of a
 * run: 2个人 is 个 + 人 because the 两 counts with the 个, where 个人 alone is
 * the word `gèrén`. What is *not* applied is 分词连写, the word spacing GB/T
 * 16159 wants in written pinyin — 他看了 segments as 他 / 看 / 了 and converts
 * as `tā kànle`, because attaching an aspect particle to its verb is a fact
 * about writing pinyin rather than about where the words are.
 */
export function segment(
  dictionary: Dictionary,
  text: string,
): readonly Segment[] {
  const runs = [...splitRuns(text)];
  // A Han run is decoded knowing the number in front of it, which is the one
  // thing outside a run that moves a boundary inside it. Read per run rather
  // than for the whole text, for the reason `convert` does: 1998年 is a year
  // and 3个 is a count, and only the characters either side say which.
  const said = runs.map((run, at) =>
    run.isHan
      ? ""
      : (readNumbersIn(run.text, surroundingCharacters(runs, at)).at(-1)
          ?.hanzi ?? ""),
  );

  const segments: Segment[] = [];
  let at = 0;
  for (const [index, run] of runs.entries()) {
    if (!run.isHan) {
      segments.push(unread(run.text, at));
      at += toCharacters(run.text).length;
      continue;
    }
    for (const word of decodeRun(
      dictionary,
      run.text,
      READING_RULES,
      said[index - 1] ?? "",
    )) {
      segments.push({
        text: word.text,
        at,
        reading: word.reading,
        partOfSpeech: word.partOfSpeech,
        isProperNoun: word.isProperNoun,
        isKnown: word.isKnown,
      });
      at += toCharacters(word.text).length;
    }
  }
  return segments;
}
