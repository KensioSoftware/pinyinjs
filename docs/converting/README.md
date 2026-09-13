# Converting

`convert` takes a loaded dictionary and Chinese text and returns a pinyin string.

```ts
convert(dictionary, "银行"); // "yínháng"
convert(dictionary, "行长"); // "hángzhǎng"
convert(dictionary, "我要去北京。"); // "Wǒ yào qù Běijīng."
convert(dictionary, "3D银行"); // "sān D yínháng", the digit is read, the letter is not
```

Call `convert(dictionary, text, options?)`. The third argument controls formatting and reading selection. See [options](../options/) for the full reference.

<a id="readings-you-assert-yourself"></a>

## Custom readings

Use the `readings` option when your application knows the intended pronunciation. This is useful for ambiguous text, names or domain-specific vocabulary:

```ts
convert(dictionary, "这篇文章不太长。", { readings: { 太长: "tài cháng" } });
```

For reusable word corrections, pass an object mapping text to pinyin:

```ts
const CORRECTIONS = { 太长: "tài cháng", 长头发: "cháng tóufa" };
convert(dictionary, text, { locale: "zh-CN", readings: CORRECTIONS });
```

A word hint applies to the exact text it names. It leaves longer dictionary words containing that text unchanged:

```ts
convert(dictionary, "校长", { readings: { 长: "cháng" } }); // "xiàozhǎng"
```

To override a longer word, include the whole word in the hint. Its word boundary is preserved:

```ts
convert(dictionary, "银行", { readings: { 银行: "yín xíng" } }); // "yínxíng"
```

A positional hint overrides one character, including its reading inside a longer word. Positions count Unicode code points from the start of the original input, including non-Han text. Each positional hint supplies one syllable:

```ts
convert(dictionary, "头发越长越漂亮", {
  readings: [{ at: 3, reading: "cháng" }],
});
convert(dictionary, "校长", { readings: [{ at: 1, reading: "cháng" }] }); // "xiàocháng"
```

The list form accepts both word and positional hints. An unmarked syllable means neutral tone, so `{ 的: "de" }` specifies the particle. Hints change readings without changing word spacing. Invalid pinyin in a hint throws an error.

## Non-Han text

Latin letters and other non-Han text are preserved, subject to the number and punctuation settings below.

```ts
convert(dictionary, "3D银行"); // "sān D yínháng"
convert(dictionary, "1998年"); // "yī jiǔ jiǔ bā nián"
convert(dictionary, "3D银行", { numbers: "keep" }); // "3Dyínháng"
```

Numbers are expanded before surrounding Chinese text is decoded. Their spoken form provides context for word boundaries and reading rules. For example, `2个人` is decoded with the context of 两个人 and becomes `liǎng gè rén`.

Context is available on both sides of the number. In 那条河长300公里, the measurement can therefore select the adjectival reading of 长.

```ts
convert(dictionary, "那条河长300公里。"); // "Nà tiáo hé cháng sānbǎi gōnglǐ."
convert(dictionary, "那条河长三百公里。"); // "Nà tiáo hé cháng sānbǎi gōnglǐ."
```

Lookahead extends up to four characters after the number.

The following characters determine how a number is read. For example, 1998年 spells out the digits, while 3个 reads a quantity. See [numbers](../numerals/) for the rules and limitations. Set `numbers: "keep"` to preserve the original digits.

When a number is spoken, adjacent Latin text is spaced accordingly. This gives `3D银行` an extra space that is absent under `numbers: "keep"`.

