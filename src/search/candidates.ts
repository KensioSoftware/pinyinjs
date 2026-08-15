import { encodeReading } from "../dictionary/artifact.js";
import { applyToneMark } from "../tone/tone-mark.js";
import { readQuery } from "./candidate-query.js";
import { convertCharacters, type ScriptTables } from "../script/conversion.js";
import { toCanonicalGlyphs } from "../script/glyphs.js";
import type { Script } from "../script/script.js";
import { readSyllable, writeSyllable } from "../syllable/syllable.js";
import { TONES } from "../tone/tone.js";
import { readingKey, type ReverseIndex } from "./reverse-index.js";

/**
 * What a query may write between syllables, all of which mean nothing here.
 *
 * The same set the matcher accepts, minus its meaning: `match` treats a written
 * boundary as evidence, because a haystack it is filtering can be read more than
 * one way. A reverse index is asked for one reading and answers with the words
 * that have it, so `yin hang` and `yinhang` are the same question.
 */
export const SEPARATORS = /[\s'’‘-]+/gu;

/**
 * A tone written as a digit, which is the last character of a syllable.
 */
const TONE_DIGIT = /^[0-5]$/u;

/**
 * Every tone a syllable that wrote none could be standing for.
 */
const TONE_DIGITS = ["1", "2", "3", "4", "5"];

/**
 * The umlaut the readings are written with, and the letter a keyboard has.
 */
const UMLAUT = "ü";

const PLAIN_U = "u";

/**
 * The 儿化 suffix, which is the one letter a reading key keeps and a query may
 * leave off.
 */
const ERHUA = "r";

/**
 * Which script a caller wants a candidate list written in, and the tables that
 * can tell.
 *
 * The two are one option because neither is any use without the other. Both
 * scripts are dictionary keys, so a reading group holds 银行 *and* 銀行 — over a
 * third of a typical list is that pairing — and the artifact deliberately does
 * not record which 简体 form pairs with which 繁體 one, since conversion never
 * needs it. So the index cannot pair them on its own, and honouring a
 * preference means loading `script.map`: about 100 KB that the hanzi → pinyin
 * path never fetches.
 *
 * Asking for the preference and the tables in one object is what keeps that
 * cost visible at the call site rather than hidden inside a load.
 *
 * ```ts
 * const tables = await loadScriptTables(source);
 * candidates(index, "yinhang", { script: { prefer: "Hans", tables } });
 * // 银行, and not 銀行 beside it
 * ```
 */
export interface ScriptPreference {
  /** The script to keep where both writings of a word are candidates. */
  readonly prefer: Script;
  /** The conversion tables, from `loadScriptTables`. */
  readonly tables: ScriptTables;
}

/**
 * How a candidate list should be narrowed.
 */
export interface CandidateOptions {
  /** How many candidates to return at most. */
  readonly limit?: number;
  /** Keep one writing of a word rather than both; see {@link ScriptPreference}. */
  readonly script?: ScriptPreference;
}
/**
 * Every way a typist may write one syllable of a stored reading.
 *
 * `shi4` is written `shi`, `shi4` or `shì`; `lü4` adds `lu` and `lu4`, since ü
 * is not on the keyboard; and an 儿化 `wanr2` adds the whole set again with the
 * r left off, because 玩儿 is `wanr` to one typist and `wan` to another.
 *
 * The r comes off only where the syllable really is 儿化. 儿 itself is `er2`,
 * and letting that shed its r would answer `e` with 儿.
 */
function writingsOf(token: string): readonly string[] {
  const digit = token.slice(-1);
  const toned = TONE_DIGIT.test(digit);
  const spelling = toned ? token.slice(0, -1) : token;
  const syllable = readSyllable(token);
  // A reading with no tone written cannot contradict one, so a query is free to
  // write any. Every reading the shipped artifacts hold has a tone digit on it,
  // so this is a case a hand-built dictionary reaches rather than a real one.
  const tones = toned ? [digit] : TONE_DIGITS;

  const written = new Set<string>();
  const add = (form: string): void => {
    const plain = form.replaceAll(UMLAUT, PLAIN_U);
    written.add(form);
    written.add(plain);
    for (const tone of tones) {
      written.add(`${form}${tone}`);
      written.add(`${plain}${tone}`);
    }
    if (!toned) {
      for (const tone of TONES) {
        written.add(applyToneMark(form, tone));
      }
    }
  };
  add(spelling);
  if (syllable !== undefined) {
    written.add(writeSyllable(syllable, "marks"));
    if (syllable.erhua === true) {
      add(spelling.slice(0, -ERHUA.length));
      written.add(writeSyllable({ ...syllable, erhua: false }, "marks"));
    }
  }
  return [...written];
}

/**
 * Whether a query spells a reading, syllable by syllable.
 *
 * Walked as a set of positions the query can have been read up to rather than
 * one cursor, because a syllable can be written more than one way and the ways
 * are different lengths: `wanr2` is `wan` or `wanr`, and only what follows says
 * which was meant.
 */
function spells(
  query: string,
  reading: string,
  writings: Map<string, readonly string[]>,
): boolean {
  let reached = new Set<number>([0]);
  for (const token of reading.split(" ")) {
    let forms = writings.get(token);
    if (forms === undefined) {
      forms = writingsOf(token);
      writings.set(token, forms);
    }
    const next = new Set<number>();
    for (const at of reached) {
      for (const form of forms) {
        if (query.startsWith(form, at)) {
          next.add(at + form.length);
        }
      }
    }
    if (next.size === 0) {
      return false;
    }
    reached = next;
  }
  return reached.has(query.length);
}

/**
 * The reading the dictionary itself reports for a word, in numbered spelling.
 *
 * Asked of the dictionary rather than re-derived, which is what makes the
 * filter also the answer to the ghost keys: 校覈 is a key, `Dictionary.lookup`
 * folds it to 校核 before it searches, and the reading that comes back is
 * `jiao4 he2` rather than the `xiao4 he2` the raw key derives to. So a candidate
 * the dictionary would disown does not survive being checked against it.
 */
function readingOf(index: ReverseIndex, word: string): string {
  const entry = index.dictionary.lookup(word);
  /* c8 ignore next -- only asked of a canonical key, which always looks up */
  return entry === undefined ? "" : encodeReading(entry.reading);
}

/**
 * The positions in every group a query can reach, likeliest first.
 *
 * Two groups, not one: the query as typed, and the query with the 儿化 r on the
 * end. `wan` has to reach 玩儿 as well as 玩, and the r is kept in the key so
 * that `wanr` can still reach only 玩儿. Whatever the second group brings in is
 * then made honest by the filter, which is what stops `e` answering with 儿.
 */
function rankedPositions(index: ReverseIndex, key: string): readonly number[] {
  const found = [
    ...index.positionsFor(key),
    ...index.positionsFor(`${key}${ERHUA}`),
  ];
  // Both groups are already ranked, so this only has to interleave them. Sorted
  // rather than merged because the comparison is one array read and the lists
  // are short: the busiest reading in the full dictionary has 805 words in it.
  return found.toSorted(
    (left, right) =>
      index.dictionary.frequencyAt(right) - index.dictionary.frequencyAt(left),
  );
}

/**
 * Keep one writing of a word where the group holds both scripts.
 *
 * Paired by 简体 form in both directions rather than by converting toward the
 * preference, because simplification is many-to-one and so the 简体 form is the
 * one both writings agree on. Going the other way needs a reading to tell 發
 * from 髮, and a pair that failed to meet would simply be left as two.
 *
 * The kept writing takes the rank of the better-placed of the two, so
 * collapsing a list never reorders what is left of it.
 */
function preferScript(
  words: readonly string[],
  script: ScriptPreference,
): readonly string[] {
  /** Whether a candidate is the writing the caller asked for. */
  const isWanted = (word: string, simplified: string): boolean =>
    script.prefer === "Hans" ? word === simplified : word !== simplified;

  const chosen = new Map<string, string>();
  const order: string[] = [];
  for (const word of words) {
    const simplified = convertCharacters(script.tables.toSimplified, word);
    const held = chosen.get(simplified);
    if (held === undefined) {
      chosen.set(simplified, word);
      order.push(simplified);
      continue;
    }
    if (!isWanted(held, simplified) && isWanted(word, simplified)) {
      chosen.set(simplified, word);
    }
  }
  /* c8 ignore next -- every entry in `order` was put in `chosen` beside it */
  return order.map((simplified) => chosen.get(simplified) ?? simplified);
}

/**
 * The words a pinyin query could be spelling, likeliest first.
 *
 * ```ts
 * candidates(index, "shi"); // 是, 时, 事, 使, 市, …
 * candidates(index, "shi4"); // narrowed by tone
 * candidates(index, "shì"); // the same, written the other way
 * candidates(index, "yinhang"); // 銀行, 银行, 引吭, 引航, 印航
 * ```
 *
 * This is the half of search that has no haystack: `match` filters Chinese text
 * you already hold, and this answers a query with nothing but the dictionary
 * behind it — pinyin-only lookup, a homophone list, or an input method for
 * somebody with no Chinese keyboard.
 *
 * **A query is a whole reading, not a prefix.** `yinhang` finds 银行 and `yinha`
 * finds nothing, because a reading key is a key rather than a stem. What a query
 * may leave out is the parts a keyboard makes awkward: the tones, the ü, the
 * spaces between syllables, and the r of 儿化.
 *
 * Both scripts are dictionary keys, so 银行 and 銀行 both come back unless a
 * {@link ScriptPreference} says which to keep.
 */
export function candidates(
  index: ReverseIndex,
  query: string,
  options: CandidateOptions = {},
): readonly string[] {
  const { key, written } = readQuery(query);
  if (key === "") {
    return [];
  }

  const writings = new Map<string, readonly string[]>();
  const found: string[] = [];
  for (const position of rankedPositions(index, key)) {
    const word = index.dictionary.wordAt(position);
    // A key whose glyphs are not the canonical ones can never be returned by
    // `Dictionary.lookup`, which folds them before it searches, so offering it
    // would be offering 中峯 beside the 中峰 that is already here. 281 of the
    // full tier's keys are like that, and dropping them at the query rather
    // than the build is what makes it free: filtering the whole key list with
    // `toCanonicalGlyphs` costs 52.9 ms, and filtering one answer costs nothing.
    if (toCanonicalGlyphs(word) !== word) {
      continue;
    }
    if (spells(written, readingOf(index, word), writings)) {
      found.push(word);
    }
  }

  const preferred =
    options.script === undefined ? found : preferScript(found, options.script);
  return options.limit === undefined
    ? preferred
    : preferred.slice(0, Math.max(0, options.limit));
}

/**
 * The other words read exactly as this one is, likeliest first.
 *
 * ```ts
 * homophonesOf(index, "长城"); // 長城, 長程, 长程, 常程 — everything read chángchéng
 * ```
 *
 * A homophone list wants the tone, where a typist's query does not, and it gets
 * one without a second index: the toneless group is narrowed to the words whose
 * stored reading is the same string. Over the eight busiest readings in the full
 * dictionary — 4,659 candidates — that narrowing costs 1.2 ms in total.
 *
 * The word itself is never in its own list. Neither is its other-script writing
 * where a {@link ScriptPreference} is given, since 銀行 is not a homophone of
 * 银行 but the same word spelled for a different reader.
 *
 * Returns nothing for a word the dictionary does not hold, since a word with no
 * reading has no homophones rather than all of them.
 */
export function homophonesOf(
  index: ReverseIndex,
  word: string,
  options: CandidateOptions = {},
): readonly string[] {
  const entry = index.dictionary.lookup(word);
  if (entry === undefined) {
    return [];
  }
  const reading = encodeReading(entry.reading);
  const same = new Set([word, entry.word]);
  if (options.script !== undefined) {
    same.add(convertCharacters(options.script.tables.toSimplified, word));
  }

  const found: string[] = [];
  for (const position of rankedPositions(index, readingKey(reading))) {
    const candidate = index.dictionary.wordAt(position);
    if (toCanonicalGlyphs(candidate) !== candidate) {
      continue;
    }
    const pairing =
      options.script === undefined
        ? candidate
        : convertCharacters(options.script.tables.toSimplified, candidate);
    if (same.has(candidate) || same.has(pairing)) {
      continue;
    }
    if (readingOf(index, candidate) === reading) {
      found.push(candidate);
    }
  }

  const preferred =
    options.script === undefined ? found : preferScript(found, options.script);
  return options.limit === undefined
    ? preferred
    : preferred.slice(0, Math.max(0, options.limit));
}
