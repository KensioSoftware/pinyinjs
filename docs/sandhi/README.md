# Sandhi

Tone sandhi changes a syllable's tone according to its context. PinyinJS applies it to parsed syllables, including changes across word boundaries.

```ts
import { applySandhi, readWord } from "@kensio/pinyinjs";

const buShi = readWord("bùshì") ?? [];
applySandhi(buShi); // bú shì, 不 flattens before a fourth tone
applySandhi(buShi, { yiBu: false }); // unchanged

const niHao = readWord("nǐhǎo") ?? [];
applySandhi(niHao); // unchanged by default
applySandhi(niHao, { thirdTone: true }); // ní hǎo
```

The dictionary stores underlying tones. This lets you choose whether to apply sandhi when formatting a reading.

## 一 and 不

On by default.

不 changes from `bù` to `bú` before a fourth tone:

```ts
convert(dictionary, "不是"); // "bú shì"
convert(dictionary, "不对"); // "bú duì"
convert(dictionary, "不行"); // "bùxíng", 行 is second tone here, so no change
```

一 changes from `yī` to `yì` before tones 1, 2 and 3, and to `yí` before tone 4. It keeps `yī` in ordinals and final position:

```ts
convert(dictionary, "一天"); // "yì tiān", before first tone
convert(dictionary, "一起"); // "yìqǐ", before third tone
convert(dictionary, "一个"); // "yí gè", before fourth tone
convert(dictionary, "一样"); // "yíyàng"
convert(dictionary, "第一"); // "dìyī", ordinal, unchanged
```

<a id="the-一-that-is-a-digit"></a>

### 一 in numbers and ordinals

Counting uses can change the tone of 一. Digit sequences and ordinals retain its underlying tone:

```ts
convert(dictionary, "十一月"); // "shíyīyuè", a last digit, not a quantity
convert(dictionary, "十一点"); // "shíyīdiǎn"
convert(dictionary, "第一次"); // "dìyīcì", ordinal
convert(dictionary, "万一你来"); // "wànyī nǐ lái"
convert(dictionary, "31日"); // "sānshíyī rì", the same through the digits
convert(dictionary, "一个"); // "yí gè", still counting, so still assimilates
convert(dictionary, "当时一个人"); // "dāngshí yí gè rén", 时 is not 十
convert(dictionary, "那是一条狗"); // "nà shì yìtiáo gǒu", nor is 是
```

The rule identifies a number-final 一 by a preceding numeral and the absence of a following numeral. The middle 一 in 一百一十 still counts 十 and remains eligible for sandhi.

`convert` uses the source Chinese characters to distinguish numeral uses. `applySandhi` can also work from pinyin alone, but identical spellings can be ambiguous. For example, `shí` may represent 十 or 时, and `dì` may represent 第 or 地.

In 88,866 corpus lines, providing the characters corrected 1,575 一 tone decisions compared with using spellings alone:

|                                         |       |
| --------------------------------------- | ----: |
| 一 after 是 (是一个, 那是一样)          | 1,338 |
| after 前, 试, 晚, 释, 始, 时, 弟        |   231 |
| a real 十 shedding a wrong assimilation |     6 |
| broken                                  |     0 |

The spelling-based numeral set excludes 亿 because its reading overlaps with non-numeral characters such as 意 and 议. Character-aware conversion can distinguish these cases. Its numeral set includes 十, 百, 千 and 万, with traditional and financial forms.

Turn both off with `sandhi: { yiBu: false }`, or `--no-sandhi` at the command
line.

## Third tone

Off by default.

A third tone can become a second tone before another third tone. For example, 你好 is spoken `ní hǎo`. Standard pinyin spelling retains `nǐ hǎo`:

```ts
convert(dictionary, "好好"); // "hǎohǎo"
convert(dictionary, "好好", { sandhi: { thirdTone: true } }); // "háohǎo"
```

Enable third-tone sandhi for pronunciation guides or speech exercises. Leave it disabled when you want ordinary written pinyin.

