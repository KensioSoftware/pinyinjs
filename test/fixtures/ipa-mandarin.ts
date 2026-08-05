/**
 * The IPA key Wikipedia writes Mandarin with, symbol by symbol.
 *
 * Taken from *Help:IPA/Mandarin* (CC BY-SA 4.0, retrieved 2026-08-05) and
 * committed rather than fetched, for the reason [syllabary.ts](syllabary.ts)
 * gives. Every row of its consonant, vowel, diphthong and tone tables is here,
 * with the page's own example characters.
 *
 * **It is a second opinion rather than the same one twice.** The IPA column of
 * the syllabary is from *Comparison of Standard Chinese transcription systems*,
 * and this is a different page with a different purpose: that one tabulates a
 * syllabary, this one is the key an editor uses when transcribing a word in an
 * article. They are broadly the same analysis and they are not identical, and
 * the twelve rows marked {@link IpaKeyRow.differs} are where they part — which
 * is the whole value of having both. See `docs/romanization/` for what this
 * package writes and why.
 *
 * The symbols are the ones the page *displays*: it links [ä], [e̞] and [o̞] and
 * writes them a, e and o, and only the displayed form is a claim about how to
 * transcribe anything.
 */

/**
 * One symbol of the key, and the words the page says use it.
 */
export interface IpaKeyRow {
  /** The symbol, as the page displays it. */
  readonly ipa: string;
  /** Which table it comes from. */
  readonly table: "consonant" | "vowel" | "diphthong" | "tone";
  /** The page's own examples, in pinyin. */
  readonly examples: readonly string[];
  /**
   * Why this package writes something else, where it does.
   *
   * Twelve of the 50 rows. Ten are one place where the syllabary's column is
   * the broader of the two transcriptions — the medials, -ang, the empty rhyme
   * and the diphthongs — and the other two are tones this key writes as pitch
   * and this package does not write at all. The test
   * asserts that each of these still *does not* match, so that a row which
   * quietly starts agreeing is a failure rather than silence.
   */
  readonly differs?: string;
}

/**
 * All 50 rows of the page's four tables, in its order.
 */
export const IPA_KEY: readonly IpaKeyRow[] = [
  { ipa: "ɕ", table: "consonant", examples: ["xiǎo"] },
  { ipa: "f", table: "consonant", examples: ["fēi"] },
  {
    ipa: "j",
    table: "consonant",
    examples: ["yá"],
    differs:
      "the i medial is written as the vowel [i] rather than as the glide [j], which is what the syllabary's column does: 牙 yá is [ia]",
  },
  { ipa: "k", table: "consonant", examples: ["gān"] },
  { ipa: "kʰ", table: "consonant", examples: ["kǒu"] },
  { ipa: "l", table: "consonant", examples: ["lái"] },
  { ipa: "m", table: "consonant", examples: ["míng"] },
  { ipa: "n", table: "consonant", examples: ["ní"] },
  { ipa: "ŋ", table: "consonant", examples: ["jiāng"] },
  { ipa: "p", table: "consonant", examples: ["bāng"] },
  { ipa: "pʰ", table: "consonant", examples: ["páng"] },
  { ipa: "ʐ", table: "consonant", examples: ["rì"] },
  { ipa: "s", table: "consonant", examples: ["sī"] },
  { ipa: "ʂ", table: "consonant", examples: ["shǐ"] },
  { ipa: "t", table: "consonant", examples: ["duān"] },
  { ipa: "tʰ", table: "consonant", examples: ["tòu"] },
  { ipa: "tɕ", table: "consonant", examples: ["jiào"] },
  { ipa: "tɕʰ", table: "consonant", examples: ["qù"] },
  { ipa: "ts", table: "consonant", examples: ["zǐ"] },
  { ipa: "tsʰ", table: "consonant", examples: ["cǐ"] },
  { ipa: "ʈʂ", table: "consonant", examples: ["zhī"] },
  { ipa: "ʈʂʰ", table: "consonant", examples: ["chī"] },
  {
    ipa: "w",
    table: "consonant",
    examples: ["wǒ"],
    differs: "the u medial is the vowel [u] rather than the glide [w]: 我 wǒ is [uo]",
  },
  { ipa: "x", table: "consonant", examples: ["huǒ"] },
  {
    ipa: "ɥ",
    table: "consonant",
    examples: ["yuè"],
    differs: "the ü medial is the vowel [y] rather than the glide [ɥ]: 月 yuè is [ye]",
  },
  { ipa: "a", table: "vowel", examples: ["ā", "ān"] },
  // The page lists 二 and 兒 twice over, once under this vowel and once under ɚ.
  { ipa: "a", table: "vowel", examples: ["èr", "ér"] },
  {
    ipa: "ɑ",
    table: "vowel",
    examples: ["liàng"],
    differs:
      "-ang is written with the same [a] as -an rather than a backed [ɑ], which is the syllabary's column again: 亮 liàng is [liaŋ]",
  },
  { ipa: "ɛ", table: "vowel", examples: ["yán"] },
  { ipa: "ɛ", table: "vowel", examples: ["yuán"] },
  { ipa: "e", table: "vowel", examples: ["yě", "yuè"] },
  { ipa: "ə", table: "vowel", examples: ["běn", "lěng"] },
  { ipa: "ɚ", table: "vowel", examples: ["èr", "ér"] },
  { ipa: "ɤ", table: "vowel", examples: ["è"] },
  { ipa: "o", table: "vowel", examples: ["guǒ", "wǒ"] },
  { ipa: "i", table: "vowel", examples: ["lǐ"] },
  {
    ipa: "ɻ̩",
    table: "vowel",
    examples: ["zhī", "chī", "shī", "rì"],
    differs:
      "the empty rhyme is one symbol [ɨ] after both series rather than two that echo the initial, which the page itself notes is transcribed [ɨ] elsewhere",
  },
  {
    ipa: "ɹ̩",
    table: "vowel",
    examples: ["zǐ", "cì", "sī"],
    differs: "the same [ɨ], for the same reason",
  },
  { ipa: "u", table: "vowel", examples: ["tǔ"] },
  { ipa: "ʊ", table: "vowel", examples: ["dōng", "yòng"] },
  { ipa: "y", table: "vowel", examples: ["yǔ"] },
  {
    ipa: "aɪ",
    table: "diphthong",
    examples: ["ài"],
    differs:
      "the diphthongs are written with plain vowel letters — [ai], [au], [ei], [ou] — as the syllabary's column writes them",
  },
  {
    ipa: "aʊ",
    table: "diphthong",
    examples: ["āo"],
    differs: "[au], for the same reason",
  },
  {
    ipa: "eɪ",
    table: "diphthong",
    examples: ["bēi"],
    differs: "[ei], for the same reason",
  },
  {
    ipa: "oʊ",
    table: "diphthong",
    examples: ["yòu", "gǒu", "ōu"],
    differs: "[ou], for the same reason",
  },
  { ipa: "˥", table: "tone", examples: ["bā"] },
  { ipa: "˧˥", table: "tone", examples: ["bá"] },
  {
    ipa: "˧˩˧",
    table: "tone",
    examples: ["bǎ"],
    differs:
      "the third tone is written [˨˩˦], the citation contour every other source here uses, where this page gives its contextual realisations and [˧˩˧] for one spoken alone",
  },
  { ipa: "˥˩", table: "tone", examples: ["bà"] },
  {
    ipa: "˧",
    table: "tone",
    examples: ["ba5"],
    differs:
      "the neutral tone is written with no letter at all, having no contour of its own; this page gives the pitch it is realised at, which depends on the syllable before it",
  },
];
