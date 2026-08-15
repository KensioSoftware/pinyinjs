/**
 * The romanisation systems the CLI can write, and the command that writes them.
 */
import { PLAIN, visibleLength } from "./colour.js";
import { type Command, column } from "./command.js";
import { transcriptions } from "./transcribe-reading.js";
import { transcribed } from "./transcribe-rows.js";

export { type System, SYSTEMS, systemNamed, writtenWith } from "./systems.js";

/**
 * How wide each of `transcribe`'s columns is when its cells are narrow.
 *
 * A floor rather than the width: a whole word is wider than a syllable, and
 * `mao-tsʻê-tung` is thirteen characters in a column sized for `ch'ü¹`. The
 * widths are kept as a floor so that a single syllable still lines up with the
 * next answer down when a file is piped through, and so that widening one row
 * does not move every example in the docs.
 */
const TRANSCRIBE_WIDTHS: readonly number[] = [12, 10, 12, 12, 10, 10, 12, 0];

/**
 * Lay rows of cells out in columns, each as wide as it needs to be.
 */
function laidOut(rows: readonly (readonly string[])[]): readonly string[] {
  const widths = TRANSCRIBE_WIDTHS.map((floor, at) =>
    Math.max(
      floor,
      ...rows.map((row) => {
        // A cell needs one space after it at least, which is what the floor
        // gives the widest syllable already. Only a cell that does not fit
        // widens the column, and then it takes two — so a single syllable is
        // laid out exactly as it was before words could arrive.
        const width = visibleLength(row[at] ?? "");
        return width + 1 > floor ? width + 2 : 0;
      }),
    ),
  );
  return rows.map((row) =>
    row
      .map((cell, at) => column(cell, widths[at] ?? 0))
      .join("")
      .trimEnd(),
  );
}

/**
 * Write pinyin in every other system, and read any of them back.
 *
 * Not `romanize`, for two reasons: bopomofo has a script of its own and IPA is
 * a transcription rather than a spelling, so half the columns are not
 * romanisations — and the input is pinyin, which already is one. *Comparison of
 * Standard Chinese transcription systems*, the syllabary these tables are
 * checked against, is the source of the word as well as of the columns.
 *
 * Needs no dictionary, for the same reason `syllable` does: a transcription is
 * a mapping over syllables and there is nothing to look up. Several rows come
 * back where Wade-Giles is ambiguous, which is most of it once the apostrophes
 * and diacritics have been dropped.
 */
export const TRANSCRIBE: Command = {
  name: "transcribe",
  summary: "pinyin to bopomofo, Wade-Giles, Yale, GR and IPA, and back",
  argument: "<text...>",
  flags: ["notation", "from"],
  needsDictionary: false,
  run: (input) =>
    input.texts.map((text) => {
      const found = transcriptions(text, input.flags);
      if (found.length === 0) {
        return {
          lines: [`${text}  not readable`],
          data: { text, read: false },
        };
      }
      return {
        lines: laidOut(
          found.map((reading, index) => {
            const one = transcribed(reading, input.flags, input.paint);
            return [
              index === 0 ? text : "",
              one.pinyin,
              one.bopomofo,
              one.wadeGiles,
              one.yale,
              one.gwoyeu,
              one.ipa,
              one.isExact === false ? "marks restored" : "",
            ];
          }),
        ),
        data: {
          text,
          read: true,
          readings: found.map((reading) =>
            transcribed(reading, input.flags, PLAIN),
          ),
        },
      };
    }),
};
