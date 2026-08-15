/**
 * What every later step of the merge leans on: the 繁體 pairing table and each
 * character's default reading.
 *
 * Both come out of the sources alone, before a single word has been looked at,
 * and the order matters — the corpus mass the defaults are ranked by reaches
 * 繁體 characters only through the pairing table.
 */
import { countCorpusMass, rankByCorpusMass } from "./corpus-mass.js";
import {
  demoteReducedNeutrals,
  isNeutralAlone,
  resolveFrequencyTones,
} from "./frequency-tones.js";
import type { CedictEntry } from "../sources/cedict.js";
import type { Syllable } from "../syllable/syllable.js";
import { readAlignedReading, readDictionaryReading } from "./reading.js";
import {
  pairScripts,
  type ScriptPairing,
  TraditionalTable,
} from "./traditional.js";
import type { MergeSources } from "./merge.js";

/**
 * Parse a Unihan reading string for one character.
 *
 * Goes through the dictionary reader so that a Unihan reading gets the same
 * treatment as any other source's: an unmarked tone means neutral, and 一 and
 * 不 are restored to their underlying tones.
 */
export function characterSyllable(
  character: string,
  reading: string,
): Syllable | undefined {
  return readDictionaryReading(character, [reading])?.[0];
}

/**
 * The 繁體 table and the character defaults, with the count of defaults a
 * reduced 轻声 would otherwise have set.
 */
export interface CharacterDefaults {
  readonly traditional: TraditionalTable;
  readonly defaults: ReadonlyMap<string, readonly Syllable[]>;
  readonly reducedNeutrals: number;
}

/**
 * Build both, from the sources and CC-CEDICT's two indexes.
 */
export function buildCharacterDefaults(
  sources: MergeSources,
  cedictByWord: ReadonlyMap<string, readonly CedictEntry[]>,
  cedictByHant: ReadonlyMap<string, readonly CedictEntry[]>,
): CharacterDefaults {
  const { unihanReadings, unihanVariants, phrase, cedict, jieba } = sources;
  // ── 繁體 evidence, mined from CC-CEDICT's own pairings ──────
  // Before the character defaults, because the corpus mass those are ranked by
  // has to reach 繁體 characters through this table: jieba's corpus and the
  // phrase corpus are both 简体, so nothing else would count a vote for 髮.
  const pairings: ScriptPairing[] = [];
  for (const entry of cedict) {
    const aligned = readAlignedReading(entry.simplified, entry.readings);
    pairings.push(...pairScripts(entry.simplified, entry.traditional, aligned));
  }
  const traditional = TraditionalTable.build(
    pairings,
    unihanVariants,
    unihanReadings,
  );

  // ── Character defaults, which every later step leans on ────
  // Unihan ranks the readings and the corpus re-ranks the ones it has seen: a
  // character's default is whichever of its readings the dictionary's own words
  // spend the most of jieba's corpus on, and Unihan's order decides the rest.
  const mass = countCorpusMass({ phrase, cedict, jieba }, traditional);
  const defaults = new Map<string, readonly Syllable[]>();
  let reducedNeutrals = 0;
  for (const [character, readings] of unihanReadings) {
    const resolved = resolveFrequencyTones(readings);
    // A 轻声 the frequency field only ever counted inside words is not the
    // character's reading — unless a source says the bare character is neutral.
    const ranked = isNeutralAlone(character, [
      ...(cedictByWord.get(character) ?? []),
      ...(cedictByHant.get(character) ?? []),
    ])
      ? resolved
      : demoteReducedNeutrals(readings, resolved);
    if (ranked !== resolved && ranked[0] !== resolved[0]) {
      reducedNeutrals++;
    }
    const parsed = ranked
      .map((reading) => characterSyllable(character, reading))
      .filter((syllable) => syllable !== undefined);
    if (parsed.length > 0) {
      defaults.set(
        character,
        rankByCorpusMass(character, parsed, readings.fields, mass),
      );
    }
  }

  return { traditional, defaults, reducedNeutrals };
}
