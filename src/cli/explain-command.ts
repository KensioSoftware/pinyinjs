/**
 * Showing what the decoder chose, syllable by syllable, and what it rejected.
 */
import { convertPieces } from "../decode/convert.js";
import { convertOptions, CONVERT_FLAGS } from "./arguments.js";
import { type Command, dictionaryOf, paintedPieces } from "./command.js";
import { explainSyllable } from "./explain-syllable.js";

/**
 * Show what the decoder chose, syllable by syllable, and what it rejected.
 */
export const EXPLAIN: Command = {
  name: "explain",
  summary: "show each syllable, how settled it was, and what it beat",
  argument: "[text...]",
  flags: [...CONVERT_FLAGS],
  needsDictionary: true,
  run: (input) => {
    const dictionary = dictionaryOf(input);
    const options = convertOptions(input.flags);

    return input.texts.map((text) => {
      const pieces = convertPieces(dictionary, text, options);
      const pinyin = pieces.map((piece) => piece.text).join("");
      const syllables = pieces
        .filter((piece) => piece.syllable !== undefined)
        .map((piece) => explainSyllable(piece, input));

      return {
        lines: [
          `${text}  ${paintedPieces(pieces, input)}`,
          ...syllables.map((syllable) => syllable.line),
        ],
        data: {
          text,
          pinyin,
          syllables: syllables.map((syllable) => syllable.data),
        },
      };
    });
  },
};
