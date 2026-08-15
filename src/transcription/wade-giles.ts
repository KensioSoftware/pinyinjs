/**
 * Wade-Giles, and cutting a run of it into syllables.
 *
 * The entry point for the system, re-exporting the spelling tables and the
 * single-syllable reader alongside its own subject: Wade-Giles writes a word
 * with hyphens, and a text that dropped them has to be segmented back. That
 * is a different problem from reading one syllable — the spellings overlap,
 * so it takes a search rather than a lookup.
 */
import type { Syllable } from "../syllable/syllable.js";
import { ERHUA_SUFFIX } from "./wade-giles-spelling.js";
import { INDEX } from "./wade-giles-index.js";
import { normalise } from "./wade-giles-parse.js";
import { readWadeGilesLoosely } from "./wade-giles-syllable.js";

export {
  type WadeGilesOptions,
  writeWadeGiles,
  writeWadeGilesSpelling,
  writeWadeGilesWord,
} from "./wade-giles-spelling.js";
export { readWadeGiles, readWadeGilesLoosely } from "./wade-giles-syllable.js";

/**
 * The longest a Wade-Giles head can be: the longest spelling, plus the 儿化
 * suffix and a tone digit.
 *
 * Derived rather than written down, because a fixed width is a number that goes
 * stale silently.
 */
const LONGEST_SPELLING =
  Math.max(...[...INDEX.exact.keys()].map((spelling) => spelling.length)) +
  1 +
  ERHUA_SUFFIX.length;

/**
 * The syllables Wade-Giles writes with no vowel in them at all.
 *
 * 嗯 `ng`, 呣 `m`, 唔 `n`, 噷 `hm` and 哼 `hng` — the syllabic nasals, every one
 * of them an interjection. They are syllables and read as such on their own,
 * but a *piece* of a longer run is never one of them: over the 411,956
 * multi-syllable words of the phrase corpus, **not one** has a syllabic nasal
 * anywhere in it, first or otherwise.
 *
 * That matters because `ng` would otherwise let any run ending in -ng come
 * apart: `shung` is a regular Wade-Giles spelling of a syllable Mandarin does
 * not have, and {@link readWadeGiles} refuses it precisely so that a rule
 * cannot invent it — but `shu` + `ng` would hand it back through the side door.
 * Barring them from a split costs nothing that can be measured and closes it.
 */
const SYLLABIC_NASALS = new Set(
  [...INDEX.loose.keys()].filter((spelling) => !/[aeiouêŭü]/u.test(spelling)),
);

/**
 * Whether a normalised run reads as exactly one Wade-Giles syllable.
 *
 * Asked of the loose reader, so that a splitter accepts the same spellings the
 * reader does: a splitter that emitted a piece the reader then refused would be
 * the two halves disagreeing about what Wade-Giles is.
 */
function isOneSyllable(run: string, memo: Map<string, boolean>): boolean {
  const found = memo.get(run);
  if (found !== undefined) {
    return found;
  }
  const isReads = readWadeGilesLoosely(run).length > 0;
  memo.set(run, isReads);
  return isReads;
}

/**
 * Split a run of Wade-Giles with no hyphens in it, longest-first.
 *
 * Memoised on the suffix, as `splitSyllables` is, since a run of ambiguous
 * syllables would otherwise backtrack exponentially.
 */
function segmentWadeGiles(
  run: string,
  reads: Map<string, boolean>,
  memo: Map<string, readonly string[] | undefined>,
): readonly string[] | undefined {
  if (run === "") {
    return [];
  }
  const found = memo.get(run);
  if (found !== undefined || memo.has(run)) {
    return found;
  }
  memo.set(run, undefined);
  for (
    let length = Math.min(LONGEST_SPELLING, run.length);
    length > 0;
    length--
  ) {
    const head = run.slice(0, length);
    if (!isOneSyllable(head, reads) || SYLLABIC_NASALS.has(head)) {
      continue;
    }
    const rest = segmentWadeGiles(run.slice(length), reads, memo);
    if (rest !== undefined) {
      const split = [head, ...rest];
      memo.set(run, split);
      return split;
    }
  }
  return undefined;
}

