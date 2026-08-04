/**
 * The 成语 GB/T 16159 writes with a hyphen down the middle.
 *
 * 6.3.2: a four-syllable 成语 *that can be read as two disyllables* takes a
 * connecting hyphen — `fēngpíng-làngjìng` — and one that cannot is written
 * solid: `bùyìlèhū`, `chūqíbùyì`. The condition is prosodic and structural, and
 * **nothing in the data tracks it.** Conditioning on both halves being
 * dictionary words fires on 10,202 of the 22,192 four-character words jieba tags
 * `i` and is uncorrelated with the standard: it fires on 层出不穷 and not on
 * 风平浪静, which are the standard's own two examples of the same rule, and it
 * fires on 精神文明 and 凯旋归来, which want a space rather than a hyphen. No
 * source carries hyphenated pinyin either, so unlike every other claim this
 * package makes, a 成语 rule could not be scored even if one were written.
 *
 * So: a list, on the same argument as [the spaced word list](./word-list.ts).
 *
 * **What is in it, and what is not.** Only 成语 whose two halves are each a
 * self-contained disyllable — parallel halves (风平｜浪静, 千军｜万马), a
 * disyllable and its predicate (声势｜浩大), or a disyllabic stem with a
 * reduplicated tail (小心｜翼翼). Those are the ones where 2+2 is beyond doubt.
 * Anything with a monosyllabic word breaking the rhythm is left out and stays
 * solid, which is what the standard does with it anyway: 目不转睛 is 目 ｜
 * 不转睛, 迫不及待 is 迫 ｜ 不及待, 情不自禁 and 显而易见 and 名副其实 the same.
 * Left out too is anything this file is not sure of, because a missing entry
 * keeps today's output and a wrong one breaks it.
 *
 * It is not a complete 成语 list and is not meant to become one — 22,192 of them
 * exist. Measured over 88,866 lines of Tatoeba and zh.wikipedia, the 117 here
 * cover 264 of the 1,737 four-character `i`-tagged words that turn up, or
 * 15.2%. Most of what is left is either genuinely not 2+2 (据我所知, 一无所知,
 * 心不在焉, 难以置信) or not a 成语 at all (非常感谢, 重新启动, 可口可乐), which
 * is the shape a curated list should have: the cases it declines are mostly
 * cases it should decline.
 */

/**
 * 简体 forms, grouped by why the halves are halves.
 */
const HANS: readonly string[] = [
  // ── Parallel halves: 联合式, the clearest case ─────────────
  "风平浪静",
  "山清水秀",
  "千军万马",
  "千家万户",
  "千方百计",
  "四面八方",
  "四通八达",
  "七零八落",
  "大街小巷",
  "成千上万",
  "生死存亡",
  "你死我活",
  "翻来覆去",
  "无影无踪",
  "无声无息",
  "自由自在",
  "自言自语",
  "自给自足",
  "全心全意",
  "一心一意",
  "平起平坐",
  "不慌不忙",
  "所作所为",
  "咬牙切齿",
  "手忙脚乱",
  "胡思乱想",
  "横冲直撞",
  "歌功颂德",
  "耀武扬威",
  "拨乱反正",
  "提心吊胆",
  "前仆后继",
  "轻描淡写",
  "斩钉截铁",
  "讨价还价",
  "粉身碎骨",
  "惊天动地",
  "大惊小怪",
  "三心二意",
  "爱憎分明",
  "光明磊落",
  "精疲力尽",
  "新陈代谢",
  "人杰地灵",
  "错综复杂",
  "心甘情愿",
  "触目惊心",
  "遍体鳞伤",
  "气急败坏",
  "大声疾呼",
  "欢声雷动",
  "星罗棋布",
  "卧薪尝胆",
  "目瞪口呆",
  "赤手空拳",
  "破口大骂",
  "束手无策",
  "大惊失色",
  "手足无措",
  "针锋相对",
  "全力以赴",
  "举世闻名",
  "全军覆没",
  "家喻户晓",
  "想方设法",
  "独立自主",
  "不由自主",
  "自力更生",
  "艰苦奋斗",
  "心满意足",
  "不知不觉",
  "心旷神怡",
  "热血沸腾",
  "光彩夺目",
  "丰富多彩",
  "慷慨激昂",
  "声势浩大",
  "兴高采烈",
  "恶有恶报",
  "开门见山",
  "粗心大意",
  "一见钟情",
  "截然不同",
  "独一无二",
  "与众不同",
  "大错特错",
  "有朝一日",
  "吹毛求疵",
  "沉默寡言",
  "鸡毛蒜皮",
  "胡说八道",
  "了如指掌",
  "无家可归",
  "乱七八糟",
  "引人注目",
  "大吃一惊",
  "竭尽全力",
  "五脏六腑",
  "直截了当",
  "出类拔萃",
  "水落石出",
  "倾盆大雨",
  "完美无瑕",
  "层出不穷",

  // ── A disyllable with a reduplicated tail: ABCC ────────────
  "小心翼翼",
  "威风凛凛",
  "忠心耿耿",
  "杀气腾腾",
  "兴致勃勃",
  "气喘吁吁",
  "忧心忡忡",

  // ── A reduplicated head with a disyllable: AABC ────────────
  "咄咄逼人",
  "滔滔不绝",
  "念念不忘",
  "源源不断",
  "息息相关",
  "面面相觑",
];

