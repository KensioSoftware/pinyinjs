# Orthography

PinyinJS applies word spacing, capitalisation and punctuation after selecting readings. For example, 我要去北京玩儿。becomes `Wǒ yào qù Běijīng wánr.`.

```ts
convert(dictionary, "我要去北京玩儿。"); // "Wǒ yào qù Běijīng wánr."
```

In this example, 北京 forms one word and is capitalised as a place name. 儿 becomes an r-suffix on `wán`. The rules implement parts of the pinyin orthography standard, GB/T 16159-2012.

Set `grouping: false` to disable word grouping. Capitalisation and apostrophes have separate [options](../options/).

## Word spacing (分词连写)

The decoder finds words. The orthography pass then decides which neighbouring words should be joined or separated in written pinyin.

```ts
convert(dictionary, "他看了"); // "tā kànle", aspect particle attaches
convert(dictionary, "走着"); // "zǒuzhe"
convert(dictionary, "我的"); // "wǒ de", 的 stands alone
convert(dictionary, "桌子"); // "zhuōzi", suffix attaches to its stem
convert(dictionary, "现代化"); // "xiàndàihuà"
convert(dictionary, "一个人"); // "yí gè rén", measure word separates
convert(dictionary, "南京市"); // "Nánjīng Shì", place generic separates
convert(dictionary, "南京市", { grouping: false }); // "Nánjīngshì"
```

The implemented rules cover:

- the aspect particles 了, 着 and 过 attaching to a verb or adjective
- a `k`-tagged suffix attaching to its stem
- the generic half of an administrative place name, where the word is tagged
  `ns` **and** the part before the generic is itself a dictionary entry

The second condition prevents incorrect place-name splits. For example, 上山下乡 is tagged `ns`, but it should remain one word.

### The curated list

A curated word list handles spacing that cannot be determined reliably from these rules:

```ts
convert(dictionary, "不是"); // "bú shì"
convert(dictionary, "一天"); // "yì tiān"
convert(dictionary, "黄河"); // "Huáng Hé"
convert(dictionary, "中国人"); // "Zhōngguórén"
convert(dictionary, "我还给你了。"); // "Wǒ huán gěi nǐ le."
```

These entries require word-specific handling:

| Wanted               | Why no rule reaches it                                           |
| -------------------- | ---------------------------------------------------------------- |
| 不是 `bú shì`        | jieba tags it `c`, the same tag as 不但 `bùdàn`                  |
| 一天 `yì tiān`       | of 247 numeral+量词 candidates many are lexicalised: 大米, 层次  |
| 黄河 `Huáng Hé`      | 青海 is `Qīnghǎi` and 上海 is `Shànghǎi`; nothing separates them |
| 中国人 `Zhōngguórén` | no suffix tag marks 人, and the decode splits it                 |
| 还给 `huán gěi`      | 开会 and 睡觉 are also verb pairs and are written together       |

Words outside the list use the general rules:

```ts
convert(dictionary, "不但"); // "búdàn"
convert(dictionary, "大米"); // "dàmǐ"
convert(dictionary, "青海"); // "Qīnghǎi"
```

<a id="why-splitting-is-harder-than-joining"></a>

### Splitting dictionary words

A dictionary entry provides evidence that its characters form one word. Splitting it requires a specific orthographic rule or an entry in the curated list. Adjacent decoded words can also be joined when spelling rules require it.

## Hyphens (重叠)

GB/T 16159 uses a hyphen within these reduplication patterns:

```ts
convert(dictionary, "干干净净"); // "gāngān-jìngjìng"
convert(dictionary, "高高兴兴"); // "gāogāo-xìngxìng"
convert(dictionary, "研究研究"); // "yánjiū-yánjiū"
convert(dictionary, "请你休息休息。"); // "Qǐng nǐ xiūxi-xiūxi."
```

The AABB rule uses the character pattern and works without part-of-speech tags. In 711,000 decoded words from Tatoeba and Chinese Wikipedia, all 66 matches were reduplications.

Repeated two-character words, such as 研究研究 and 休息休息, can be joined with a hyphen even when the complete repetition has no dictionary entry. This rule was correct in 46 of 54 corpus matches. It can misidentify a word repeated across a clause boundary, such as 我们 in 告诉我们｜我们在哪里.

The rule excludes these cases:

```ts
convert(dictionary, "爸爸妈妈"); // "bàba māma", two words, not AABB
convert(dictionary, "看看"); // "kànkan", written solid, neutral second syllable
```

AABB must arrive from the decoder as one word. This keeps 爸爸妈妈 as two words. It can also miss reduplications that the decoder splits. About 16 of 43 corpus examples arriving as two words had that problem.

<a id="成语-from-a-list"></a>

### Idiom hyphenation

Four-syllable idioms (成语) take a hyphen when they consist of two independent two-syllable units. A curated list identifies these idioms:

