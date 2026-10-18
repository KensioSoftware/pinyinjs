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

<a id="a-character-on-its-own"></a>

## A character on its own

A character that forms a word by itself takes its default reading, the first in `readingsOf`. Most defaults are ranked by how often the sources saw each reading, and those counts include the character inside words. For most characters that ranking is also right when the character stands alone. A few characters have a literary reading in their compounds and an everyday one as a free verb or classifier, and for those it is wrong. 剥削 and 剥夺 make 剥 `bō`, while someone peeling an orange says `bāo`. 一切 makes 切 `qiè`, and 切土豆 is `qiē`.

Those characters lead with the reading they take on their own. Their compounds are dictionary words and keep their own readings:

```ts
convert(dictionary, "我给你剥橙子"); // "wǒ gěi nǐ bāo chéngzi"
convert(dictionary, "剥削"); // "bōxuē"
convert(dictionary, "把土豆切一下"); // "bǎ tǔdòu qiē yíxià"
convert(dictionary, "一切"); // "yíqiè"
convert(dictionary, "这幢楼"); // "zhè zhuàng lóu"
```

The list is 幢 `zhuàng`, 抡 `lūn`, 剥 `bāo`, 削 `xiāo`, 铺 `pū`, 咳 `ké`, 哄 `hǒng`, 刨 `páo`, 攒 `zǎn`, 绷 `bēng`, 翘 `qiào`, 划 `huá`, 曲 `qǔ`, 切 `qiē`, 嚼 `jiáo`, 倔 `juè`, 脏 `zāng`, 挣 `zhèng` and 漂 `piāo`, with the 繁體 forms Unihan gives the same reading. Each entry is a judgement about how the character is used on its own. The list leaves out characters with two common free uses, such as 卡 (`kǎ`, a card, and `qiǎ`, stuck). It also leaves out characters that names and transliterations use on their own, such as 勒 (`lēi` in 勒得难受, `lè` in 达勒姆) and 盛 (`chéng` in 盛汤, the surname `Shèng`). Context rules suit those better.

On the 20,139 labelled polyphones in CPP, the change fixed 66 more readings than it broke, almost all of them 幢, 翘, 咳 and 刨. It broke readings of 攒 in the architectural 攒尖 and of 抡 in personal names, which the dictionary does not hold.

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

A skill counts as an object when it is a verb of two or more characters, as in 教游泳 and 教阅读. A single verb character does not count, since the core tier has no 教育 or 教练 and leaves 育 and 练 after a bare 教. Every word starting after 教 is checked, so the tagged 孩子 inside the untagged 孩子们 counts. The adverbial 地 does not rule the verb out the way other particles do:

```ts
convert(dictionary, "私塾先生教孩子们写字"); // "sīshú xiānsheng jiāo háizimen xiězì"
convert(dictionary, "她教阅读和写作"); // "tā jiāo yuèdú hé xiězuò"
convert(dictionary, "她兢兢业业地教了多年书"); // "tā jīngjīng-yèyè de jiāole duōnián shū"
```

These three changes moved 3 more readings in the full tier, 2 in the standard tier and none in the core tier, all corrections. On CPP two unlabelled nominal compounds read `jiāo` wrongly (宗教法教禁止 and 中华理教总会), and labelled accuracy is unchanged.

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

Other contexts mark a span of time or a change in length:

```ts
convert(dictionary, "长时间看手机会损伤眼睛"); // "cháng shíjiān kàn shǒujī huì sǔnshāng yǎnjing"
convert(dictionary, "东北的冬天又长又冷"); // "Dōngběi de dōngtiān yòu cháng yòu lěng"
convert(dictionary, "白天日益变长"); // "báitiān rìyì biàn cháng"
convert(dictionary, "时间长了"); // "shíjiān chángle"
convert(dictionary, "时间比我想的长"); // "shíjiān bǐ wǒ xiǎng de cháng"
convert(dictionary, "宽松的长外套"); // "kuānsōng de cháng wàitào"
```

