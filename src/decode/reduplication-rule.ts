/**
 * How a verb is read when it is said twice with 了 or 一 between.
 *
 * 数了数 and 数一数 are one verb said twice. Each half is a character of its
 * own to the lattice, and each falls back on the character's default.
 */
import { isSameSyllable } from "../dictionary/entry.js";
import { QUANTITY_CHARACTERS } from "../numerals/characters.js";
import { toCharacters } from "../script/characters.js";
import { readSyllable, type Syllable } from "../syllable/syllable.js";
import {
  type EdgeContext,
  type EdgeRule,
  tagOf,
  wordsEndingAt,
  wordsStartingAt,
} from "./rules.js";

/**
 * What can stand between the halves of a reduplicated verb.
 *
 * 看了看 is the completed form and 看一看 the tentative one. Both are verbal
 * shapes. A noun or a 量词 repeats with 一 as well (一天一天, 一种一种), and
 * {@link reduplicatedAt} turns that shape away by the numeral in front.
 */
const INFIX = new Set(["了", "一"]);

/**
 * The polyphones whose verbal reading is not their default.
 *
 * The default is the reading a character takes in most text. For these that
 * reading is a noun (数 `shù`, 种 `zhǒng`), an adjective (凉 `liáng`) or the
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
const VERBAL_READINGS: ReadonlyMap<string, Syllable> = new Map(
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

/**
 * Whether a tagged word of more than one character starts or ends at a
 * position.
 */
function isInTaggedWord(
  words: readonly string[],
  context: EdgeContext,
): boolean {
  return words.some(
    (word) => toCharacters(word).length > 1 && tagOf(context, word) !== "",
  );
}

/**
 * Where the reduplication covering a position starts, or undefined.
 *
 * The position is either half. Three things turn the shape away. A numeral in
 * front makes it a count said twice (一种一种, 一卷一卷). A tagged word ending
 * at the first half claims that half (多数一数 holds 多数). A tagged word
 * starting at the second half claims that one, and that is how 数了数字 keeps
 * 数字 `shùzì`.
 */
function reduplicatedAt(context: EdgeContext, at: number): number | undefined {
  const { characters } = context;
  const character = characters[at] ?? "";
  let head: number | undefined;
  if (INFIX.has(characters[at + 1] ?? "") && characters[at + 2] === character) {
    head = at;
  } else if (
    INFIX.has(characters[at - 1] ?? "") &&
    characters[at - 2] === character
  ) {
    head = at - 2;
  }
  if (
    head === undefined ||
    QUANTITY_CHARACTERS.has(characters[head - 1] ?? "") ||
    isInTaggedWord(wordsEndingAt(context, head + 1), context) ||
    isInTaggedWord(wordsStartingAt(context, head + 2), context)
  ) {
    return undefined;
  }
  return head;
}

/**
 * The syllable a reduplication gives the character at a position, or
 * undefined where it gives none.
 */
function verbalSyllableAt(
  context: EdgeContext,
  at: number,
): Syllable | undefined {
  const verbal = VERBAL_READINGS.get(context.characters[at] ?? "");
  if (verbal === undefined) {
    return undefined;
  }
  return reduplicatedAt(context, at) === undefined ? undefined : verbal;
}

/**
 * Whether an edge longer than one character reads either half another way.
 *
 * 一卷 reaches into the second half of 卷一卷, and the decode read it
 * `juǎn yíjuàn` through that word. The full tier's 数一数 is `shǔ yī shù`, and
 * that reading of the second half goes too. The rule reads it `shǔ yì shǔ`.
 */
function readsAgainst(context: EdgeContext): boolean {
  const { edge } = context;
  if (edge.reading.length !== edge.to - edge.from) {
    return false;
  }
  return edge.reading.some((syllable, offset) => {
    const said = verbalSyllableAt(context, edge.from + offset);
    return said !== undefined && !isSameSyllable(syllable, said);
  });
}

/**
 * A verb said twice around 了 or 一 takes its verbal reading on both halves.
 *
 * 数 is stored `shù`, the noun, with `shǔ` as an alternate. 数数 is a word and
 * reads `shǔshù`. Put 了 between the halves and the word is gone, so 他数了数
 * 桌上的数字 came out `shù le shù`. The full tier holds 数一数 as a word and
 * the standard tier does not, so 数一数 went the same way there.
 *
 * The same shape split other verbs down the middle. 弹了弹 read `tán le dàn`,
 * because the 弹 rule saw the 了 after the first half and nothing after the
 * second. 教了教 read `jiāo le jiào` for the same reason. See
 * {@link VERBAL_READINGS} for the characters and {@link reduplicatedAt} for
 * the shapes turned away.
 *
 * Over 88,866 lines of Tatoeba and zh.wikipedia, A了A and A一A appear 107
 * times with an AA key behind them, across 43 shapes led by 想一想, 看了看 and
 * 看一看. None of them is one of these characters, and every one already read
 * both halves alike. Across those lines and both CPP splits, the rule moves no
 * decode in either tier.
 */
export const REDUPLICATED_VERB: EdgeRule = {
  name: "reduplicated-verb",
  verdictFor: (context: EdgeContext) => {
    const { edge } = context;
    if (edge.to - edge.from !== 1) {
      return readsAgainst(context) ? "forbid" : "keep";
    }
    const said = verbalSyllableAt(context, edge.from);
    const here = edge.reading[0];
    if (said === undefined || here === undefined) {
      return "keep";
    }
    return isSameSyllable(here, said) ? "force" : "keep";
  },
};
