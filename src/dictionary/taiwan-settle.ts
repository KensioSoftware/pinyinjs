/**
 * A word's settled 國語 reading in the shape the merge stores it: the fields
 * it fills on the entry, and what it adds to the build's counts.
 */
import { isSingleCharacter } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import type { EntryReadings } from "./entry.js";
import type { WordSources } from "./merge-types.js";
import type { TraditionalForm } from "./traditional-form.js";
import { type TaiwanReading, taiwanReadingOf } from "./taiwan-reading.js";

/**
 * The fields of an entry's readings that a settled 國語 reading fills.
 */
function taiwanColumnsOf(
  taiwan: TaiwanReading,
): Pick<EntryReadings, "tw" | "twAlternates"> {
  return {
    ...(taiwan.reading !== undefined && { tw: taiwan.reading }),
    ...(taiwan.alternates.length > 0 && { twAlternates: taiwan.alternates }),
  };
}

/**
 * What a settled 國語 reading adds to the build's counts.
 */
function taiwanTallyOf(taiwan: TaiwanReading): {
  readonly taiwanReadings: number;
  readonly standardTaiwanReadings: number;
} {
  const isDelta = taiwan.reading !== undefined;
  return {
    taiwanReadings: isDelta ? 1 : 0,
    standardTaiwanReadings: isDelta && taiwan.isStandard ? 1 : 0,
  };
}

/**
 * The spellings 教育部 is asked for a word under, which is how it keys it.
 *
 * A character's other 繁體 forms are other characters, which 教育部 reads as
 * themselves: 最's include 冣, which it lists as `jù`. A word's are the same
 * word, and its 简体 spelling is only asked where it is also the 繁體 one:
 * 教育部 lists 听听, written with the 繁體 character 听, as `yǐn yǐn`.
 */
function spellingsOf(
  word: string,
  hant: string,
  hantVariants: readonly string[],
): readonly string[] {
  return isSingleCharacter(word)
    ? [...new Set([hant, word])]
    : [hant, ...hantVariants];
}

/**
 * Settle a word's 國語 reading, as the fields it fills on the entry and what
 * it adds to the build's counts.
 */
export function settleTaiwanReading(
  word: string,
  form: TraditionalForm,
  senseReadings: readonly (readonly Syllable[])[],
  reading: readonly Syllable[],
  sources: WordSources,
): {
  readonly readings: Pick<EntryReadings, "tw" | "twAlternates">;
  readonly tally: ReturnType<typeof taiwanTallyOf>;
} {
  const taiwan = taiwanReadingOf(
    word,
    spellingsOf(word, form.hant, form.hantVariants),
    form.senses,
    senseReadings,
    reading,
    sources.unihanReadings.get(word),
    sources.moe,
  );
  return { readings: taiwanColumnsOf(taiwan), tally: taiwanTallyOf(taiwan) };
}
