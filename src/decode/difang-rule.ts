/**
 * Whether a 地方 is a place or the regions, and a 地道 the real thing or a
 * tunnel.
 *
 * The dictionary holds 地方 as `dìfang`, the place of 这个地方, and 地道 as
 * `dìdao`, the real thing of 地道的川菜, by the judgement recorded in
 * `neutral-senses.ts`. The full-tone senses are left to longer words the
 * dictionary holds (地方性, 地方法院, 地道战) and to the frames below, which
 * take the word apart so that 地 and 方 or 地 and 道 are read on their own.
 */
import { isSameSyllable } from "../dictionary/entry.js";
import { toCharacters } from "../script/characters.js";
import type { Syllable } from "../syllable/syllable.js";
import {
  type EdgeContext,
  type EdgeRule,
  type EdgeVerdict,
  wordsStartingAt,
} from "./rules.js";
import { isTunnelAt } from "./didao-frames.js";
import { syllableOf } from "./verbal-frame.js";

/** The word 地方, the same in both scripts. */
const DIFANG = "地方";

/** The word 地道, the same in both scripts. */
const DIDAO = "地道";

/** The reading of 地 as the ground, which both full-tone senses keep. */
const DI: Syllable = syllableOf("dì");

/**
 * Words after 地方 that make it the regions, as against the centre.
 *
 * 地方政府, 地方财政 and 地方官员 are local government and its money and
 * officials, and 地方媒体, 地方文化 and 地方口音 are the region's press, culture
 * and accent. Each is matched as a word of its own, and 这个地方很好 has none of
 * them after its 地方.
 */
const ADMINISTRATION = new Set(
  [
    "政府 官员 官員 官吏 长官 長官 干部 幹部 领导 領導",
    "当局 當局 机关 機關 机构 機構 部门 部門 人大",
    "政权 政權 行政 政治 统治 統治 自治 势力 勢力",
    "法规 法規 制度 选举 選舉 议会 議會 治安",
    "财政 財政 经济 經濟 税收 稅收 债务 債務 银行 銀行",
    "保护主义 保護主義",
    "媒体 媒體 报纸 報紙 新闻 新聞 电视台 電視台",
    "教会 教會 召会 召會 文化 剧种 劇種 戏曲 戲曲",
    "名产 名產 特产 特產 口音 方言",
  ].flatMap((line) => line.split(" ")),
);

/**
 * What the regions are set against: the centre (中央和地方, 从中央到地方) and
 * the army (部队和地方, where 地方 is civilian life).
 */
const COUNTERPARTS = new Set(["中央", "部队", "部隊", "军队", "軍隊"]);

/** What joins a counterpart to 地方 on either side of it. */
const JOINING = new Set(toCharacters("和与與及到同跟"));

/**
 * Words before 地方 that make it a region: 民族自治地方, and the square earth
 * of 天圆地方.
 */
const REGION_BEFORE = new Set(["自治", "天圆", "天圓"]);

/**
 * Whether the 地方 between two positions is set against a counterpart, on
 * either side of a joining word, or follows a word that makes it a region.
 */
function isAgainstCounterpart(
  characters: readonly string[],
  from: number,
  to: number,
): boolean {
  const before = characters.slice(Math.max(0, from - 3), from);
  const after = characters.slice(to, to + 3);
  const twoBefore = before.slice(-2).join("");
  return (
    REGION_BEFORE.has(twoBefore) ||
    (before.length === 3 &&
      COUNTERPARTS.has(before.slice(0, 2).join("")) &&
      JOINING.has(before[2] ?? "")) ||
    (JOINING.has(after[0] ?? "") && COUNTERPARTS.has(after.slice(1).join("")))
  );
}

/**
 * Whether the 地方 between two positions is the regions.
 */
function isRegionalAt(context: EdgeContext, from: number, to: number): boolean {
  return (
    wordsStartingAt(context, to).some((word) => ADMINISTRATION.has(word)) ||
    isAgainstCounterpart(context.characters, from, to)
  );
}

/**
 * The verdict on an edge where a word is to be taken apart and its 地 read
 * `dì`.
 *
 * The word's own edge is forbidden, and so is a lone 地 read any other way:
 * left to itself the decode reads a 地 standing alone as the particle `de`.
 */
function takeApart(
  context: EdgeContext,
  word: string,
  holds: (context: EdgeContext, from: number, to: number) => boolean,
): EdgeVerdict {
  const { characters, edge } = context;
  const to = edge.from + toCharacters(word).length;
  if (characters.slice(edge.from, to).join("") !== word) {
    return "keep";
  }
  // A longer word through the same characters is forbidden too, since in
  // these frames it can only cut into the word after: 地方官 out of 地方官员.
  if (edge.to >= to) {
    return holds(context, edge.from, to) ? "forbid" : "keep";
  }
  if (edge.to - edge.from !== 1 || !holds(context, edge.from, to)) {
    return "keep";
  }
  const [syllable] = edge.reading;
  return syllable !== undefined && isSameSyllable(syllable, DI)
    ? "force"
    : "forbid";
}

/**
 * 地方 taken apart where it is the regions.
 *
 * 地方政府 came out `dìfang zhèngfǔ`, the government of a spot. Taking the edge
 * away leaves 地 and 方 their own readings, `dì fāng`, written apart as the
 * decode leaves them.
 */
export const REGIONAL_DIFANG: EdgeRule = {
  name: "regional-difang",
  verdictFor: (context: EdgeContext) =>
    takeApart(context, DIFANG, isRegionalAt),
};

/**
 * 地道 taken apart where it is a tunnel.
 *
 * 挖地道 came out `wā dìdao`, digging the real thing. Taking the edge away
 * leaves 地 and 道 their own readings, `dì dào`.
 */
export const TUNNEL_DIDAO: EdgeRule = {
  name: "tunnel-didao",
  verdictFor: (context: EdgeContext) => takeApart(context, DIDAO, isTunnelAt),
};
