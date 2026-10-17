/**
 * Whether a 钉 is nailing something or is a nail.
 *
 * The verb is `dìng` and the noun `dīng`. The noun stands on its own in 竹钉,
 * 一根钉 and 钉痕. The verb drives something in and says where: 钉进地里,
 * 钉在十字架上.
 */
import { type EdgeContext, wordEndingAt } from "./rules.js";
import {
  isBareAt,
  startsWithAny,
  syllableOf,
  type VerbalFrame,
} from "./verbal-frame.js";

/**
 * What follows a 钉 that is nailing: where it goes, and aspect.
 */
const COMPLEMENT = new Set([
  "在",
  "进",
  "入",
  "上",
  "住",
  "牢",
  "死",
  "紧",
  "着",
  "了",
  "到",
]);

/**
 * What is nailed, or nailed with: 钉十字架, 钉钉子.
 */
const NAILED = ["十字架", "钉子"];

/**
 * The passive marker. Nothing but the verb follows it: 被钉十字架.
 */
const PASSIVE = "被";

/**
 * Whether the 钉 at a position is nailing.
 */
function isNailingAt(context: EdgeContext, at: number): boolean {
  return (
    isBareAt(context, at + 1, COMPLEMENT) ||
    startsWithAny(context, at + 1, NAILED) ||
    wordEndingAt(context, at) === PASSIVE
  );
}

/**
 * 钉 read `dìng` where it is nailing.
 *
 * Unihan gives 釘 `dīng` alone, so only 钉 is here.
 */
export const DING_FRAME: VerbalFrame = {
  characters: new Set(["钉"]),
  reading: syllableOf("dìng"),
  boundBefore: new Set(),
  boundAfter: new Set(),
  isVerbalAt: isNailingAt,
};
