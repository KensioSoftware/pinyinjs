/**
 * The words whose reading a build must reproduce.
 *
 * Each stands for a class of upstream defect a source refresh could
 * reintroduce — a 儿化 repair, a sandhi normalisation, a polyphone the corpus
 * would otherwise flatten — so a failure means the merge stopped doing
 * something it used to, not that one word is wrong.
 */
import type { BuildAssertion, BuiltDictionary } from "./built-dictionary.js";

/**
 * Assert one word reads a particular way.
 */
export function reads(
  word: string,
  expected: string,
  why: string,
): BuildAssertion {
  return {
    description: `${word} → ${expected} (${why})`,
    check: (dictionary: BuiltDictionary): string | undefined => {
      const actual = dictionary.reading(word);
      if (actual === undefined) {
        return `${word} is missing from the dictionary`;
      }
      return actual === expected
        ? undefined
        : `${word} reads ${actual}, expected ${expected}`;
    },
  };
}

export const WORD_READINGS: readonly BuildAssertion[] = [
  reads("玩儿", "wánr", "儿化 repaired from CC-CEDICT's r5"),
  reads("女儿", "nǚ ér", "儿 keeps its own syllable here"),
  reads("这儿", "zhèr", "儿化 despite upstream writing a tone on the er"),
  reads("儿子", "ér zi", "儿化 exception list consulted"),
  reads("一丁不识", "yī dīng bù shí", "一 sandhi normalised out"),
  reads("一不小心", "yī bù xiǎo xīn", "一 and 不 sandhi normalised out"),
  reads("大夫", "dài fu", "override applied over both sources"),
  reads("东西", "dōng xi", "the thing, not the compass directions"),
  reads("东西方", "dōng xī fāng", "and the directions where that is the word"),
  reads("告诉", "gào su", "the everyday verb, not filing a complaint"),
  reads("银行", "yín háng", "polyphone survives"),
  reads("行长", "háng zhǎng", "polyphone survives"),
  reads("头发", "tóu fa", "CC-CEDICT wins on the neutral tone"),
  reads("还是", "hái shi", "CC-CEDICT wins on the neutral tone"),
  reads("頭髮", "tóu fa", "繁體 derived using the reading, and keyed directly"),
  reads("重複", "chóng fù", "one of two 繁體 spellings, both keyed"),
  reads("重覆", "chóng fù", "the other, on the same entry"),
  reads("下麵", "xià miàn", "both spellings of a word CC-CEDICT writes twice"),
];
