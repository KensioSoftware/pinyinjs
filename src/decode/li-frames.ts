/**
 * Whether a 里 standing alone means "in, inside", which 繁體 writes 裡.
 *
 * 里 has two senses that read alike. `lǐ` is the unit of distance and the
 * neighbourhood, written 里 in both scripts (公里, 邻里, 里程, 里长), and `lǐ`
 * is also the locative after a noun, written 裡 (鏡子裡, 房間裡, 冰箱裡). The
 * syllable cannot tell them apart. The character table takes 里 by default,
 * because most of the words that hold 里 are the unit or the neighbourhood.
 * The table converts the locative words it knows (这里, 心里, 家里, 夜里)
 * whole. A 里 the decode leaves as a word of its own has no such word behind
 * it, and is the locative unless a number comes before it: 屋子里 is inside the
 * room, and 走了十里 is ten 里 walked.
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import { toCharacters } from "../script/characters.js";
import type { ScriptChoice } from "./script-types.js";

/**
 * The 繁體 form of the locative.
 */
const INSIDE = "裡";

/**
 * What can come before a 里 that counts distance, in both scripts.
 *
 * The numerals, and the words that stand in for one or round it off: 几里,
 * 数里, 十多里, 十来里, 十余里, 半里.
 */
const COUNTING = new Set(
  toCharacters("〇零一二三四五六七八九十百千万萬两兩廿几幾数數多来來余餘半"),
);

/**
 * Transliteration syllables that come before a 里 in a foreign name: 克里斯,
 * 加布里埃尔, 德米特里, 鲍里斯, 恩里科, 胡里奥, 齐里.
 */
const NAME_BEFORE = new Set<string | undefined>(
  toCharacters("克布特鲍胡恩夏埃尤荷齐弗杰诺莫默奥艾迪阿伊佩塞贝哈帕茨维格"),
);

/**
 * Transliteration syllables that come after a 里 in a foreign name: 里玛,
 * 鲍里斯, 胡里奥, 恩里科, 格里菲斯, 斯特里普, 叶里温.
 */
const NAME_AFTER = new Set<string | undefined>(
  toCharacters("斯埃玛奥科希约马奇尔亚诺娜莎欧达雅菲普曼温"),
);

/**
 * Whether two characters are a word of their own, which the name syllables
 * are not. 坦克里 and 表格里 end in 克 and 格, and 坦克 and 表格 are nouns.
 */
function isWord(
  dictionary: Dictionary,
  characters: readonly string[],
): boolean {
  return (
    characters.length === 2 &&
    dictionary.lookup(characters.join("")) !== undefined
  );
}

/**
 * Whether a 里 sits inside a foreign name, between syllables that make no
 * word with what is either side of them.
 */
function isInName(
  dictionary: Dictionary,
  characters: readonly string[],
  at: number,
): boolean {
  return (
    (NAME_BEFORE.has(characters[at - 1]) &&
      !isWord(dictionary, characters.slice(at - 2, at))) ||
    (NAME_AFTER.has(characters[at + 1]) &&
      !isWord(dictionary, characters.slice(at + 1, at + 3)))
  );
}

/**
 * Whether the 里 at a position means "in, inside".
 *
 * The caller has already settled that the character is a 里 standing alone.
 * A 里 with nothing before it in the run is left alone, since there is no noun
 * for it to be inside. A run starts after punctuation or any character that is
 * not Han, digits among them, and 5里 is as likely as Facebook里.
 */
function isInsideAt(
  dictionary: Dictionary,
  characters: readonly string[],
  at: number,
): boolean {
  const before = characters[at - 1];
  return (
    before !== undefined &&
    !COUNTING.has(before) &&
    !isInName(dictionary, characters, at)
  );
}

/**
 * Write 裡 where a 里 standing alone means "in, inside".
 *
 * The character table takes 里 by default, which is right for 公里 and 邻里 and
 * wrote 镜子里 as 鏡子里. A 里 the decode left as a word of its own after a
 * noun is the locative. A number before it makes it the unit, and a
 * transliteration syllable either side makes it part of a name. See
 * {@link isInsideAt}.
 *
 * Only a choice that names 裡 as a rival is touched, which confines this to
 * 简→繁: converting into 简体 has nothing to change 里 into.
 */
export function writeInside(
  choices: readonly ScriptChoice[],
  dictionary: Dictionary,
  characters: readonly string[],
  from: number,
): readonly ScriptChoice[] {
  const [choice] = choices;
  if (
    choices.length !== 1 ||
    choice === undefined ||
    !choice.alternatives.includes(INSIDE) ||
    !isInsideAt(dictionary, characters, from)
  ) {
    return choices;
  }
  return [
    {
      from: choice.from,
      to: INSIDE,
      evidence: "reading",
      alternatives: [choice.to, ...choice.alternatives].filter(
        (form) => form !== INSIDE,
      ),
    },
  ];
}
