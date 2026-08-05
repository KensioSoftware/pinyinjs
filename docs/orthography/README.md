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

### 成语, from a list

The same hyphen goes down the middle of a four-syllable 成语 — but only one that
can be read as two disyllables. The rest are written solid, and which is which
comes from a curated list:

```ts
convert(dictionary, "风平浪静"); // "fēngpíng-làngjìng"
convert(dictionary, "千军万马"); // "qiānjūn-wànmǎ"
convert(dictionary, "層出不窮"); // "céngchū-bùqióng" — either script
convert(dictionary, "不亦乐乎"); // "búyìlèhū" — cannot be halved
convert(dictionary, "目不转睛"); // "mùbùzhuǎnjīng" — 目 ｜ 不转睛
```

No rule reaches this. Conditioning on both halves being dictionary words fires
on 10,202 of the 22,192 four-character idioms and is uncorrelated with the
standard's criterion: it fires on 层出不穷 and not on 风平浪静, which are the
standard's own two examples of the same rule, and it fires on 精神文明 and
凯旋归来, which want a space. No source carries hyphenated pinyin either, so
unlike everything else here a rule could not even be scored.

The list holds 117 idioms in both scripts — the ones whose two halves are each a
self-contained disyllable, where 2+2 is beyond doubt. Measured on Tatoeba and
zh.wikipedia it covers 15.2% of the four-character idioms that actually turn up;
most of the remainder are either genuinely not 2+2 (据我所知, 心不在焉) or not
成语 at all (非常感谢, 可口可乐). An idiom the list does not carry is written the
way it was before, which is also what the standard does with the ones it cannot
halve.

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

A proper noun is a flag on a dictionary entry, set from jieba's part-of-speech
tags — `nr` person, `ns` place, `nt` organisation, `nz` other — and demoted
again where CC-CEDICT writes the headword's pinyin in lower case. There is no
name rule of any kind: no surname list, and nothing that looks at what follows
a surname.

`Lǐ Huá` falls out of the dictionary being consulted a character at a time.
李华 is not an entry, so it decodes as two single-character words, and 李 and 华
each carry the flag on their own — 李 tagged `nr`, and 华 tagged `ns`, a place
name rather than anything about given names. Both capitals and the space
between them come from that, not from recognising a person.

Which means it works where the characters happen to be flagged and nowhere
else, and the gaps are easy to find. 42 of the first hundred 百家姓 surnames
carry no flag at all, so the surname loses its capital:

```ts
convert(dictionary, "李华"); // "Lǐ Huá"
convert(dictionary, "钱华"); // "qián Huá" — 钱 is not flagged
convert(dictionary, "孙华"); // "sūn Huá"
convert(dictionary, "李華"); // "Lǐ huá" — 華 is not flagged where 华 is
```

A surname list would capitalise all four of those. That the last three come out
this way is what says there is not one.

Inheriting jieba's tags means inheriting its mistakes in the other direction
too. 无缝钢管 is tagged `nz`, so it converts as `Wúfènggāngguǎn` with a capital
it has not earned.

### The parts of a proper name are written apart

```ts
convert(dictionary, "毛泽东"); // "Máo Zédōng"
convert(dictionary, "司马迁"); // "Sīmǎ Qiān" — a compound surname
convert(dictionary, "马克思"); // "Mǎkèsī" — a transliteration, left whole
convert(dictionary, "北京大学"); // "Běijīng Dàxué"
convert(dictionary, "上海交通大学"); // "Shànghǎi Jiāotōng Dàxué"
```

GB/T 16159 5.1 writes 姓 apart from 名, **and** a proper noun apart from its
generic, each part capitalised. Both halves of that clause are one rule here,
because the evidence for them is the same evidence.

