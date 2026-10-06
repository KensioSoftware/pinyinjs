/**
 * Converting one word between the scripts, and what the evidence was.
 *
 * A word is converted whole where the tables know it and character by
 * character otherwise, and each choice carries what settled it so a caller
 * can show where the conversion was guessing.
 */
import type {
  ScriptChoice,
  ScriptEvidence,
  ScriptTarget,
} from "./script-types.js";
import type { Dictionary } from "../dictionary/dictionary.js";
import { toCharacters } from "../script/characters.js";
import {
  type CharacterConversion,
  conversionKey,
  convertCharacter,
  formsOf,
} from "../script/conversion.js";
import { DEFAULT_REGION, type Region } from "../script/glyphs.js";
import type { Script } from "../script/script.js";
import type { Syllable } from "../syllable/syllable.js";
import { CONCERNING, isConcerningAt, isGan } from "./gan-frames.js";

/**
 * The script and region a target names.
 */
export function targetOf(target: ScriptTarget): {
  script: Script;
  region: Region;
} {
  if (target === "zh-Hans") {
    return { script: "Hans", region: DEFAULT_REGION };
  }
  return {
    script: "Hant",
    region: target === "zh-Hant-HK" ? "HK" : DEFAULT_REGION,
  };
}

/**
 * Convert one word, preferring what a source wrote to what its characters imply.
 */
export function convertWord(
  table: ReadonlyMap<string, CharacterConversion>,
  words: ReadonlyMap<string, string>,
  word: string,
  reading: readonly Syllable[],
): readonly ScriptChoice[] {
  const characters = toCharacters(word);
  const attested = words.get(word);
  // A word only counts as attested when it lines up character for character;
  // anything else cannot be reported per character, which is what the choices
  // are. Those are rare enough to fall through to the characters.
  const attestedCharacters =
    attested === undefined ? undefined : toCharacters(attested);
  const isAttested = attestedCharacters?.length === characters.length;

  // A reading covering a different number of characters than the word has
  // cannot be lined up with them — 儿化 writes two characters as one syllable.
  const isAligned = reading.length === characters.length;

  return characters.map((character, at) => {
    const syllable = isAligned ? reading[at] : undefined;
    const conversion = table.get(character);
    const atReading = conversion?.byReading?.get(conversionKey(syllable));
    const to = isAttested
      ? /* c8 ignore next -- the lengths were just checked */
        (attestedCharacters[at] ?? character)
      : convertCharacter(table, character, syllable);
    // Every form the table names but the one taken. The character's own form
    // belongs among them: 万 is 萬 counting and 万 in the surname 万俟, 准 is
    // 準 and 准 in 准將, 著 is 着 and 著 at `zhù`. Excluding it left 42 简→繁
    // characters and 3,160 繁→简 ones reporting a guess with nothing to have
    // guessed between.
    const alternatives = formsOf(conversion).filter((form) => form !== to);
    return {
      from: character,
      to,
      evidence: evidenceFor(
        isAttested,
        atReading !== undefined,
        alternatives.length > 0,
      ),
      alternatives,
    };
  });
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
export function keepConcerning(
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

/**
 * Rank what settled a character, strongest evidence first.
 *
 * `locked` is keyed on whether a rival form survived rather than on
 * {@link import("../script/conversion.js").isAmbiguousCharacter}, and the two part company where a word overrides
 * the character table. 钟 has one 繁體 form by the characters and 一见钟情 is
 * 一見鍾情, so the choice named 鐘 as the road not taken while calling itself
 * locked. A word settled that one, which is what `word` is for.
 */
export function evidenceFor(
  isAttested: boolean,
  isAtReading: boolean,
  hasRival: boolean,
): ScriptEvidence {
  if (!hasRival) {
    return "locked";
  }
  if (isAttested) {
    return "word";
  }
  return isAtReading ? "reading" : "default";
}
