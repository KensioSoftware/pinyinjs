/**
 * Which 繁體 spelling an entry takes, and which others reach it.
 *
 * CC-CEDICT decides wherever it has the word, since it pairs the two scripts
 * itself; the derivation only answers where it is silent. Both are settled
 * against the sense matching the reading, because a word read two ways can be
 * written two ways — 万 is 萬 when read wàn and stays 万 when read mò.
 */
import { toCanonicalGlyphs } from "../script/glyphs.js";
import type { CedictEntry } from "../sources/cedict.js";
import type { Syllable } from "../syllable/syllable.js";
import { sensesForReading } from "./reading-agreement.js";
import type { ReadCharacters } from "./reading.js";
import type { TraditionalTable } from "./traditional.js";

/**
 * The 繁體 form of one entry, and what the merge counts about it.
 */
export interface TraditionalForm {
  /** The CC-CEDICT senses matching the reading, most useful first. */
  readonly senses: readonly CedictEntry[];
  readonly hant: string;
  /** Other 繁體 spellings a source writes of the same word. */
  readonly hantVariants: readonly string[];
  /** Whether `hant` was derived rather than taken from CC-CEDICT. */
  readonly isDerived: boolean;
}

/**
 * Settle all of it for one word.
 */
export function traditionalFormOf(
  word: string,
  cedictEntries: readonly CedictEntry[],
  reading: readonly Syllable[],
  aligned: readonly ReadCharacters[] | undefined,
  traditional: TraditionalTable,
): TraditionalForm {
  let isDerived = false;
  // Which sense matters: 万 is 萬 when read wàn but stays 万 when read mò, and
  // CC-CEDICT carries both as separate entries. Taking whichever came first
  // in the file would pair the chosen reading with another sense's script.
  const senses = sensesForReading(word, cedictEntries, reading);
  const sense = senses[0];
  let hant: string;
  if (sense === undefined) {
    // Canonicalised because the derivation settles each word against Unihan's
    // variant lists with no single standard behind it, so 里 derives as 裏
    // where the corpus overwhelmingly writes 裡. Both are the same character
    // with the same reading, and a key written in the form the lookup path
    // normalises *away from* can never be found — see the note below.
    hant = toCanonicalGlyphs(traditional.convert(aligned ?? []));
    isDerived = hant !== word;
  } else {
    hant = toCanonicalGlyphs(sense.traditional);
  }

  // Other spellings of the same word, so that a 繁體 reader of either finds
  // it. Only what a source writes out: composing spellings from per-character
  // variants instead would add 229,482 keys to the full tier, almost all of
  // them forms nobody writes — 方麵 for 方面, 公裡 for 公里 — because the
  // reading that picks the right variant for one word does not generalise to
  // every word the character appears in.
  //
  // Canonicalised for the same reason `hant` is, and deduplicated after:
  // 裏面 and 裡面 are one spelling once the glyph forms are folded, and
  // keying both would claim a variant that does not exist.
  //
  // The 简体 headword's own canonical spelling joins them where it differs,
  // and that is not a nicety: the lookup path normalises 繁體 glyph forms
  // before it searches, so a key written in a form it normalises *away from*
  // can never be found. The phrase corpus carries a few hundred headwords
  // spelled with 峯, 藴 or 枱 — 鹫峯寺, 义藴, 写字枱 — and without this they
  // are entries nothing can reach.
  const hantVariants = [
    ...new Set([
      ...senses.map((other) => toCanonicalGlyphs(other.traditional)),
      toCanonicalGlyphs(word),
    ]),
  ].filter((form) => form !== hant && form !== word);

  return { senses, hant, hantVariants, isDerived };
}
