# Converting

`convert` takes a dictionary and some text and returns pinyin. Everything else
in the package is either something it uses on the way or a different view of
the same answer.

```ts
convert(dictionary, "银行"); // "yínháng"
convert(dictionary, "行长"); // "hángzhǎng"
convert(dictionary, "我要去北京。"); // "Wǒ yào qù Běijīng."
convert(dictionary, "3D银行"); // "sān D yínháng", the digit is read, the letter is not
```

The signature is `convert(dictionary, text, options?)`. Options are documented
in full in [options](../options/). This page is about what happens between the
two arguments and the string that comes back.

## Why the word is the unit

行 has four readings, `xíng`, `háng`, `héng` and `hàng`, and the character on
its own gives no way to choose between them. 银行 is `yínháng` and 行长 is
`hángzhǎng`. A per-character table cannot get both right, and picking the
commonest reading gets one of them wrong every time.

So the unit is the word, and the words have to be found in the text before
anything can be read. That is segmentation, and it is ambiguous in its own
right. 南京市长江大桥 is 南京市 / 长江 / 大桥 or 南京 / 市长 / 江大桥, and the
two disagree about whether 长 is `cháng` or `zhǎng`.

## What the decoder does

Every dictionary match at every position goes into a lattice, a graph where
each edge is a word and carries the reading that word has. Converting is then
choosing a path.

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

Two things about this are worth knowing as a user.

**Most positions never get scored.** After the lattice is built, the decoder
asks at each position how many distinct readings survive across every path
through it. Where the answer is one, the position is _locked_ and no amount of
scoring can move it. That is about two thirds of positions in running text. Only
the short stretches between locked positions get a shortest-path decode, and
they are typically two to six characters long.

**Segmentation ambiguity that never crosses a polyphone cannot produce a wrong
reading.** 研究生命起源 splits as 研究生 / 命 or 研究 / 生命 and reads the same
either way. It does change the spacing, and that is why segmentation still
matters, but a spacing mistake is ugly and readable where a reading mistake is
simply wrong. The two are held to different bars on purpose.

The consequence you can see from outside is that the decoder knows when it was
choosing, and will tell you. See [confidence](../confidence/).

## Rules, where the cost model cannot reach

Some readings are settled by context rather than by evidence about the
characters, and no amount of frequency data reaches them. Those are handled by
typed rules that run over the lattice, after it is built and before anything is
decoded, and that may only take candidates away, never invent one.

```ts
convert(dictionary, "我得走了"); // "wǒ děi zǒule", modal
convert(dictionary, "他跑得很快"); // "tā pǎo de hěn kuài", particle
convert(dictionary, "他得到了"); // "tā dédàole", the word decides
```

得 is one character with three readings. The dictionary can only carry a
default, and the default is the particle `de`, so every modal 得 read as one
until this. What separates them is entirely contextual. The particle attaches to
the verb or adjective in front of it, so a 得 with a pronoun, adverb or time
word before it and a verb phrase after it is something else.

The second is 教, `jiào` in the dictionary and `jiāo` when it teaches:

```ts
convert(dictionary, "他在北京大学教了三年书。"); // "Tā zài Běijīng Dàxué jiāole sān nián shū."
convert(dictionary, "我教英语"); // "wǒ jiāo Yīngyǔ"
convert(dictionary, "教育"); // "jiàoyù", and 宗教 is `zōngjiào`
```

The compounds carry their own reading and are right already. What is left is the
教 standing as a word of its own, and that one is the verb. The object is what
says so, whether a pronoun, a noun or a name after it, or an aspect particle,
since only a verb takes 了, 过 or 得. A modal or a negator in front of it says
the same thing from the other side, and reaches the 教 that governs nothing at
all:

```ts
convert(dictionary, "他怎么教，我都学不会。"); // "Tā zěnme jiāo, wǒ dōu xué búhuì."
convert(dictionary, "这在学校是不教的"); // "zhè zài xuéxiào shì bù jiāo de"
```

Over 88,866 lines 181 教 decode as a word of their own and every one read
`jiào`. This moves 162 and is wrong on three, where a nominal compound takes an
object's shape, in 统一教创始人, 方法教深思 and 做到了教政分离. 有 is left out
of the modal set, since 有教无类 is `yǒujiào wúlèi`.

