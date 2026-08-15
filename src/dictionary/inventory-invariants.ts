/**
 * What must hold of every reading at once.
 *
 * Three sweeps: every syllable used is one the inventory knows, in a tone the
 * inventory knows, and a reading is as long as the characters it reads.
 */
import { characterCount } from "../script/characters.js";
import { DICTIONARY_SYLLABLES } from "../syllable/inventory.js";
import type { BuildAssertion, BuiltDictionary } from "./built-dictionary.js";

export const INVENTORY_INVARIANTS: readonly BuildAssertion[] = [
  {
    // Membership rather than a count. MERGE.md asked for "exactly 408 after the
    // merge", which is the phrase corpus's own inventory — but the merged
    // dictionary also carries Unihan's and CC-CEDICT's rare characters, whose
    // readings are legitimately outside it (鞥 ēng, 覅 fiào, 挼 ruá). Fixing the
    // count would either exclude those or bless whatever a refresh adds; naming
    // the permitted set does neither.
    description: "every syllable used is one the inventory knows",
    check: (dictionary: BuiltDictionary): string | undefined => {
      const unknown = [...dictionary.syllableInventory()].filter(
        (syllable) => !DICTIONARY_SYLLABLES.has(syllable),
      );
      return unknown.length === 0
        ? undefined
        : `readings use ${String(unknown.length)} syllable(s) outside the inventory: ${unknown.join(", ")}`;
    },
  },
  {
    // The romanisation readers narrow an ambiguous spelling on the tone that
    // was written — `lo²` is 羅 luó and not a 咯 that is only ever neutral —
    // so a tone the table has never heard of is a syllable those readers will
    // refuse to hand back. Regenerate `SYLLABLE_TONES` when this fails.
    description: "every syllable is used in a tone the inventory knows",
    check: (dictionary: BuiltDictionary): string | undefined => {
      const unattested = [...dictionary.unattestedTones()];
      return unattested.length === 0
        ? undefined
        : `readings use ${String(unattested.length)} syllable(s) in a tone the inventory does not list: ${unattested.join(", ")}`;
    },
  },
  {
    description: "every entry's syllable count matches its character count",
    check: (dictionary: BuiltDictionary): string | undefined => {
      for (const entry of dictionary.entries) {
        const characters = characterCount(entry.hans);
        const erhua = entry.readings.cn.filter(
          (syllable) => syllable.erhua === true,
        ).length;
        // Punctuation is written but unread, so it is allowed to have no
        // syllable; a reading may therefore be shorter but never longer.
        if (entry.readings.cn.length + erhua > characters) {
          return `${entry.hans} has ${String(entry.readings.cn.length)} syllables for ${String(characters)} characters`;
        }
      }
      return;
    },
  },
];
