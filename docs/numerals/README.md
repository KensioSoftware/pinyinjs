# Numbers

Reading a number aloud needs no dictionary and no segmentation — arithmetic and
about twenty readings — so this is the one part of the package that works with
nothing loaded.

```ts
import { numeralHanzi, readNumeral } from "@kensio/pinyinjs";

numeralHanzi(12345); // "一万两千三百四十五"
numeralHanzi(2026, { style: "digits" }); // "二〇二六"
```

## The one hard question: counted, or spelled out?

The same digits go both ways, and nothing in the number says which:

```ts
numeralHanzi(2026); // "两千零二十六" — 2026个, a quantity
numeralHanzi(2026, { style: "digits" }); // "二〇二六" — 2026年, a year
```

Only what follows the number decides it — 年 spells it out, 个 counts it — so
the style is the caller's to choose and this module will do either. `cardinal`
is the default because a bare number is more often a quantity than a label.

## Counting

The awkward parts are 零 and the bare 十, and both are about saying the number
rather than about arithmetic.

```ts
numeralHanzi(10); // "十" — not 一十
numeralHanzi(115); // "一百一十五" — but here the 一 stays
numeralHanzi(1005); // "一千零五" — a skipped place is spoken
numeralHanzi(1500); // "一千五百" — a trailing one is not
numeralHanzi(25_000); // "两万五千"
numeralHanzi(20_050); // "两万零五十" — the lower group leaves a gap
numeralHanzi(100_000_005); // "一亿零五"
```

Numbers group by 万 rather than by thousands, which is why 12,345 is _one_ 万
and 2,345 rather than twelve thousand.

**两 or 二.** A lone 2 multiplying 千, 万 or 亿 is 两: 2,000 is 两千, 20,000 is
两万, and 12,000 is 一万两千. 二 stands wherever the 2 is not a multiplier — 12
is 十二, 20 is 二十, 200 is 二百, and 120,000 is 十二万, where the 二 is the units
digit of 12.

This is genuinely variable rather than a rule, so it is a choice of three.
现代汉语词典 has 二 before 百 and either before 千/万/亿, and then adds that the
二 of 三万二千 cannot be 两 — so the prescription is `leading` and what people
say is `always`:

```ts
numeralHanzi(12_000); // "一万两千" — always, the default
numeralHanzi(12_000, { liang: "leading" }); // "一万二千" — the 词典's own rule
numeralHanzi(12_000, { liang: "never" }); // "一万二千", and 二千 for 2,000 too
```

## Spelling digits out

```ts
numeralHanzi("007", { style: "digits" }); // "〇〇七" — the zeros survive
numeralHanzi("007"); // "七" — counted, they do not
numeralHanzi(2019, { style: "digits", zero: "零" }); // "二零一九"
```

Pass a **string** when the digits matter as digits: a room number keeps its
leading zeros and a `number` cannot.

## Reading

```ts
import { writeSyllable } from "@kensio/pinyinjs";

const said = (value, options) =>
  readNumeral(value, options)
    ?.map((s) => writeSyllable(s))
    .join(" ");

said(2026); // "liǎng qiān líng èr shí liù"
said(2026, { style: "digits" }); // "èr líng èr liù"
said(110, { style: "digits", yao: true }); // "yāo yāo líng"
said("3.14"); // "sān diǎn yī sì"
said(-40); // "fù sì shí"
```

`yāo` is how 一 is said when digits are read out one at a time — 110 is
`yāo yāo líng` and a room number is said the same way, because `yī` and `qī` are
hard to tell apart down a bad line. It is off by default, because 2019 is
`èr líng yī jiǔ` with an ordinary `yī`: it belongs to phone numbers rather than
to digits as such.

**Readings come back with underlying tones**, exactly as the dictionary's do, so
一 is `yī` whatever it will be said as. Run [sandhi](../sandhi/) over the result
to get what a speaker says:

