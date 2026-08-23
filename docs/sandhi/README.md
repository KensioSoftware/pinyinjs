# Sandhi

Tone sandhi is applied to the syllable array. It can be switched off, it works
across word boundaries, and the spelling cannot confuse it.

```ts
import { applySandhi, readWord } from "@kensio/pinyinjs";

const buShi = readWord("bùshì") ?? [];
applySandhi(buShi); // bú shì, 不 flattens before a fourth tone
applySandhi(buShi, { yiBu: false }); // unchanged

const niHao = readWord("nǐhǎo") ?? [];
applySandhi(niHao); // unchanged by default
applySandhi(niHao, { thirdTone: true }); // ní hǎo
```

The dictionary stores _underlying_ tones, since the source data has sandhi baked
in and the build normalises it out. That is what makes any of this optional. A
package that stored 不 as `bú` could never give you `bù` back.

## 一 and 不

On by default.

**不** is `bù`, and flattens to `bú` before a fourth tone:

```ts
convert(dictionary, "不是"); // "bú shì"
convert(dictionary, "不对"); // "bú duì"
convert(dictionary, "不行"); // "bùxíng", 行 is second tone here, so no change
```

**一** is `yī`, and becomes `yì` before tones 1, 2 and 3, `yí` before tone 4,
and stays `yī` in ordinals and in final position:

```ts
convert(dictionary, "一天"); // "yì tiān", before first tone
convert(dictionary, "一起"); // "yìqǐ", before third tone
convert(dictionary, "一个"); // "yí gè", before fourth tone
convert(dictionary, "一样"); // "yíyàng"
convert(dictionary, "第一"); // "dìyī", ordinal, unchanged
```

### The 一 that is a digit

That last line is a rule of its own, and it is the half most converters get
wrong. 一 assimilates when it is **counting**, and keeps its citation tone when
it is a digit or an ordinal:

```ts
convert(dictionary, "十一月"); // "shíyīyuè", a last digit, not a quantity
convert(dictionary, "十一点"); // "shíyīdiǎn"
convert(dictionary, "第一次"); // "dìyīcì", ordinal
convert(dictionary, "万一你来"); // "wànyī nǐ lái"
convert(dictionary, "31日"); // "sānshíyī rì", the same through the digits
convert(dictionary, "一个"); // "yí gè", still counting, so still assimilates
```

The signal is a numeral word before the 一 with no numeral after it. That is
what leaves 一百一十's middle 一 alone. 十 follows it, and it is counting the
ten.

**The pass reads syllables and never characters**, because that is all it has.
`pinyinjs sandhi shíyī gè` is given no hanzi at all. So it cannot tell 十 from
时 or 第 from 地, and that costs something measurable. Over 88,866 lines of
Tatoeba and zh.wikipedia:

|                             |       |
| --------------------------- | ----: |
| 一 conversions changed      |   561 |
| put right                   |   520 |
| broken (当时一个, 兄弟一样) |    41 |
| precision                   | 92.7% |

亿 is deliberately left out of the numeral set, and that was measured. No 一 in
that text ends a number in 亿, while 意, 议, 义 and 議 all read `yì`, all
precede a 一 that really is counting, and would all have lost their sandhi for
it. That is 11 conversions broken and none gained.

Turn both off with `sandhi: { yiBu: false }`, or `--no-sandhi` at the command
line.

## Third tone

Off by default.

A third tone before another third tone is said as a second tone, so 你好 is
spoken `ní hǎo`. Standard orthography writes the underlying tones anyway, and
that is why this stays off:

```ts
convert(dictionary, "好好"); // "hǎohǎo"
convert(dictionary, "好好", { sandhi: { thirdTone: true } }); // "háohǎo"
```

Turn it on when you are transcribing how something is _said_, for a
pronunciation guide, a speech exercise or subtitles for a listening task, and
leave it off when you are writing pinyin as text.

```ts
const henHao = readWord("hěnhǎo") ?? [];
applySandhi(henHao); // hěn hǎo
applySandhi(henHao, { thirdTone: true }); // hén hǎo
```

### Its domain is the prosodic foot

