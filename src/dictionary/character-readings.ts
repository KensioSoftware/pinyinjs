/**
 * Single characters whose default reading a source would otherwise get wrong.
 *
 * Two source quirks between them: the 简体 phrase corpus carrying a 繁體
 * headword and reading it as though the characters were 简体, and Unihan's
 * frequency field counting a 轻声 that only occurs inside words.
 */
import type { BuildAssertion } from "./built-dictionary.js";
import { reads } from "./word-readings.js";

export const CHARACTER_READINGS: readonly BuildAssertion[] = [
  // The 简体 phrase corpus carries a few 繁體 headwords and reads them as
  // though the characters were 简体 — 徵 as `zhǐ` rather than as 征, 沈 as the
  // surname rather than as 沉. Left as entries of their own they outrank the
  // 繁體 key derived from the 简体 entry, and the word reads one way in a tier
  // holding the phrase tail and another way in a tier without it.
  reads("特徵", "tè zhēng", "not tè zhǐ, which is 徵 read as itself"),
  reads("沈溺", "chén nì", "not shěn nì, which is 沈 read as the surname"),
  reads("蝨子", "shī zi", "not shī zǐ, which is 子 read with its full tone"),
  // kHanyuPinlu writes 李 as `li(36)`, with no tone mark. Read as 轻声 — which
  // is what an unmarked reading means everywhere else in source data — 李华
  // comes out `Li Huá`. The other Unihan fields all write `lǐ`, and that is
  // what settles it. 们 is the control: genuinely neutral, and written bare by
  // the other fields too, so it must not be "corrected".
  reads("李", "lǐ", "a tone kHanyuPinlu left off is restored"),
  reads("们", "men", "a genuine 轻声 is not given a tone it never had"),
  reads("吧", "ba", "the 语气词, not the 酒吧 the corpus mass counts"),
  reads("酒吧", "jiǔ bā", "and the word the character keeps its full tone in"),
  reads("西", "xī", "a 轻声 counted only inside words does not lead"),
  reads("子", "zǐ", "and a suffix sense is not a claim about the character"),
  reads("夫", "fū", "nor is 大夫's and 丈夫's reduction"),
  reads("吗", "ma", "but a 语气词 CC-CEDICT reads 轻声 alone keeps it"),
];
