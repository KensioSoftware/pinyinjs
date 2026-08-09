/**
 * A word whose 轻声 sense is the one the dictionary should carry.
 */
export interface NeutralSenseWord {
  /** The word, in 简体. */
  readonly word: string;
  /** What the full-tone sense of the same spelling is, and why it is not this
   * word. */
  readonly displaces: string;
}

/**
 * Words where CC-CEDICT's 轻声 sense is the everyday word and its full-tone
 * sense is something else written the same way.
 *
 * Step 7 of the merge takes CC-CEDICT's neutral tones over the phrase corpus's
 * full ones, and it does so against **the sense nearest the reading it already
 * has** — otherwise 行长 would take 行's other pronunciation. That works for the
 * 609 words it settles, and it cannot work here: the phrase corpus's reading
 * matches the full-tone sense *exactly*, so the nearest sense is the one that
 * already agrees and there is no neutral tone to take. 东西 is `dong1 xi1` (east
 * and west) and `dong1 xi5` (thing), the corpus writes `dōng xī`, and the thing
 * never got a say.
 *
 * **98 words are in that shape and nothing in the pipeline can rank two senses
 * of one spelling.** jieba counts the spelling, not the sense. CPP labels 6 of
 * the 98. Letting longer CC-CEDICT headwords vote, weighted by jieba, picks the
 * *literal* sense for 东西 by 663 to 113 — because compounds like 东西半球 are
 * exactly where a literal sense lives. So this is a list, and it is a list of
 * judgements.
 *
 * **What is listed here.** A word whose 轻声 sense is the one 现代汉语词典 gives
 * the headword, and whose full-tone sense is literary (生意 the life force),
 * technical (说法 expounding the dharma), legal (告诉 filing a complaint) or a
 * name (大方县, 金子 the Japanese surname). What is *not* listed is the larger
 * half of the 98 where both senses are current and common — 地方 is `dìfang` the
 * place and `dìfāng` the opposite of central, 大意 is the gist and carelessness,
 * 多少 is how-many and an amount, 地道 is a tunnel and the real thing. Choosing
 * for those would be trading one wrong answer for another.
 *
 * **No reading is written here**, only the word. The merge takes the neutral
 * sense CC-CEDICT already holds, so a source refresh that changes a word's
 * senses cannot leave a hand-typed reading behind — and `BUILD_ASSERTIONS`
 * fails the build if any word here stops reading with a 轻声 at all.
 */
export const NEUTRAL_SENSE_WORDS: readonly NeutralSenseWord[] = [
  { word: "东西", displaces: "east and west, the compass directions" },
  { word: "告诉", displaces: "to press charges, the legal term" },
  { word: "故事", displaces: "故事 gùshì, an old practice or precedent" },
  { word: "妻子", displaces: "wife and children, the classical sense" },
  { word: "说法", displaces: "to expound Buddhist teachings" },
  { word: "小子", displaces: "CC-CEDICT's own (literary) and (old) youngster" },
  { word: "买卖", displaces: "to buy and sell, the verb" },
  { word: "生意", displaces: "life force, vitality" },
  { word: "本事", displaces: "the source material a work is based on" },
  { word: "大爷", displaces: "an arrogant idler, not one's uncle" },
  { word: "大方", displaces: "大方县, the county in Guizhou" },
  { word: "口音", displaces: "oral speech sounds, the linguistics term" },
  { word: "结实", displaces: "to bear fruit" },
  { word: "把手", displaces: "to shake hands, the verb" },
  { word: "金子", displaces: "Kaneko, the Japanese surname" },
  { word: "出息", displaces: "to yield interest, and to exhale in Buddhism" },
  {
    word: "管子",
    displaces: "管子, the Warring States politician and the book",
  },
  { word: "支吾", displaces: "to resist, to withstand" },
];

/**
 * The listed words, for the merge to test membership against.
 */
export const NEUTRAL_SENSE_LOOKUP: ReadonlySet<string> = new Set(
  NEUTRAL_SENSE_WORDS.map((listed) => listed.word),
);