A span of time after 长 (时间, 时期, 周末, 假期) makes it a length. jieba counts 长时间 as a word, and neither CC-CEDICT nor `large_pinyin.txt` gives it a reading. A 长 between the two halves of 又…又 is the first of two qualities. A 长 that ends its clause is a length after a verb of becoming (变, 变得), after a span or a time word as its subject (时间, 日子, 距离, 冬天) or after a 比 earlier in the run. That 比 has to stand alone, which leaves 比作 and 比较 out, and the 长 cannot be followed by 的. 头发长了 is the same shape as 时间长了 with a thing that grows, so the subject decides it. A 的 in front and a noun after make 长 attributive, as a 量词 or 有 in front does.

In 88,866 lines these contexts changed 9 readings in the full tier, 10 in the standard tier and 18 in the core tier. All are corrections except one in the core tier, 菲利普的长子, where that tier has no word 长子. Among the corrections are 长时间驾车, 女人通常比男人寿命长 and 公园的长椅. CPP accuracy is unchanged.

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

### 的话 as the particle and the noun

的话 is a word, the conditional _if_ at the end of 要是下雨的话. The same two characters are as often the particle 的 and the noun 话 (_words_) it modifies. The rule keeps the word and splits it where 话 is the noun:

```ts
convert(dictionary, "他说的话不是真的。"); // "Tā shuō de huà bú shì zhēnde."
convert(dictionary, "你应该听妈妈的话。"); // "Nǐ yīnggāi tīng māma de huà."
convert(dictionary, "下雨的话，明天的出游就取消吧。"); // "Xiàyǔ dehuà, míngtiān de chūyóu jiù qǔxiāo ba."
convert(dictionary, "我这么说的话是不是像个傻瓜？"); // "Wǒ zhème shuō dehuà shìbúshì xiàng gè shǎguā?"
```

话 is the noun when a 吗 or 里 follows it, when a verb of speaking comes before the 的 (说的话, 所说的话, 说过的话, 说这样的话), when a 句 counts it, when 刚才 or 刚刚 is when the words were said, and when a person owns them. An owner counts when it opens the run with more of the clause after it (他的话让我吃惊), or when it is the object of a verb that takes words, such as 听, 相信, 把 or 因为 (听老师的话, 不听我的话). 这么说的话 and 要我说的话 stay conditional.

The readings are the same either way. The rule changes the segmentation and the spacing, so 出来的话吗 is `chūlái de huà ma` where it was `chūlái dehuà ma`.

The full tier read 463 of the 475 runs holding 的话 in Tatoeba, zh.wikipedia and the Chinese Boost example sentences as the conditional. The rule splits 195 of them. One is wrong, 她的话是有那么几个缺点, where 她的话 is a topic (_as for her_). It leaves nouns it cannot see from these contexts, such as 他刻薄的话 and 请用通俗的话.

### 得 in potential complements

The rule selects neutral-tone 得 between a verb and a potential complement:

```ts
convert(dictionary, "他算得上一个作家"); // "tā suàn de shàng yí gè zuòjiā"
convert(dictionary, "取得上级批准"); // "qǔdé shàngjí pīzhǔn", the word
```

Both sides are checked. A verb before 得 excludes 只得上山, where 得 belongs to an adverb. The complement must stand alone, which excludes 取得上级批准, where 上 belongs to 上级. Ambiguous 了 and 过 are excluded because they also mark aspect. 了 has a rule of its own, described next.

<a id="liao-in-potential-complements"></a>

### 了 in potential complements

The rule selects `liǎo` for 了 after a verb and 得:

```ts
convert(dictionary, "你吃得了吗？"); // "Nǐ chī de liǎo ma?"
convert(dictionary, "我觉得他们来得了"); // "wǒ juéde tāmen lái de liǎo"
convert(dictionary, "这条裤子我现在穿得了了"); // "zhè tiáo kùzi wǒ xiànzài chuān de liǎo le"
convert(dictionary, "他获得了冠军"); // "tā huòdéle guànjūn", aspect
convert(dictionary, "得了吧"); // "déleba", the word
```

了 is stored `le` (aspect), with `liǎo` and `liào` as alternates. 吃不了 and 受不了 read `liǎo` through 不了, which is a dictionary word. 吃得了 has no entry, and 得了 is itself a word read `dé le`.

The rule needs a verb before 得. A pronoun or a noun there leaves 得了 alone, as in 得了吧 and 他得了病. Modal and phase verbs are excluded (他可能得了感冒, 我开始得了流感), and so are nouns made from verbs (他考试得了一百分).

