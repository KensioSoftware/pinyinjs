/**
 * The subcommands that convert a text and hand it back.
 *
 * `convert`, `html`, `annotate` and `segment` all run the same conversion and
 * differ only in what they wrap around it, which is why they sit together.
 */
import {
  convert,
  convertGreedily,
  convertPieces,
  convertPiecesGreedily,
} from "../decode/convert.js";
import { segment } from "../decode/segment.js";
import { convertToAnnotatedHtml, convertToHtml } from "../format/html.js";
import { toTranscription } from "../format/transcription.js";
import { writeSyllable } from "../syllable/syllable.js";
import {
  convertOptions,
  CONVERT_FLAGS,
  htmlOptions,
  transcriptionSystem,
} from "./arguments.js";
import { PLAIN } from "./colour.js";
import {
  type Command,
  dictionaryOf,
  paintedPieces,
  written,
} from "./command.js";
import { systemNamed } from "./transcribe-command.js";

/**
 * Convert each text, one line in and one line out.
 */
export const CONVERT: Command = {
  name: "convert",
  summary: "hanzi to pinyin",
  argument: "[text...]",
  flags: [...CONVERT_FLAGS, "greedy", "system"],
  needsDictionary: true,
  run: (input) => {
    const options = convertOptions(input.flags);
    const isGreedy = input.flags.greedy === true;
    const decode = isGreedy ? convertGreedily : convert;
    const inPieces = isGreedy ? convertPiecesGreedily : convertPieces;
    const system = systemNamed(transcriptionSystem(input.flags));
    if (system !== undefined) {
      // hanzi → pinyin → the system, which is the shape ROADMAP.md predicted
      // for the whole of `transcription`. See toTranscription for why the word
      // grouping is shared and only the join is the system's.
      return input.texts.map((text) => {
        const written = toTranscription(
          inPieces(dictionaryOf(input), text, options),
          (syllables) => system.word(syllables, options.notation !== "none"),
          { capitals: system.capitals },
        );
        return {
          lines: [written],
          data: { text, system: system.name, transcription: written },
        };
      });
    }
    return input.texts.map((text) => {
      const pinyin = decode(dictionaryOf(input), text, options);
      // The pieces cost a second sweep of the lattice, so they are only asked
      // for where there is a colour to put on them.
      const written =
        input.paint === PLAIN
          ? pinyin
          : paintedPieces(inPieces(dictionaryOf(input), text, options), input);
      return { lines: [written], data: { text, pinyin } };
    });
  },
};

/**
 * Convert each text to HTML, one element per syllable.
 */
export const HTML: Command = {
  name: "html",
  summary: "hanzi to pinyin as HTML, one element per syllable",
  argument: "[text...]",
  flags: [...CONVERT_FLAGS, "no-tone-classes", "no-uncertain", "no-lang"],
  needsDictionary: true,
  run: (input) => {
    const options = htmlOptions(input.flags);
    return input.texts.map((text) => {
      const html = convertToHtml(dictionaryOf(input), text, options);
      return { lines: [html], data: { text, html } };
    });
  },
};

/**
 * Annotate each text: the hanzi, with its reading above.
 *
 * Uncoloured for the same reason `html` is — the classes are the hook, and a
 * terminal escape code inside markup would be pasted into a page.
 */
export const ANNOTATE: Command = {
  name: "annotate",
  summary: "hanzi with its pinyin above, as ruby HTML",
  argument: "[text...]",
  flags: [...CONVERT_FLAGS, "no-tone-classes", "no-uncertain", "no-lang"],
  needsDictionary: true,
  run: (input) => {
    const options = htmlOptions(input.flags);
    return input.texts.map((text) => {
      const html = convertToAnnotatedHtml(dictionaryOf(input), text, options);
      return { lines: [html], data: { text, html } };
    });
  },
};

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
