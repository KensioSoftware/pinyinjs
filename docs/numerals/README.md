# Numbers

Reading a number aloud needs no dictionary and no segmentation — arithmetic and
about twenty readings — so this is the one part of the package that works with
nothing loaded.

```ts
import { numeralHanzi, readNumeral } from "@kensio/pinyinjs";

numeralHanzi(12345); // "一万二千三百四十五"
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

**两 or 二.** A leading lone 2 in front of a big unit is 两: 2,000 is 两千 and
20,000 is 两万. 二 stands everywhere else — 12 is 十二, 20 is 二十, and inside a
longer number the 千 keeps its 二, so 12,000 is 一万二千. `liang: false` writes
二 throughout.

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

## What is not built

Everything above is the number itself. What is _not_ here is the context that
picks a style for it — a number inside hanzi text is still passed through as
written, so `convert(dictionary, "3D打印")` is `3Ddǎyìn` rather than
`sān D dǎyìn`. Dates, currency, phone numbers and the alphanumeric compounds
are the same problem in different clothes: they are all about reading what
surrounds the digits, and none of them changes how the digits themselves are
said.

## How this is measured

CC-CEDICT has 20 headwords with digits in them and reads 17 of those digit runs
out, which is the only transcription of digit readings any source here carries.
`pnpm numerals` scores against it: all 17 match, 14 with plain digits and 3 —
110, 119, 120 — needing `yāo`. Every one of them is spelled out rather than
counted, which is a finding rather than a coincidence: the cardinal style is
unattested in that data and had to be tested against worked examples instead.
