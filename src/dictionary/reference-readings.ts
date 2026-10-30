/**
 * Readings a standard reference dictionary gives that no source carries.
 *
 * Unihan, the phrase corpus and CC-CEDICT between them miss a tail of
 * readings that print dictionaries list (a character's reading in one literary
 * word, a surname, a place name, a dialect word). Where a source has the word
 * and reads it from the character's everyday reading, the printed reading is
 * the better evidence, and it replaces the corpus's.
 */

/**
 * A reference dictionary's readings, by character and by word.
 */
export interface ReferenceReadings {
  readonly characters: ReadonlyMap<string, readonly string[]>;
  readonly words: ReadonlyMap<string, readonly string[]>;
}

/**
 * A character's readings a standard reference dictionary gives and the
 * sources lack, as tone-marked pinyin.
 *
 * They follow every reading a source gives, so they never set a character's
 * default and only ever stand as alternates. The three characters no source
 * reads at all take the reading here as their only one. A 繁體 form is listed
 * beside its 简体 one, since each has a Unihan entry of its own.
 *
 * Three dialect readings are left out, 不 `dǔn` in 不子, 泽 `duó` in 凌泽 (an
 * icicle) and syllabic 姆 `m̄`, along with the old reading 能 `nài` and the
 * surname reading 扑 `pú`. Each character has one reading otherwise, and a
 * second would mark every free-standing 不, 能 and 扑, every 泽 in a given
 * name and every 姆 in a transliterated one uncertain. 不子 carries its
 * reading as a word. So does 神神道道, the one word that reads 道 as `dāo`.
 */
const CHARACTER_READINGS: ReadonlyMap<string, readonly string[]> = new Map([
  ["咹", ["ǎn"]],
  ["㼎", ["báo"]],
  ["箄", ["bēi", "pái"]],
  ["屏", ["bīng"]], // 屏营
  ["礤", ["cā"]],
  ["倡", ["chāng"]], // 倡优
  ["樘", ["chēng"]],
  ["𡷫", ["chéng"]], // a surname
  ["郗", ["chī"]], // a surname
  ["佁", ["chì"]], // 佁儗
  ["玼", ["cī"]],
  ["粢", ["cī"]], // 粢饭
  ["酂", ["cuán"]], // a place name
  ["酇", ["cuán"]],
  ["嵅", ["dǎn", "dǎng"]], // place names in Guangxi
  ["碴", ["zhǎ"]], // 道碴
  ["嘚", ["dè"]], // 嘚瑟
  ["镫", ["dēng"]],
  ["鐙", ["dēng"]],
  ["澄", ["dēng"]],
  ["螲", ["dié"]], // 螲𬠅
  ["𭣧", ["dù"]],
  ["柂", ["duò"]],
  ["媠", ["duò"]],
  ["欸", ["ē", "é", "ě", "è"]],
  ["噁", ["è"]], // 二噁英
  ["胲", ["gǎi"]],
  ["𭥙", ["gǎng"]],
  ["岗", ["gàng"]], // 岗尖, 岗口儿甜
  ["崗", ["gàng"]],
  ["瘩", ["dā"]], // 疙疙瘩瘩, 疙里疙瘩
  ["𫵼", ["gēng"]],
  ["𣪘", ["guǐ"]],
  ["亢", ["háng"]], // the throat, in literary use
  ["猲", ["hè"]],
  ["愒", ["hè", "qì"]],
  ["沕", ["hū"]],
  ["鳠", ["huò"]],
  ["鱯", ["huò"]],
  ["雘", ["huò"]],
  ["筊", ["jiǎo"]],
  ["寁", ["jié"]],
  ["蹴", ["jiù"]],
  ["菹", ["jù"]],
  ["朘", ["juān"]],
  ["蠼", ["jué"]],
  ["焅", ["kào"]],
  ["㲉", ["kòu"]],
  ["磈", ["kuǐ"]],
  ["癞", ["là"]], // 癞痢
  ["癩", ["là"]],
  ["乐", ["lào"]], // 乐亭, a place name
  ["樂", ["lào"]],
  ["嘞", ["lē"]],
  ["𥉳", ["liū"]],
  ["蹓", ["liù"]],
  ["碌", ["lū"]], // 骨碌碌
  ["掹", ["měng"]],
  ["䏚", ["miǎo"]], // a term in Chinese medicine
  ["玟", ["mín"]], // a stone like jade
  ["貉", ["mò"]], // the same as 貊
  ["媆", ["nèn"]], // the same as 嫩
  ["𫪘", ["óu", "ǒu", "òu"]], // an interjection
  ["蒡", ["páng"]], // 蒡葧
  ["㾦", ["pēi"]],
  ["𫔇", ["pī"]],
  ["芘", ["pí"]], // 芘芣
  ["𡏋", ["pǔ"]],
  ["呇", ["qǐ"]],
  ["跂", ["qǐ"]],
  ["倩", ["qìng"]], // to ask someone to do something, as in 倩人执笔
  ["桵", ["ruǐ"]], // a tree named in ancient texts
  ["埫", ["shǎng"]], // the same as 垧
  ["谌", ["shèn"]], // a surname
  ["諶", ["shèn"]],
  ["箵", ["xǐng"]],
]);

/**
 * Words a standard reference dictionary reads, with the reading it gives, as
 * the phrase corpus writes one. That is a syllable per character, tone-marked,
 * and unmarked for 轻声. An 儿 read as 儿化 is `r5`, as CC-CEDICT writes it.
 *
 * Each either has no source at all or is read in the phrase corpus from its
 * characters' everyday readings. 凌泽 is left out. It is a dialect word for an
 * icicle, and as a word it would take every given name 凌泽 apart.
 */
const WORD_READINGS: ReadonlyMap<string, readonly string[]> = new Map([
  ["粢饭", ["cī", "fàn"]],
  ["道碴", ["dào", "zhǎ"]],
  ["螲𬠅", ["dié", "dāng"]],
  ["不子", ["dǔn", "zi"]],
  ["岗尖", ["gàng", "jiān"]],
  ["岗口儿甜", ["gàng", "kǒu", "r5", "tián"]],
  ["疙疙瘩瘩", ["gē", "ge", "dā", "dā"]],
  ["疙里疙瘩", ["gē", "li", "gē", "dā"]],
  ["骨碌碌", ["gū", "lū", "lū"]],
  ["骨碌碌地", ["gū", "lū", "lū", "de"]],
  ["神神道道", ["shén", "shen", "dāo", "dāo"]],
]);

/**
 * The readings the build adds to the sources.
 */
export const REFERENCE_READINGS: ReferenceReadings = {
  characters: CHARACTER_READINGS,
  words: WORD_READINGS,
};
