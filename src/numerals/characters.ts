import { toCharacters } from "../script/characters.js";
import { readSyllable, type Syllable } from "../syllable/syllable.js";

/**
 * The 汉字 a digit is written with, indexed by its value.
 */
export const DIGIT_CHARACTERS = "零一二三四五六七八九";

/**
 * The other 汉字 a written number is made of, and what each is worth.
 *
 * 十, 百 and 千 are the places inside a group of four; 万 and 亿 are the group
 * separators, which is what makes Chinese numbers myriad-grouped rather than
 * thousand-grouped: 12,345 is 一万二千三百四十五, one 万 and 2,345.
 */
export const UNIT_VALUES: ReadonlyMap<string, number> = new Map([
  ["十", 10],
  ["百", 100],
  ["千", 1000],
  ["万", 10_000],
  ["亿", 100_000_000],
]);

/**
 * Every character a number can be written with, and how it is read.
 *
 * This is the whole of the numerals' data — twenty-odd readings, carried here
 * rather than looked up, because reading a number needs no dictionary and a
 * package that needed one for it would be the wrong shape. Readings are
 * underlying*: 一 is `yī` and 不 would be `bù`, with the contextual tone left
 * to the sandhi pass, exactly as the dictionary stores them.
 */
const READINGS: ReadonlyMap<string, string> = new Map([
  ["零", "líng"],
  ["〇", "líng"],
  ["一", "yī"],
  ["二", "èr"],
  ["两", "liǎng"],
  ["兩", "liǎng"],
  ["三", "sān"],
  ["四", "sì"],
  ["五", "wǔ"],
  ["六", "liù"],
  ["七", "qī"],
  ["八", "bā"],
  ["九", "jiǔ"],
  ["十", "shí"],
  ["百", "bǎi"],
  ["千", "qiān"],
  ["万", "wàn"],
  ["萬", "wàn"],
  ["亿", "yì"],
  ["億", "yì"],
  ["点", "diǎn"],
  ["點", "diǎn"],
  ["负", "fù"],
  ["負", "fù"],
  ["分", "fēn"],
  ["之", "zhī"],
  ["百分之", "bǎi fēn zhī"],
]);

/**
 * The 汉字 a quantity is written with: the digits, 两, and the places.
 *
 * Less than {@link numeralSyllable} reads, and deliberately so. 点, 分, 之 and
 * 负 are parts of how a number is *said* rather than quantities in themselves,
 * so a 量词 after one of them is not being counted by it — which is the only
 * question this set is asked.
 */
export const QUANTITY_CHARACTERS: ReadonlySet<string> = new Set([
  ...toCharacters(DIGIT_CHARACTERS),
  "〇",
  "两",
  "兩",
  ...UNIT_VALUES.keys(),
  "萬",
  "億",
]);

/**
 * Read one numeral character.
 *
 * Undefined for anything that is not one, which is how a caller tells a
 * numeral apart from the text around it.
 */
export function numeralSyllable(character: string): Syllable | undefined {
  const spelling = READINGS.get(character);
  return spelling === undefined ? undefined : readSyllable(spelling);
}

/**
 * `yāo`, which is how 一 is said when digits are read out one at a time.
 *
 * 110 is `yāo yāo líng` and 120 is `yāo èr líng`, because `yī` and `qī` are
 * hard to tell apart over a bad line. It is a reading of the digit rather than
 * a different digit — 一 is still written — and it belongs to phone numbers,
 * room numbers and the like rather than to counting, which is why it is a
 * separate reading here and an option rather than a rule.
 */
export function yaoSyllable(): Syllable | undefined {
  return readSyllable("yāo");
}
