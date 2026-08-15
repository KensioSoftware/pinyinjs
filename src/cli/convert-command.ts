/**
 * hanzi → pinyin, one line in and one line out.
 *
 * The plainest of the conversions, and the one that also carries the other
 * transcription systems: a system is a different way of writing the syllables
 * a conversion already settled, so it is a flag here rather than a command.
 */
import {
  convert,
  convertGreedily,
  convertPieces,
  convertPiecesGreedily,
} from "../decode/convert.js";
import { toTranscription } from "../format/transcription.js";
import {
  convertOptions,
  CONVERT_FLAGS,
  transcriptionSystem,
} from "./arguments.js";
import { PLAIN } from "./colour.js";
import { type Command, dictionaryOf, paintedPieces } from "./command.js";
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
