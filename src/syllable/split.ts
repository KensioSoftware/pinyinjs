import { isSyllable, readSyllable, type Syllable } from "./syllable.js";

/**
 * Characters that mark a syllable boundary explicitly.
 *
 * The apostrophe is the 隔音符号 of Xī'ān; the hyphen joins the halves of a
 * reduplicated word or a 成语 written 2+2.
 */
const SYLLABLE_SEPARATORS = /['’‘-]/u;

/**
 * Split a run of pinyin with no explicit boundaries into syllables.
 *
 * Works longest-first, which is what the orthography assumes: an apostrophe is
 * required exactly where the longest-first reading would be wrong, so `xian` is
 * one syllable and 西安 must be written `Xī'ān` to be read as two.
 *
 * Memoised on the suffix being segmented, since without it a long run of
 * ambiguous syllables would backtrack exponentially.
 */
function segmentRun(
  run: string,
  memo: Map<string, readonly string[] | undefined>,
): readonly string[] | undefined {
  if (run === "") {
    return [];
  }
  const cached = memo.get(run);
  if (cached !== undefined || memo.has(run)) {
    return cached;
  }

  let found: readonly string[] | undefined;
  for (let length = run.length; length >= 1; length--) {
    const head = run.slice(0, length);
    if (!isSyllable(head)) {
      continue;
    }
    const rest = segmentRun(run.slice(length), memo);
    if (rest !== undefined) {
      found = [head, ...rest];
      break;
    }
  }

  memo.set(run, found);
  return found;
}

/**
 * Split a written pinyin word into its syllables.
 *
 * Apostrophes and hyphens are honoured as explicit boundaries and dropped from
 * the result. Returns undefined when the word cannot be read as a sequence of
 * syllables at all.
 */
export function splitSyllables(word: string): readonly string[] | undefined {
  const memo = new Map<string, readonly string[] | undefined>();
  const syllables: string[] = [];

  for (const run of word.split(SYLLABLE_SEPARATORS)) {
    if (run === "") {
      continue;
    }
    const segmented = segmentRun(run, memo);
    if (segmented === undefined) {
      return undefined;
    }
    syllables.push(...segmented);
  }

  return syllables.length > 0 ? syllables : undefined;
}

/**
 * Read a written pinyin word into its syllables.
 *
 * Returns undefined when the word cannot be read as a sequence of syllables.
 */
export function readWord(word: string): readonly Syllable[] | undefined {
  const spellings = splitSyllables(word);
  if (spellings === undefined) {
    return undefined;
  }

  const syllables: Syllable[] = [];
  for (const spelling of spellings) {
    const syllable = readSyllable(spelling);
    /* c8 ignore next 3 -- unreachable: splitSyllables only emits syllables */
    if (syllable === undefined) {
      return undefined;
    }
    syllables.push(syllable);
  }
  return syllables;
}
