/**
 * A hanzi text and the pinyin a correct conversion should produce.
 */
export interface GoldCase {
  readonly hanzi: string;
  readonly pinyin: string;
  readonly script: "Hans" | "Hant";
  readonly locale?: "zh-CN" | "zh-TW";
  /** Categories this case exercises, for per-category reporting. */
  readonly tags: readonly string[];
}

/**
 * The gold corpus: hand-curated cases that define correct output.
 *
 * This corpus is the arbiter, not the upstream dictionaries. Several cases here
 * deliberately contradict what `large_pinyin.txt` or CC-CEDICT contain, because
 * those sources are wrong on them — 一点儿 is `yìdiǎnr`, not `yī diǎn er`, and
 * 大夫 meaning doctor is `dàifu`, not the `dà fū` both sources default to. Those
 * are tagged `source-defect`.
 *
 * Orthography (spacing, capitalisation, apostrophes) comes from GB/T
 * 16159—2012, since no dictionary source carries it.
 */
export const GOLD_CASES: readonly GoldCase[] = [
  // ── Basics ────────────────────────────────────────────────
  { hanzi: "你好", pinyin: "Nǐ hǎo", script: "Hans", tags: ["basic"] },
  { hanzi: "谢谢", pinyin: "Xièxie", script: "Hans", tags: ["basic", "neutral-tone"] },
  { hanzi: "中国", pinyin: "Zhōngguó", script: "Hans", tags: ["basic", "proper-noun"] },
  { hanzi: "学生", pinyin: "xuésheng", script: "Hans", tags: ["basic", "neutral-tone"] },
  { hanzi: "客气", pinyin: "kèqi", script: "Hans", tags: ["neutral-tone"] },

  // ── 3-3 sandhi is NOT written; underlying tones stand ──────
  { hanzi: "很好", pinyin: "hěn hǎo", script: "Hans", tags: ["sandhi-33"] },
  { hanzi: "手表", pinyin: "shǒubiǎo", script: "Hans", tags: ["sandhi-33"] },

  // ── Polyphones ────────────────────────────────────────────
  { hanzi: "银行", pinyin: "yínháng", script: "Hans", tags: ["polyphone"] },
  { hanzi: "行长", pinyin: "hángzhǎng", script: "Hans", tags: ["polyphone"] },
  { hanzi: "长城", pinyin: "Chángchéng", script: "Hans", tags: ["polyphone", "proper-noun"] },
  { hanzi: "长大", pinyin: "zhǎngdà", script: "Hans", tags: ["polyphone"] },
  { hanzi: "重要", pinyin: "zhòngyào", script: "Hans", tags: ["polyphone"] },
  { hanzi: "重复", pinyin: "chóngfù", script: "Hans", tags: ["polyphone"] },
  { hanzi: "还给", pinyin: "huán gěi", script: "Hans", tags: ["polyphone"] },
  { hanzi: "音乐", pinyin: "yīnyuè", script: "Hans", tags: ["polyphone"] },
  { hanzi: "快乐", pinyin: "kuàilè", script: "Hans", tags: ["polyphone"] },
  { hanzi: "会计", pinyin: "kuàijì", script: "Hans", tags: ["polyphone"] },
  { hanzi: "开会", pinyin: "kāihuì", script: "Hans", tags: ["polyphone"] },
  { hanzi: "睡觉", pinyin: "shuìjiào", script: "Hans", tags: ["polyphone"] },
  { hanzi: "觉得", pinyin: "juéde", script: "Hans", tags: ["polyphone", "neutral-tone"] },
  { hanzi: "大夫", pinyin: "dàifu", script: "Hans", tags: ["polyphone", "source-defect"] },
  { hanzi: "还是", pinyin: "háishi", script: "Hans", tags: ["polyphone", "source-disagreement"] },

  // ── The crossing ambiguity that actually matters ───────────
  { hanzi: "南京市长江大桥", pinyin: "Nánjīng Shì Cháng Jiāng Dàqiáo", script: "Hans", tags: ["polyphone", "segmentation", "proper-noun"] },

  // ── 儿化 ──────────────────────────────────────────────────
  { hanzi: "玩儿", pinyin: "wánr", script: "Hans", tags: ["erhua"] },
  { hanzi: "这儿", pinyin: "zhèr", script: "Hans", tags: ["erhua"] },
  { hanzi: "那儿", pinyin: "nàr", script: "Hans", tags: ["erhua"] },
  { hanzi: "哪儿", pinyin: "nǎr", script: "Hans", tags: ["erhua"] },
  { hanzi: "一点儿", pinyin: "yìdiǎnr", script: "Hans", tags: ["erhua", "sandhi-yi", "source-defect"] },
  { hanzi: "女儿", pinyin: "nǚ'ér", script: "Hans", tags: ["erhua", "apostrophe"] },
  { hanzi: "儿子", pinyin: "érzi", script: "Hans", tags: ["erhua", "neutral-tone"] },
  // Not a dictionary key, while 这边儿 and 旁边儿 are. The reading is now right
  // and the spacing is not: 边儿 is reached as a word of its own, so this is
  // `nà biānr` rather than one word with a neutral 边. A known miss.
  { hanzi: "那边儿", pinyin: "nàbianr", script: "Hans", tags: ["erhua", "rule-override"] },

  // ── 得: one character, three readings, settled by context ──
  { hanzi: "我得走了", pinyin: "wǒ děi zǒule", script: "Hans", tags: ["polyphone", "rule-override"] },
  { hanzi: "你得去", pinyin: "nǐ děi qù", script: "Hans", tags: ["polyphone", "rule-override"] },
  { hanzi: "他跑得很快", pinyin: "tā pǎo de hěn kuài", script: "Hans", tags: ["polyphone", "rule-override"] },
  { hanzi: "得到", pinyin: "dédào", script: "Hans", tags: ["polyphone"] },

  // ── 教: jiāo teaches, jiào is the noun and the compounds ──
  { hanzi: "他在北京大学教了三年书。", pinyin: "Tā zài Běijīng Dàxué jiāole sān nián shū.", script: "Hans", tags: ["polyphone", "rule-override", "sentence"] },
  { hanzi: "我教英语", pinyin: "wǒ jiāo Yīngyǔ", script: "Hans", tags: ["polyphone", "rule-override"] },
  { hanzi: "教育", pinyin: "jiàoyù", script: "Hans", tags: ["polyphone"] },
  { hanzi: "宗教", pinyin: "zōngjiào", script: "Hans", tags: ["polyphone"] },

  // ── 一 sandhi ─────────────────────────────────────────────
  { hanzi: "一个", pinyin: "yí gè", script: "Hans", tags: ["sandhi-yi"] },
  { hanzi: "一天", pinyin: "yì tiān", script: "Hans", tags: ["sandhi-yi"] },
  { hanzi: "一年", pinyin: "yì nián", script: "Hans", tags: ["sandhi-yi"] },
  { hanzi: "一起", pinyin: "yìqǐ", script: "Hans", tags: ["sandhi-yi"] },
  { hanzi: "第一", pinyin: "dìyī", script: "Hans", tags: ["sandhi-yi"] },

  // ── 不 sandhi ─────────────────────────────────────────────
  { hanzi: "不是", pinyin: "bú shì", script: "Hans", tags: ["sandhi-bu"] },
  { hanzi: "不好", pinyin: "bù hǎo", script: "Hans", tags: ["sandhi-bu"] },
  { hanzi: "不对", pinyin: "bú duì", script: "Hans", tags: ["sandhi-bu"] },
  { hanzi: "不客气", pinyin: "bú kèqi", script: "Hans", tags: ["sandhi-bu", "neutral-tone"] },

  // ── Apostrophes ───────────────────────────────────────────
  { hanzi: "西安", pinyin: "Xī'ān", script: "Hans", tags: ["apostrophe", "proper-noun"] },
  { hanzi: "天安门", pinyin: "Tiān'ānmén", script: "Hans", tags: ["apostrophe", "proper-noun"] },
  { hanzi: "可爱", pinyin: "kě'ài", script: "Hans", tags: ["apostrophe"] },
  { hanzi: "海鸥", pinyin: "hǎi'ōu", script: "Hans", tags: ["apostrophe"] },

  // ── Proper nouns and names ────────────────────────────────
  { hanzi: "北京", pinyin: "Běijīng", script: "Hans", tags: ["proper-noun"] },
  { hanzi: "上海", pinyin: "Shànghǎi", script: "Hans", tags: ["proper-noun"] },
  { hanzi: "李华", pinyin: "Lǐ Huá", script: "Hans", tags: ["proper-noun", "personal-name"] },
  { hanzi: "黄河", pinyin: "Huáng Hé", script: "Hans", tags: ["proper-noun", "orthography"] },

  // ── 姓 and 名 written apart, GB/T 16159 5.1 ────────────────
  // A dictionary entry decodes as one word, so these are a split rather than a
  // join, and the boundary comes from CC-CEDICT's own capitalisation. The
  // compound surnames are here because nothing in the rule knows they are
  // compound, and 马克思 because a transliteration must survive it whole.
  { hanzi: "毛泽东", pinyin: "Máo Zédōng", script: "Hans", tags: ["proper-noun", "personal-name"] },
  { hanzi: "毛澤東", pinyin: "Máo Zédōng", script: "Hant", tags: ["proper-noun", "personal-name", "traditional"] },
  { hanzi: "邓小平", pinyin: "Dèng Xiǎopíng", script: "Hans", tags: ["proper-noun", "personal-name"] },
  { hanzi: "李白", pinyin: "Lǐ Bái", script: "Hans", tags: ["proper-noun", "personal-name"] },
  { hanzi: "司马迁", pinyin: "Sīmǎ Qiān", script: "Hans", tags: ["proper-noun", "personal-name"] },
  { hanzi: "诸葛亮", pinyin: "Zhūgě Liàng", script: "Hans", tags: ["proper-noun", "personal-name"] },
  { hanzi: "马克思", pinyin: "Mǎkèsī", script: "Hans", tags: ["proper-noun", "personal-name"] },

  // ── 5.1's other half: a proper noun apart from its generic ─
  // Same clause and the same evidence. 上海交通大学 is here because it wants
  // two cuts, which is what 48% of organisations carrying a boundary want.
  { hanzi: "北京大学", pinyin: "Běijīng Dàxué", script: "Hans", tags: ["proper-noun", "organisation"] },
  { hanzi: "清华大学", pinyin: "Qīnghuá Dàxué", script: "Hans", tags: ["proper-noun", "organisation"] },
  { hanzi: "上海交通大学", pinyin: "Shànghǎi Jiāotōng Dàxué", script: "Hans", tags: ["proper-noun", "organisation"] },
  { hanzi: "汇丰银行", pinyin: "Huìfēng Yínháng", script: "Hans", tags: ["proper-noun", "organisation"] },

  // ── Orthography: particles, affixes, measure words ─────────
  { hanzi: "我的书", pinyin: "wǒ de shū", script: "Hans", tags: ["orthography", "particle"] },
  { hanzi: "他看了", pinyin: "tā kànle", script: "Hans", tags: ["orthography", "particle"] },
  { hanzi: "走着", pinyin: "zǒuzhe", script: "Hans", tags: ["orthography", "particle", "glyph-forms"] },
  { hanzi: "一个人", pinyin: "yí gè rén", script: "Hans", tags: ["orthography", "sandhi-yi"] },
  { hanzi: "桌子", pinyin: "zhuōzi", script: "Hans", tags: ["orthography", "neutral-tone"] },
  { hanzi: "现代化", pinyin: "xiàndàihuà", script: "Hans", tags: ["orthography"] },

  // ── 重叠: the hyphen goes inside the word ──────────────────
  { hanzi: "干干净净", pinyin: "gāngān-jìngjìng", script: "Hans", tags: ["orthography", "hyphen"] },
  { hanzi: "高高兴兴", pinyin: "gāogāo-xìngxìng", script: "Hans", tags: ["orthography", "hyphen"] },
  { hanzi: "形形色色", pinyin: "xíngxíng-sèsè", script: "Hans", tags: ["orthography", "hyphen"] },
  { hanzi: "研究研究", pinyin: "yánjiū-yánjiū", script: "Hans", tags: ["orthography", "hyphen"] },
  { hanzi: "休息休息", pinyin: "xiūxi-xiūxi", script: "Hans", tags: ["orthography", "hyphen", "neutral-tone"] },
  // 成语 that can be read as two disyllables, from the curated list.
  { hanzi: "风平浪静", pinyin: "fēngpíng-làngjìng", script: "Hans", tags: ["orthography", "hyphen"] },
  { hanzi: "千军万马", pinyin: "qiānjūn-wànmǎ", script: "Hans", tags: ["orthography", "hyphen"] },
  { hanzi: "小心翼翼", pinyin: "xiǎoxīn-yìyì", script: "Hans", tags: ["orthography", "hyphen"] },
  { hanzi: "層出不窮", pinyin: "céngchū-bùqióng", script: "Hant", tags: ["orthography", "hyphen", "traditional"] },
  // Not on the list and not 2+2: the standard writes these solid.
  { hanzi: "不亦乐乎", pinyin: "búyìlèhū", script: "Hans", tags: ["orthography", "hyphen"] },
  { hanzi: "目不转睛", pinyin: "mùbùzhuǎnjīng", script: "Hans", tags: ["orthography", "hyphen"] },

  // 爸爸妈妈 is that shape and is two words, so the hyphen must not reach it.
  { hanzi: "爸爸妈妈", pinyin: "bàba māma", script: "Hans", tags: ["orthography", "hyphen", "neutral-tone"] },
  // 看看 is a repeat too, and is written solid with a neutral second syllable.
  { hanzi: "看看", pinyin: "kànkan", script: "Hans", tags: ["orthography", "hyphen", "neutral-tone"] },

  // ── Numbers in text ───────────────────────────────────────
  { hanzi: "我有3个苹果。", pinyin: "Wǒ yǒu sān gè píngguǒ.", script: "Hans", tags: ["numbers", "sentence"] },
  { hanzi: "1988年", pinyin: "yī jiǔ bā bā nián", script: "Hans", tags: ["numbers"] },
  { hanzi: "25个", pinyin: "èrshíwǔ gè", script: "Hans", tags: ["numbers", "orthography"] },
  { hanzi: "95%的人", pinyin: "bǎifēnzhījiǔshíwǔ de rén", script: "Hans", tags: ["numbers"] },
  { hanzi: "3D打印", pinyin: "sān D dǎyìn", script: "Hans", tags: ["numbers"] },
  // The 量词 after the digits belongs to them, not to the noun behind it: 个人
  // is a common noun and 2个人 is two people. The 汉字 the digits stand for are
  // decoded with the run, so this is the same case as 两个人 written out.
  { hanzi: "我有2个人", pinyin: "wǒ yǒu liǎng gè rén", script: "Hans", tags: ["numbers", "segmentation"] },
  { hanzi: "三个人", pinyin: "sān gè rén", script: "Hans", tags: ["segmentation", "orthography"] },
  // And the words a rule firing on every character after a number would break.
  { hanzi: "5分钟", pinyin: "wǔ fēnzhōng", script: "Hans", tags: ["numbers", "segmentation"] },
  { hanzi: "第三集团军", pinyin: "dìsān jítuánjūn", script: "Hans", tags: ["segmentation"] },

  // ── Sentences ─────────────────────────────────────────────
  { hanzi: "我要去北京玩儿。", pinyin: "Wǒ yào qù Běijīng wánr.", script: "Hans", tags: ["sentence", "erhua", "proper-noun"] },
  { hanzi: "他是中国人。", pinyin: "Tā shì Zhōngguórén.", script: "Hans", tags: ["sentence", "proper-noun"] },
  { hanzi: "这是我的书。", pinyin: "Zhè shì wǒ de shū.", script: "Hans", tags: ["sentence", "particle"] },

  // ── Traditional script ────────────────────────────────────
  { hanzi: "銀行", pinyin: "yínháng", script: "Hant", tags: ["traditional", "polyphone"] },
  { hanzi: "中國", pinyin: "Zhōngguó", script: "Hant", tags: ["traditional", "proper-noun"] },
  { hanzi: "臺灣", pinyin: "Táiwān", script: "Hant", tags: ["traditional", "proper-noun"] },
  { hanzi: "學生", pinyin: "xuésheng", script: "Hant", tags: ["traditional", "neutral-tone"] },
  { hanzi: "長城", pinyin: "Chángchéng", script: "Hant", tags: ["traditional", "proper-noun"] },

  // ── The simplification merges: traditional disambiguates ───
  { hanzi: "頭髮", pinyin: "tóufa", script: "Hant", tags: ["traditional", "merge"] },
  { hanzi: "發現", pinyin: "fāxiàn", script: "Hant", tags: ["traditional", "merge"] },
  { hanzi: "萬一", pinyin: "wànyī", script: "Hant", tags: ["traditional", "merge"] },
  { hanzi: "乾淨", pinyin: "gānjìng", script: "Hant", tags: ["traditional", "merge"] },
  { hanzi: "幹部", pinyin: "gànbù", script: "Hant", tags: ["traditional", "merge"] },
  { hanzi: "麵包", pinyin: "miànbāo", script: "Hant", tags: ["traditional", "merge"] },
  { hanzi: "後來", pinyin: "hòulái", script: "Hant", tags: ["traditional", "merge"] },

  // ── Hong Kong glyph forms ─────────────────────────────────
  // 常用字字形表 against Taiwan's 教育部標準字體. Same characters, same
  // readings, different standard forms — so each of these must read exactly as
  // its Taiwan spelling does. None of them is a dictionary key: they resolve
  // because the lookup path normalises 繁體 glyph forms. See glyphs.ts.
  { hanzi: "羣眾", pinyin: "qúnzhòng", script: "Hant", tags: ["traditional", "glyph-forms"] },
  { hanzi: "麪包", pinyin: "miànbāo", script: "Hant", tags: ["traditional", "glyph-forms"] },
  { hanzi: "裏面", pinyin: "lǐmiàn", script: "Hant", tags: ["traditional", "glyph-forms"] },
  { hanzi: "衞生", pinyin: "wèishēng", script: "Hant", tags: ["traditional", "glyph-forms"] },
  { hanzi: "鑰匙", pinyin: "yàoshi", script: "Hant", tags: ["traditional", "glyph-forms"] },
  // 温 is excluded from normalisation because it is also a 简体 character. So is
  // 着, which 走着 above already covers — that case is why the rule exists.
  { hanzi: "温度", pinyin: "wēndù", script: "Hans", tags: ["glyph-forms"] },

  // ── Locale readings ───────────────────────────────────────
  { hanzi: "垃圾", pinyin: "lājī", script: "Hans", locale: "zh-CN", tags: ["locale"] },
  { hanzi: "垃圾", pinyin: "lèsè", script: "Hant", locale: "zh-TW", tags: ["locale"] },
  // The compound no source marks. CC-CEDICT annotates 垃圾 and 垃圾桶 and stops,
  // and the decoder prefers the longer word, so 垃圾分類 used to read `lājī` in
  // 國語 and the locale switch looked like it did nothing.
  { hanzi: "垃圾分類", pinyin: "lājīfēnlèi", script: "Hant", locale: "zh-CN", tags: ["locale"] },
  { hanzi: "垃圾分類", pinyin: "lèsèfēnlèi", script: "Hant", locale: "zh-TW", tags: ["locale"] },
  { hanzi: "亞洲", pinyin: "Yàzhōu", script: "Hant", locale: "zh-CN", tags: ["locale", "proper-noun"] },
  // A character's delta that was a choice between its 普通话 senses. 地 is `dì`
  // when it means the ground and `de` as the adverbial particle, in Taipei as
  // much as in Beijing; 都 is `dū` only as the capital city.
  { hanzi: "從容地", pinyin: "cōngróng de", script: "Hant", locale: "zh-TW", tags: ["locale", "particle"] },
  { hanzi: "他都知道", pinyin: "tā dōu zhīdào", script: "Hant", locale: "zh-TW", tags: ["locale", "polyphone"] },
  // What a real delta looks like beside them.
  { hanzi: "他和我", pinyin: "tā hàn wǒ", script: "Hant", locale: "zh-TW", tags: ["locale"] },
];
