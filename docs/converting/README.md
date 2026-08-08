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
in full in [options](../options/); this page is about what happens between the
two arguments and the string that comes back.

## Why it is not a lookup table

行 has four readings, `xíng`, `háng`, `héng` and `hàng`, and nothing about the
character says which one to write. 银行 is `yínháng` and 行长 is `hángzhǎng`.
A per-character table cannot get both right, and picking the commonest reading
gets one of them wrong every time.

So the unit is the word, and the words have to be found in the text before
anything can be read. That is segmentation, and it is ambiguous in its own
right: 南京市长江大桥 is 南京市 / 长江 / 大桥 or 南京 / 市长 / 江大桥, and the
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
scoring can move it, which is about two thirds of positions in running text. Only the
short stretches between locked positions get a shortest-path decode, and they
are typically two to six characters long.

**Segmentation ambiguity that does not cross a polyphone cannot produce a wrong
reading.** 研究生命起源 splits as 研究生 / 命 or 研究 / 生命 and reads the same
either way. It does change the spacing, which is why segmentation still matters,
but a spacing mistake is ugly and readable where a reading mistake is simply
wrong. The two are held to different bars on purpose.

The consequence you can see from outside is that the decoder knows when it was
choosing, and will tell you: see [confidence](../confidence/).

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
until this. What separates them is entirely contextual: the particle attaches to
the verb or adjective in front of it, so a 得 with a pronoun, adverb or time
word before it and a verb phrase after it is not that particle.

The second is 教, which is `jiào` in the dictionary and `jiāo` when it teaches:

```ts
convert(dictionary, "他在北京大学教了三年书。"); // "Tā zài Běijīng Dàxué jiāole sān nián shū."
convert(dictionary, "我教英语"); // "wǒ jiāo Yīngyǔ"
convert(dictionary, "教育"); // "jiàoyù", and 宗教 is `zōngjiào`
```

The compounds carry their own reading and are right already; what is left is
the 教 standing as a word of its own, and that one is the verb. The object is
what says so — a pronoun, a noun or a name after it, or an aspect particle,
since only a verb takes 了, 过 or 得. Over 88,866 lines 181 教 decode as a word
of their own and every one read `jiào`; this moves 158 and is wrong on three,
where a nominal compound takes an object's shape: 统一教创始人, 方法教深思 and
做到了教政分离.

The third rule keeps 儿 from standing on its own where the dictionary says it
should not:

```ts
convert(dictionary, "那边儿"); // "nà biānr", not "nàbian ér"
convert(dictionary, "女儿"); // "nǚ'ér", a syllable of its own, and stays one
```

儿化 is a per-word dictionary fact, and 2,009 of the 2,067 words ending in 儿
carry it, but 那边儿 is not listed while 这边儿, 上边儿 and 旁边儿 are. Where
the character in front of a 儿 makes an attested 儿化 word, the reading that
leaves 儿 stranded as `ér` is taken off the lattice. That asserts nothing new:
边儿 is `biānr` because the dictionary says so. The spacing is still not what
GB/T 16159 wants, since 那边儿 is one word and this writes two, because the word
it would need is precisely the one missing.

The fourth keeps a 量词 out of the word behind it where a number is counting
with it:

```ts
convert(dictionary, "三个人"); // "sān gè rén", three people
convert(dictionary, "个人"); // "gèrén", the word, with nothing counting
convert(dictionary, "五分钟"); // "wǔ fēnzhōng", untouched
```

个人 is a common noun, so 三个人 read as three _personals_ and nothing weighed
that against the 个 belonging to the 三 in front of it. What makes it decidable
is the dictionary's own tagging: 个, 次, 天 and 杯 are 量词 and the characters
that merely look like one here are not — 分 is a verb, 部 and 成 are nouns, 年
and 点 are numerals — so 五分钟, 三部分, 五成分 and 五年级 are left alone, and
those are exactly the words a rule firing on every character after a number
would break. An ordinal counts nothing, so 第三集团军 is left alone too, and a
numeral inside a longer word is not counting either: the 一 of 唯一道路 belongs
to 唯一.

Over 88,866 lines it forbids 561 edges and moves 53 decodes, of which three are
wrong: 一批评, 这一名词 and 六七股灾, where the 一 and the 六七 are not counting
anything and no tag says so. One reading changes in the whole corpus, and it is
a fix — 下了两天雨 read 天雨 as `tiān yù`.

