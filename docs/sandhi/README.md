# Sandhi

Tone sandhi is applied to the syllable array rather than to a string, so it can
be switched off, works across word boundaries, and cannot be confused by the
spelling.

```ts
import { applySandhi, readWord } from "@kensio/pinyinjs";

const buShi = readWord("bùshì") ?? [];
applySandhi(buShi); // bú shì — 不 flattens before a fourth tone
applySandhi(buShi, { yiBu: false }); // unchanged

const niHao = readWord("nǐhǎo") ?? [];
applySandhi(niHao); // unchanged by default
applySandhi(niHao, { thirdTone: true }); // ní hǎo
```

The dictionary stores _underlying_ tones — the source data has sandhi baked in,
and the build normalises it out — which is what makes any of this optional.
A package that stored 不 as `bú` could never give you `bù` back.

## 一 and 不

On by default.

**不** is `bù`, and flattens to `bú` before a fourth tone:

```ts
convert(dictionary, "不是"); // "bú shì"
convert(dictionary, "不对"); // "bú duì"
convert(dictionary, "不行"); // "bùxíng" — 行 is second tone here, so no change
```

**一** is `yī`, and becomes `yì` before tones 1, 2 and 3, `yí` before tone 4,
and stays `yī` in ordinals and in final position:

```ts
convert(dictionary, "一天"); // "yì tiān" — before first tone
convert(dictionary, "一起"); // "yìqǐ" — before third tone
convert(dictionary, "一个"); // "yí gè" — before fourth tone
convert(dictionary, "一样"); // "yíyàng"
convert(dictionary, "第一"); // "dìyī" — ordinal, unchanged
```

### The 一 that is not counting

That last line is a rule of its own, and it is the half most converters get
wrong. 一 assimilates when it is **counting**; it keeps its citation tone when
it is a digit or an ordinal:

```ts
convert(dictionary, "十一月"); // "shíyīyuè" — a last digit, not a quantity
convert(dictionary, "十一点"); // "shíyīdiǎn"
convert(dictionary, "第一次"); // "dìyīcì" — ordinal
convert(dictionary, "万一你来"); // "wànyī nǐ lái"
convert(dictionary, "31日"); // "sānshíyī rì" — the same through the digits
convert(dictionary, "一个"); // "yí gè" — still counting, so still assimilates
```

The signal is a numeral word before the 一 with nothing numeric after it, which
is what leaves 一百一十's middle 一 alone: 十 follows it, so it is counting the
ten.

**The pass reads syllables and never characters**, because that is all it has —
`pinyinjs sandhi shíyī gè` is given no hanzi at all. So it cannot tell 十 from
时 or 第 from 地, and that costs something measurable. Over 88,866 lines of
Tatoeba and zh.wikipedia:

|                             |       |
| --------------------------- | ----: |
| 一 conversions changed      |   561 |
| put right                   |   520 |
| broken — 当时一个, 兄弟一样 |    41 |
| precision                   | 92.7% |

亿 is deliberately not in the numeral set, and that is measured rather than
assumed: no 一 in that text ends a number in 亿, while 意, 议, 义 and 議 all
read `yì`, all precede a 一 that really is counting, and would all have lost
their sandhi for it — 11 conversions against nothing gained.

Turn both off with `sandhi: { yiBu: false }`, or `--no-sandhi` at the command
line.

## Third tone

Off by default.

A third tone before another third tone is said as a second tone, so 你好 is
spoken `ní hǎo`. Standard orthography writes the underlying tones anyway, which
is why this is not on:

```ts
convert(dictionary, "好好"); // "hǎohǎo"
convert(dictionary, "好好", { sandhi: { thirdTone: true } }); // "háohǎo"
```

Turn it on when you are transcribing how something is _said_ — a
pronunciation guide, a speech exercise, subtitles for a listening task — and
leave it off when you are writing pinyin as text.

```ts
const henHao = readWord("hěnhǎo") ?? [];
applySandhi(henHao); // hěn hǎo
applySandhi(henHao, { thirdTone: true }); // hén hǎo
```

## Across word boundaries

Because the pass runs over the syllable array rather than per word, a sandhi
trigger works across a boundary the decoder put in. 不 followed by a fourth
tone in the next word still flattens.

## Options

`applySandhi(syllables, options?)` takes the same object as the `sandhi` field
of [`ConvertOptions`](../options/#sandhi):

| Field       | Default | Does                         |
| ----------- | ------- | ---------------------------- |
| `yiBu`      | `true`  | 一 and 不 tone changes       |
| `thirdTone` | `false` | third tone before third tone |

It is merged with the defaults, so `{ thirdTone: true }` leaves `yiBu` on.

## What is not implemented

儿化 is handled, but as a dictionary fact rather than as a sandhi rule — see
[orthography](../orthography/). The half-third-tone allophone (a
third tone before a non-third tone, said as a low fall with no rise) is not
written, because it has no distinct pinyin spelling to write.

## From the command line

```console
$ pinyinjs sandhi bùshì
bùshì  bú shì

$ pinyinjs sandhi --third-tone nǐhǎo
nǐhǎo  ní hǎo
```

`sandhi` takes written pinyin and needs no dictionary. The same two flags —
`--no-sandhi` and `--third-tone` — also work on `convert`, `html` and
`explain`.

<!-- card
```ts
convert(dictionary, "不是"); // "bú shì"
convert(dictionary, "一个"); // "yí gè"
convert(dictionary, "好好"); // "hǎohǎo"
convert(dictionary, "好好", { sandhi: { thirdTone: true } });
// "háohǎo"
```
-->
