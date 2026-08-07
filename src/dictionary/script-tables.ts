import { toCharacters } from "../script/characters.js";
import { toCanonicalGlyphs } from "../script/glyphs.js";
import {
  type CharacterConversion,
  conversionKey,
  convertCharacters,
  type ScriptTables,
} from "../script/conversion.js";
import type { Syllable } from "../syllable/syllable.js";
import type { DictionaryEntry } from "./entry.js";

/**
 * How often one character was written as another, at one reading.
 */
type FormCounts = Map<string, number>;

/**
 * Observed pairings for one character: counts at each reading, and overall.
 */
type ByReading = Map<string, FormCounts>;

/**
 * The key standing for "at any reading".
 */
const ANY = "";

/**
 * How much of a reading's evidence must agree before it overrides the default.
 *
 * A reading that disagrees with the default only earns a line in the table if
 * the sources are reasonably united about it. Below this it is noise — one
 * mis-aligned entry, or a spelling nobody else uses — and storing it would
 * make the conversion worse at the cost of bytes.
 */
const READING_AGREEMENT = 0.8;

/**
 * How much of a character's evidence a rival form needs to be worth reporting.
 *
 * This decides honesty rather than output: a form listed here makes the
 * character *ambiguous*, so every conversion of it is reported as a guess
 * unless a word or a reading settled it. Set too low and 和 is doubtful because
 * Unihan knows 咊; set too high and 面 looks certain when only the word tells
 * 面 from 麵. A twentieth of the evidence is enough to be a real spelling and
 * far more than the one-off variants clear.
 */
const RIVAL_SHARE = 0.05;

/**
 * The pairings an entry attests, character by character.
 *
 * Entries whose two scripts are written with a different number of characters
 * are skipped rather than aligned by guesswork, for the same reason
 * `pairScripts` skips them: an invented alignment is evidence for a pairing
 * nobody wrote.
 */
function pairingsOf(
  entry: DictionaryEntry,
): readonly { hans: string; hant: string; key: string }[] {
  const hans = toCharacters(entry.hans);
  const hant = toCharacters(entry.hant);
  if (hans.length !== hant.length) {
    return [];
  }
  const reading = entry.readings.cn;
  // Only a reading with one syllable per character lines up; anything else
  // (儿化 covering two, or a source disagreeing about length) is used as
  // evidence for the pairing but not for any particular reading.
  const isAligned = reading.length === hans.length;
  return hans.map((character, at) => ({
    hans: character,
    /* c8 ignore next -- the two forms are known to be the same length */
    hant: hant[at] ?? character,
    key: isAligned ? conversionKey(reading[at]) : ANY,
  }));
}

/**
 * Tally one pairing under both its own reading and the any-reading key.
 */
function tally(
  observed: Map<string, ByReading>,
  from: string,
  to: string,
  key: string,
  weight: number,
): void {
  const byReading = observed.get(from) ?? new Map<string, FormCounts>();
  const keys = new Set([ANY, key]);
  for (const at of keys) {
    const counts = byReading.get(at) ?? new Map<string, number>();
    counts.set(to, (counts.get(to) ?? 0) + weight);
    byReading.set(at, counts);
  }
  observed.set(from, byReading);
}

/**
 * The commonest form in a tally, and what share of the evidence it holds.
 *
 * A tie prefers a form other than the character itself, and that matters more
 * than it looks. Every character has an entry of its own where both scripts are
 * the same string, so a character attested in exactly one cross-script word
 * arrives here tied one-all against its own identity — 儁 against 㑺. The real
 * pairing is the one somebody wrote down; the identity is an artefact of how
 * the dictionary is keyed. `TraditionalTable` breaks the same tie the same way.
 */
function commonest(
  from: string,
  counts: FormCounts | undefined,
): { form: string; share: number } | undefined {
  if (counts === undefined || counts.size === 0) {
    return undefined;
  }
  let form = "";
  let best = 0;
  let total = 0;
  for (const [candidate, count] of counts) {
    total += count;
    if (
      count > best ||
      (count === best && form === from && candidate !== from)
    ) {
      form = candidate;
      best = count;
    }
  }
  return { form, share: best / total };
}

