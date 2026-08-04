import { DICTIONARY_SYLLABLES } from "./inventory.js";
import { isSeparableStart } from "./separation.js";
import {
  isSyllable,
  readSyllable,
  type Syllable,
  writeSyllableSpelling,
} from "./syllable.js";

/**
 * Characters that mark a syllable boundary explicitly.
 *
 * The apostrophe is the 隔音符号 of Xī'ān; the hyphen joins the halves of a
 * reduplicated word or a 成语 written 2+2.
 */
const SYLLABLE_SEPARATORS = /['’‘-]/u;

/**
 * Whether a spelling is a syllable Mandarin actually uses.
 *
 * {@link isSyllable} asks only whether an initial and a final can be put
 * together, which is a wider question: `tia` passes it and is not a syllable of
 * the language. The 儿化 suffix is set aside before the check, since the
 * inventory lists base syllables and `wanr` is `wan` with an r on it.
 */
function isAttestedSyllable(text: string): boolean {
  const syllable = readSyllable(text);
  return (
    syllable !== undefined &&
    DICTIONARY_SYLLABLES.has(
      writeSyllableSpelling({ ...syllable, erhua: false }),
    )
  );
}

/**
 * Split a run of pinyin with no explicit boundaries into syllables.
 *
 * Works longest-first, which is what the orthography assumes: an apostrophe is
 * required exactly where the longest-first reading would be wrong, so `xian` is
 * one syllable and 西安 must be written `Xī'ān` to be read as two.
 *
 * `isSeparated` carries the other half of that rule. Longest-first alone reads
 * `guórén` as `guór'én` and `huángěi` as `huáng'ěi`, both of which the missing
 * apostrophe rules out — so a run is first segmented with a/o/e barred from
 * starting any syllable but the first, and only falls back to plain
 * longest-first when that finds nothing. The fallback is what keeps input
 * tolerant: `hǎiōu` is written wrong, and still reads as two syllables.
 *
 * The strict pass also holds out for real syllables rather than merely
 * well-formed ones, because barring a vowel otherwise pushes it into nonsense:
 * `Tiānānmén` would come apart as `tiā nān mén` where `tiā` is not a syllable
 * of the language at all.
 *
 * Memoised on the suffix being segmented, since without it a long run of
 * ambiguous syllables would backtrack exponentially.
 */
function segmentRun(
  run: string,
  memo: Map<string, readonly string[] | undefined>,
  isSeparated: boolean,
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
    if (isSeparated ? !isAttestedSyllable(head) : !isSyllable(head)) {
      continue;
    }
    const tail = run.slice(length);
    if (isSeparated && isSeparableStart(tail)) {
      continue;
    }
    const rest = segmentRun(tail, memo, isSeparated);
    if (rest !== undefined) {
      found = [head, ...rest];
      break;
    }
  }

  memo.set(run, found);
  return found;
}

/**
 * Segment a run, honouring the apostrophe rule where it can be honoured.
 */
function segment(run: string): readonly string[] | undefined {
  return segmentRun(run, new Map(), true) ?? segmentRun(run, new Map(), false);
}

/**
 * Split a written pinyin word into its syllables.
 *
 * Apostrophes and hyphens are honoured as explicit boundaries and dropped from
 * the result. Returns undefined when the word cannot be read as a sequence of
 * syllables at all.
 */
export function splitSyllables(word: string): readonly string[] | undefined {
  const syllables: string[] = [];

  for (const run of word.split(SYLLABLE_SEPARATORS)) {
    if (run === "") {
      continue;
    }
    const segmented = segment(run);
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
