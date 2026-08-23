import { toCharacters } from "../script/characters.js";
import { CANONICAL_FORMS, toCanonicalGlyphs } from "../script/glyphs.js";
import { convertCharacters, type ScriptTables } from "../script/conversion.js";
import type { DictionaryEntry } from "./entry.js";
import {
  alignedReadings,
  type ByReading,
  pairingsOf,
  tableOf,
  tally,
} from "./script-pairings.js";
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
 *
 * Occurrence alone is too strict, and that is what {@link writesCharacter}
 * settles. A word list assembled from four sources holds a few headwords that
 * failed to simplify — 见幾而作 and 极深研幾 are 简体 keys written with 幾 — and
 * one of those was enough to take 幾 out of the 繁體-only set against the 297
 * words that put it in. 衛 was out on the strength of a single 简体 headword
 * against 394. So a script counts as writing a character when it writes it
 * often enough to mean something, on the two-condition shape
 * `deriveGlyphTables` already uses for the same kind of question.
 *
 * The variant forms are added afterwards, because normalising folds them away
 * before anything is counted: every 裏 becomes 裡 on the way in, so 裏 occurs
 * nowhere and settled nothing. Every key of `CANONICAL_FORMS` is 繁體 by
 * construction — the variants 简体 writes were excluded from it, measured
 * against CC-CEDICT's 简体 column — so the domain of that table is 繁體-only and
 * joins the set wholesale.
 *
 * Measured against the dictionary's own paired headwords, which is 190,000
 * labelled texts in two scripts: the multi-character pairs settle 99.13% of the
 * time against 97.84% before, and 4 settle the wrong way. Checked against
 * OpenCC's character tables, which no part of this is derived from, the 33
 * characters that join the 简体 side all agree and 56 of the 60 judgeable ones
 * joining the 繁體 side do. The four it disagrees about are 捝, 棁, 涚 and 蒀,
 * which OpenCC lists in both its 简→繁 and 繁→简 tables and no corpus writes at
 * all.
 *
 * 著 stays out of both, which is the honest answer rather than a miss: 简体
 * writes it in its `zhù` sense — 专著, 显著, 著名 — and 繁體 writes it for that
 * and for the aspect particle. 干, 台 and 里 are out for the same reason.
 */
/**
 * How many words a script must write a character in before it counts.
 *
 * The absolute floor, paired with {@link WRITTEN_SHARE} below. Both come from
 * `deriveGlyphTables`, which asks the same question about a variant spelling
 * and answers it with the same two conditions and the same numbers.
 */
const WRITTEN_WORDS = 10;

/**
 * The share of the other script's evidence that makes a handful count anyway.
 *
 * Without this a rare character would belong to neither script. 齶 is written
 * in two 繁體 words and no 简体 one, which is 繁體-only however small the number,
 * and a bare floor would throw it away along with 幾's two stray headwords.
 */
const WRITTEN_SHARE = 0.05;

/**
 * Whether a script writes a character often enough for it to mean anything.
 *
 * Two conditions, asking different questions. The floor asks whether the
 * character is written at all in that script, and the share asks whether it is
 * written *relative to the other script* — which is what separates 幾, at two
 * 简体 headwords against 297 繁體 ones, from 著 at 36 against 733.
 */
/**
 * Count each character of a word once, into a running tally.
 */
function countCharacters(into: Map<string, number>, word: string): void {
  for (const character of toCharacters(word)) {
    into.set(character, (into.get(character) ?? 0) + 1);
  }
}

function writesCharacter(
  counts: ReadonlyMap<string, number>,
  other: ReadonlyMap<string, number>,
  character: string,
): boolean {
  const held = counts.get(character) ?? 0;
  if (held === 0) {
    return false;
  }
  return (
    held >= WRITTEN_WORDS || held > (other.get(character) ?? 0) * WRITTEN_SHARE
  );
}

function scriptOnlyCharacters(entries: readonly DictionaryEntry[]): {
  hansOnly: ReadonlySet<string>;
  hantOnly: ReadonlySet<string>;
} {
  const inHans = new Map<string, number>();
  const inHant = new Map<string, number>();

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
    countCharacters(inHans, canonicalHans);
    for (const form of forms) {
      countCharacters(inHant, toCanonicalGlyphs(form));
    }
  }

  const hansOnly = new Set<string>();
  const hantOnly = new Set<string>();
  for (const character of new Set([...inHans.keys(), ...inHant.keys()])) {
    const hans = writesCharacter(inHans, inHant, character);
    const hant = writesCharacter(inHant, inHans, character);
    if (hans && !hant) {
      hansOnly.add(character);
    } else if (hant && !hans) {
      hantOnly.add(character);
    }
  }

  for (const variant of CANONICAL_FORMS.keys()) {
    if (!hansOnly.has(variant)) {
      hantOnly.add(variant);
    }
  }

  return { hansOnly, hantOnly };
}
