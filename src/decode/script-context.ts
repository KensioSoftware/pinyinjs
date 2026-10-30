/**
 * Revisiting a converted word in the light of the run around it.
 *
 * The character table decides each character alone, and for a few the words
 * either side are what settle it. `script-words` converts a word on its own
 * evidence, and this is what follows it.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import type { CharacterConversion } from "../script/conversion.js";
import type { Syllable } from "../syllable/syllable.js";
import { CONCERNING, isConcerningAt, isGan } from "./gan-frames.js";
import { writeInside } from "./li-frames.js";
import { convertWord } from "./script-words.js";
import type { ScriptChoice } from "./script-types.js";

/**
 * What a word in a run is converted against.
 */
export interface RunTables {
  readonly dictionary: Dictionary;
  readonly table: ReadonlyMap<string, CharacterConversion>;
  readonly words: ReadonlyMap<string, string>;
}

/**
 * Convert a word, then revisit its choices in the light of the run around it.
 *
 * The character table decides 干 and 里 alone, and a frame around the word can
 * overrule it: 与你无干 keeps 干 and 镜子里 writes 裡. `from` is where the
 * word starts in `characters`, which are the whole run's.
 */
export function convertInRun(
  tables: RunTables,
  word: string,
  reading: readonly Syllable[],
  characters: readonly string[],
  from: number,
): readonly ScriptChoice[] {
  const converted = convertWord(tables.table, tables.words, word, reading);
  const concerning = keepConcerning(
    converted,
    tables.dictionary,
    characters,
    from,
    reading,
  );
  return writeInside(concerning, tables.dictionary, characters, from);
}

/**
 * Keep 干 where it means "to concern".
 *
 * 干 read `gān` is 乾 when it means dry (干燥, 干货) and stays 干 when it means
 * to concern (干扰, 相干), and the syllable cannot tell the two apart. A word
 * settles most of them. A 干 standing alone at `gān` fell back on 乾, which
 * wrote 与你无干 as 與你無乾 and 干卿底事 as 乾卿底事. The frames that read
 * it `gān` in the first place are the ones that decide it here. See
 * {@link isConcerningAt}.
 *
 * `from` is where the word starts in `characters`, which are the whole run's,
 * since the frames reach past the word.
 */
function keepConcerning(
  choices: readonly ScriptChoice[],
  dictionary: Dictionary,
  characters: readonly string[],
  from: number,
  reading: readonly Syllable[],
): readonly ScriptChoice[] {
  if (reading.length !== choices.length) {
    return choices;
  }
  return choices.map((choice, at) =>
    choice.from === CONCERNING &&
    choice.to !== CONCERNING &&
    isGan(reading[at]) &&
    isConcerningAt(dictionary, characters, from + at)
      ? {
          from: choice.from,
          to: CONCERNING,
          evidence: "reading",
          alternatives: [choice.to, ...choice.alternatives].filter(
            (form) => form !== CONCERNING,
          ),
        }
      : choice,
  );
}
