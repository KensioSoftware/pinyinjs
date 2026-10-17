/**
 * The verbs the reduplication rule reads, and the reading each takes.
 */
import { readSyllable, type Syllable } from "../syllable/syllable.js";

/**
 * The polyphones whose verbal reading is not their default.
 *
 * The default is the reading a character takes in most text. For these that
 * reading is a noun (数 `shù`, 种 `zhǒng`, 量 `liàng`), an adjective (凉
 * `liáng`), another verb (转 `zhuǎn`, which changes where `zhuàn` spins) or the
 * reading their compounds take (教 `jiào`, 弹 `dàn`, 削 `xuē`). A
 * reduplicated character is a verb, and the verbal reading is the one it
 * wants.
 *
 * 卷 is in for its tail. Its default is already `juǎn`, and 卷一卷 read the
 * second half `juàn` off 一卷, a word the dictionary tags `m`.
 *
 * Written out by hand because the dictionary has no tag per reading. The
 * nearest thing it holds is the reduplicated word itself, and that is the
 * wrong evidence. Of the 19 AA keys in the standard tier whose first syllable
 * differs from the character's default, 数数 (in both scripts) is the only
 * verb said twice. The rest are literary reduplicatives (查查 `zhāzhā`, 拜拜 `báibái`, 累累
 * `léiléi`), and reading 查一查 off 查查 would turn a correct `chá` into `zhā`.
 */
export const VERBAL_READINGS: ReadonlyMap<string, Syllable> = new Map(
  (
    [
      ["数", "shǔ"],
      ["數", "shǔ"],
      ["凉", "liàng"],
      ["涼", "liàng"],
      ["种", "zhòng"],
      ["種", "zhòng"],
      ["教", "jiāo"],
      ["弹", "tán"],
      ["彈", "tán"],
      ["卷", "juǎn"],
      ["削", "xiāo"],
      ["量", "liáng"],
      ["转", "zhuàn"],
      ["轉", "zhuàn"],
    ] as const
  ).map(([character, text]) => {
    const syllable = readSyllable(text);
    /* c8 ignore next 3 -- every reading above is a syllable */
    if (syllable === undefined) {
      throw new Error(`${text} is not a syllable`);
    }
    return [character, syllable];
  }),
);