Many verbs make a word with 得, such as 获得, 取得, 记得 and 觉得. The 了 after these marks aspect, so the rule leaves them alone. 来得 and 算得 are exceptions, since 来得了 and 这算得了什么 are potential complements. The core tier holds no words, so a fixed list of these verbs stands in for the dictionary there.

The 了 after `liǎo` keeps its aspect reading, so 我受不了了 reads `shòubùliǎo le`.

In 88,866 corpus lines, the rule changed 12 readings in the full tier, 14 in the standard tier and 15 in the core tier. All but one are corrections. In 你去办公室睡得了呗 the 得了 means "and be done with it", and neither reading was right. No sentence in either CPP split changed.

<a id="de-obtaining"></a>

### 得 as "to obtain"

The rule selects `dé le` for 得了 when an illness, a score or a prize follows:

```ts
convert(dictionary, "他上周被确诊得了肺炎"); // "tā shàngzhōu bèi quèzhěn dé le fèiyán"
convert(dictionary, "我邻居得了焦虑症"); // "wǒ línjū dé le jiāolǜzhèng"
convert(dictionary, "他得了感冒"); // "tā dé le gǎnmào"
convert(dictionary, "他这次考试得了几分"); // "tā zhècì kǎoshì dé le jǐfēn"
convert(dictionary, "他治得了病"); // "tā zhì de liǎo bìng", a potential complement
```

得 is stored as the particle `de`, so a bare 得 read `de` here before. After a verb, the potential complement rule read it `de liǎo`, as in 确诊得了肺炎. That rule now leaves this frame to this one.

The object is matched by its characters, so the core tier reads it the same way. An illness ends in a character such as 病, 症, 炎 or 癌, or is one of a short list (感冒, 流感, 中风 and others). 病人, 病房 and 病情 are excluded. A score is a count followed by 分 (but not 分钟 or 分之), and a prize is 奖, a placing such as 第三名, or a word such as 冠军 or 金牌. The object has to end within four characters of the 了, and 的 or a sentence-final particle closes it.

Some verbs take these objects as a potential complement. 治, 医, 看 and 控制 come before illnesses (他治得了病, 他控制得了病情), and 拿 and 考 before prizes (你拿得了冠军吗). The 得 after them keeps the particle reading.

Over the same 88,866 corpus lines, the rule changed 35 readings in the full tier, 35 in the standard tier and 46 in the core tier. Every one is a correction from `de` to `dé`. Eleven of the core tier's are 获得了冠军 and the like, which read `huò de le` there. No label in either CPP split falls on a 得 the rule moves.

### Experiential 过

The rule selects neutral-tone 过 after a verb when it marks a past experience:

```ts
convert(dictionary, "他去过法国。"); // "Tā qùguo Fǎguó."
convert(dictionary, "我吃过饭了。"); // "Wǒ chīguo fàn le."
convert(dictionary, "他经过我家"); // "tā jīngguò wǒjiā", the word
```

The default reading is `guò`. A verbal word ending immediately before 过 supports its use as an aspect marker, as in 去过, 见过 and 听说过. jieba tags 没 as a verb, and the rule makes an exception for it. In 考试没过 (failed the exam) 过 is the verb `guò`.

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

The halves also come apart around an aspect particle, a complement or a count. The rule reads the tail across those as well:

```ts
convert(dictionary, "我睡不着觉。"); // "Wǒ shuì bù zháo jiào."
convert(dictionary, "我只睡了三个小时觉。"); // "Wǒ zhǐ shuìle sān gè xiǎoshí jiào."
convert(dictionary, "他请了假。"); // "Tā qǐngle jià."
convert(dictionary, "我觉得很好。"); // "Wǒ juéde hěn hǎo.", 觉得 keeps its word
```

The inserted material has to match a short pattern. The verb half may take 了 or 过, a potential complement such as 不着 or 得了, or a result such as 够了. The object half may take a count (个, 个好, 三天, 天, 八个小时, 一会儿, 一下 or 点). 下 and 年 count only after a numeral, so a bare directional 下 is left alone.

