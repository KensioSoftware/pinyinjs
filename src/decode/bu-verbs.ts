/**
 * The verbs before a 不 that rule out a potential complement, and the words
 * after one that do.
 *
 * A verb that takes a clause negates it with 不 (我想不去), and 不到 before a
 * count is "fewer than" (出国不到一个月). `neutral-bu.ts` reads both.
 */
import { toCharacters } from "../script/characters.js";
import type { DecodedWord } from "./word.js";

/**
 * Verbs that take a clause, so that a 不 after them negates it.
 *
 * 我想不去, 你要不来吗, 他说不去就不去 and 保持不动: each is `bù` or `bú`.
 */
export const TAKES_CLAUSE = new Set([
  ...toCharacters("想要会會能敢肯愿願该該可得说說是让讓叫请請"),
  ...[
    "愿意 願意 应该 應該 可以 能够 能夠 打算 决定 決定 希望 准备 準備",
    "答应 答應 同意 建议 建議 保证 保證 发誓 發誓 认为 認為 以为 以為",
    "觉得 覺得 知道 相信 听说 聽說 发现 發現 记得 記得 担心 擔心",
    "假装 假裝 表示 承认 承認 保持",
  ].flatMap((line) => line.split(" ")),
]);

/**
 * What a verb before 不到 ends in where 不到 counts something short: 我们有不到
 * 五分钟 and 还有不到三个月 have fewer than five minutes and three months.
 */
export const SHORT_OF = "有";

/** The 到 of 不到. */
export const DAO = "到";

/**
 * What a count starts with, in both scripts.
 *
 * 不到 before a count is "fewer than" whatever comes before it: 出国不到一个月
 * and 在位不到两个月.
 */
const COUNT_STARTS = new Set(
  toCharacters("一二三四五六七八九十两兩半几幾百千万萬零〇0123456789"),
);

/**
 * Whether a word starts with a count.
 */
export function startsCount(word: DecodedWord | undefined): boolean {
  return COUNT_STARTS.has(toCharacters(word?.text ?? "")[0] ?? "");
}

/**
 * Complements that stay complements after a verb taking a clause.
 *
 * 说不出来 and 想不起来 are as common as any potential complement, and nobody
 * says or thinks so as not to come out.
 */
export const AFTER_CLAUSE = new Set([
  "出",
  "起",
  "出来",
  "出來",
  "起来",
  "起來",
]);

/**
 * Particles 分词连写 joins to the word before them, which a complement may be:
 * 走不动了 is written `zǒu bu dòngle`.
 */
const TRAILING_PARTICLES = new Set(toCharacters("了啦呢吗嗎吧啊呀"));

/**
 * Aspect on a verb, which says the verb is done with and the 不 is not its
 * complement: 等了不到十分钟.
 */
export const ASPECT = new Set(toCharacters("了着著过過"));

/**
 * A complement's text with any particle 分词连写 joined to it taken off.
 */
export function withoutParticles(text: string): string {
  const characters = [...toCharacters(text)];
  while (
    characters.length > 1 &&
    TRAILING_PARTICLES.has(characters.at(-1) ?? "")
  ) {
    characters.pop();
  }
  return characters.join("");
}