The fifth reads 长 as `cháng` where an adverb of degree measures it:

```ts
convert(dictionary, "这篇文章不太长。"); // "Zhè piān wénzhāng bú tài cháng."
convert(dictionary, "要多长时间"); // "yào duō cháng shíjiān"
convert(dictionary, "她长得很漂亮"); // "tā zhǎng de hěn piàoliang", growing
convert(dictionary, "校长"); // "xiàozhǎng", through the word
```

长 is stored `zhǎng` with `cháng` as an alternate, which is what the sources
say about the character alone — Unihan counts `zhǎng(1879)` against
`cháng(1179)` — and that default earns its place: 署长, 团长, 公安局长 and 总会长
all reach a bare 长 at the end of a title and read it correctly. The gap was the
adjective, which no word covers and nothing in the cost model could prefer.

Only the left side of the context carries information, as with 得. A growing 长
is a verb and no 很, 太, 最 or 多 modifies one, whereas what follows an
adjectival 长 is a noun, a particle or the end of the sentence — which is what
follows half the verbs too. 得, 着 and the 越…越 correlative are guarded, since
真长得很快 and 越长越高 are reachable from both sides; 了 and 的 are not, because
after an adverb they are the sentence particle and the attributive, which makes
时间太长了 and 很长的道路 both `cháng`.

Over 88,866 lines, 260 长 decode as a word of their own and this moves 75 to
`cháng`, all 75 correctly. On CPP's 40 hand-labelled 长 the character goes
85.00% to 87.50%; the shapes left are the ones no adverb marks — 长约8分,
干流长175公里 and 存续期长而明显.

The same rule pushes the other way on 越长越X, where growing is what the
correlative is about:

```ts
convert(dictionary, "他越长越高"); // "tā yuè zhǎng yuè gāo"
convert(dictionary, "时间越长越好"); // "shíjiān yuè cháng yuè hǎo"
```

越长 is a key read `yuè cháng`, and the only one of its shape — 越大, 越高, 越好
and 越快 are all absent, so 越高越好 decodes as two words while 越长越高 reaches
for a word nothing else in the paradigm has. It carries no part of speech, which
is how a reading somebody asserted is held rather than a word anybody counted,
and it comes from one source. Where the far half of the correlative names
something growing produces — 高, 大, 胖, 壮, 结实 — that edge is dropped and the
character's own `zhǎng` stands.

This one is a heuristic and is labelled as such: 越长 occurs three times in the
88,866 lines and all three are 越来越长 or 说的越长, so unlike the rest of the
page there is no corpus behind the shape. It is deliberately a `forbid` rather
than a `force`, which leaves `cháng` standing as a rival a single bucket dearer
— 越长越X is genuinely ambiguous, since 孩子越长越漂亮 grows where 头发越长越漂亮
lengthens, so the decode answers with the likelier reading and still reports
itself as [guessing](../confidence/). 漂亮 is out of the list for that reason.

Rules are exported (`READING_RULES`, `MODAL_DE`, `TEACHING_JIAO`,
`ATTESTED_ERHUA`, `COUNTED_MEASURE`, `ADJECTIVAL_CHANG`, `applyEdgeRules`) and
`decodeRun` takes its own list, so an application with its own domain can add to
them or decode with none.

## Readings you assert yourself

No rule settles every polyphone, and some texts are genuinely ambiguous — 孩子越
长越漂亮 grows where 头发越长越漂亮 lengthens, and nothing in the characters says
which. An application that knows its own content can say what this one could
only guess at, with the `readings` option:

```ts
convert(dictionary, "这篇文章不太长。", { readings: { 太长: "tài cháng" } });
```

The terse form is a plain object of text to reading, which is what a corrections
table looks like after an application has accumulated a few. Keep it as a
constant and pass it everywhere:

```ts
const CORRECTIONS = { 太长: "tài cháng", 长头发: "cháng tóufa" };
convert(dictionary, text, { locale: "zh-CN", readings: CORRECTIONS });
```

**A word hint is an assertion about the text it names**, so it rewrites the
reading of exactly those characters and no more. It says nothing about a longer
word that happens to contain them:

```ts
convert(dictionary, "校长", { readings: { 长: "cháng" } }); // "xiàozhǎng"
```

That is deliberate, and it is what makes a corrections table safe to accumulate:
the dictionary knowing 校长 is better evidence about that stretch than a remark
about one of its characters, so entries do not reach into words nobody was
thinking about. Naming the whole word does reach it, and the word stays whole:

```ts
convert(dictionary, "银行", { readings: { 银行: "yín xíng" } }); // "yínxíng"
```

**A positional hint is an assertion about one character of one text**, and
nothing outranks it — the enclosing word included. Positions are counted in code
points from the start of the text, across any non-Han runs in it:

```ts
convert(dictionary, "头发越长越漂亮", {
  readings: [{ at: 3, reading: "cháng" }],
});
convert(dictionary, "校长", { readings: [{ at: 1, reading: "cháng" }] }); // "xiàocháng"
```

The list form takes both kinds, so mix them where a table needs one exception.
An unmarked syllable is 轻声, as everywhere else here: `{ 的: "de" }` is the
particle. Spacing is untouched — a hint changes what a stretch reads as, not
where the words fall — and a hint that cannot be parsed throws rather than being
skipped, since a correction silently doing nothing is worse than one that fails.

## Non-Han text

Latin letters, punctuation and anything else that was never Han pass through
exactly as written. Digits are the one thing that does not: they are read.

```ts
convert(dictionary, "3D银行"); // "sān D yínháng"
convert(dictionary, "1998年"); // "yī jiǔ jiǔ bā nián"
convert(dictionary, "3D银行", { numbers: "keep" }); // "3Dyínháng"
```

**The Han after a number is decoded with that number in front of it**, as the
汉字 it would have been written with. Without it a run has no idea what preceded
it, and 2个人 read as `liǎng gèrén`, two _personals_, where 两个人 written out
has always been `liǎng gè rén`. The digits are read first — what decides how
they are said is the character after them, which needs no decode — and the run
is then decoded knowing them.

Which style a number takes comes from what follows it, since 1998年 is a year
and 3个 is a count, and it needs no dictionary: `src/numerals/` is arithmetic and
about twenty readings. [Numbers](../numerals/) has the three rules and what
they deliberately do not guess at. `numbers: "keep"` leaves every digit exactly
as it was written, which is what this did before there was anything to read
them with.

Once a digit _has_ been read, the letters beside it are being said too, which
is why `3D银行` gains a space it keeps none of under `numbers: "keep"`.

Full-width punctuation is the exception, because it is Chinese text rather than
foreign text: `。，、；：？！` are rewritten as their Latin equivalents by
default. See [orthography](../orthography/#punctuation).

## Spacing, capitals and apostrophes

`convert` does not return a run of syllables. It returns pinyin written the way
the standard writes it, which means word spacing, capitals on proper nouns and
sentences, and 隔音符号 where a syllable boundary would otherwise be ambiguous.

```ts
convert(dictionary, "他看了"); // "tā kànle"
convert(dictionary, "南京市"); // "Nánjīng Shì"
convert(dictionary, "天安门"); // "Tiān'ānmén"
```

All of that is [orthography](../orthography/), including what it does not do.

## The greedy baseline

`convertGreedily` decodes with longest-match instead: take the longest
dictionary word at each position, never reconsider. It is kept because it is
what the previous generation of this library did, and because having a baseline
in the repository is how the lattice's accuracy gets measured rather than
asserted.

```ts
import { convertGreedily } from "@kensio/pinyinjs";

convert(dictionary, "研究生命起源"); // "yánjiū shēngmìng qǐyuán"
convertGreedily(dictionary, "研究生命起源"); // "yánjiūshēng mìng qǐyuán"
```

Greedy takes 研究生 because it is longer, and 生命 loses. Both readings happen
to be right here, this being the ambiguity that does not cross a polyphone, so
what it costs is the spacing.

Measured on 20,139 hand-labelled polyphonic characters, the lattice reads
90.34% correctly against greedy's 90.11%: 76 characters it gets right that
greedy does not, against 31 the other way. Small, but real. Use `convert`;
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

`convert` does not call `convertPieces` internally, though. Pricing the
alternatives costs a second sweep of the lattice, around 1.5× the work, so
`convert` runs the decode that does not do it. Reach for `convertPieces` when
you want the confidence, not as the general form of `convert`.

<!-- card
```ts
convert(dictionary, "银行"); // "yínháng"
convert(dictionary, "行长"); // "hángzhǎng"
convert(dictionary, "女儿"); // "nǚ'ér"
convert(dictionary, "1998年"); // "yī jiǔ jiǔ bā nián"
```
-->