The third rule keeps 儿 from standing on its own where the dictionary says it
should not:

```ts
convert(dictionary, "那边儿"); // "nà biānr", not "nàbian ér"
convert(dictionary, "女儿"); // "nǚ'ér", a syllable of its own, and stays one
```

儿化 is a per-word dictionary fact, and 2,009 of the 2,067 words ending in 儿
carry it, but the list has 这边儿, 上边儿 and 旁边儿 without 那边儿. Where the
character in front of a 儿 makes an attested 儿化 word, the reading that leaves
儿 stranded as `ér` is taken off the lattice. That asserts no new fact, since
边儿 is `biānr` because the dictionary says so. The spacing still falls short of
what GB/T 16159 wants, since 那边儿 is one word and this writes two, because the
word it would need is precisely the one missing.

The fourth keeps a 量词 out of the word behind it where a number is counting
with it:

```ts
convert(dictionary, "三个人"); // "sān gè rén", three people
convert(dictionary, "个人"); // "gèrén", the word, with nothing counting
convert(dictionary, "五分钟"); // "wǔ fēnzhōng", untouched
```

个人 is a common noun, so 三个人 read as three _personals_, with no weight on
the 个 belonging to the 三 in front of it. What makes it decidable is the
dictionary's own tagging. 个, 次, 天 and 杯 are 量词, and the characters that
merely look like one here carry other tags (分 is a verb, 部 and 成 are nouns,
年 and 点 are numerals), so 五分钟, 三部分, 五成分 and 五年级 are left alone,
and those are exactly the words a rule firing on every character after a number
would break. An ordinal counts nothing, so 第三集团军 is left alone too, and a
numeral inside a longer word counts nothing either. The 一 of 唯一道路 belongs
to 唯一.

Over 88,866 lines it forbids 561 edges and moves 53 decodes, of which three are
wrong. Those are 一批评, 这一名词 and 六七股灾, where the 一 and the 六七 count
nothing and no tag says so. One reading changes in the whole corpus, and it is a
fix, since 下了两天雨 read 天雨 as `tiān yù`.

The fifth reads 长 as `cháng` where an adverb of degree measures it:

```ts
convert(dictionary, "这篇文章不太长。"); // "Zhè piān wénzhāng bú tài cháng."
convert(dictionary, "要多长时间"); // "yào duō cháng shíjiān"
convert(dictionary, "她长得很漂亮"); // "tā zhǎng de hěn piàoliang", growing
convert(dictionary, "校长"); // "xiàozhǎng", through the word
```

长 is stored `zhǎng` with `cháng` as an alternate, and that is what the sources
say about the character alone (Unihan counts `zhǎng(1879)` against
`cháng(1179)`). The default earns its place, since 署长, 团长, 公安局长 and
总会长 all reach a bare 长 at the end of a title and read it correctly. The gap
was the adjective, which no word covers and no part of the cost model could
prefer.

A degree adverb settles it from the left alone, as with 得. A growing 长 is a
verb and no 很, 太, 最 or 多 modifies one, whereas what follows an adjectival 长
is a noun, a particle or the end of the sentence, and that is what follows half
the verbs too. 得, 着 and the 越…越 correlative are guarded, since 真长得很快 and
越长越高 are reachable from both sides. 了 and 的 need no guard, because after an
adverb they are the sentence particle and the attributive, which makes 时间太长了
and 很长的道路 both `cháng`.

Two more read the far side alone. A quality can be compared, intensified and
conjoined where a growing cannot, and a length can be given in metres:

```ts
convert(dictionary, "长一点"); // "cháng yìdiǎn"
convert(dictionary, "队伍已经长极了"); // "duìwǔ yǐjīng cháng jíle"
convert(dictionary, "神经棘长而狭窄"); // "shénjīng jí cháng ér xiázhǎi"
convert(dictionary, "那条河长三百公里"); // "nà tiáo hé cháng sānbǎi gōnglǐ"
convert(dictionary, "那条河长300公里"); // "nà tiáo hé cháng sānbǎi gōnglǐ"
```

