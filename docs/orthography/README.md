# Orthography

Correct pinyin is not a run of syllables. It is word-spaced, capitalised and
punctuated, and 我要去北京玩儿。is `Wǒ yào qù Běijīng wánr.` rather than
`wǒ yào qù běi jīng wán er.`

```ts
convert(dictionary, "我要去北京玩儿。"); // "Wǒ yào qù Běijīng wánr."
```

Three separate things happen in that one example. 北京 groups into one word, it
capitalises as a proper noun, and 儿 attaches as an r-suffix instead of
surfacing as `er`. The reference standard is 《汉语拼音正词法基本规则》
GB/T 16159—2012, and this is a distinct pipeline stage rather than a side effect
of the decoder.

Turn the whole spacing pass off with `grouping: false`; capitals and
apostrophes have [options](../options/) of their own.

## Word spacing (分词连写)

The decoder produces words; 分词连写 decides which of them are written
together.

```ts
convert(dictionary, "他看了"); // "tā kànle" — aspect particle attaches
convert(dictionary, "走着"); // "zǒuzhe"
convert(dictionary, "我的"); // "wǒ de" — 的 stands alone
convert(dictionary, "桌子"); // "zhuōzi" — suffix attaches to its stem
convert(dictionary, "现代化"); // "xiàndàihuà"
convert(dictionary, "一个人"); // "yí gè rén" — measure word separates
convert(dictionary, "南京市"); // "Nánjīng Shì" — place generic separates
convert(dictionary, "南京市", { grouping: false }); // "Nánjīngshì"
```

Three rules survive being measured against the whole dictionary rather than
against a corpus, and those three are what is implemented:

- the aspect particles 了, 着 and 过 attaching to a verb or adjective
- a `k`-tagged suffix attaching to its stem
- the generic half of an administrative place name, where the word is tagged
  `ns` **and** the part before the generic is itself a dictionary entry

That second condition on place names is not decoration. Without it 上山下乡 is
tagged `ns` and comes apart as `Shàngshānxià Xiāng`.

### The curated list

Some spacings no rule reaches, and those live in a curated word list instead:

```ts
convert(dictionary, "不是"); // "bú shì"
convert(dictionary, "一天"); // "yì tiān"
convert(dictionary, "黄河"); // "Huáng Hé"
convert(dictionary, "中国人"); // "Zhōngguórén"
convert(dictionary, "我还给你了。"); // "Wǒ huán gěi nǐ le."
```

Each of those defeated a rule for a specific reason:

| Wanted               | Why no rule reaches it                                           |
| -------------------- | ---------------------------------------------------------------- |
| 不是 `bú shì`        | jieba tags it `c`, the same tag as 不但 `bùdàn`                  |
| 一天 `yì tiān`       | of 247 numeral+量词 candidates many are lexicalised: 大米, 层次  |
| 黄河 `Huáng Hé`      | 青海 is `Qīnghǎi` and 上海 is `Shànghǎi`; nothing separates them |
| 中国人 `Zhōngguórén` | no suffix tag marks 人, and the decode splits it                 |
| 还给 `huán gěi`      | 开会 and 睡觉 are also verb pairs and are written together       |

The list is curated, so words it does not cover are written the way the rules
leave them:

```ts
convert(dictionary, "不但"); // "búdàn"
convert(dictionary, "大米"); // "dàmǐ"
convert(dictionary, "青海"); // "Qīnghǎi"
```

### Why splitting is harder than joining

Joining what the decode separated overrides nothing — the dictionary had no
entry for the joined form, so there was no evidence either way. Splitting a
decoded word contradicts positive evidence that it _is_ one word, so it needs a
condition strong enough to survive the whole dictionary, or a listed entry with
a reason attached. That asymmetry is why the rule set is short and the list
exists.

## Hyphens (重叠)

A reduplication is one word with a boundary inside it, and GB/T 16159 marks
that boundary with a hyphen rather than a space:

```ts
convert(dictionary, "干干净净"); // "gāngān-jìngjìng"
convert(dictionary, "高高兴兴"); // "gāogāo-xìngxìng"
convert(dictionary, "研究研究"); // "yánjiū-yánjiū"
convert(dictionary, "请你休息休息。"); // "Qǐng nǐ xiūxi-xiūxi."
```

The shape is the whole of the evidence, which matters because two thirds of the
dictionary carries no part-of-speech tag: a four-character word whose halves
each double is a reduplication and essentially nothing else. Over 711,000
decoded words of Tatoeba and zh.wikipedia the AABB rule fires 66 times and all
66 are reduplications.

The repeat rule — 研究研究, 休息休息 — reads two words rather than one, because
verb reduplication is productive and 研究研究 is not a dictionary entry. It
fires 54 times over the same text and is right 46 of them; the eight misses are
a word ending one clause and starting the next, as in 告诉我们｜我们在哪里,
which nothing short of syntax separates from 讨论讨论.