/**
 * Split written Wade-Giles into syllables: `maotsetung` becomes three.
 *
 * **The hyphen is Wade's own boundary and is honoured where it is there.** What
 * this is for is the text that dropped it, which is most of the Wade-Giles
 * anybody meets — and there the system has nothing to fall back on, since its
 * apostrophe marks aspiration rather than separation. Pinyin's 隔音符号 has no
 * counterpart here.
 *
 * Longest-first, as `splitSyllables` is for pinyin, and measured on the same
 * vocabulary the 52.07% ambiguity figure comes from — 411,956 multi-syllable
 * words of the phrase corpus, written in Wade-Giles and run together:
 *
 * | | marks kept | marks dropped |
 * | --- | ---: | ---: |
 * | the boundary is found | 99.19% | 99.04% |
 * | the word comes back | **99.45%** | **56.04%** |
 *
 * **Finding the boundary is not the hard part; saying which syllable it was
 * is.** The boundary is found either way; what collapses is the reading, and
 * only when the marks are gone, because 52.07% of written syllables then no
 * longer say which syllable they were. See {@link readWadeGilesLoosely}.
 *
 * The true split is among the candidates 100.00% of the time and is the only
 * candidate 17.08% of the time, at a mean of 5.23 candidates per word — so
 * longest-first is a choice among real rivals rather than the only reading
 * available. It comes back whole slightly *more* often than it finds the
 * boundary, because two of the variant spellings read the same either way.
 *
 * The 0.81% of boundaries that are missed are one mechanism: Wade-Giles ends
 * syllables in -n and -ng and begins them with vowels and n-, so `i-ti-hu-na`
 * runs together as `itihuna` and comes back `i-ti-hun-a`. Of 3,317 misses,
 * 53.39% swallow a syllable beginning with n- and 36.72% one beginning with a
 * vowel. Pinyin is spared most of this by spelling a zero-initial i- as `yi-`;
 * Wade-Giles writes 一 as `i`, and 960 of the misses — 28.94% — are a
 * swallowed 一.
 *
 * Returns undefined for a run that does not split into Wade-Giles at all —
 * which includes `Chungking` and `Tsingtao`, because those are Postal
 * Romanisation rather than Wade-Giles and `king`, `tsing` and `pe` are not
 * Wade-Giles syllables.
 */
export function splitWadeGiles(text: string): readonly string[] | undefined {
  const run = normalise(text);
  if (run === "") {
    return undefined;
  }
  const reads = new Map<string, boolean>();

  // One syllable is one syllable, which is what lets the syllabic nasals be
  // read on their own while never being a piece of anything longer.
  if (isOneSyllable(run, reads)) {
    return [run];
  }

  const memo = new Map<string, readonly string[] | undefined>();

  // A hyphen is a boundary except in `-êrh`, which is part of a spelling — so
  // the segmenter is given the hyphens and takes the longer head where one
  // reads, rather than the run being cut on them first.
  const split = segmentWadeGiles(run, reads, memo);
  if (split !== undefined) {
    return split;
  }
  // Nothing read across the hyphens, so treat every one of them as a boundary.
  const parts = run.split("-").filter((part) => part !== "");
  if (parts.length < 2) {
    return undefined;
  }
  const segments = parts.map((part) => segmentWadeGiles(part, reads, memo));
  return segments.includes(undefined)
    ? undefined
    : segments.flatMap((segment) => segment ?? []);
}

/**
 * Read a whole Wade-Giles word, splitting it first: `lishihchen` is 李時珍.
 *
 * Takes the first candidate for each syllable rather than every combination,
 * which is the same choice {@link readWadeGilesLoosely}'s ordering offers and
 * for the same reason: a caller looking at a word cannot be handed the 5.23
 * splits and the candidates under each of them and be said to have an answer.
 * Measured over the phrase corpus, that recovers 99.45% of words written with
 * their marks and 56.04% of words written without them.
 *
 * Undefined where the run does not split at all.
 */
export function readWadeGilesWord(
  text: string,
): readonly Syllable[] | undefined {
  const split = splitWadeGiles(text);
  if (split === undefined) {
    return undefined;
  }
  const syllables = split.flatMap((spelling) => {
    const [first] = readWadeGilesLoosely(spelling);
    /* c8 ignore next -- the splitter only emits spellings that read */
    return first === undefined ? [] : [first];
  });
  /* c8 ignore next -- for the same reason */
  return syllables.length === split.length ? syllables : undefined;
}