/**
 * Reduce one character's observations to a default and its exceptions.
 *
 * A character with only one observed form needs no entry at all when that form
 * is itself — simplification changed a minority of characters, and storing the
 * other 40,000 as identities would be most of the file.
 */
function conversionOf(
  from: string,
  byReading: ByReading,
): CharacterConversion | undefined {
  const overall = commonest(from, byReading.get(ANY));
  if (overall === undefined) {
    return undefined;
  }

  const exceptions = new Map<string, string>();
  for (const [key, counts] of byReading) {
    const at = commonest(from, counts);
    if (
      key !== ANY &&
      at !== undefined &&
      at.form !== overall.form &&
      at.share >= READING_AGREEMENT
    ) {
      exceptions.set(key, at.form);
    }
  }

  const also = rivalsOf(byReading.get(ANY), overall.form, exceptions);

  if (overall.form === from && exceptions.size === 0 && also.length === 0) {
    return undefined;
  }
  return {
    to: overall.form,
    ...(exceptions.size > 0 && { byReading: exceptions }),
    ...(also.length > 0 && { also }),
  };
}

/**
 * The forms a character takes often enough to make it genuinely ambiguous.
 *
 * Forms a reading already accounts for are left out: those are settled evidence
 * rather than open questions, and repeating them here would report 发 as a
 * guess in 头发 when the reading decided it.
 */
function rivalsOf(
  counts: FormCounts | undefined,
  chosen: string,
  exceptions: ReadonlyMap<string, string>,
): readonly string[] {
  if (counts === undefined) {
    return [];
  }
  let total = 0;
  for (const count of counts.values()) {
    total += count;
  }
  const settled = new Set([chosen, ...exceptions.values()]);
  return [...counts]
    .filter(
      ([form, count]) => !settled.has(form) && count / total >= RIVAL_SHARE,
    )
    .toSorted(([, left], [, right]) => right - left)
    .map(([form]) => form);
}

/**
 * Reduce every character's observations into a table.
 */
function tableOf(
  observed: Map<string, ByReading>,
): ReadonlyMap<string, CharacterConversion> {
  const table = new Map<string, CharacterConversion>();
  for (const [from, byReading] of observed) {
    const conversion = conversionOf(from, byReading);
    if (conversion !== undefined) {
      table.set(from, conversion);
    }
  }
  return table;
}

/**
 * The readings a word is converted with, where they line up character by
 * character.
 */
function alignedReadings(
  entry: DictionaryEntry,
): readonly (Syllable | undefined)[] {
  const characters = toCharacters(entry.hans).length;
  return entry.readings.cn.length === characters ? entry.readings.cn : [];
}

/**
 * Build the script conversion tables from the merged dictionary.
 *
 * The evidence is the merged entries rather than CC-CEDICT directly, which
 * matters: the merge has already corrected neutral tones, repaired 儿化 and
 * derived 繁體 forms for the phrase corpus, so what is counted here is what the
 * dictionary actually holds rather than what one source said about it.
 *
 * Words are counted once each rather than weighted by frequency. A default is
 * only there to keep the exception list short — every word it gets wrong is
 * stored — so what matters is how many words agree, not how often they are
 * said.
 */
