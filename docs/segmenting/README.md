# Segmenting

`segment` splits Chinese text into words.

```ts
import { segment } from "@kensio/pinyinjs";

segment(dictionary, "南京市长江大桥").map((found) => found.text);
// ["南京市", "长江", "大桥"]
```

PinyinJS identifies words before selecting their readings. For example, 行 can be `xíng`, `háng`, `héng` or `hàng`, depending on the word. `segment` returns the word boundaries selected by the same decoder used by `convert`.

The decoder considers pronunciation when choosing word boundaries. 南京市长江大桥 can be split as 南京市 / 长江 / 大桥 or 南京 / 市长 / 江大桥. These splits give 长 different readings (`cháng` and `zhǎng`). The decoder selects the split with the lowest total conversion cost.

<a id="what-comes-back"></a>

## Return value

`segment` returns one `Segment` per word and per run of non-Han text.

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

The result includes all input text in its original order, including punctuation, Latin text, whitespace and digits. Joining the segment text reconstructs the input:

```ts
segment(dictionary, text)
  .map((one) => one.text)
  .join("") === text; // always
```

Filter on `isKnown` to keep dictionary entries. Use `at` to locate each segment in the original text.

`isKnown` is true when the dictionary contains the segment. This includes individual Chinese characters. It is false for non-Han text and Chinese characters with no dictionary reading.

## Positions are code points

`at` counts Unicode code points. A character outside the Basic Multilingual Plane, such as 𠮷, occupies one position even though JavaScript stores it as two UTF-16 code units. Positional hints in the `readings` conversion option use the same units.

<a id="where-it-stops"></a>

## Limitations

Segmentation returns word boundaries before pinyin orthography is applied. Written pinyin may join adjacent segments:

```ts
segment(dictionary, "他看了").map((one) => one.text); // ["他", "看", "了"]
convert(dictionary, "他看了"); // "tā kànle"
```

For example, pinyin spelling rules attach an aspect particle to its verb. The segmentation result keeps the verb and particle separate.

Segment readings use mainland Mandarin. Use `convertPieces` for `zh-TW` readings, formatted syllables or confidence information.

## Uses

- search indexing and query tokenising
- CJK line breaking, where a break belongs between words
- a reader that responds to a word rather than to a character
- counting the vocabulary in a text

Segmentation uses the loaded PinyinJS dictionary and runs locally in Node.js or the browser.

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

`--json` returns one document per input text, including each segment's `at` position and flags.

<!-- card
```ts
segment(dictionary, "南京市长江大桥")
  .map((found) => found.text);
// ["南京市",
//  "长江", "大桥"]
// not 南京 / 市长, which reads zhǎng
```
-->