/**
 * 繁體 spellings of the same 成语, where they differ.
 *
 * Listed rather than converted, because 繁體 is a key in its own right
 * everywhere else in this package and routing it through 简体 to look something
 * up is exactly what SCRIPTS-AND-LOCALES.md refuses to do. Every entry is
 * checked against the dictionary by a test, so a spelling that is not a real
 * word cannot sit here unnoticed.
 */
const HANT: readonly string[] = [
  "風平浪靜",
  "山清水秀",
  "千軍萬馬",
  "千家萬戶",
  "千方百計",
  "四面八方",
  "四通八達",
  "七零八落",
  "大街小巷",
  "成千上萬",
  "生死存亡",
  "你死我活",
  "翻來覆去",
  "無影無蹤",
  "無聲無息",
  "自由自在",
  "自言自語",
  "自給自足",
  "全心全意",
  "一心一意",
  "平起平坐",
  "不慌不忙",
  "所作所為",
  "咬牙切齒",
  "手忙腳亂",
  "胡思亂想",
  "橫衝直撞",
  "歌功頌德",
  "耀武揚威",
  "撥亂反正",
  "提心吊膽",
  "前仆後繼",
  "輕描淡寫",
  "斬釘截鐵",
  "討價還價",
  "粉身碎骨",
  "驚天動地",
  "大驚小怪",
  "三心二意",
  "愛憎分明",
  "光明磊落",
  "精疲力盡",
  "新陳代謝",
  "人傑地靈",
  "錯綜複雜",
  "心甘情願",
  "觸目驚心",
  "遍體鱗傷",
  "氣急敗壞",
  "大聲疾呼",
  "歡聲雷動",
  "星羅棋布",
  "臥薪嘗膽",
  "目瞪口呆",
  "赤手空拳",
  "破口大罵",
  "束手無策",
  "大驚失色",
  "手足無措",
  "針鋒相對",
  "全力以赴",
  "舉世聞名",
  "全軍覆沒",
  "家喻戶曉",
  "想方設法",
  "獨立自主",
  "不由自主",
  "自力更生",
  "艱苦奮鬥",
  "心滿意足",
  "不知不覺",
  "心曠神怡",
  "熱血沸騰",
  "光彩奪目",
  "豐富多彩",
  "慷慨激昂",
  "聲勢浩大",
  "興高采烈",
  "惡有惡報",
  "開門見山",
  "粗心大意",
  "一見鍾情",
  "截然不同",
  "獨一無二",
  "與眾不同",
  "大錯特錯",
  "有朝一日",
  "吹毛求疵",
  "沉默寡言",
  "雞毛蒜皮",
  "胡說八道",
  "瞭如指掌",
  "無家可歸",
  "亂七八糟",
  "引人注目",
  "大吃一驚",
  "竭盡全力",
  "五臟六腑",
  "直截了當",
  "出類拔萃",
  "水落石出",
  "傾盆大雨",
  "完美無瑕",
  "層出不窮",
  "小心翼翼",
  "威風凜凜",
  "忠心耿耿",
  "殺氣騰騰",
  "興致勃勃",
  "氣喘吁吁",
  "憂心忡忡",
  "咄咄逼人",
  "滔滔不絕",
  "念念不忘",
  "源源不斷",
  "息息相關",
  "面面相覷",
];

/**
 * One 成语, spelled both ways.
 *
 * The two spellings are often the same string — 山清水秀 and 三心二意 are
 * written identically in both scripts — and that is why the pair is kept rather
 * than a flat list of forms: it is what makes "every 简体 entry has the 繁體 one
 * that reads the same beside it" a checkable claim.
 */
export interface IdiomSpelling {
  readonly hans: string;
  /** Empty where the list is missing its counterpart, which a test rejects. */
  readonly hant: string;
}

/**
 * Every 成语 written with the 2+2 hyphen, paired across the two scripts.
 */
export const HYPHENATED_IDIOMS: readonly IdiomSpelling[] = HANS.map(
  (hans, at) => ({ hans, hant: HANT[at] ?? "" }),
);

/**
 * Every spelling that takes the hyphen, which is how the rule asks.
 */
export const HYPHENATED_IDIOM_FORMS: ReadonlySet<string> = new Set(
  HYPHENATED_IDIOMS.flatMap((idiom) => [idiom.hans, idiom.hant]),
);