```ts
import { applySandhi } from "@kensio/pinyinjs";

applySandhi(readNumeral(100) ?? []); // yì bǎi
```

**Sandhi belongs to a counted quantity and stops at the decimal point.** 一百 is
`yìbǎi`, but 110 spelled out is `yāo yāo líng` and never `yì yì líng`, and 3.14
is `sān diǎn yī sì`: a digit said on its own keeps its citation tone, and
everything after the point is read digit by digit whatever the style. The
`pinyinjs number` command does exactly this, and it is what a caller assembling
an utterance should do too.

## Percentages and fractions

Both reverse, which is why they are functions rather than something to assemble
by hand:

```ts
percentHanzi(95); // "百分之九十五" — "of a hundred parts, ninety-five"
fractionHanzi(3, 4); // "四分之三" — the denominator is named first
```

## On the command line

```console
$ pinyinjs number 2026 --digits
2026        二〇二六              èr líng èr liù

$ pinyinjs number 95 --percent
95          百分之九十五            bǎi fēn zhī jiǔ shí wǔ
```

No dictionary is loaded for it. See [the command line](../cli/).

## Numbers inside text

`convert` reads the digits it meets, choosing the style from what follows them:

```ts
convert(dictionary, "我有3个苹果。"); // "Wǒ yǒu sān gè píngguǒ."
convert(dictionary, "1988年之后"); // "yī jiǔ bā bā nián zhīhòu"
convert(dictionary, "95%的人"); // "bǎifēnzhījiǔshíwǔ de rén"
convert(dictionary, "3D打印"); // "sān D dǎyìn"
convert(dictionary, "我有3个", { numbers: "keep" }); // "wǒ yǒu3gè"
```

Three rules decide it, and they are deliberately few:

| The text              | What happens     | Why                                        |
| --------------------- | ---------------- | ------------------------------------------ |
| four digits before 年 | spelled out      | 1997年 is a year; 30年 is thirty years     |
| digits before % or ％ | 百分之, reversed | the sign is read, and read first           |
| anything else         | counted          | what almost every digit in running text is |

A number that has been read is a **word**: 25个 is `èrshíwǔ gè`, one word for
the number and a space before the measure word, which is what 正词法 6.1.5 asks
for. Digits spelled out are not a word — they are digits — so 1997年 is
`yī jiǔ jiǔ qī nián`. Sandhi crosses the boundary, so 1个 is `yí gè`: the tone
the 一 assimilates to is in the next word.

**A digit touching `:`, `-`, `/` or their full-width forms is left exactly as
written.** 6:30 is a time, 3202-5625 is a phone number and COVID-19 is a name;
none of them is a quantity, and the mark between the parts has no reading.

### What it does not guess

A bare four-digit year with nothing after it — `他生于1990。` — is counted
rather than spelled out. Measured over 88,866 lines, 68% of four-digit runs sit
directly in front of 年 and those are the ones handled; of the rest, some are
years in citations and some are quantities like 1500 or 2000人, and nothing in
the text separates them. Reading a quantity as a year is a reading error rather
than a spacing one, so the rule stops where the evidence does.

Dates beyond 年月日, currency, and phone numbers read as `yāo` are the same
kind of problem and are not built either.

## How this is measured

CC-CEDICT has 20 headwords with digits in them and reads 17 of those digit runs
out, which is the only transcription of digit readings any source here carries.
`pnpm numerals` scores against it: all 17 match, 14 with plain digits and 3 —
110, 119, 120 — needing `yāo`. Every one of them is spelled out rather than
counted, which is a finding rather than a coincidence: the cardinal style is
unattested in that data and had to be tested against worked examples instead.

The same harness converts those headwords end to end, and there 7 of 17 match.
The ten that do not are all one thing: a bare number CC-CEDICT reads as a label
— 110, 88, 996, 95后 — where `convert` counts it. Nothing in running text
separates 我有110个 from 打110, so this is a limit rather than a defect, and the
number is recorded rather than smoothed over.