```ts
convert(dictionary, "风平浪静"); // "fēngpíng-làngjìng"
convert(dictionary, "千军万马"); // "qiānjūn-wànmǎ"
convert(dictionary, "層出不窮"); // "céngchū-bùqióng", either script
convert(dictionary, "不亦乐乎"); // "búyìlèhū", cannot be halved
convert(dictionary, "目不转睛"); // "mùbùzhuǎnjīng", 目 ｜ 不转睛
```

Two dictionary matches alone cannot establish this boundary. That test also matches phrases requiring a space and misses some examples specified by the standard.

The list contains 117 idioms in both scripts and covers 15.2% of four-character idioms in the measured corpus. Unlisted idioms retain the spacing produced by the general rules.

## Capitals

```ts
convert(dictionary, "银行"); // "yínháng", not "Yínháng"
convert(dictionary, "我要去北京。"); // "Wǒ yào qù Běijīng."
convert(dictionary, "李华"); // "Lǐ Huá"
convert(dictionary, "长江"); // "Cháng Jiāng"
convert(dictionary, "你好，世界"); // "nǐ hǎo, shìjiè"
```

Dictionary-marked proper nouns are capitalised. Sentence-initial capitalisation requires sentence punctuation in the input. A comma does not start a new sentence.

Proper-noun flags come from jieba tags (`nr` for people, `ns` for places, `nt` for organisations and `nz` for other names). CC-CEDICT entries with lowercase readings can remove the flag. PinyinJS has no general name recogniser or surname list.

Only definitions with their own meaning can remove a proper-noun flag. Cross-references are excluded from that check. For example, the capitalised reference from 长寿 to 长寿区 describes the district, while the lowercase entry for 长寿 describes longevity.

```ts
convert(dictionary, "祝你健康长寿。"); // "Zhù nǐ jiànkāng chángshòu."
convert(dictionary, "长寿区在重庆。"); // "Chángshòu Qū zài Chóngqìng."
convert(dictionary, "我们的友谊很深。"); // "Wǒmen de yǒuyì hěn shēn."
```

This removed flags from 118 keys, including 友谊, 温泉 and 白云. It corrected about two thirds of the affected corpus cases. It can also remove a needed capital when a longer place name is missing from the dictionary, such as 青山公路.

If all senses are cross-references, their capitalisation is used. This applies to 2,347 flagged keys, including 三亚, 上饶 and 三门峡.

Single-character names require an additional frequency check. A character must occur more often at the start of names than in ordinary words, including its standalone occurrences. This helps distinguish a surname such as 李 from a common word that can also be a surname, such as 连.

```ts
convert(dictionary, "他连再见也不说"); // "tā lián zàijiàn yě bù shuō"
convert(dictionary, "这周我一直在工作"); // "zhè zhōu wǒ yìzhí zài gōngzuò"
convert(dictionary, "他很帅"); // "tā hěn shuài"
```

The check retains 243 of 511 single-character flags. It remains imperfect when a common character frequently starts names. For example, 福 can still be capitalised in 清心的人有福了.

`Lǐ Huá` is produced from two individually flagged characters because 李华 has no dictionary entry. The result follows dictionary tags, without recognising the full text as a person's name.

Names whose characters lack the flag may remain lowercase. This affects 42 of the first hundred surnames in 百家姓:

```ts
convert(dictionary, "李华"); // "Lǐ Huá"
convert(dictionary, "钱华"); // "qián Huá", 钱 is not flagged
convert(dictionary, "孙华"); // "sūn Huá"
convert(dictionary, "錢華"); // "qián Huá", the same gap in 繁體
```

Check name capitalisation when presenting converted text to readers.