By default, `。，、；：？！` become their Latin equivalents. See [punctuation](../orthography/#punctuation) for the settings.

## Spacing, capitals and apostrophes

`convert` applies word spacing, capitalisation and apostrophes after selecting readings. Apostrophes mark potentially ambiguous syllable boundaries.

```ts
convert(dictionary, "他看了"); // "tā kànle"
convert(dictionary, "南京市"); // "Nánjīng Shì"
convert(dictionary, "天安门"); // "Tiān'ānmén"
```

See [orthography](../orthography/) for the spelling rules and known limitations.

<a id="getting-more-than-a-string-back"></a>

## Structured output

| You want                               | Use                                                   |
| -------------------------------------- | ----------------------------------------------------- |
| the pinyin                             | `convert`                                             |
| one piece at a time, with confidence   | `convertPieces`, [confidence](../confidence/)         |
| marked-up HTML                         | `convertToHtml`, [HTML output](../html/)              |
| what the dictionary holds for one word | `dictionary.lookup`, [dictionaries](../dictionaries/) |

`convertPieces` returns individual syllables with confidence information. You can render them with `toHtml` or combine them with `joinPieces`. `convertToHtml` is equivalent to `toHtml(convertPieces(…))`, and `joinPieces(convertPieces(…))` produces the same text as `convert`.

`convert` avoids calculating alternative-reading costs. Use it for a string result. Use `convertPieces` when you need per-syllable data or confidence information. Calculating alternatives takes about 1.5 times the work of a plain conversion.

<a id="why-the-word-is-the-unit"></a>

## Word context

Characters can have several readings. 行 has `xíng`, `háng`, `héng` and `hàng`. The surrounding word determines the appropriate reading. For example, 银行 is `yínháng` and 行长 is `hángzhǎng`.

Selecting readings also requires finding word boundaries. 南京市长江大桥 can be split as 南京市 / 长江 / 大桥 or 南京 / 市长 / 江大桥. The two splits give 长 different readings (`cháng` and `zhǎng`).

<a id="what-the-decoder-does"></a>

## How the decoder selects readings

The decoder builds a lattice, a graph containing every dictionary word that matches at each position. Each edge represents a word and its reading. A path through the graph represents one way to segment and read the text.

```
input
  └─ run splitting        Han runs against everything else
  └─ lattice build        every dictionary match per position
  └─ reading projection   collapse edges by reading; lock settled positions
  └─ shortest path        scored decode over the unlocked stretches only
  └─ orthography          grouping, capitals, apostrophes, punctuation
  └─ sandhi               a typed pass over the syllable array
  └─ formatting           diacritics, digits, superscripts or HTML
```

A position is locked when every candidate path gives it the same reading. About two thirds of positions in running text are locked. The decoder searches for the lowest-cost path through the remaining stretches, which are typically two to six characters long.

Different word boundaries can produce the same reading. For example, 研究生 / 命 and 研究 / 生命 give the same syllables but different spacing. Reading accuracy and word spacing are therefore separate concerns.

Use [confidence](../confidence/) information to identify positions where the decoder chose among alternative readings.

<a id="rules-where-the-cost-model-cannot-reach"></a>

## Context rules

Context rules remove incompatible readings before the decoder scores the graph. They use surrounding words and grammatical patterns. A rule can remove a dictionary candidate but cannot introduce a new reading.

```ts
convert(dictionary, "我得走了"); // "wǒ děi zǒule", modal
convert(dictionary, "他跑得很快"); // "tā pǎo de hěn kuài", particle
convert(dictionary, "他得到了"); // "tā dédàole", the word decides
```

### 得 as a modal verb

得 has three readings. Its default is the neutral-tone particle `de`. The rule selects a modal reading when 得 follows a pronoun, adverb or time word and precedes a verb phrase. A particle 得 normally attaches to the preceding verb or adjective.

### 教 as a verb

The rule selects `jiāo` when 教 means to teach. Its default character reading is `jiào`:

```ts
convert(dictionary, "他在北京大学教了三年书。"); // "Tā zài Běijīng Dàxué jiāole sān nián shū."
convert(dictionary, "我教英语"); // "wǒ jiāo Yīngyǔ"
convert(dictionary, "教育"); // "jiàoyù", and 宗教 is `zōngjiào`
```

Dictionary compounds keep their own readings. For standalone 教, a following pronoun, noun, name or aspect particle supports the verb reading. A preceding modal or negator can also select it when there is no object:

```ts
convert(dictionary, "他怎么教，我都学不会。"); // "Tā zěnme jiāo, wǒ dōu xué búhuì."
convert(dictionary, "这在学校是不教的"); // "zhè zài xuéxiào shì bù jiāo de"
```

In 88,866 lines, the rule changed 162 of 181 standalone 教 readings, with three incorrect changes. The exceptions were nominal compounds that resembled verbs with objects. 有 is excluded from the modal set to preserve 有教无类 (`yǒujiào wúlèi`).

### Dictionary-supported erhua

The rule joins 儿 to the preceding syllable when their dictionary entry specifies an r-suffix:

```ts
convert(dictionary, "那边儿"); // "nà biānr", not "nàbian ér"
convert(dictionary, "女儿"); // "nǚ'ér", a syllable of its own, and stays one
```

The dictionary marks 2,009 of 2,067 words ending in 儿 as erhua. A recognised ending such as 边儿 can supply the suffix even when the complete word, such as 那边儿, is missing. This fixes the reading but may leave an extra word boundary because the complete word has no entry.

### Counted measure words

A measure word (量词) following a number is kept separate from the next word:

```ts
convert(dictionary, "三个人"); // "sān gè rén", three people
convert(dictionary, "个人"); // "gèrén", the word, with nothing counting
convert(dictionary, "五分钟"); // "wǔ fēnzhōng", untouched
```

For example, 三个人 contains 三 + 个 + 人. The rule prevents the noun 个人 from absorbing the measure word 个. It uses dictionary tags for 个, 次, 天 and 杯. Other tags protect words such as 五分钟, 三部分, 五成分 and 五年级. Ordinals such as 第三集团军 and numerals inside words such as 唯一道路 are excluded.

In 88,866 lines, this changed 53 conversions, with three incorrect changes where a numeral-like prefix was not counting. It corrected one pronunciation, the 天 in 下了两天雨.

### 长 as an adjective

The rule selects `cháng` when context indicates length, including a preceding degree adverb:

```ts
convert(dictionary, "这篇文章不太长。"); // "Zhè piān wénzhāng bú tài cháng."
convert(dictionary, "要多长时间"); // "yào duō cháng shíjiān"
convert(dictionary, "她长得很漂亮"); // "tā zhǎng de hěn piàoliang", growing
convert(dictionary, "校长"); // "xiàozhǎng", through the word
```

The default character reading is `zhǎng`. This is appropriate for titles such as 署长 and 团长. The rule supplies `cháng` for standalone adjectival uses that lack a dictionary word.

Adverbs such as 很, 太, 最 and 多 indicate an adjective. The rule excludes ambiguous patterns involving 得, 着 and 越…越, including 真长得很快 and 越长越高. Sentence-final 了 and attributive 的 remain eligible, as in 时间太长了 and 很长的道路.

Following comparisons, intensifiers, conjunctions and measurements can also indicate length:

```ts
convert(dictionary, "长一点"); // "cháng yìdiǎn"
convert(dictionary, "队伍已经长极了"); // "duìwǔ yǐjīng cháng jíle"
convert(dictionary, "神经棘长而狭窄"); // "shénjīng jí cháng ér xiázhǎi"
convert(dictionary, "那条河长三百公里"); // "nà tiáo hé cháng sānbǎi gōnglǐ"
convert(dictionary, "那条河长300公里"); // "nà tiáo hé cháng sānbǎi gōnglǐ"
```

Measurements must express distance or duration. A number alone is insufficient because it may count something else, as in 新长两个校区 or 总会长一职.

Some patterns require context on both sides:

```ts
convert(dictionary, "那座桥不长。"); // "Nà zuò qiáo bù cháng."
convert(dictionary, "胡子不长在前额上"); // "húzi bù zhǎng zài qián'é shàng"
convert(dictionary, "他有长头发。"); // "Tā yǒu cháng tóufa."
convert(dictionary, "树长叶子"); // "shù zhǎng yèzi"
convert(dictionary, "我看见一个长头发的女生"); // "wǒ kànjiàn yí gè cháng tóufa de nǚshēng"
convert(dictionary, "这是我第一次长胡子"); // "zhè shì wǒ dìyīcì zhǎng húzi"
```

A preceding measure word can be part of a longer dictionary entry. For example, the rule finds 个 inside 一个. Ordinals are excluded because they can describe when an action happened.

不 and 还 can modify either an adjective or a verb. The rule also checks whether 长 ends the clause. A preceding measure word or 有 can help distinguish an adjective from a verb with an object.

In 88,866 lines, the rule changed 125 of 379 standalone 长 or 長 readings to `cháng`. Accuracy on 40 hand-labelled 长 examples increased from 85.00% to 92.50%.

A preceding verb alone does not trigger the rule. Dictionary tags cannot reliably distinguish 他留长头发 (wearing long hair) from 他长头发 (growing hair).

For some 越长越X patterns, the rule instead favours `zhǎng`:

```ts
convert(dictionary, "他越长越高"); // "tā yuè zhǎng yuè gāo"
convert(dictionary, "时间越长越好"); // "shíjiān yuè cháng yuè hǎo"
```

The dictionary contains 越长 with the reading `yuè cháng`. When the second half describes growth, such as 高, 大, 胖, 壮 or 结实, the rule removes that compound reading and allows the character reading `zhǎng`.

This is a heuristic with limited corpus evidence. It removes one candidate without forcing `zhǎng`, and `cháng` remains an alternative. Ambiguous patterns still report [uncertainty](../confidence/). 漂亮 is excluded because both growing more beautiful and lengthening can fit 越长越漂亮.

### 弹 as a verb

The rule selects `tán` when 弹 means to play an instrument:

```ts
convert(dictionary, "他会弹一点儿古筝。"); // "Tā huì tán yìdiǎnr gǔzhēng."
convert(dictionary, "他钢琴弹得很好"); // "tā gāngqín tán de hěn hǎo"
convert(dictionary, "子弹"); // "zǐdàn", through the word
```

The default character reading is `dàn`. Dictionary words such as 子弹, 炸弹 and 导弹 already carry that reading. The rule handles standalone verbal uses.

A following object or aspect particle supports `tán`. An object must contain at least two characters to avoid noun compounds such as 着弹点 and 弹洞. This differs from 教, which commonly takes single-character objects such as 我 and 你. Listed noun compounds such as 弹匣 and 弹药 retain their word readings.

Across 109,013 corpus lines, the rule changed 30 standalone readings. It corrected 29 and misread 拆弹专家. It still misses some verbs without a recognised object, such as 开始弹, 四手联弹 and 弹起三次. The 40 hand-labelled 弹 examples were already correct through dictionary words.

The rule also removes untagged multi-character candidates that carry the conflicting reading. For example, 和弹 can otherwise supply `dàn` in 我的爱好是开车和弹吉他. Tagged words ending in 弹 remain eligible.

### Structural 的

The rule prevents an untagged candidate from combining the particle 的 with the start of the following word:

```ts
convert(dictionary, "没有人知道他的真名字"); // "méiyǒu rén zhīdào tā de zhēn míngzi"
convert(dictionary, "我的确知道"); // "wǒ díquè zhīdào", a word jieba counted
convert(dictionary, "我要一辆的士"); // "wǒ yào yí liàng dīshì"
```

Candidates such as 的真, 的卡, 的筆 and 的這 can incorrectly cross a grammatical boundary. Tagged words such as 的确, 的士 and 的哥 are retained.

In 88,866 lines, the rule corrected 40 runs. Some corrections also changed spacing, including the former single-word output `deduì` for 你說的對.

### 得 in potential complements

The rule selects neutral-tone 得 between a verb and a potential complement:

```ts
convert(dictionary, "他算得上一个作家"); // "tā suàn de shàng yí gè zuòjiā"
convert(dictionary, "取得上级批准"); // "qǔdé shàngjí pīzhǔn", the word
```

Both sides are checked. A verb before 得 excludes 只得上山, where 得 belongs to an adverb. The complement must stand alone, which excludes 取得上级批准, where 上 belongs to 上级. Ambiguous 了 and 过 are excluded because they also mark aspect.

### Experiential 过

The rule selects neutral-tone 过 after a verb when it marks a past experience:

```ts
convert(dictionary, "他去过法国。"); // "Tā qùguo Fǎguó."
convert(dictionary, "我吃过饭了。"); // "Wǒ chīguo fàn le."
convert(dictionary, "他经过我家"); // "tā jīngguò wǒjiā", the word
```

The default reading is `guò`. A verbal word ending immediately before 过 supports its use as an aspect marker, as in 去过, 见过 and 听说过.

The rule also removes conflicting untagged pairs. Longer dictionary words retain their readings, including 睡过头, 过马路 and 反应过度.

The grammatical condition was correct in 939 of 998 examined cases. Known mistakes include directional and resultative complements, such as 他游过了河 and 他们转过身, and verbal uses such as 你要過聖誕節了嗎.

The rule does not exclude all motion verbs. Doing so would miss valid experiential uses such as 游过泳 and 跑过马拉松.

### Taxi words containing 的

The rule keeps `dī` in recognised taxi words while excluding those readings from modifier phrases:

```ts
convert(dictionary, "打的去旅馆吧。"); // "Dǎdī qù lǚguǎn ba."
convert(dictionary, "他给谁打的电话？"); // "Tā gěi shéi dǎ de diànhuà?"
convert(dictionary, "我的哥哥们在树下。"); // "Wǒ de gēgemen zài shù xià."
```

The dictionary records `dī` in 的士, 的哥, 的姐, 打的, 面的 and 摩的. These characters can also occur across a particle boundary. For example, 我的哥哥们 contains the particle 的 followed by 哥哥, not the taxi word 的哥.

The rule checks words around both ends of the candidate. A longer word can claim a character inside it, as 哥哥 does in 的哥 or 上面 does in 面的. Following nouns, pronouns, adjectives and adverbs provide further evidence for particle uses.

When context supports a taxi word, the rule removes the competing single-character 的 candidate. This also keeps the taxi word together in the output.

In 88,866 lines, the rule corrected six readings and ten word boundaries. One phrase remained wrong, 用一元硬币来打的, where an earlier clause supplied the 是 of a 是…的 construction.

### Separated compounds

The rule preserves a separable verb's reading when 个 appears between its two characters:

```ts
convert(dictionary, "我想向老师请个假。"); // "Wǒ xiǎng xiàng lǎoshī qǐng gè jià."
convert(dictionary, "就去睡个觉吧"); // "jiù qù shuì gè jiào ba"
convert(dictionary, "他会弹个琴"); // "tā huì tán gè qín"
```

For example, 请假 and 请个假 both use `jià`. The dictionary reading of 请假 supplies the reading across 个. The same mechanism handles 睡个觉, 弹个琴 and 教个书.

The surrounding pair must be a tagged dictionary word, the first character must be a verb, and the second must be free of a competing tagged word. These checks exclude counting phrases such as 一个只 and protect 奇怪 in 有个奇怪的女人.

The rule can constrain either half of the compound. 请个假 and 睡个觉 need a correction after 个, while 弹个琴 and 教个书 need one before it.

Only 个 is supported as the inserted measure word. Other classifier tags also occur on ordinary morphemes, and 下 and 回 can introduce directional complements. Expanding the rule to those cases produced incorrect readings.

In 88,866 lines, the complete conditions matched three phrases, 请个假, 打个折 and 睡個覺. All three were corrections.

Applications can supply a custom rule list to `decodeRun`, including an empty list. The exported rules are `READING_RULES`, `MODAL_DE`, `PARTICLE_DE`, `POTENTIAL_DE`, `TAXI_DI`, `TEACHING_JIAO`, `ATTESTED_ERHUA`, `COUNTED_MEASURE`, `ADJECTIVAL_CHANG`, `PLAYING_TAN`, `EXPERIENTIAL_GUO` and `SEPARATED_COMPOUND`. `applyEdgeRules` applies a list to the candidate graph.

## The greedy baseline

`convertGreedily` selects the longest dictionary word at each position without reconsidering earlier choices. It provides a baseline for comparing the lattice decoder.

```ts
import { convertGreedily } from "@kensio/pinyinjs";

convert(dictionary, "研究生命起源"); // "yánjiū shēngmìng qǐyuán"
convertGreedily(dictionary, "研究生命起源"); // "yánjiūshēng mìng qǐyuán"
```

In this example, the greedy decoder selects 研究生 because it is longer. The syllables remain correct, but the word spacing changes.

On 20,139 hand-labelled polyphonic characters, `convert` scored 91.30% accuracy and `convertGreedily` scored 91.08%. The lattice corrected 72 greedy errors and introduced 28 others. Use `convert` for normal conversion. The repository commands `pnpm accuracy` and `pnpm polyphones` compare both algorithms.

<!-- card
```ts
convert(dictionary, "银行"); // "yínháng"
convert(dictionary, "行长"); // "hángzhǎng"
convert(dictionary, "女儿"); // "nǚ'ér"
convert(dictionary, "1998年"); // "yī jiǔ jiǔ bā nián"
```
-->
