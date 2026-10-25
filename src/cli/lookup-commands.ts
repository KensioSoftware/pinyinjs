/**
 * The subcommands that look a word up rather than decode one.
 *
 * `lookup` reports what the dictionary stores for a word and `sandhi` shows
 * what the runtime pass does to a reading. Neither asks the decoder to choose
 * anything, which is what separates them from `explain` and `syllable`.
 */
import { applySandhi } from "../decode/sandhi.js";
import { readWord } from "../syllable/split.js";
import { convertOptions } from "./arguments.js";
import { PLAIN } from "./colour.js";
import { type Command, dictionaryOf, written } from "./command.js";
import { entryFound } from "./lookup-entry.js";

/**
 * Look words up in the dictionary.
 */
export const LOOKUP: Command = {
  name: "lookup",
  summary: "what the dictionary holds for a word",
  argument: "<word...>",
  flags: [],
  needsDictionary: true,
  run: (input) =>
    input.texts.map((word) =>
      entryFound(dictionaryOf(input), word, input.paint),
    ),
};

/**
 * Apply sandhi to written pinyin, with no dictionary at all.
 */
export const SANDHI: Command = {
  name: "sandhi",
  summary: "apply tone sandhi to written pinyin",
  argument: "<pinyin...>",
  flags: ["third-tone", "no-sandhi"],
  needsDictionary: false,
  run: (input) => {
    const options = convertOptions(input.flags).sandhi;
    return input.texts.map((text) => {
      // Whitespace is the only word boundary written pinyin has, and third-tone
      // sandhi needs it: 行長很喜歡 is `hángzhǎng hén xǐhuan`, where a scan that
      // could not see the boundary would lower the 長 as well.
      const words = text
        .split(/\s+/u)
        .filter((part) => part !== "")
        .map((part) => readWord(part));
      if (words.length === 0 || words.some((word) => word === undefined)) {
        return {
          lines: [`${text}  not readable as pinyin`],
          data: { text, read: false },
        };
      }
      const read = words.filter((word) => word !== undefined);
      const said = applySandhi(
        read.flat(),
        options,
        read.map((word) => word.length),
      );
      return {
        lines: [`${text}  ${written(said, input.paint)}`],
        data: { text, read: true, pinyin: written(said, PLAIN) },
      };
    });
  },
};
