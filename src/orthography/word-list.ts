import { characterCount } from "../script/characters.js";

/**
 * How GB/T 16159 writes a word that no rule gets right.
 *
 * `parts` are the 简体 characters of each written word, in order, and must
 * concatenate back to `word` exactly — checked by a test, since a typo would
 * otherwise silently drop characters from a conversion.
 */
export interface SpacedWord {
  readonly word: string;
  readonly parts: readonly string[];
  /** Which clause of the standard, and why no rule can reach it. */
  readonly reason: string;
}

/**
 * Words whose written spacing has to be listed rather than derived.
 *
 * ORTHOGRAPHY.md calls for this and the measurements in
 * [ROADMAP.md](../../.claude/ROADMAP.md) say why it cannot be a rule instead.
 * Three rules were sized against the whole dictionary and rejected: jieba tags
 * 不是 and 不但 both `c` where the standard writes `bú shì` and `bùdàn`; of 247
 * two-character numeral+量词 candidates a large share are lexicalised (大米,
 * 层次, 片段); and 黄河 is `Huáng Hé` where 青海 is `Qīnghǎi`, with nothing in
 * the data to separate them.
 *
 * **Keep this small**, on the same principle as the reading overrides: anything
 * a rule can reach belongs in a rule. Entries are the standard's own worked
 * examples, and each says which clause it comes from. It is deliberately not a
 * complete 正词法 implementation — the entries here are the ones this package
 * has a case for, and the list grows as cases arrive rather than by guessing at
 * them.
 *
 * A single part forces the opposite of a split: 中国人 is decoded as 中国 + 人
 * and written as one word.
 */
export const SPACED_WORDS: readonly SpacedWord[] = [
  // ── 6.1.3 数词和量词分写 ──────────────────────────────────
  {
    word: "一个",
    parts: ["一", "个"],
    reason: "Numeral and measure word are written separately.",
  },
  {
    word: "一天",
    parts: ["一", "天"],
    reason: "Numeral and measure word are written separately.",
  },
  {
    word: "两个",
    parts: ["两", "个"],
    reason: "Numeral and measure word are written separately.",
  },
  {
    word: "几个",
    parts: ["几", "个"],
    reason: "Numeral and measure word are written separately.",
  },

  // ── 6.2.3 否定副词分写 ──────────────────────────────────
  {
    word: "不是",
    parts: ["不", "是"],
    reason:
      "The negative adverb is written apart from what it negates. jieba tags this `c`, the same tag it gives 不但, which is written together.",
  },
  {
    word: "不好",
    parts: ["不", "好"],
    reason: "The negative adverb is written apart from what it negates.",
  },
  {
    word: "不对",
    parts: ["不", "对"],
    reason: "The negative adverb is written apart from what it negates.",
  },

  // ── 6.3.1 专名和通名分写 ──────────────────────────────────
  {
    word: "黄河",
    parts: ["黄", "河"],
    reason:
      "Proper name and generic term are written separately and both capitalised. No rule reaches a two-character name: 青海 is Qīnghǎi and 上海 is Shànghǎi.",
  },
  {
    word: "长江",
    parts: ["长", "江"],
    reason: "Proper name and generic term are written separately.",
  },
  {
    word: "泰山",
    parts: ["泰", "山"],
    reason: "Proper name and generic term are written separately.",
  },
  {
    word: "华山",
    parts: ["华", "山"],
    reason: "Proper name and generic term are written separately.",
  },
  {
    word: "珠江",
    parts: ["珠", "江"],
    reason: "Proper name and generic term are written separately.",
  },

  // ── 6.3.4 国名、民族名加"人"连写 ────────────────────────
  {
    word: "中国人",
    parts: ["中国人"],
    reason:
      "A nationality is written as one word. The decode splits it into 中国 and 人 because that is the likelier segmentation, and no suffix tag marks 人.",
  },
  {
    word: "美国人",
    parts: ["美国人"],
    reason: "A nationality is written as one word.",
  },
  {
    word: "外国人",
    parts: ["外国人"],
    reason: "A nationality is written as one word.",
  },

  // ── 6.2.2 动词与补语，补语是动词的分写 ──────────────────
  {
    word: "还给",
    parts: ["还", "给"],
    reason:
      "A verb is written apart from a complement that is itself a verb. Not reachable by tag: 开会 and 睡觉 are also verb pairs and are written together.",
  },
];

/**
 * The table keyed by word, with the longest entries findable first.
 */
export const SPACED_WORD_FORMS: ReadonlyMap<string, readonly string[]> =
  new Map(SPACED_WORDS.map((spaced) => [spaced.word, spaced.parts]));

/**
 * The longest word in the table, which bounds how far a scan has to look.
 */
export const LONGEST_SPACED_WORD: number = Math.max(
  0,
  ...SPACED_WORDS.map((spaced) => characterCount(spaced.word)),
);