Only a distance or a stretch of time counts as a measurement, and the corpus is
why: a numeral after a 长 is more often counting something else, as in
学校现有通榆和新长两个校区 and 竞争马华总会长一职, and both of those are `zhǎng`.

Two more need both sides:

```ts
convert(dictionary, "那座桥不长。"); // "Nà zuò qiáo bù cháng."
convert(dictionary, "胡子不长在前额上"); // "húzi bù zhǎng zài qián'é shàng"
convert(dictionary, "他有长头发。"); // "Tā yǒu cháng tóufa."
convert(dictionary, "树长叶子"); // "shù zhǎng yèzi"
convert(dictionary, "我看见一个长头发的女生"); // "wǒ kànjiàn yí gè cháng tóufa de nǚshēng"
convert(dictionary, "这是我第一次长胡子"); // "zhè shì wǒ dìyīcì zhǎng húzi"
```

A 量词 in front is asked of every word ending there rather than the longest,
since 一个 is tagged a numeral and the 量词 is the 个 inside it. An ordinal is
excluded, because 第一次 is when the growing happened rather than what is being
counted.

不 and 还 scope a verb as readily as a quality, so neither is a degree adverb,
and a noun after a 长 is 长知识 as readily as 长头发. What separates the pairs is
the far side. A growing 长 governs something and an adjectival one has nothing
left to say, so a scoped 长 that closes its clause is the adjective; and a 量词
or 有 in front of a 长 leaves it nothing to be the verb of, since the subject is
already spoken for.

Over 88,866 lines, 379 长 and 長 decode as a word of their own and this moves
125 to `cháng`. On CPP's 40 hand-labelled 长 the character goes 85.00% to
92.50%.

A verb in front is **not** one of the contexts, though 他留长头发 wears long hair
where 他长头发 grows it. jieba tags 树 a verb and 习惯 a noun, so no tag names the
set, and taking every verb read 树长叶子 and 教育长邓演达 as adjectives.

The same rule pushes the other way on 越长越X, where growing is what the
correlative is about:

```ts
convert(dictionary, "他越长越高"); // "tā yuè zhǎng yuè gāo"
convert(dictionary, "时间越长越好"); // "shíjiān yuè cháng yuè hǎo"
```

越长 is a key read `yuè cháng`, and the only one of its shape. 越大, 越高, 越好
and 越快 are all absent, so 越高越好 decodes as two words while 越长越高 reaches
for a word no other member of the paradigm has. It carries no part of speech,
and that is how a reading somebody asserted is held rather than a word anybody
counted, and it comes from one source. Where the far half of the correlative
names something growing produces (高, 大, 胖, 壮, 结实) that edge is dropped and
the character's own `zhǎng` stands.

This one is a heuristic and is labelled as such. 越长 occurs three times in the
88,866 lines and all three are 越来越长 or 说的越长, so unlike the rest of the
page there is no corpus behind the shape. It is deliberately a `forbid` rather
than a `force`, which leaves `cháng` standing as a rival a single bucket dearer.
越长越X is genuinely ambiguous, since 孩子越长越漂亮 grows where 头发越长越漂亮
lengthens, so the decode answers with the likelier reading and still reports
itself as [guessing](../confidence/). 漂亮 is out of the list for that reason.

The sixth reads 弹 as `tán` where it is playing rather than a projectile:

```ts
convert(dictionary, "他会弹一点儿古筝。"); // "Tā huì tán yìdiǎnr gǔzhēng."
convert(dictionary, "他钢琴弹得很好"); // "tā gāngqín tán de hěn hǎo"
convert(dictionary, "子弹"); // "zǐdàn", through the word
```

弹 is stored `dàn` with `tán` as an alternate, and the sources agree about the
character alone (Unihan counts `dàn(313)` against `tán(50)`). That is a fact
about a corpus in which nearly every 弹 is ammunition, and every one of those is
a word that carries its own reading: 子弹, 炸弹, 导弹, 原子弹 and 手榴弹 were
right already. What the default was left deciding is the 弹 standing as a word
of its own, and in running text that one is the verb.

