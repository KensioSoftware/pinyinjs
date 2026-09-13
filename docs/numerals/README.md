# Numbers

PinyinJS converts numbers to Chinese numerals and pinyin without loading a dictionary.

```ts
import { numeralHanzi, readNumeral } from "@kensio/pinyinjs";

numeralHanzi(12345); // "一万两千三百四十五"
numeralHanzi(2026, { style: "digits" }); // "二〇二六"
```

<a id="the-one-hard-question-counted-or-spelled-out"></a>

## Quantities and digit sequences

A number can be read as a quantity or as individual digits:

```ts
numeralHanzi(2026); // "两千零二十六", 2026个, a quantity
numeralHanzi(2026, { style: "digits" }); // "二〇二六", 2026年, a year
```

Choose the style for standalone numbers. For example, a year is usually read digit by digit, while a count uses a quantity. The default style is `cardinal`.

## Counting

The following rules determine where 零 and 十 appear:

```ts
numeralHanzi(10); // "十", not 一十
numeralHanzi(115); // "一百一十五", but here the 一 stays
numeralHanzi(1005); // "一千零五", a skipped place is spoken
numeralHanzi(1500); // "一千五百", a trailing one is not
numeralHanzi(25_000); // "两万五千"
numeralHanzi(20_050); // "两万零五十", the lower group leaves a gap
numeralHanzi(100_000_005); // "一亿零五"
```

Chinese groups large numbers by 万 (ten thousand). For example, 12,345 is one 万 plus 2,345.

With the default setting, a lone 2 before 千, 万 or 亿 is written 两. Examples include 两千, 两万 and 一万两千. Other positions use 二, as in 十二, 二十, 二百 and 十二万.

The `liang` option controls this choice. `leading` follows the dictionary prescription that excludes 两 in forms such as 三万二千. `always` also permits 两 there:

```ts
numeralHanzi(12_000); // "一万两千", always, the default
numeralHanzi(12_000, { liang: "leading" }); // "一万二千", the 词典's own rule
numeralHanzi(12_000, { liang: "never" }); // "一万二千", and 二千 for 2,000 too
```

Set `counts` when a standalone 2 counts a following noun or measure word, as in 两个西瓜 or 两个人:

```ts
numeralHanzi(2); // "二", a number counting nothing
numeralHanzi(2, { counts: true }); // "两", 两个西瓜
numeralHanzi(12, { counts: true }); // "十二", the 二 of 十二个 is inside the number
numeralHanzi(200, { counts: true }); // "二百", and so is the 二 of 二百个
```

This changes only a standalone 2. `liang: "never"` keeps 二 even when `counts` is set.

## Spelling digits out

```ts
numeralHanzi("007", { style: "digits" }); // "〇〇七", the zeros survive
numeralHanzi("007"); // "七", counted, they do not
numeralHanzi(2019, { style: "digits", zero: "零" }); // "二零一九"
```

Pass a string to preserve leading zeros, such as those in a room number. A JavaScript `number` cannot retain them.

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

The optional `yao` setting reads 一 as `yāo` in digit sequences, as in telephone numbers. It is off by default. Ordinary year readings use `yī`, as in 2019 (`èr líng yī jiǔ`).

The returned syllables have underlying tones. For example, 一 is returned as `yī`. Apply [tone sandhi](../sandhi/) when you need its contextual spoken tone:

```ts
import { applySandhi } from "@kensio/pinyinjs";

applySandhi(readNumeral(100) ?? []); // yì bǎi
```

Apply sandhi to the integer part of a cardinal number. Individually spoken digits retain their underlying tones, including digits after a decimal point. For example, 一百 becomes `yìbǎi`, while 3.14 is `sān diǎn yī sì`. The `pinyinjs number` command applies this distinction.

## Percentages and fractions

Chinese reads the denominator before the numerator. Use these functions for the correct order:

```ts
percentHanzi(95); // "百分之九十五", "of a hundred parts, ninety-five"
fractionHanzi(3, 4); // "四分之三", the denominator is named first
```

## On the command line

```console
$ pinyinjs number 2026 --digits
2026        二〇二六              èr líng èr liù

$ pinyinjs number 95 --percent
95          百分之九十五            bǎi fēn zhī jiǔ shí wǔ
```

The command runs without a dictionary. See [the command line](../cli/) for its options.

## Numbers inside text

`convert` reads numbers within Chinese text and infers their style from the surrounding characters:

```ts
convert(dictionary, "我有3个苹果。"); // "Wǒ yǒu sān gè píngguǒ."
convert(dictionary, "1988年之后"); // "yī jiǔ bā bā nián zhīhòu"
convert(dictionary, "95%的人"); // "bǎifēnzhījiǔshíwǔ de rén"
convert(dictionary, "3D打印"); // "sān D dǎyìn"
convert(dictionary, "我有3个", { numbers: "keep" }); // "wǒ yǒu3gè"
```

Style selection follows these rules:

| The text              | What happens     | Why                                        |
| --------------------- | ---------------- | ------------------------------------------ |
| four digits before 年 | spelled out      | 1998年 is a year; 30年 is thirty years     |
| digits before % or ％ | 百分之, reversed | the sign is read, and read first           |
| anything else         | counted          | what almost every digit in running text is |

A standalone 2 immediately before a Han character normally reads 两. This sets the `counts` behaviour described above:

```ts
convert(dictionary, "我们买了2个西瓜"); // "wǒmen mǎile liǎng gè xīguā"
convert(dictionary, "他2岁"); // "tā liǎng suì"
convert(dictionary, "2点"); // "liǎng diǎn", the same 两 as 2:00
convert(dictionary, "2万人"); // "liǎng wàn rén", as 20,000 is 两万
```

Exceptions use 二 when the digit labels a month, day, number, floor, route, class or period (月, 日, 号, 楼, 路, 班 and 期). Ordinals preceded by 第 also use 二. 十 and 百 keep the forms 二十 and 二百.

```ts
convert(dictionary, "2月"); // "èr yuè", February
convert(dictionary, "2号"); // "èr hào", the second of the month
convert(dictionary, "第2次"); // "dì èr cì", an ordinal names a position
convert(dictionary, "12个"); // "shí'èr gè", a 2 inside a larger number
```

A cardinal number is written as one pinyin word. For example, 25个 is `èrshíwǔ gè`. Digit sequences remain separated, as in 1998年 (`yī jiǔ jiǔ bā nián`). Sandhi crosses the word boundary, so 1个 becomes `yí gè`.

A decimal joins the cardinal integer part into one word, then writes 点 and the fractional digits separately:

```ts
convert(dictionary, "一共75.5元"); // "yígòng qīshíwǔ diǎn wǔ yuán"
convert(dictionary, "3.14"); // "sān diǎn yī sì"
```

Digits touching `-`, `/` or their full-width equivalents are preserved. This includes labels such as 3202-5625 and COVID-19.

Colon-separated times are read aloud:

```ts
convert(dictionary, "6:30起床"); // "liù diǎn sānshí fēn qǐchuáng"
convert(dictionary, "2:30"); // "liǎng diǎn sānshí fēn", two o'clock is 两
convert(dictionary, "12:00"); // "shí'èr diǎn", no 零零分 on the hour
convert(dictionary, "16:9的"); // "16:9de", a ratio, and left alone
```

Time recognition requires exactly two digits after the colon. In the measured corpus, all 104 matching examples were times. Ratios and scores such as 16:9 and 2:1 remained unchanged.

Time output includes 分 after the minutes to distinguish a time from a decimal. The hour, 点, minutes and 分 are separate words.

<a id="where-it-stops-guessing"></a>

### Limitations of automatic number reading

A four-digit number without 年 is read as a quantity. For example, `他生于1990。` does not automatically select year-style digits. Use the standalone number functions with an explicit style when the application knows that the number is a year or label.

Currency expressions such as `$5` and `￥100` are preserved. The converter does not infer a currency name from the symbol.

Dashed and slashed dates are preserved, and phone numbers do not automatically select `yāo`. Dates written with 年月日 use the normal number rules. For example, 三月 is `sān yuè` and 三十一日 is `sānshíyī rì`.

<a id="how-this-is-measured"></a>

## Validation

`pnpm numerals` compares numeral readings with CC-CEDICT. All 17 digit sequences with recorded readings match when the appropriate settings are supplied. Three emergency numbers require `yāo`. The source examples all spell out digits, so cardinal readings are tested separately with worked examples.

End-to-end `convert` matches 7 of those 17 examples. The remaining ten require label-style digits, while automatic conversion selects a quantity. These include 110, 88, 996 and 95后. Context does not always distinguish a quantity from a label.

<!-- card
```ts
numeralHanzi(12345); // "一万两千三百四十五"
numeralHanzi(2026); // "两千零二十六"
numeralHanzi(2026, { style: "digits" }); // "二〇二六"
percentHanzi(95); // "百分之九十五"
```
-->