The conditions are tighter than for 个. The pair itself must be tagged as a verb, and the noun 打场 never qualifies. The tail must be tagged as a noun or verb. That excludes the 吗 of 干吗 and the 下 of 坐下, and 来 and 去 are excluded by name. The tail must not run on into a noun or an attributive 的, as 假 does in 放了假钱. Only the tail is settled. A head found across a complement can be an adverb, as 还 is in 还不够钱.

Over the 88,866 lines and both CPP splits (241,680 Han runs), this changed 35 conversions and all 35 were corrections. 24 were 觉 to `jiào` and 7 were 假 to `jià`. The others were 血 to `xiě` in 流了血 and 吐了血, and 肚 to `dù` in 下過肚. CPP's labelled polyphones held at 91.86%.

假 used as a noun with no verb in front, as in 五天带薪假, still reads `jiǎ`. So does 假花, because the dictionary tags 花 as a verb.

### Reduplicated verbs

A verb said twice around 了 or 一 takes its verb reading on both halves:

```ts
convert(dictionary, "他数了数桌上的数字。"); // "Tā shǔ le shǔ zhuō shàng de shùzì."
convert(dictionary, "数一数"); // "shǔ yì shǔ"
convert(dictionary, "他弹了弹烟灰"); // "tā tánle tán yānhuī"
```

数 is stored `shù`, the noun, with `shǔ` as an alternate. 数数 is a dictionary word, but 了 between the halves hides it, and each 数 fell back on `shù`. The same shape split other verbs down the middle. 弹了弹 read `tán le dàn` and 教了教 `jiāo le jiào`.

The rule covers 数, 凉, 种, 教, 弹, 卷, 削, 量 and 转 (with their 繁體 forms). Each has a verb reading that differs from its default or from a word that reaches into the shape (一卷 in 卷一卷). The list is written by hand. The dictionary has no tag per reading, and the reduplicated words it does hold are mostly literary (查查 is `zhāzhā`, and reading 查一查 off it would be wrong).

