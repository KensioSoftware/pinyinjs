/**
 * The titles that follow a surname.
 */

/**
 * The kinship terms a child uses for a parent or a grandparent.
 *
 * 王奶奶 and 马奶奶 are neighbours, called by their surnames. Children's
 * stories call animal parents the same way, and 熊妈妈 is a mother bear, so
 * these terms do not make a name of {@link STORY_ANIMALS}.
 */
export const FAMILY_TITLES: ReadonlySet<string> = new Set([
  "奶奶",
  "爷爷",
  "爺爺",
  "妈妈",
  "媽媽",
  "爸爸",
]);

/**
 * The surname characters that are also an animal a story calls 熊妈妈.
 */
export const STORY_ANIMALS: ReadonlySet<string> = new Set(["熊"]);

/**
 * The words that say the character before them is a surname.
 *
 * Forms of address, kinship terms and job titles, in both scripts. 某 and 氏
 * are here too (王某, 陈氏), and so are the 小二 of an inn and the 麻子 of a
 * pockmarked man, which name a person in sayings such as 王小二开饭店 and
 * 王麻子的剪刀. 小二 decodes as 小 and 二, so it is matched across two words.
 */
export const SURNAME_TITLES: ReadonlySet<string> = new Set([
  "先生",
  "小姐",
  "女士",
  "太太",
  "夫人",
  "老师",
  "老師",
  "同学",
  "同學",
  "教授",
  "医生",
  "醫生",
  "大夫",
  "师傅",
  "師傅",
  "经理",
  "經理",
  "主任",
  "老板",
  "老闆",
  "阿姨",
  "叔叔",
  "大爷",
  "大爺",
  "大妈",
  "大媽",
  "大哥",
  "大姐",
  "大娘",
  "大婶",
  "大嬸",
  "大叔",
  "大嫂",
  "嫂子",
  "伯伯",
  "婆婆",
  "小二",
  "麻子",
  "教头",
  "教頭",
  "校长",
  "校長",
  "局长",
  "局長",
  "主席",
  "总统",
  "總統",
  "警官",
  "律师",
  "律師",
  "博士",
  "将军",
  "將軍",
  "同志",
  "护士",
  "護士",
  "秘书",
  "秘書",
  "书记",
  "書記",
  "市长",
  "市長",
  "部长",
  "部長",
  "院长",
  "院長",
  "队长",
  "隊長",
  "总理",
  "總理",
  "某",
  "氏",
  ...FAMILY_TITLES,
]);
