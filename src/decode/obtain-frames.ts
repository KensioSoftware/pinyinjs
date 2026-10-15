/**
 * Whether a 得了 is the verb "to obtain", as in 得了肺炎 and 得了一百分.
 */
import { toCharacters } from "../script/characters.js";
import type { EdgeContext } from "./rules.js";

/**
 * One kind of thing a 得 obtains, and how its name is found after the 了.
 *
 * Matched as characters rather than through the dictionary, since the core
 * tier holds no words and 焦虑症 is three characters there.
 */
interface ObtainedKind {
  /** Whether the name of one of these ends or starts at a position. */
  readonly namedAt: (characters: readonly string[], at: number) => boolean;
  /**
   * The verbs that take one of these as the object of a potential complement.
   *
   * 治得了病 is "able to cure it" and 拿得了冠军 "able to win it", so the 得
   * after these stays the particle whatever follows.
   */
  readonly potentialVerbs: ReadonlySet<string>;
}

/**
 * The characters an illness's name ends with.
 *
 * 肺炎, 精神病, 焦虑症, 肺癌, 肿瘤, 湿疹, 疟疾.
 */
const ILLNESS_ENDS = new Set(toCharacters("病症炎癌瘤疮瘡疹疾痢癣癬痘痨癆"));

/**
 * The characters that make a word of an illness character without naming an
 * illness.
 *
 * 病人, 病房, 病情 and 病假 are about the ill rather than what they have, and
 * 帮得了病人 and 控制得了病情 are potential complements.
 */
const NOT_ILLNESS_AFTER = new Set(toCharacters("人房院床假历歷例号號友情况況"));

/**
 * The illnesses whose names end with none of {@link ILLNESS_ENDS}.
 */
const ILLNESS_WORDS = new Set([
  "感冒",
  "流感",
  "发烧",
  "發燒",
  "中风",
  "中風",
  "中暑",
  "艾滋",
  "抑郁",
  "抑鬱",
  "失眠",
  "哮喘",
]);

/**
 * An illness, which a 得 contracts: 他得了感冒, 我邻居得了焦虑症.
 *
 * 诊 is not among the verbs, since 确诊得了肺炎 is "diagnosed as having
 * pneumonia".
 */
const ILLNESS: ObtainedKind = {
  namedAt: (characters, at) =>
    (ILLNESS_ENDS.has(characters[at] ?? "") &&
      !NOT_ILLNESS_AFTER.has(characters[at + 1] ?? "")) ||
    ILLNESS_WORDS.has(characters.slice(at, at + 2).join("")),
  potentialVerbs: new Set(toCharacters("治医醫看防控制抗扛挺忍熬")),
};

/**
 * The characters that make a word of 分 that is not a score.
 *
 * 坚持得了十分钟 is "able to hold out ten minutes", and 吃得了三分之一 a
 * third.
 */
const NOT_SCORE_AFTER = new Set(toCharacters("钟鐘之"));

/**
 * The prizes and placings a 得 wins whose names do not end in 分 or 名.
 */
const PRIZE_WORDS = new Set([
  "冠军",
  "冠軍",
  "亚军",
  "亞軍",
  "季军",
  "季軍",
  "金牌",
  "银牌",
  "銀牌",
  "铜牌",
  "銅牌",
]);

/**
 * The characters a count is written with, for the 分 of 一百分 and the 名 of
 * 第三名.
 *
 * 满分 and 高分 are scores too. 部分 is not, and 吃得了一部分 is a potential
 * complement.
 */
const NUMERALS = new Set(
  toCharacters(
    "一二三四五六七八九十百千两兩零几幾满滿高低少0123456789０１２３４５６７８９",
  ),
);

/**
 * Whether a character is preceded by a count.
 */
function countedAt(characters: readonly string[], at: number): boolean {
  return NUMERALS.has(characters[at - 1] ?? "");
}

/**
 * A score, a prize or a placing, which a 得 wins: 得了几分, 得了奖, 得了冠军,
 * 得了第三名.
 */
const PRIZE: ObtainedKind = {
  namedAt: (characters, at) => {
    const character = characters[at] ?? "";
    return (
      (character === "分" &&
        countedAt(characters, at) &&
        !NOT_SCORE_AFTER.has(characters[at + 1] ?? "")) ||
      character === "奖" ||
      character === "獎" ||
      (character === "名" && countedAt(characters, at)) ||
      PRIZE_WORDS.has(characters.slice(at, at + 2).join(""))
    );
  },
  potentialVerbs: new Set(toCharacters("拿考")),
};

const KINDS: readonly ObtainedKind[] = [ILLNESS, PRIZE];

/**
 * The characters an object is never read across.
 *
 * 吃得了药的病人 has a 病 four characters on, but the 的 in front of it has
 * already closed the object of the 吃.
 */
const BOUNDARIES = new Set(toCharacters("的了吗嗎呢吧啊"));

/**
 * How far past the 了 the object's name can end.
 *
 * Three characters takes in 精神病, 焦虑症 and 一百分, and a fourth a
 * modifier such as 重感冒 or 第一名.
 */
const REACH = 4;

/**
 * Whether one kind of thing is named between a 了 and the next boundary.
 */
function namesKindAfter(
  characters: readonly string[],
  at: number,
  kind: ObtainedKind,
): boolean {
  if (kind.potentialVerbs.has(characters[at - 1] ?? "")) {
    return false;
  }
  const end = Math.min(characters.length, at + 2 + REACH);
  for (let next = at + 2; next < end; next++) {
    if (BOUNDARIES.has(characters[next] ?? "")) {
      return false;
    }
    if (kind.namedAt(characters, next)) {
      return true;
    }
  }
  return false;
}

/**
 * Whether the 得 at a position is the verb "to obtain", with 了 after it and
 * an illness, a score or a prize after that.
 *
 * 他上周被确诊得了肺炎, 他得了感冒 and 他得了几分 are all `dé le`. A verb in
 * front of the 得 would otherwise make it the particle of a potential
 * complement, and 确诊得了肺炎 came out `quèzhěn de liǎo fèiyán`.
 */
export function obtainsAt(context: EdgeContext, at: number): boolean {
  const { characters } = context;
  if (characters[at] !== "得" || characters[at + 1] !== "了") {
    return false;
  }
  return KINDS.some((kind) => namesKindAfter(characters, at, kind));
}
