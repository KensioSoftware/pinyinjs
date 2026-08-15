import { toCharacters } from "../script/characters.js";
import { toCanonicalGlyphs } from "../script/glyphs.js";
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