export function buildScriptTables(
  entries: readonly DictionaryEntry[],
): ScriptTables {
  const toTraditionalCounts = new Map<string, ByReading>();
  const toSimplifiedCounts = new Map<string, ByReading>();

  for (const entry of entries) {
    for (const { hans, hant, key } of pairingsOf(entry)) {
      tally(toTraditionalCounts, hans, hant, key, 1);
      tally(toSimplifiedCounts, hant, hans, key, 1);
    }
  }

  const toTraditional = tableOf(toTraditionalCounts);
  const toSimplified = tableOf(toSimplifiedCounts);

  // Only the words the character tables get wrong. Everything else is already
  // right and would be bytes spent restating it.
  //
  // Single characters are deliberately excluded. A one-character entry is not
  // independent evidence about that character — it is one of the observations
  // the character table was built from — so an "exception" for it is simply the
  // aggregate being overruled by one of its own inputs. 和 has a rare variant
  // 咊 that Unihan knows and nobody writes; keeping the exception would convert
  // every 和 to it, against the thousands of words that say otherwise.
  const traditionalWords = new Map<string, string>();
  const simplifiedWords = new Map<string, string>();
  for (const entry of entries) {
    if (toCharacters(entry.hans).length < 2) {
      continue;
    }
    const readings = alignedReadings(entry);
    if (convertCharacters(toTraditional, entry.hans, readings) !== entry.hant) {
      traditionalWords.set(entry.hans, entry.hant);
    }
    if (convertCharacters(toSimplified, entry.hant, readings) !== entry.hans) {
      simplifiedWords.set(entry.hant, entry.hans);
    }
  }

  return {
    toTraditional,
    toSimplified,
    traditionalWords,
    simplifiedWords,
    ...scriptOnlyCharacters(entries),
  };
}

/**
 * The characters each script writes and the other does not.
 *
 * What settles a text's script is which characters *occur* in each: 发 is
 * 简体-only because no 繁體 word is written with it, and 髮 is 繁體-only for the
 * mirror reason. A character both scripts use — the great majority — settles
 * nothing and belongs in neither set.
 *
 * Only entries whose two forms **differ** are counted, and that restriction is
 * what makes this work at all. `hans` is the dictionary's key rather than a
 * claim about script, so every 繁體 character is also some entry's `hans` — 髮
 * has a character entry of its own, with 髮 on both sides. Counting those would
 * put every character in both sets and leave both empty.
 *
 * It also settles the genuinely two-sided characters correctly. 干 is a 简体
 * form of 幹 and 乾 *and* a 繁體 character in its own right, so it appears on
 * both sides of 干扰/干擾 and lands in neither set, which is the honest answer.
 *
 * Both sides are folded to their canonical glyph forms first. The phrase corpus
 * is nominally 简体 and writes a few hundred headwords with 繁體 variants — 衞生,
 * 鹫峯寺 — and taking those at face value put 衞 and 峯 in the 简体-only set. A
 * text written 衞生 was then detected as 简体 and left alone when it was asked
 * for 简体, which is the opposite of what it needed.
 */
function scriptOnlyCharacters(entries: readonly DictionaryEntry[]): {
  hansOnly: ReadonlySet<string>;
  hantOnly: ReadonlySet<string>;
} {
  const inHans = new Set<string>();
  const inHant = new Set<string>();
  for (const entry of entries) {
    // A 繁體 form that differs from the 简体 one only by glyph normalisation is
    // not evidence about script — 衞生 and 衛生 are two 繁體 spellings of one
    // word, and the merge keys the second so the first can be found. Counting
    // it would put that entry's 简体 characters on the 繁體 side, which is how
    // 发 stopped being 简体-only.
    const canonicalHans = toCanonicalGlyphs(entry.hans);
    const forms = [entry.hant, ...(entry.hantVariants ?? [])].filter(
      (form) => form !== entry.hans && form !== canonicalHans,
    );
    if (forms.length === 0) {
      continue;
    }
    const hansCharacters = toCharacters(canonicalHans);
    for (const character of hansCharacters) {
      inHans.add(character);
    }
    const hantCharacters = forms.flatMap((form) =>
      toCharacters(toCanonicalGlyphs(form)),
    );
    for (const character of hantCharacters) {
      inHant.add(character);
    }
  }

  return {
    hansOnly: new Set([...inHans].filter((c) => !inHant.has(c))),
    hantOnly: new Set([...inHant].filter((c) => !inHans.has(c))),
  };
}
