import type { Dictionary } from "../dictionary/dictionary.js";
import {
  capitaliseSentenceParts,
  isSentence,
} from "../orthography/capitals.js";
import { toLatinPunctuationParts } from "../orthography/punctuation.js";
import { readNumbersIn } from "../numerals/text.js";
import { toCharacters } from "../script/characters.js";
import { hintsWithin, resolveHints } from "./hints.js";
import { splitRuns, surroundingCharacters } from "./runs.js";
import type { ConvertedPiece, ConvertOptions, Written } from "./pieces.js";
import { numeralBefore, surrounding, writeNumbers } from "./numbers.js";
import { type Decode, GREEDY, LATTICE, SCORED } from "./decoders.js";

export {
  type ConvertedPiece,
  type ConvertOptions,
  type NumberStyle,
  sourcesOf,
} from "./pieces.js";
import { writeRun, rewrite, wordsOf } from "./write-run.js";

/**
 * Run the pipeline over a text with a given decoder.
 */
function convertWith(
  decode: Decode,
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions,
): readonly ConvertedPiece[] {
  const {
    locale = "zh-CN",
    notation = "marks",
    apostrophe = "always",
    capitals = "auto",
    punctuation = "latin",
    grouping = true,
    numbers = "read",
    sandhi,
    readings,
  } = options;
  const written: Written = { notation, apostrophe, capitals };
  const converted: ConvertedPiece[] = [];

  const runs = [...splitRuns(text)];
  // Parsed once for the whole text rather than per run, so that a malformed
  // hint is reported whether or not a run happens to reach it.
  const hints = readings === undefined ? undefined : resolveHints(readings);
  // Where each run starts, in code points, so a caller counting positions from
  // the start of the text can be met where the run puts them.
  const starts: number[] = [];
  let start = 0;
  for (const run of runs) {
    starts.push(start);
    start += toCharacters(run.text).length;
  }
  // Read before anything is decoded, because a number needs to know what
  // follows it — 1998年 is a year and 3个 is a count — and the character that
  // decides it is there for the reading without a decode of its own.
  const read = runs.map((run, at) =>
    run.isHan || numbers === "keep"
      ? []
      : readNumbersIn(run.text, surroundingCharacters(runs, at)),
  );
  // Decoded before anything is written, because a number's sandhi needs the
  // syllable after it, and because a Han run needs the number in front of it:
  // 2个人 is `liǎng gè rén` and 个人 on its own is the word `gèrén`.
  const decoded = runs.map((run, at) => {
    if (!run.isHan) {
      return [];
    }
    const within =
      hints === undefined
        ? undefined
        : hintsWithin(hints, starts[at] ?? 0, toCharacters(run.text).length);
    const said = numeralBefore(read[at - 1] ?? []);
    return wordsOf(
      decode(dictionary, run.text, said, within),
      dictionary,
      grouping,
    );
  });

  for (const [at, run] of runs.entries()) {
    const words = decoded[at] ?? [];
    if (run.isHan) {
      converted.push(...writeRun(dictionary, words, locale, written, sandhi));
      continue;
    }
    converted.push(
      ...writeNumbers(
        run.text,
        read[at] ?? [],
        surrounding(runs, decoded, at),
        written,
        { sandhi },
      ),
    );
  }
  let pieces: readonly ConvertedPiece[] = converted;

  // Both of these read the whole conversion rather than one run: a sentence
  // capital belongs to whichever run happens to start the sentence, and a mark
  // needs to know whether anything follows it before it takes a space.
  if (capitals === "auto" && isSentence(text)) {
    pieces = rewrite(pieces, capitaliseSentenceParts);
  }
  return punctuation === "latin"
    ? rewrite(pieces, toLatinPunctuationParts)
    : pieces;
}

/**
 * Convert hanzi to pinyin with the lattice decoder.
 *
 * The recommended path. Builds every candidate reading of each Han run, locks
 * the positions that read the same way whichever candidates are chosen, and
 * scores only what is left — see {@link decodeRun} and ALGORITHM.md. GB/T 16159
 * orthography is then applied over the decoded words rather than over the
 * output string.
 */
export function convert(
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions = {},
): string {
  return joinPieces(convertWith(LATTICE, dictionary, text, options));
}

/**
 * Convert hanzi to pinyin, syllable by syllable, with confidence beside each.
 *
 * The same conversion {@link convert} performs and the same text once joined,
 * kept in pieces so that each syllable can be rendered on its own terms.
 * Everything the decode rejected is reported with it — see
 * {@link import("./confidence.js").ReadingConfidence} — which is what an
 * output format needs to show a reader where it was guessing.
 *
 * Costs a second sweep of the lattice, which is why it is not what
 * {@link convert} runs.
 */
export function convertPieces(
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions = {},
): readonly ConvertedPiece[] {
  return convertWith(SCORED, dictionary, text, options);
}

/**
 * The same pieces, without asking the lattice what it rejected.
 *
 * Internal, and not in `src/index.ts`: it exists for `slug`, which needs the
 * syllables and the word boundaries but has nothing to say about confidence,
 * and would otherwise pay {@link convertPieces}'s second sweep on every title
 * it is handed. An output format that shows a reader anything about the decode
 * wants {@link convertPieces} instead.
 */
export function convertPiecesUnscored(
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions = {},
): readonly ConvertedPiece[] {
  return convertWith(LATTICE, dictionary, text, options);
}

/**
 * Join a conversion's pieces back into the text they spell.
 */
export function joinPieces(pieces: readonly ConvertedPiece[]): string {
  return pieces.map((piece) => piece.text).join("");
}

/**
 * Convert hanzi to pinyin with the greedy baseline decoder.
 *
 * **The baseline, kept to measure against.** See {@link decodeGreedily} for why
 * this is not the intended algorithm, and ALGORITHM.md for what replaces it.
 * Use {@link convert} instead.
 */
export function convertGreedily(
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions = {},
): string {
  return joinPieces(convertWith(GREEDY, dictionary, text, options));
}

/**
 * The same, kept in pieces.
 *
 * {@link convertPieces} for the baseline, so that a caller rendering each
 * syllable — colouring its tone — can still ask for the comparison. The pieces
 * carry no confidence, because the greedy decode cannot say what it rejected.
 */
export function convertPiecesGreedily(
  dictionary: Dictionary,
  text: string,
  options: ConvertOptions = {},
): readonly ConvertedPiece[] {
  return convertWith(GREEDY, dictionary, text, options);
}