Simplified and traditional forms share proper-noun flags derived from jieba. See [shared tags and counts](../scripts-and-locales/#tags-frequency-and-names).

Incorrect source tags can also cause unwanted capitals. For example, jieba tags 无缝钢管 as `nz`, producing `Wúfènggāngguǎn`.

### The parts of a proper name are written apart

```ts
convert(dictionary, "齐白石"); // "Qí Báishí"
convert(dictionary, "司马迁"); // "Sīmǎ Qiān", a compound surname
convert(dictionary, "马克思"); // "Mǎkèsī", a transliteration, left whole
convert(dictionary, "北京大学"); // "Běijīng Dàxué"
convert(dictionary, "上海交通大学"); // "Shànghǎi Jiāotōng Dàxué"
```

GB/T 16159 section 5.1 separates surnames from given names and proper names from generic terms. Each part is capitalised.

The decoder returns dictionary names such as 齐白石 and 北京大学 as single words. The orthography pass can then [split those words](#why-splitting-is-harder-than-joining) at boundaries recorded by CC-CEDICT.

The boundary comes from the entry itself. Surname or generic-term lists cannot reliably distinguish names such as 齐白石 from transliterations such as 马克思, or find every boundary in an organisation name.

Capital letters in CC-CEDICT's pinyin identify the boundaries:

| Entry        | CC-CEDICT pinyin                   | Divides at           |
| ------------ | ---------------------------------- | -------------------- |
| 齐白石       | `Qi2 Bai2 shi2`                    | 齐 ｜ 白石           |
| 司马迁       | `Si1 ma3 Qian1`                    | 司马 ｜ 迁           |
| 北京大学     | `Bei3 jing1 Da4 xue2`              | 北京 ｜ 大学         |
| 上海交通大学 | `Shang4 hai3 Jiao1 tong1 Da4 xue2` | 上海 ｜ 交通 ｜ 大学 |
| 马克思       | `Ma3 ke4 si1`                      | nothing, one word    |

This handles compound surnames, generic terms and transliterated names according to the source entry.

Every recorded boundary is applied. Among tagged entries with boundaries, 48% of organisations (`nt`) and 1.6% of people (`nr`) have more than one boundary.

Only `nr` and `nt` entries use this rule:

| Tag  | With a boundary | Why not                                                                                                              |
| ---- | --------------: | -------------------------------------------------------------------------------------------------------------------- |
| `ns` |           5,341 | the [place rule](#word-spacing-分词连写) has its own measured condition, and 美德 `Mei3 De2` is also `měidé`, virtue |
| `nz` |             346 | 第二次世界大战 is `Di4 er4 Ci4 Shi4 jie4 Da4 zhan4`, which divides after 第二                                        |

Across 88,866 lines from Tatoeba and Chinese Wikipedia, the rule applied 548 times to 221 distinct words. These included 304 personal names and 244 organisations.

Known source-data errors include:

- Abbreviations with too many capitalised parts. 中共中央 becomes `Zhōng Gòng Zhōngyāng`, while the intended grouping is `Zhōnggòng Zhōngyāng`.
- Transliterated names marked as Chinese names. CC-CEDICT's capitalisation makes 白求恩 (Bethune) become `Bái Qiú'ēn`.
- Missing proper-noun tags. 习近平 is tagged `nrfg` and 周恩来 is tagged `t`, so neither reaches this rule.

### 老王 is Lǎo Wáng

```ts
convert(dictionary, "我去把老王找来。"); // "Wǒ qù bǎ Lǎo Wáng zhǎo lái."
convert(dictionary, "那是小李的书。"); // "Nà shì Xiǎo Lǐ de shū."
```

The prefixes 老 and 小 are written separately and capitalised when they precede a single-character word marked as a proper noun.

大 is excluded because it often acts as an ordinary adjective. In 88,866 corpus lines, the 老 and 小 rule matched 38 forms of address across 12 distinct pairs, including 小王, 小李 and 老王.

## Apostrophes (隔音符号)

```ts
convert(dictionary, "西安"); // "Xī'ān"
convert(dictionary, "天安门"); // "Tiān'ānmén"
convert(dictionary, "女儿"); // "nǚ'ér"
convert(dictionary, "海鸥"); // "hǎi'ōu"
```

By default, an apostrophe precedes a non-initial syllable beginning with `a`, `o` or `e` within a word. Initial `i`, `u` and `ü` are written with `y` or `w` and do not need this separator.

`apostrophe: "standard"` inserts an apostrophe only when omitting it would create an ambiguous spelling, following GB/T 16159. The default is `"always"`.

## Punctuation

By default, `。，、；：？！` become Latin punctuation with the appropriate following space:

```ts
convert(dictionary, "北京。"); // "Běijīng."
convert(dictionary, "北京。", { punctuation: "keep" }); // "Běijīng。"
```

Brackets and quotation marks are left alone under either setting.

## 儿 and 儿化

The dictionary records how 儿 behaves in each word:

```ts
convert(dictionary, "玩儿"); // "wánr", retroflex suffix, one syllable
convert(dictionary, "女儿"); // "nǚ'ér", full syllable, needs an apostrophe
convert(dictionary, "儿子"); // "érzi", full syllable, word-initial
```

Erhua flags come from CC-CEDICT's explicit `r5` token. The dictionary build checks that these readings survive parsing and formatting.

<a id="where-it-stops"></a>

## Limitations

PinyinJS implements part of GB/T 16159. Known gaps include:

| GB/T 16159 says                                           | What happens now          |
| --------------------------------------------------------- | ------------------------- |
| 4+ syllable compounds split: 无缝钢管 → `wúfèng gāngguǎn` | `Wúfènggāngguǎn`, unsplit |
| 成语 outside the curated list                             | written solid, no hyphen  |

These cases require boundaries that the available dictionary data cannot reliably supply.

A compound with four or more syllables may contain several dictionary words without requiring a split in standard pinyin. Some such compounds are idioms that should remain joined or hyphenated. Part-of-speech tags are also inconsistent. PinyinJS therefore leaves these compounds intact unless a specific rule or curated entry supplies the boundary.

Rules based on part-of-speech tags cover only tagged entries. In the measured dictionary, 487,552 of 721,718 Han words had no tag. These rules cannot apply to roughly two thirds of the vocabulary.

<!-- card
```ts
convert(dictionary, "走着"); // "zǒuzhe"
convert(dictionary, "我的"); // "wǒ de"
convert(dictionary, "黄河"); // "Huáng Hé"
convert(dictionary, "看看"); // "kànkan"
```
-->
