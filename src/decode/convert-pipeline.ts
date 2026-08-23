/**
 * The conversion pipeline: runs in, written pieces out.
 *
 * One function, because the phases depend on each other in a fixed order and
 * each needs what the one before it produced — the numbers are read before
 * anything is decoded, the Han runs are decoded before anything is written, and
 * the capitals and punctuation are applied over the whole text rather than over
 * a run. Which decoder does the middle of it is the caller's to choose, which is
 * what makes the six entry points in `convert.ts` six lines each.
 */
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
import type { Decode } from "./decoders.js";
import { wordsOf } from "./run-words.js";
import { writeRun, rewrite } from "./write-run.js";

/**
 * Run the pipeline over a text with a given decoder.
 */
export function convertWith(
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
