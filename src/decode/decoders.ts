/**
 * The three decoders a conversion can be run with.
 *
 * Each takes a Han run and hands back words; only one of them has anything to
 * say about how settled it was, so the other two are wrapped to report
 * nothing rather than each caller having to allow for the difference.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { decodeRun, decodeRunScored } from "./decode.js";
import { decodeGreedily } from "./greedy.js";
import type { ResolvedHints } from "./hints.js";
import type { DecodeContext } from "./lattice-slice.js";
import { READING_RULES } from "./reading-rules.js";
import type { DecodedWord, ScoredWord } from "./word.js";

/**
 * How a Han run is turned into words, with whatever the decoder can say about
 * how settled they were.
 *
 * The context is one argument here where the exported decoders keep `before`
 * and `after` apart, since nothing outside this package calls it and the two
 * are one claim about the text around the run.
 */
export type Decode = (
  dictionary: Dictionary,
  run: string,
  context: DecodeContext,
  hints: ResolvedHints | undefined,
) => readonly ScoredWord[];

/**
 * A decoder that reports no confidence at all, which is every decoder but one.
 */
function unscored(
  decode: (
    dictionary: Dictionary,
    run: string,
    context: DecodeContext,
    hints: ResolvedHints | undefined,
  ) => readonly DecodedWord[],
): Decode {
  return (dictionary, run, context, hints) =>
    decode(dictionary, run, context, hints).map((word) => ({
      word,
      confidence: [],
    }));
}

/**
 * The lattice decoder, reporting nothing about its own confidence.
 */
export const LATTICE: Decode = unscored((dictionary, run, context, hints) =>
  decodeRun(
    dictionary,
    run,
    READING_RULES,
    context.before,
    hints,
    context.after,
  ),
);

/**
 * The lattice decoder, with what each reading was chosen over.
 */
export const SCORED: Decode = (dictionary, run, context, hints) =>
  decodeRunScored(
    dictionary,
    run,
    READING_RULES,
    context.before,
    hints,
    context.after,
  );

/**
 * The greedy baseline, which has nothing to report either way.
 *
 * The context around a run goes unused: longest-match has no way to weigh one
 * segmentation against another, which is the whole reason it is the baseline,
 * and 汉字 it cannot report would only be another thing to trim.
 */
export const GREEDY: Decode = unscored((dictionary, run) =>
  decodeGreedily(dictionary, run),
);