```ts
const henHao = readWord("hěnhǎo") ?? [];
applySandhi(henHao); // hěn hǎo
applySandhi(henHao, { thirdTone: true }); // hén hǎo
```

<a id="its-domain-is-the-prosodic-foot"></a>

### Word and phrase grouping

Third-tone sandhi depends on prosodic feet, groups of syllables pronounced together. It is strongest within a foot and more optional across larger boundaries. The reference used here is [Shih 1986](https://www.researchgate.net/publication/36071823_The_Prosodic_Domain_of_Tone_Sandhi_in_Chinese).

PinyinJS approximates these groups with three rules:

```ts
const said = { sandhi: { thirdTone: true } };
convert(dictionary, "展览馆", said); // "zhánlánguǎn", 展览 + 馆
convert(dictionary, "纸老虎", said); // "zhǐláohǔ", 纸 + 老虎
convert(dictionary, "老板很好", said); // "láobǎn hén hǎo"
```

1. Within a word, dictionary boundaries determine the order of changes. 展覽館 splits as 展覽 + 館, while 紙老虎 splits as 紙 + 老虎. A split requires both parts to be dictionary words, and the most even split is preferred.
2. A one-syllable word joins the following word's group. This changes 很 in 很喜歡 and 我 and 也 in 我也很好 (`wó yé hén hǎo`).
3. Two multi-syllable words remain separate groups. For example, 行長 and 很喜歡 keep the boundary in `hángzhǎng hén xǐhuan`.

The approximation misses one-syllable words that attach to the preceding word. For example, it writes 保管好 as `báoguǎn hǎo`, while the intended pronunciation is `báoguán hǎo`. Resolving this requires grammatical information beyond word boundaries.

## Across word boundaries

The pass processes the complete syllable array. 一 and 不 can change tone in response to a syllable in the next word.

Third-tone sandhi also needs word grouping. `convert` supplies the decoder's groups. A direct `applySandhi` call treats the reading as one word unless you supply `SandhiGrouping`:

```ts
const reading = readWord("hángzhǎnghěnxǐhuan") ?? [];
applySandhi(reading, { thirdTone: true }); // háng zháng hén xǐ huan
applySandhi(reading, { thirdTone: true }, [2, 1, 2]); // háng zhǎng hén xǐ huan
```

Each grouping entry describes one word, using either its syllable count or the counts of its parts. For example, `[[1, 2]]` describes 紙老虎. Groupings with the wrong total syllable count are ignored. The `sandhi` CLI command derives groups from spaces in its input.

## Options

`applySandhi(syllables, options?, grouping?, characters?)` accepts the same options as [`ConvertOptions.sandhi`](../options/#sandhi). The optional `characters` array associates each syllable with its source Han character. Use `undefined` when one character cannot represent the syllable:

| Field       | Default | Does                         |
| ----------- | ------- | ---------------------------- |
| `yiBu`      | `true`  | 一 and 不 tone changes       |
| `thirdTone` | `false` | third tone before third tone |

Options are merged with the defaults. `{ thirdTone: true }` keeps `yiBu` enabled.

<a id="where-it-stops"></a>

## Limitations

Erhua is stored in the dictionary and handled by [orthography](../orthography/). The sandhi pass does not change it. The half-third tone before a non-third tone has no separate pinyin spelling and is not marked.

## From the command line

```console
$ pinyinjs sandhi bùshì
bùshì  bú shì

$ pinyinjs sandhi --third-tone nǐhǎo
nǐhǎo  ní hǎo
```

`sandhi` accepts written pinyin and runs without a dictionary. The `--no-sandhi` and `--third-tone` flags also work with `convert`, `html` and `explain`.

<!-- card
```ts
convert(dictionary, "不是"); // "bú shì"
convert(dictionary, "一个"); // "yí gè"
convert(dictionary, "好好"); // "hǎohǎo"
convert(dictionary, "好好", { sandhi: { thirdTone: true } });
// "háohǎo"
```
-->
