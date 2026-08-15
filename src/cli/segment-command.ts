/**
 * Splitting a text into the words the decoder finds in it.
 */
import { segment } from "../decode/segment.js";
import { writeSyllable } from "../syllable/syllable.js";
import { type Command, dictionaryOf, written } from "./command.js";

/**
 * Split each text into the words the decoder finds in it.
 *
 * The words on one line, since that is what the answer is, with the reading
 * under each so the split can be read against what it settled. A stretch that
 * was never Han is shown as itself and marked, because it is part of the text
 * and not part of the segmentation.
 */
export const SEGMENT: Command = {
  name: "segment",
  summary: "split text into words",
  argument: "[text...]",
  flags: [],
  needsDictionary: true,
  run: (input) =>
    input.texts.map((text) => {
      const found = segment(dictionaryOf(input), text);
      return {
        lines: [
          found.map((one) => one.text).join(" / "),
          // Unpadded, as `lookup` is and for the same reason: a hanzi column
          // cannot be lined up by counting characters, since a terminal draws
          // most of them two cells wide and 。 and Latin one.
          ...found.map(
            (one) =>
              `  ${[
                one.text,
                written(one.reading, input.paint),
                one.isKnown ? one.partOfSpeech : "—",
              ]
                .filter((cell) => cell !== "")
                .join("  ")}`,
          ),
        ],
        data: {
          text,
          words: found.map((one) => ({
            text: one.text,
            at: one.at,
            reading: one.reading
              .map((syllable) => writeSyllable(syllable))
              .join(" "),
            partOfSpeech: one.partOfSpeech,
            isProperNoun: one.isProperNoun,
            isKnown: one.isKnown,
          })),
        },
      };
    }),
};