Stated as "a third tone before another third tone", the rule is wrong about as
often as it is right. What it actually applies inside is the prosodic foot, and
feet are built out of structure. The standard reference is
[Shih 1986](https://www.researchgate.net/publication/36071823_The_Prosodic_Domain_of_Tone_Sandhi_in_Chinese),
and the work since finds sandhi obligatory within a foot and progressively more
optional across larger prosodic boundaries.

Three things follow, and a left-to-right scan of the syllables gets all three
wrong:

```ts
const said = { sandhi: { thirdTone: true } };
convert(dictionary, "展览馆", said); // "zhánlánguǎn", 展览 + 馆
convert(dictionary, "纸老虎", said); // "zhǐláohǔ", 纸 + 老虎
convert(dictionary, "老板很好", said); // "láobǎn hén hǎo"
```

1. **Inside a word, the division decides.** 展覽館 is 展覽 + 館, so 覽 lowers
   against 館. 紙老虎 is 紙 + 老虎, so 老 lowers against 虎 first and 紙 is left
   facing a second tone it cannot assimilate to. The dictionary is asked where a
   word divides. A division is proposed only where **both halves are words in
   their own right**, and the most even one wins.
2. **A monosyllabic word leans on the word after it** and joins its foot. That
   lowers the 很 of 很喜歡, and the 我 and 也 of 我也很好 (`wó yé hén hǎo`).
3. **Two full words are two feet.** 行長 and 很喜歡 do not form one, so
   這家銀行的行長很喜歡旅行 is `hángzhǎng hén xǐhuan` and not `hángzháng hén`.

What that gives up is the monosyllable leaning **backwards**. 保管好 is
`báoguán hǎo`, its 好 a complement of the verb in front of it, and this writes
`báoguǎn hǎo`. Telling that apart from 老闆很好 means knowing which way the
monosyllable attaches, a question about syntax that the words alone cannot
answer.

## Across word boundaries

The pass runs over the whole syllable array at once. A sandhi trigger works
across a boundary the decoder put in. 不 followed by a fourth tone in the next
word still flattens.

一 and 不 assimilate to whatever follows and need only the syllables. Third-tone
sandhi needs to know where the words are, so `convert` passes the grouping the
decoder found. Calling `applySandhi` directly with only a reading takes the
whole of it for one word, which is all a bare reading says. Pass a
`SandhiGrouping` where you know better:

```ts
const reading = readWord("hángzhǎnghěnxǐhuan") ?? [];
applySandhi(reading, { thirdTone: true }); // háng zháng hén xǐ huan
applySandhi(reading, { thirdTone: true }, [2, 1, 2]); // háng zhǎng hén xǐ huan
```

One entry per word, holding its syllable count, or the counts of the parts it
divides into, as `[[1, 2]]` for 紙老虎. A grouping that fails to account for
exactly the syllables given is ignored. The `sandhi` command splits its argument
on whitespace to get one, since that is the only boundary written pinyin has.

## Options

`applySandhi(syllables, options?, grouping?)` takes the same object as the
`sandhi` field of [`ConvertOptions`](../options/#sandhi):

| Field       | Default | Does                         |
| ----------- | ------- | ---------------------------- |
| `yiBu`      | `true`  | 一 and 不 tone changes       |
| `thirdTone` | `false` | third tone before third tone |

It is merged with the defaults, so `{ thirdTone: true }` leaves `yiBu` on.

## Where it stops

儿化 is handled as a dictionary fact, over in [orthography](../orthography/),
and no sandhi rule here touches it. The half-third-tone allophone (a third tone
before a non-third tone, said as a low fall with no rise) goes unwritten,
because it has no distinct pinyin spelling to write.

## From the command line

```console
$ pinyinjs sandhi bùshì
bùshì  bú shì

$ pinyinjs sandhi --third-tone nǐhǎo
nǐhǎo  ní hǎo
```

`sandhi` takes written pinyin and needs no dictionary. The same two flags,
`--no-sandhi` and `--third-tone`, also work on `convert`, `html` and `explain`.

<!-- card
```ts
convert(dictionary, "不是"); // "bú shì"
convert(dictionary, "一个"); // "yí gè"
convert(dictionary, "好好"); // "hǎohǎo"
convert(dictionary, "好好", { sandhi: { thirdTone: true } });
// "háohǎo"
```
-->