毛泽东 and 北京大学 are dictionary entries, though, so the decoder produces
**one** word each — and reading them as one word is what makes them read
correctly at all. That makes this a split, and [splitting
contradicts](#why-splitting-is-harder-than-joining) the dictionary's own claim
that the characters belong together.

The obvious conditions are not good enough. A surname list takes 马克思, 高尔基,
巴赫 and 牛顿 apart, not one of which is a Chinese name — the shape is identical
to 毛 + 泽东. And a list of generics cannot say where 上海浦东发展银行 divides.

**The condition is CC-CEDICT's own capitalisation, which states the boundary
instead of leaving it to be inferred:**

| Entry        | CC-CEDICT pinyin                   | Divides at           |
| ------------ | ---------------------------------- | -------------------- |
| 毛泽东       | `Mao2 Ze2 dong1`                   | 毛 ｜ 泽东           |
| 司马迁       | `Si1 ma3 Qian1`                    | 司马 ｜ 迁           |
| 北京大学     | `Bei3 jing1 Da4 xue2`              | 北京 ｜ 大学         |
| 上海交通大学 | `Shang4 hai3 Jiao1 tong1 Da4 xue2` | 上海 ｜ 交通 ｜ 大学 |
| 马克思       | `Ma3 ke4 si1`                      | none — one word      |

So a compound surname is recognised without a list of compound surnames, a
generic without a list of generics, and a transliteration is excluded without a
list of transliterations. It is the same source and the same signal that already
vetoes jieba's proper-noun tags, extended from _whether_ a word is a proper noun
to _where_ its parts divide.

**Every stated boundary is cut, not only the first**, which is what separates an
organisation from a person: **48% of `nt` entries carrying a boundary carry more
than one**, against 1.6% of `nr`. One cut would leave 上海交通大学 as
`Shànghǎi Jiāotōngdàxué`.

A tag is still required, because the mark is not confined to what 5.1 covers.
The rule takes `nr` and `nt` and no others:

| Tag  | With a boundary | Why not                                                                                                              |
| ---- | --------------: | -------------------------------------------------------------------------------------------------------------------- |
| `ns` |           5,341 | the [place rule](#word-spacing-分词连写) has its own measured condition, and 美德 `Mei3 De2` is also `měidé`, virtue |
| `nz` |             346 | 第二次世界大战 is `Di4 er4 Ci4 Shi4 jie4 Da4 zhan4`, which divides after 第二                                        |

Measured over 88,866 lines of Tatoeba and zh.wikipedia the rule fires **548
times over 221 distinct words** — 304 personal names and 244 organisations — and
nearly all are a boundary the standard wants: 蒋介石, 孙中山, 诸葛亮, 夏目漱石,
中国共产党, 汇丰银行, 黄埔军校, 中国社会科学院, and 富士山 → `Fùshì Shān` among
the words jieba calls a name and CC-CEDICT still marks.

Three things it gets wrong, all inherited:

- **An abbreviation whose every element is capitalised.** 中共中央 is
  `Zhong1 Gong4 Zhong1 yang1`, so it divides at each character and comes out
  `Zhōng Gòng Zhōngyāng` rather than `Zhōnggòng Zhōngyāng`. **22 of the 244
  organisation firings** have this shape. A "no one-character part" condition
  would fix it and destroy the personal names, where a one-character 姓 is the
  norm — 74.6% of `nr` entries with a boundary have one.
- **A transliteration CC-CEDICT capitalised as though it were a Chinese name.**
  白求恩 is `Bai2 Qiu2 en1`, so Bethune comes out `Bái Qiú'ēn`.
- **Names the tag misses entirely.** 习近平 is tagged `nrfg` and 周恩来 `t`,
  neither of which counts as a proper noun, so both convert with no capital at
  all — `xíjìnpíng` and `zhōu'ēnlái` — and never reach this rule. That is a
  tagging gap rather than a boundary one.

### 老王 is Lǎo Wáng

```ts
convert(dictionary, "我去把老王找来。"); // "Wǒ qù bǎ Lǎo Wáng zhǎo lái."
convert(dictionary, "那是小李的书。"); // "Nà shi Xiǎo Lǐ de shū."
```

GB/T 16159 writes the 称呼语 in front of a surname apart and with a capital of
its own. The words were already apart; what was missing was the capital, so the
rule marks the prefix a proper noun and lets the writer do what it already does
with one.

The surname is the evidence: a one-character word the dictionary marks a proper
noun is what 老 and 小 attach to. **大 is deliberately not included.** It is
written the same way in 大李, but it is also an ordinary adjective in front of
anything at all, and it is the one that goes wrong — over 88,866 lines the three
prefixes fire 49 times together and both clear mistakes are 大, in 泡大池 (a big
pool) and 那头大熊 (a big bear). Without it the rule fires **38 times over 12
distinct pairs** — 小王, 小李, 老王, 小丁 and eight more — and every one of them
read in context is a real form of address, including 小萨米·戴维斯, where 小 is
doing the work of "Jr".

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

| GB/T 16159 says                                           | What happens now          |
| --------------------------------------------------------- | ------------------------- |
| 4+ syllable compounds split: 无缝钢管 → `wúfèng gāngguǎn` | `Wúfènggāngguǎn`, unsplit |
| 成语 outside the curated list                             | written solid, no hyphen  |

Both are gaps by decision rather than by omission, and the decision is
measured.

**Splitting a 4+ syllable compound needs to know where the boundary is, and the
only evidence available is uncorrelated with the standard.** Over 88,866 lines
the decoder produces 9,210 words of four syllables or more, 4,462 of them
distinct. Asking whether the word cuts into two dictionary words — the same
condition the 成语 hyphen rejected — leaves 58.11% with exactly one cut, 4.62%
with several and 37.27% with none. And that one cut is the standard's boundary
only about a fifth of the time: of the 2,593 one-cut words, **20.83% are tagged
`i` and 16.08% `l`** — 成语 and 习语, which the standard writes solid or
hyphenates, so splitting them would be actively wrong — against 21.91% tagged
`n`, the nouns 6.1.6 is actually about. A further **21.52% carry no tag at all**,
which is the caveat below arriving in practice. Conditioning on `n` looks better
in a sample and still fires on 登峰造极 and 天马行空, both 成语 that jieba tags
`n`. Since splitting a decoded word overrides positive evidence that it is one
word, that is not a strong enough condition and the rule is not written.

A coverage caveat worth knowing before expecting more from the tag-conditioned
rules: 487,552 of 721,718 Han words carry no part-of-speech tag at all, since
only the jieba-sourced third of the dictionary has one. Any rule conditioned on
a tag is silently inert on two thirds of the vocabulary.

<!-- card
```ts
convert(dictionary, "走着"); // "zǒuzhe"
convert(dictionary, "我的"); // "wǒ de"
convert(dictionary, "黄河"); // "Huáng Hé"
convert(dictionary, "看看"); // "kànkan"
```
-->
