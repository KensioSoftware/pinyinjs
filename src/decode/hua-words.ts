/**
 * The words {@link import("./hua-rule.js").NOUN_HUA} reads the context of a
 * 的话 by, in both scripts.
 */

/** The two writings of the word, which are all this rule looks at. */
export const DE_HUA = new Set(["的话", "的話"]);

/**
 * What follows the noun 话 and cannot follow the conditional.
 *
 * A conditional clause is followed by the clause it conditions, so it is never
 * the thing a 吗 asks about and has no inside for 里 to name: 出来的话吗,
 * 他的话里有文章.
 */
export const AFTER_NOUN = new Set(["吗", "嗎", "里", "裡", "裏"]);

/** The verbs of speaking whose object 话 is: 说的话, 讲过的话. */
export const SPEAKING = new Set(["说", "說", "讲", "講"]);

/**
 * Words ending in a verb of speaking that are not that verb.
 *
 * 听讲 is attending a lecture and 小说 is a novel, and 去听讲的话 is a
 * conditional.
 */
export const NOT_SPEAKING = new Set([
  "听讲",
  "聽講",
  "演讲",
  "演講",
  "听说",
  "聽說",
  "小说",
  "小說",
]);

/**
 * What asks for an opinion before 我说, 要我说的话 being *if you ask me*.
 */
export const ASKING = new Set(["要", "依", "让", "讓"]);

/**
 * What can stand between a verb of speaking and the 的 of its object.
 *
 * 过, 出来, 了 and 不完 are the verb's own, and 所 makes the verb the modifier.
 */
export const SPEAKING_TAIL = new Set([
  "过",
  "過",
  "出",
  "来",
  "來",
  "了",
  "不",
  "完",
]);

/**
 * The manners a speaker can ask after, which make 说的话 the conditional.
 *
 * 我这么说的话是不是像个傻瓜 is *if I put it like this*, and the 说 here is
 * saying it that way rather than saying the words.
 */
export const MANNER = new Set([
  "这么",
  "這麼",
  "那么",
  "那麼",
  "这样",
  "這樣",
  "那样",
  "那樣",
]);

/**
 * The modifiers that pick out words of a kind after a verb of speaking.
 *
 * 说这样的话 is saying such things, where 这样的话 alone is *in that case*.
 */
export const KIND = new Set([
  ...MANNER,
  "同样",
  "同樣",
  "这种",
  "這種",
  "那种",
  "那種",
]);

/**
 * The pronouns that make 的话 someone's words: 他的话, 听妈妈的话.
 *
 * Personal pronouns only. 这样 is tagged a pronoun as well, and 这样的话 is the
 * conditional far more often than it is anything else.
 */
export const PERSONS = new Set([
  "我",
  "你",
  "他",
  "她",
  "您",
  "我们",
  "我們",
  "你们",
  "你們",
  "他们",
  "他們",
  "她们",
  "她們",
  "咱们",
  "咱們",
  "别人",
  "別人",
  "人家",
  "大家",
]);

/** The tags of a noun that can own its words: 老师, 汤姆. */
export const OWNER_TAGS = /^(?:n|nr|nrfg|nrt)$/u;

/**
 * The verbs whose object is somebody's words, 听他的话 and 相信你的话.
 *
 * Each takes what was said rather than an action, which is why 帮助我的话 and
 * 陪我的话 stay conditional while 相信我的话 does not. 把, 对 and 因为 are in for
 * the same reason: 把你的话转告给他, 对我的话充耳不闻 and 因为他的话 have the
 * words as their object.
 */
export const RECEIVING = new Set([
  "听",
  "聽",
  "听见",
  "聽見",
  "听到",
  "聽到",
  "听从",
  "聽從",
  "聆听",
  "聆聽",
  "相信",
  "怀疑",
  "懷疑",
  "收回",
  "引用",
  "回味",
  "转告",
  "轉告",
  "听懂",
  "聽懂",
  "听不懂",
  "聽不懂",
  "判断",
  "判斷",
  "印证",
  "印證",
  "证实",
  "證實",
  "记得",
  "記得",
  "因为",
  "因為",
  "照",
  "把",
  "对",
  "對",
]);

/** What can negate a receiving verb inside a word of its own: 不听, 没听. */
export const NEGATION = /^[不没沒]/u;

/** The characters a receiving verb can carry before its object: 听了, 听完了. */
export const RECEIVING_TAIL = new Set(["了", "完"]);

/**
 * When the words were said, which a conditional cannot be about: 刚才的话.
 */
export const EARLIER = new Set(["刚才", "剛才", "刚刚", "剛剛"]);

/**
 * The adjectives that describe what was said, 刻薄的话 and 难听的话.
 *
 * Only adjectives that hardly describe a person or a state. 你累的话 and
 * 你无聊的话 are conditionals, so 累 and 无聊 stay out.
 */
export const OF_SPEECH = new Set([
  "刻薄",
  "卑鄙",
  "愚蠢",
  "蠢",
  "难听",
  "難聽",
  "好听",
  "好聽",
  "动听",
  "動聽",
  "中听",
  "中聽",
  "粗鲁",
  "粗魯",
  "粗俗",
  "下流",
  "肉麻",
  "恶毒",
  "惡毒",
  "刺耳",
  "尖酸",
  "伤人",
  "傷人",
]);

/** The degree an adjective of speech can carry: 很蠢, 最愚蠢, 这么卑鄙. */
export const DEGREE = new Set([
  "很",
  "最",
  "更",
  "太",
  "多么",
  "多麼",
  "如此",
  ...MANNER,
]);

/**
 * The verbs of explaining that follow the words something is put in:
 * 用通俗的话解释, 用简练的话介绍.
 */
export const EXPLAINING = [
  "解释",
  "解釋",
  "介绍",
  "介紹",
  "说",
  "說",
  "讲",
  "講",
  "表达",
  "表達",
  "描述",
  "概括",
  "回答",
  "写",
  "寫",
];