A numeral in front turns the shape away, since 一卷一卷 counts rolls. A tagged word claiming either half does too, which keeps the 数字 of 数了数字 (counted the digits) `shùzì`. Its first 数 reads `shǔ` through the [verbal reading](#verbs-with-a-reading-of-their-own) rule. Across 88,866 corpus lines, the 107 matches for the first seven characters already read both halves alike. 量 and 转 came later. The rule moves both halves of 他转了转他的眼睛 (twice in the corpus) and the second 量 of 護士用溫度計量了量他的體溫.

### 还 as a verb

The rule selects `huán` when 还 gives back money, a book or an account:

```ts
convert(dictionary, "我得去银行还钱。"); // "Wǒ děi qù yínháng huán qián."
convert(dictionary, "请明天前还书"); // "qǐng míngtiān qián huán shū"
convert(dictionary, "他还书法很好"); // "tā hái shūfǎ hěn hǎo"
```

The default character reading is `hái`, the adverb. The full tier holds 还钱, 还书 and 还账 as words, and the standard tier holds none of them (no frequency list counts them), so standard read 还钱 as `hái qián`. The rule makes standard agree with full.

The objects are listed by hand. jieba tags 有点, 客气 and 问 as nouns, and 还 in front of each of those is the adverb. The object must also stand clear of a tagged word of its own, which keeps 还书法 `hái`. In 88,866 corpus lines and both CPP splits, the rule changed 5 standard-tier readings and all 5 were corrections.

<a id="gan-as-to-concern"></a>

### 干 as "to concern"

The rule selects `gān` when 干 means to concern or to have to do with:

```ts
convert(dictionary, "这不干你的事！"); // "Zhè bù gān nǐ de shì!"
convert(dictionary, "干你什么事"); // "gān nǐ shénme shì"
convert(dictionary, "你干你的事"); // "nǐ gàn nǐ de shì"
```

干 is stored `gàn` (to do), with `gān` as an alternate. The "to concern" sense appears in four frames, and the rule matches each as characters: 不干你的事 (or 不干我事), 干你什么事 (or 干你屁事), 干卿何事 and 与你无干. A pronoun after 干 is not enough on its own. 你干你的事 tells someone to get on with their own work, and it stays `gàn`.

The full tier holds 无干 and 干卿底事 as words, and the standard tier holds neither. A tagged word starting at the 干 keeps its own reading, so 无干部 stays `wú gànbù`. In 88,866 corpus lines and both CPP splits, the rule changed 2 readings in each tier and both were corrections.

The same frames keep 干 as 干 in [script conversion](../script-conversion/).

<a id="zhi-as-a-measure-word"></a>

### 只 as a measure word

The rule selects `zhī` when a number or a demonstrative counts 只:

```ts
convert(dictionary, "三只猫"); // "sān zhī māo"
convert(dictionary, "这只猫"); // "zhè zhī māo"
convert(dictionary, "他只有一个"); // "tā zhǐyǒu yí gè", the adverb
convert(dictionary, "这只是个玩笑"); // "zhè zhǐshì gè wánxiào"
```

只 is stored `zhǐ` (only), with `zhī` as an alternate. 一只 and 几只 are dictionary words and read `zhī` through the word. Other counted forms, such as 三只, 两只 and 这只, have no entry.

A numeral, 几, 半, 每 or 多少 before 只 selects `zhī` whatever follows. In 另外两只是母的 (the other two are female), the rule takes 只是 apart. Approximate numbers (十多只, 百余只) and ordinals (第三只) count as well. A numeral inside a tagged word belongs to that word, so 唯一只有 keeps `zhǐyǒu`.

After 这, 那 and 哪, the adverb is the commoner reading. The rule selects `zhī` there only when a noun, an adjective or the end of the run follows. A word starting at 只 that reads `zhǐ` keeps the adverb, as in 这只是, 那只有 and 去那只要五分钟. A verb after 只 does the same, as in 这只会导致争论.

Numbers written in digits are read before the rule runs, so 3只猫 gives `sān zhī māo`.

In 88,866 corpus lines and both CPP splits, the rule changed 119 readings in the full tier, 126 in the standard tier and 262 in the core tier. All but three are corrections. 后半只计 (standard and core) and 凡百只务实行 (core) have no word holding the numeral. The rule misses 这只表多少钱, where 表 is tagged as a verb.

The reading also selects 隻 in [script conversion](../script-conversion/), so 三只猫 becomes 三隻貓.

<a id="verbs-with-a-reading-of-their-own"></a>

### Verbs with a reading of their own

Nine characters read differently as verbs. The rule selects the verb's reading where the words around the character show the verb:

```ts
convert(dictionary, "我妈妈量了我的体温"); // "wǒ māma liáng le wǒ de tǐwēn"
convert(dictionary, "他的词汇量很大"); // "tā de cíhuì liàng hěn dà"
convert(dictionary, "你能数到十吗"); // "nǐ néng shǔ dào shí ma"
convert(dictionary, "请把音量调低一点"); // "qǐng bǎ yīnliàng tiáo dī yìdiǎn"
convert(dictionary, "请系好安全带"); // "qǐng jì hǎo ānquándài"
convert(dictionary, "月球围着地球转"); // "yuèqiú wéizhe dìqiú zhuàn"
convert(dictionary, "把桩钉进地里"); // "bǎ zhuāng dìng jìn dìlǐ"
convert(dictionary, "树上结满了果实"); // "shù shàng jiē mǎnle guǒshí"
convert(dictionary, "我们照了一张相"); // "wǒmen zhào le yì zhāng xiàng"
convert(dictionary, "味道很冲"); // "wèidao hěn chòng"
```

Each character is stored with the reading its compounds take most often (量 `liàng` from 数量 and 质量, 系 `xì` from 关系). A compound carries its own reading, so the default decides only the character standing alone, and in running text that is often the verb.

| Character | Verb    | Selected where                                                                              | Left alone       |
| --------- | ------- | ------------------------------------------------------------------------------------------- | ---------------- |
| 量        | `liáng` | 了, 着, 一下 or 一次 follows, or a measurement (体温, 宽度), or 请 or 正在 comes before     | 词汇量, 信息量   |
| 数        | `shǔ`   | 到, 了, 过 or 一下 follows, or 开始, 会 or 能 comes before                                  | 数十人, 数小时   |
| 调        | `tiáo`  | a direction follows (调低, 调高, 调亮, 调快), or 过音 or 杯                                 | 调往广州         |
| 系        | `jì`    | a complement (系好, 系紧, 系在) or what is tied (系领带, 系安全带) follows                  | 历史系           |
| 转        | `zhuàn` | the clause goes round something (绕着, 围着) or 在 comes before, or 起来, 得 or laps follow | 天气转凉, 转火车 |
| 钉        | `dìng`  | a complement (钉进, 钉在) or 十字架 follows, or 被 comes before                             | 一根钉           |
| 结        | `jiē`   | the object within five words is fruit (果实, 桃)                                            | 结了婚, 结冰     |
| 相        | `xiàng` | 照 comes before with only aspect, a count or 的 between                                     | 互相             |
| 冲        | `chòng` | a degree adverb comes before and the clause ends                                            | 冲过来           |

A tagged word holding the character with another reading keeps that reading, unless a commoner tagged word crosses it (冷气调高 holds 气调, and 冷气 is the word the decode takes). Each character also has the neighbours that make a compound the smaller tiers lack. The rule leaves the character alone beside one of them, so 我们联系上他们 keeps `xì` in the core tier, which holds no 联系.

Unihan gives 繫 no `jì` and 釘 no `dìng`, so the rule leaves those two forms alone. A 衝 that is strong reads `chòng` the same way 冲 does. The [reduplicated verb](#reduplicated-verbs) rule reads 量了量 and 转了转 with the verb's reading too.

In 88,866 corpus lines and both CPP splits, the rule changed 83 readings in the full tier, 94 in the standard tier and 152 in the core tier. One is wrong in every tier, the 调大脊 of an article on roof tiles, where 调 is a transfer. CPP accuracy rose from 91.82% to 91.86%.

The `jì` reading selects 繫 in [script conversion](../script-conversion/), so 他不会系领带 becomes 他不會繫領帶.

<a id="pairs-nobody-counted"></a>

### Function words inside pairs nobody counted

The rule keeps a common function word at its usual reading when a pair that no corpus counts would give it a rare one:

```ts
convert(dictionary, "气球胀得太大，会破的"); // "qìqiú zhàng de tài dà, huì pò de"
convert(dictionary, "书架上都是书"); // "shūjià shàng dōu shì shū"
convert(dictionary, "汤里放点葱会更香"); // "tāng lǐ fàng diǎn cōng huì gèng xiāng"
convert(dictionary, "我到家给你打电话"); // "wǒ dào jiā gěi nǐ dǎdiànhuà"
```

The decoder charges per word, so a dictionary pair beats its two characters read apart. Most pairs agree with their characters. Some hold a sense the language barely uses, and they carry a rare reading into an everyday sentence. 破的 is _to hit the target_ (`pò dì`), 上都 is the Yuan summer capital (`Shàngdū`), 更香 is an incense clock (`gēngxiāng`) and 家给 comes from the idiom 家给人足 (`jiā jǐ`).

The rule removes a two-character pair in the lowest three frequency buckets (one jieba never counted) when it gives one of these characters its rare reading:

| Character | Usual reading | Rare reading   | Pair |
| --------- | ------------- | -------------- | ---- |
| 的        | `de`          | `dì`, `dí`     | 破的 |
| 着        | `zhe`         | `zhuó`, `zhāo` | 着笔 |
| 给        | `gěi`         | `jǐ`           | 家给 |
| 更        | `gèng`        | `gēng`         | 更香 |
| 都        | `dōu`         | `dū`           | 上都 |
| 没        | `méi`         | `mò`           | 没过 |
| 间        | `jiān`        | `jiàn`         | 有间 |
| 赚        | `zhuàn`       | `zuàn`         | 赚得 |

kHanyuPinlu counts each usual reading at thirty or more times the rare one. 着 keeps `zháo`, which 睡不着 needs.

Counted words keep their readings (目的, 首都, 京都), and so do longer words (知更鸟, 漫无目的地). Except for 的 and 着, each character is only taken from one side of a pair. Compounds such as 都护, 间日, 俸给 and 淹没 have the rare reading on the other side. A pair ending in 都 stays a name at the end of the run or before a noun (称为魔都, 金中都故城). A pair of 更 and a bare verb stays the compound _to change_ (更变).

In 88,866 corpus lines the rule changed 25 runs in the full tier, and all 25 were corrections. Over both CPP splits it changed 32 runs, two of them wrongly (官员俸给 and 北魏国都代郡). The standard and core tiers hold none of these pairs, so nothing changes there.

<a id="hao-as-easy"></a>

### 好学 as "easy to learn"

The rule takes the word 好学 apart where it means easy to learn:

```ts
convert(dictionary, "德语好学吗"); // "Déyǔ hǎo xué ma"
convert(dictionary, "只要你好好学中文"); // "zhǐyào nǐ hǎohǎo xué Zhōngwén"
convert(dictionary, "聪明好学"); // "cōngming hào xué", studious
```

The dictionary holds 好学 as `hào xué` (studious), the sense jieba counts. After a language name ending in 语 or 文, 好学 is easy to learn, since a language cannot be studious. After another 好, the first 好 of 好好 takes it. Removing the word leaves `hǎo` and `xué`.

In 88,866 corpus lines the rule changed 5 readings in the full tier and 3 in the standard tier, all corrections. Nothing changed in the core tier or on CPP.

<a id="mei-as-adjective"></a>

### 美的 as an adjective and its 的

The rule takes the word 美的 apart where 美 is the adjective _beautiful_:

```ts
convert(dictionary, "她是一个非常美的女人"); // "tā shì yí gè fēicháng Měi de nǚrén"
convert(dictionary, "多美的日出啊"); // "duō Měi de rìchū a"
convert(dictionary, "美的空调很好用"); // "Měidí kōngtiáo hěn hǎo yòng", the brand
```

The dictionary holds 美的 as a proper noun, the appliance maker `Měidí`. After a degree word (最, 很, 更, 非常, 这么, 多 and others) or a 是, 美 is graded or asserted, and a company name takes neither. Removing the word leaves 美 and the particle 的, read `de`. (美 on its own is still capitalised, because the dictionary also holds it as the short name of the United States.)

Over 139,893 distinct runs from Tatoeba and the Chinese Boost example sentences, the full tier read 美的 as the name in 28 runs, and none was the company. The rule changes 26 of them, all corrections. The two it leaves are 对美的感受 and 凡美的事物, where 美 is the noun _beauty_.

Applications can supply a custom rule list to `decodeRun`, including an empty list. The exported rules are `READING_RULES`, `MODAL_DE`, `PARTICLE_DE`, `POTENTIAL_DE`, `TAXI_DI`, `TEACHING_JIAO`, `ATTESTED_ERHUA`, `COUNTED_MEASURE`, `ADJECTIVAL_CHANG`, `PLAYING_TAN`, `EXPERIENTIAL_GUO`, `SEPARATED_COMPOUND`, `REDUPLICATED_VERB`, `RETURNING_HUAN`, `CONCERNING_GAN`, `COUNTING_ZHI`, `POTENTIAL_LIAO`, `OBTAINING_DE`, `VERBAL_READING`, `DOMINANT_READING`, `EASY_HAO` and `ADJECTIVAL_MEI`. `applyEdgeRules` applies a list to the candidate graph.

## The greedy baseline

`convertGreedily` selects the longest dictionary word at each position without reconsidering earlier choices. It provides a baseline for comparing the lattice decoder.

```ts
import { convertGreedily } from "@kensio/pinyinjs";

convert(dictionary, "研究生命起源"); // "yánjiū shēngmìng qǐyuán"
convertGreedily(dictionary, "研究生命起源"); // "yánjiūshēng mìng qǐyuán"
```

In this example, the greedy decoder selects 研究生 because it is longer. The syllables remain correct, but the word spacing changes.

On 20,139 hand-labelled polyphonic characters, `convert` scored 91.82% accuracy and `convertGreedily` scored 91.58%. The lattice corrected 87 greedy errors and introduced 39 others. Use `convert` for normal conversion. The repository commands `pnpm accuracy` and `pnpm polyphones` compare both algorithms.

<!-- card
```ts
convert(dictionary, "银行"); // "yínháng"
convert(dictionary, "行长"); // "hángzhǎng"
convert(dictionary, "女儿"); // "nǚ'ér"
convert(dictionary, "1998年"); // "yī jiǔ jiǔ bā nián"
```
-->