The object is what says so, as it is for 教, whether an instrument, a piece or
its composer after it, or 了, 过, 着 or 得, since only a verb takes those. That
object has to be **two characters or more**, the one place this departs from 教.
弹 joins bound morphemes into nouns far more readily, as in 着弹点, 掷弹兵,
供弹爪, 底排弹时 and 弹洞, and each of those puts a single tagged character
where an object would go, whereas what the verb governs is a word. 教 could not
take the same guard, 教我 and 教你 being its commonest shape. The other side
needs no guard, because the nominal compounds starting with 弹 are all listed.
弹匣, 弹坑, 弹壳, 弹片, 弹药, 弹道 and 弹头 reach their reading through the
word.

The 88,866 lines are the wrong corpus for this rule on their own, holding 38
bare 弹 of which 31 are somebody playing something, so CPP's 20,147 sentences
are measured with them as plain text. The benchmark is drawn from military
articles, where the shapes this can break live. Over the 109,013 lines together,
60 弹 decode as a word of their own, every one read `dàn`, and 34 of the 60 are
wrong. This moves 30, of which 29 are right and one is wrong, that one being
拆弹专家, a compound with an object's shape on both sides. It leaves five.
开始弹, 四手联弹 and 弹起三次 have no object to see, and
用那种指法弹不会觉得费力 and 反手持法去弹班卓琴 send the decode to 班 rather
than 班卓琴. On CPP's 40 hand-labelled 弹 nothing moves, all 40 having been
right through a word.

As with 教, forcing the single-character edge falls short on its own, since a
reading spanning two characters carries its own 弹 in. 我的爱好是开车和弹吉他
read `dàn` off 和弹, a pair held with no part of speech. A tagged word ending in
弹 is left alone, and that is every one that matters.

The seventh keeps a word beginning with 的 from starting where the structural
particle does:

```ts
convert(dictionary, "没有人知道他的真名字"); // "méiyǒu rén zhīdào tā de zhēn míngzi"
convert(dictionary, "我的确知道"); // "wǒ díquè zhīdào", a word jieba counted
convert(dictionary, "我要一辆的士"); // "wǒ yào yí liàng dī shì"
```

的 attaches to the modifier in front of it and the head follows, so a key
spanning that 的 and the head's first character is describing another sentence.
的真, 的卡, 的筆 and 的這 are all keys, and none of them is a word. Only an
untagged key is taken off the lattice, which is the same line the 教 rule draws:
的确, 的士 and 的哥 are words jieba counted, and each of them can genuinely
begin where this fires.

Over 88,866 lines it forbids edges in 40 runs and every one is a correction.
Half of them correct the spacing as much as the reading, since 你說的對 was one
word, `deduì`.

The eighth reads the 得 of a potential complement as the particle:

```ts
convert(dictionary, "他算得上一个作家"); // "tā suàn de shàng yí gè zuòjiā"
convert(dictionary, "取得上级批准"); // "qǔdé shàngjí pīzhǔn", the word
```

算得 is a key jieba counted and the phrase corpus reads `suàn dé`, which is what
it says standing alone and not what a complement leaves it doing. Both sides are
needed: a verb before the 得 rules out 只得上山, where the 得 belongs to an adverb,
and the complement after it has to stand on its own, which rules out 取得上级批准
where 上 is the front of 上级. 了 and 过 are left out of the complement set
because both are aspect markers too, and 获得了 and 赢得过 are far commoner than
吃得了 and 说得过去.

The ninth reads 过 toneless where it marks experiential aspect:

```ts
convert(dictionary, "他去过法国。"); // "Tā qùguo Fǎguó."
convert(dictionary, "我吃过饭了。"); // "Wǒ chīguo fàn le."
convert(dictionary, "他经过我家"); // "tā jīngguò wǒjiā", the word
```

The marker is toneless and the dictionary leads with `guò`, so every 去过, 见过
and 听说过 came out fourth tone. Aspect attaches to a verb and to nothing else.
A 过 with a verbal word ending immediately in front of it is the marker. What
follows says nothing either way, an object, a 了 and the end of the sentence all
standing behind the marker as readily as behind the verb 过.

