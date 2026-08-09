# Segmenting

`segment` splits Chinese text into words.

```ts
import { segment } from "@kensio/pinyinjs";

segment(dictionary, "南京市长江大桥").map((found) => found.text);
// ["南京市", "长江", "大桥"]
```

Chinese is written without spaces, so finding the words is a decision rather
than a lookup — and it is the same decision converting has always had to make
first, because the unit a reading belongs to is the word. 行 is `xíng`, `háng`,
`héng` or `hàng`, and nothing about the character says which; only 银行 and 行长
do. This returns the answer the decoder already works out, which `convert` used
to throw away on its way to a string.

That is worth saying plainly, because it is the difference from a segmenter
built for its own sake: **the split is chosen for the reading it produces**. The
classic example splits either way — 南京市 / 长江 / 大桥 or 南京 / 市长 / 江大桥
— and the two disagree about whether 长 is `cháng` or `zhǎng`. A cut that reads
correctly is preferred over one that merely matches something longer.

## What comes back

One `Segment` per word, and one per stretch that was never Han.

| Field          | Is                                                                 |
| -------------- | ------------------------------------------------------------------ |
| `text`         | the characters, exactly as the text writes them                    |
| `at`           | where it starts, in code points from the start of the text         |
| `reading`      | the 普通话 reading, empty for a stretch that was never Han         |
| `partOfSpeech` | jieba's tag, or the empty string                                   |
| `isProperNoun` | whether the dictionary marks it one                                |
| `isKnown`      | whether the dictionary holds an entry for exactly these characters |

```ts
const found = segment(dictionary, "我要去北京。");
found.map((one) => one.text); // ["我", "要", "去", "北京", "。"]
found[3]?.partOfSpeech; // "ns"
found[3]?.isProperNoun; // true
found[3]?.at; // 3
```

**Every stretch comes back, in order.** Punctuation, Latin words, whitespace and
digits are all segments of their own, so the pieces rejoin into exactly the text
they came from:

```ts
segment(dictionary, text)
  .map((one) => one.text)
  .join("") === text; // always
```

That property is what makes it safe to rebuild a document from, and it is why
the stretches with no reading are included rather than dropped. A caller wanting
only the words filters on `isKnown`, and one wanting to highlight in place has
`at`.

`isKnown` is about the dictionary entry rather than about wordhood: a single
character standing alone is known, because the dictionary has an entry for the
character. It is false for a stretch that was never Han, and for a Han character
no source has a reading for.

## Positions are code points

`at` counts characters, not UTF-16 units, so a character outside the basic plane
counts as the one character it is — 𠮷 is a surname and one position. This is the
same counting the `readings` conversion option uses for a positional hint.

## What it does not do

**Word spacing.** 分词连写 is the orthography written pinyin wants, and it is
applied when writing pinyin rather than when finding words:

```ts
segment(dictionary, "他看了").map((one) => one.text); // ["他", "看", "了"]
convert(dictionary, "他看了"); // "tā kànle"
```

Attaching an aspect particle to its verb is a fact about how the pinyin is
written, not about where the words are, so the two answers differ on purpose.

**Readings in another locale.** The reading on a segment is 普通话. For a
`zh-TW` reading, or for tone marks written out with confidence beside them,
`convertPieces` is the one that lines syllables up with characters.

## Uses

- search indexing and query tokenising
- CJK line breaking, where a break belongs between words
- a reader that responds to a word rather than to a character
- counting the vocabulary in a text

It needs no wasm, no backend and no model — the dictionary is already loaded for
converting, and the segmentation falls out of it.

## At the command line

```console
$ pinyinjs segment 我要去北京。
我 / 要 / 去 / 北京 / 。
  我  wǒ  r
  要  yào  v
  去  qù  v
  北京  běi jīng  ns
  。  —
```

`--json` gives one document per text, with `at` and the flags on every word.

<!-- card
```ts
segment(dictionary, "南京市长江大桥")
  .map((found) => found.text);
// ["南京市",
//  "长江", "大桥"]
// not 南京 / 市长, which reads zhǎng
```
-->
