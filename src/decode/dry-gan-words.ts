/**
 * The words the dry 干 frames in `dry-gan-frames.ts` are matched against.
 *
 * Kept apart from the frames, as the dominant readings are kept apart from
 * their rule, so each list can be read and added to on its own.
 */

/**
 * Punctuation a list of 又 pairs is broken with, as in 又红、又干.
 */
export const LIST_BREAK = new Set(["、", "，", ","]);

/**
 * The degree words that grade an adjective, in both scripts.
 *
 * 很干, 太干了, 有点干. The verb takes none of them. 这么, 那么, 这样 and 那样
 * are left out because they also say how a thing is done (你那么干会被人踢出
 * 酒吧的), and 真 because 我真干了 is the verb.
 */
export const DEGREE = new Set([
  "很",
  "太",
  "挺",
  "更",
  "最",
  "非常",
  "十分",
  "特别",
  "特別",
  "比较",
  "比較",
  "相当",
  "相當",
  "极其",
  "極其",
  "有点",
  "有點",
  "有点儿",
  "有點兒",
  "有些",
  "越来越",
  "越來越",
]);

/**
 * Verbs that 干 completes as "dry", in both scripts: 拧干, 晾不干, 烧干.
 *
 * The common ones are words already (晒干, 擦干). These are the ones the
 * dictionary does not hold as a word with 干.
 */
export const DRYING = new Set([
  "晒",
  "曬",
  "晾",
  "擦",
  "抹",
  "揩",
  "拧",
  "擰",
  "绞",
  "絞",
  "扭",
  "烧",
  "燒",
  "烤",
  "烘",
  "吹",
  "吸",
  "榨",
  "沥",
  "瀝",
  "控",
  "甩",
  "喝",
  "蒸",
  "熬",
  "哭",
  "流",
  "风",
  "風",
]);

/**
 * What can come between a drying verb and its 干: 晾不干, 擦得干.
 */
export const POTENTIAL = new Set(["不", "得"]);

/**
 * Measure words a dry thing is counted with, in both scripts: 一条干毛巾.
 *
 * A measure word in front of 干 and a noun after it make 干 the adjective,
 * since a measure word cannot count a verb.
 */
export const MEASURES = new Set([
  "条",
  "條",
  "块",
  "塊",
  "件",
  "片",
  "张",
  "張",
  "双",
  "雙",
  "根",
  "堆",
  "袋",
  "包",
  "捆",
]);

/**
 * Things that get wet and then dry, in both scripts.
 *
 * Kept to things nobody does anything to with 干: clothes, cloth, paint, ink,
 * cement, water and the bodies of water it stands in, and skin. 天, the
 * seasons, 地 and 口 are left out, because 今天干什么, 冬天干什么, 认真地干
 * and 一口干完 end in them.
 */
export const WET = new Set([
  "衣服",
  "衣裳",
  "衣物",
  "衬衫",
  "襯衫",
  "衬衣",
  "襯衣",
  "袜子",
  "襪子",
  "裤子",
  "褲子",
  "鞋子",
  "鞋",
  "毛巾",
  "床单",
  "床單",
  "被子",
  "头发",
  "頭髮",
  "拖把",
  "油漆",
  "漆",
  "墨",
  "墨水",
  "墨迹",
  "墨跡",
  "颜料",
  "顏料",
  "水泥",
  "混凝土",
  "河",
  "小河",
  "大河",
  "河水",
  "水",
  "井",
  "湖",
  "池塘",
  "泉",
  "泥",
  "土",
  "地面",
  "皮肤",
  "皮膚",
  "嘴唇",
  "喉咙",
  "喉嚨",
  "嗓子",
  "鼻子",
  "眼睛",
  "伤口",
  "傷口",
]);

/**
 * Adverbs that can stand between a wet thing and its 干, in both scripts:
 * 衣服还没干, 河都干了, 衣服总干不了, 皮肤容易干.
 */
export const BETWEEN = [
  "还没有",
  "還沒有",
  "还没",
  "還沒",
  "没有",
  "沒有",
  "已经",
  "已經",
  "一直",
  "总是",
  "總是",
  "容易",
  "终于",
  "終於",
  "很快",
  "早就",
  "全都",
  "还",
  "還",
  "没",
  "沒",
  "快",
  "都",
  "总",
  "總",
  "难",
  "難",
  "也",
  "就",
  "早",
  "全",
  "会",
  "會",
];

/**
 * What a dry thing's 干 can be followed by: the end of the sentence, a
 * particle, a potential complement or 以后. 衣服干了吗, 衣服干不了, 混凝土干了
 * 以后. Anything else after it, an object above all, is the verb.
 */
export const AFTER_WET = new Set([
  "了",
  "吗",
  "嗎",
  "呢",
  "吧",
  "啊",
  "呀",
  "不",
  "得",
  "透",
  "以",
  "后",
  "後",
  "的",
]);