Forcing the single-character edge falls short on its own, for the reason the 教
rule gives. 我从没见过风车 read `guò` off 见过 and 你已經吃過飯了 off 吃過飯. A
pair carrying no part of speech is taken off the lattice with it. A key of three
characters is a word in its own right and keeps its 过. That leaves 睡过头,
过马路 and 反应过度 alone.

Over 88,866 lines, 1,437 过 and 過 decode as a word of their own and every one of
them reads `guò`. This moves 1,002 and 29 more that no boundary had split out.
The condition was sized before the rule was written, and it is right on 939 of
the 998 it holds for. The 59 misses are a directional or resultative complement
(他游过了河, 他们转过身), 过 as a verb behind a modal (你要過聖誕節了嗎), 过
meaning to exceed (期望过高), and one noun.

Tightening it was measured and rejected. A written-out set of the verbs that take
a crossing 过 would carry the rule from 94% right to 96%, at the cost of
我在这个泳池里游过泳 and of every 跑过马拉松 these 88,866 lines do not happen to
hold.

Rules are exported (`READING_RULES`, `MODAL_DE`, `PARTICLE_DE`, `POTENTIAL_DE`,
`TEACHING_JIAO`, `ATTESTED_ERHUA`, `COUNTED_MEASURE`, `ADJECTIVAL_CHANG`,
`PLAYING_TAN`, `EXPERIENTIAL_GUO`, `applyEdgeRules`) and
`decodeRun` takes its own list, so an application with its own domain can add to
them or decode with none.

## Readings you assert yourself

No rule settles every polyphone, and some texts are genuinely ambiguous.
孩子越长越漂亮 grows where 头发越长越漂亮 lengthens, and the characters alone
leave the choice open. An application that knows its own content can say what
this one could only guess at, with the `readings` option:

```ts
convert(dictionary, "这篇文章不太长。", { readings: { 太长: "tài cháng" } });
```

The terse form is a plain object of text to reading, the shape a corrections
table takes after an application has accumulated a few. Keep it as a constant
and pass it everywhere:

```ts
const CORRECTIONS = { 太长: "tài cháng", 长头发: "cháng tóufa" };
convert(dictionary, text, { locale: "zh-CN", readings: CORRECTIONS });
```

**A word hint is an assertion about the text it names**, so it rewrites the
reading of exactly those characters and no more. It leaves a longer word that
happens to contain them alone:

```ts
convert(dictionary, "校长", { readings: { 长: "cháng" } }); // "xiàozhǎng"
```

That is deliberate, and it is what makes a corrections table safe to accumulate.
The dictionary knowing 校长 is better evidence about that stretch than a remark
about one of its characters, so an entry never reaches into a word nobody was
thinking about. Naming the whole word does reach it, and the word stays whole:

```ts
convert(dictionary, "银行", { readings: { 银行: "yín xíng" } }); // "yínxíng"
```

**A positional hint is an assertion about one character of one text**, and it
outranks everything, the enclosing word included. Positions are counted in code
points from the start of the text, across any non-Han runs in it, and the
reading is one syllable, since a position names one character:

```ts
convert(dictionary, "头发越长越漂亮", {
  readings: [{ at: 3, reading: "cháng" }],
});
convert(dictionary, "校长", { readings: [{ at: 1, reading: "cháng" }] }); // "xiàocháng"
```

The list form takes both kinds, so mix them where a table needs one exception.
An unmarked syllable is 轻声, as everywhere else here, and `{ 的: "de" }` is the
particle. Spacing is untouched, since a hint changes what a stretch reads as and
never where the words fall. A hint that cannot be parsed throws instead of being
skipped, because a correction that silently does nothing is worse than one that
fails.

## Non-Han text

Latin letters, punctuation and anything else that was never Han pass through
exactly as written. Digits are the one exception, and they are read.

```ts
convert(dictionary, "3D银行"); // "sān D yínháng"
convert(dictionary, "1998年"); // "yī jiǔ jiǔ bā nián"
convert(dictionary, "3D银行", { numbers: "keep" }); // "3Dyínháng"
```

**The Han around a number is decoded with that number beside it**, as the 汉字
it would have been written with. Without it a run has no idea what surrounded
it, and 2个人 read as `liǎng gèrén`, two _personals_, where 两个人 written out
has always been `liǎng gè rén`. The digits are read first, since what decides
how they are said is the character after them, which needs no decode, and the
runs are then decoded knowing them.