Two things it deliberately does not do:

```ts
convert(dictionary, "爸爸妈妈"); // "bàba māma" — two words, not AABB
convert(dictionary, "看看"); // "kànkan" — written solid, neutral second syllable
```

爸爸妈妈 has exactly the AABB shape and is two words. What separates it from
干干净净 is that the decode produced two words rather than one, so that is the
condition — nothing in the dictionary could tell them apart, since 匆匆 and 爸爸
are both words and so are 匆忙 and 爸妈. The cost is measurable: of 43 AABB
spans arriving as two words, about 16 are reduplications the decoder split, and
those keep their space.

## Capitals

```ts
convert(dictionary, "银行"); // "yínháng", not "Yínháng"
convert(dictionary, "我要去北京。"); // "Wǒ yào qù Běijīng."
convert(dictionary, "李华"); // "Lǐ Huá"
convert(dictionary, "长江"); // "Cháng Jiāng"
convert(dictionary, "你好，世界"); // "nǐ hǎo, shìjiè"
```

Proper nouns always; the first word of a sentence only where the source is
punctuated as one. That punctuation is the only thing separating 学生 looked up
as a word from 这是我的书。written as a sentence, and a comma does not count.

Proper-noun detection comes from jieba's part-of-speech tags — `nr` person,
`ns` place, `nt` organisation, `nz` other. Personal names absent from every
dictionary are recovered from a closed surname list of about 500 entries plus
"the next one or two characters are the given name", which is what gets
`Lǐ Huá`.

Inheriting jieba's tags means inheriting its mistakes. 无缝钢管 is tagged `nz`,
so it converts as `Wúfènggāngguǎn` with a capital it has not earned.

## Apostrophes (隔音符号)

```ts
convert(dictionary, "西安"); // "Xī'ān"
convert(dictionary, "天安门"); // "Tiān'ānmén"
convert(dictionary, "女儿"); // "nǚ'ér"
convert(dictionary, "海鸥"); // "hǎi'ōu"
```

An apostrophe goes before any syllable of a word that begins with `a`, `o` or
`e` and is not the first. Those three are the complete trigger set: `i`, `u`
and `ü` surface as `y` and `w` in that position and cannot create a boundary
ambiguity.

`apostrophe: "standard"` writes it only where leaving it out would genuinely
read as something else, which is what GB/T 16159 asks for. `"always"` is the
default because that is what essentially every style guide does.

## Punctuation

`。，、；：？！` are rewritten as their Latin equivalents and take the space the
full-width glyph carried:

```ts
convert(dictionary, "北京。"); // "Běijīng."
convert(dictionary, "北京。", { punctuation: "keep" }); // "Běijīng。"
```

Brackets and quotation marks are left alone under either setting.

## 儿 and 儿化

One character, three behaviours, so this is a per-word dictionary fact rather
than a rule:

```ts
convert(dictionary, "玩儿"); // "wánr" — retroflex suffix, one syllable
convert(dictionary, "女儿"); // "nǚ'ér" — full syllable, needs an apostrophe
convert(dictionary, "儿子"); // "érzi" — full syllable, word-initial
```

The erhua flag comes from CC-CEDICT's explicit `r5` token. Source data is
unreliable here — the phrase corpus writes 玩儿 as `wán er` — which is why the
build refuses to write an artifact unless 儿化 round-trips both ways.

## What is not implemented

The standard is larger than what is built. Known gaps, all of which degrade to
something readable rather than something wrong:

| GB/T 16159 says                                           | What happens now                           |
| --------------------------------------------------------- | ------------------------------------------ |
| 成语 hyphenate 2+2: 风平浪静 → `fēngpíng-làngjìng`        | `fēngpínglàngjìng`, no hyphen              |
| 4+ syllable compounds split: 无缝钢管 → `wúfèng gāngguǎn` | `Wúfènggāngguǎn`, unsplit                  |
| 老王 → `Lǎo Wáng`                                         | `lǎo Wáng` — 老 is not treated as a prefix |

成语 is the one worth explaining, because it looks like the reduplication rule
and is not. The standard hyphenates a four-syllable idiom that can be read as
two disyllables and writes the rest solid, and no property of the dictionary
tracks that: conditioning on both halves being words fires on 10,202 of the
22,192 four-character idioms and gets 层出不穷 right while missing 风平浪静,
which are the standard's own two examples of the same rule. That is a curated
list or a source that marks the structure, not a rule.

A coverage caveat worth knowing before expecting more from the tag-conditioned
rules: 487,552 of 721,718 Han words carry no part-of-speech tag at all, since
only the jieba-sourced third of the dictionary has one. Any rule conditioned on
a tag is silently inert on two thirds of the vocabulary.