Both directions, since a rule reads both. 那条河长300公里 is four runs and the 长
ends the first of them, so a rule asking what the 长 is measured in used to see
nothing at all — the numeral is one run away and the 公里 two.

```ts
convert(dictionary, "那条河长300公里。"); // "Nà tiáo hé cháng sānbǎi gōnglǐ."
convert(dictionary, "那条河长三百公里。"); // "Nà tiáo hé cháng sānbǎi gōnglǐ."
```

The trailing context stops four characters past the number, which is as far as
a rule can look ahead.

Which style a number takes comes from what follows it, since 1998年 is a year
and 3个 is a count, and it needs no dictionary. `src/numerals/` is arithmetic
and about twenty readings. [Numbers](../numerals/) has the three rules and the
limits on what they guess at. `numbers: "keep"` leaves every digit exactly as it
was written, the behaviour this had before there was anything to read them with.

Once a digit _has_ been read, the letters beside it are being said too, which
is why `3D银行` gains a space it keeps none of under `numbers: "keep"`.

Full-width punctuation is the exception, being Chinese text and not foreign
text. `。，、；：？！` are rewritten as their Latin equivalents by default. See
[orthography](../orthography/#punctuation).

## Spacing, capitals and apostrophes

`convert` returns pinyin written the way the standard writes it, and never a
bare run of syllables. That means word spacing, capitals on proper nouns and
sentences, and 隔音符号 where a syllable boundary would otherwise be ambiguous.

```ts
convert(dictionary, "他看了"); // "tā kànle"
convert(dictionary, "南京市"); // "Nánjīng Shì"
convert(dictionary, "天安门"); // "Tiān'ānmén"
```

All of that is [orthography](../orthography/), including where it stops.

## The greedy baseline

`convertGreedily` decodes with longest-match instead, taking the longest
dictionary word at each position and never reconsidering. It is kept because it
is what the previous generation of this library did, and because having a
baseline in the repository is how the lattice's accuracy gets measured rather
than asserted.

```ts
import { convertGreedily } from "@kensio/pinyinjs";

convert(dictionary, "研究生命起源"); // "yánjiū shēngmìng qǐyuán"
convertGreedily(dictionary, "研究生命起源"); // "yánjiūshēng mìng qǐyuán"
```

Greedy takes 研究生 because it is longer, and 生命 loses. Both readings happen
to be right here, this being the ambiguity that stays clear of a polyphone, so
what it costs is the spacing.

Measured on 20,139 hand-labelled polyphonic characters, the lattice reads 91.30%
correctly against greedy's 91.08%. That is 72 characters it gets right where
greedy misses, against 28 the other way. Small, but real. Use `convert`.
`convertGreedily` is there to be compared against, and `pnpm accuracy` and
`pnpm polyphones` in the repository are what compare them.

## Getting more than a string back

| You want                               | Use                                                   |
| -------------------------------------- | ----------------------------------------------------- |
| the pinyin                             | `convert`                                             |
| one piece at a time, with confidence   | `convertPieces`, [confidence](../confidence/)         |
| marked-up HTML                         | `convertToHtml`, [HTML output](../html/)              |
| what the dictionary holds for one word | `dictionary.lookup`, [dictionaries](../dictionaries/) |

`convertPieces` is the general one. `convertToHtml` is exactly
`toHtml(convertPieces(…))`, and `joinPieces(convertPieces(…))` gives back what
`convert` returns, so anything the other two do you can do yourself from the
pieces.

`convert` calls the plain decode, though, and never `convertPieces`. Pricing the
alternatives costs a second sweep of the lattice, around 1.5× the work. Reach
for `convertPieces` when you want the confidence, rather than as the general
form of `convert`.

<!-- card
```ts
convert(dictionary, "银行"); // "yínháng"
convert(dictionary, "行长"); // "hángzhǎng"
convert(dictionary, "女儿"); // "nǚ'ér"
convert(dictionary, "1998年"); // "yī jiǔ jiǔ bā nián"
```
-->
