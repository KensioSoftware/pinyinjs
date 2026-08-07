# Script conversion

`toScript` converts between 简体 and 繁體.

```ts
import { loadScriptTables, toScript } from "@kensio/pinyinjs";

const tables = await loadScriptTables(source);

toScript(dictionary, tables, "我们后来发现了头发问题", { to: "zh-Hant" });
// "我們後來發現了頭髮問題"
```

The tables are a separate file from the dictionary, so nothing that only
converts hanzi to pinyin pays for them. See [dictionaries](../dictionaries/) for
what a `source` is.

## Why a pinyin package converts scripts better

Simplification merged distinct characters, and what un-merges them is **the
reading**. This package has the reading, because it decoded the text to get it.

```ts
toScript(dictionary, tables, "头发", { to: "zh-Hant" }); // "頭髮"
toScript(dictionary, tables, "出发", { to: "zh-Hant" }); // "出發"
```

发 is 發 or 髮, and nothing about the character says which. 头发 is `tóufà` and
出发 is `chūfā`, and _that_ says which. The same evidence splits 干 three ways
and 只 two:

| Text   | Reading    | 繁體   |
| ------ | ---------- | ------ |
| 干燥   | `gānzào`   | 乾燥   |
| 干部   | `gànbù`    | 幹部   |
| 干扰   | `gānrǎo`   | 干擾   |
| 一只猫 | `yìzhīmāo` | 一隻貓 |
| 只有   | `zhǐyǒu`   | 只有   |

Other converters work from phrase tables alone, so they are right about the
words on the list and guessing past it. Because this reads the text first, the
evidence generalises to words no list holds.

## Both directions need it

繁→简 looks deterministic and is not. Seventy common characters map more than
one way, and the reading separates them:

```ts
toScript(dictionary, tables, "乾燥", { to: "zh-Hans" }); // "干燥"
toScript(dictionary, tables, "乾隆", { to: "zh-Hans" }); // "乾隆"
```

乾 is 干 when it is `gān` and stays 乾 when it is `qián`.

## Taiwan and Hong Kong

Both write 繁體 and disagree about the standard form of 58 characters. Taiwan
follows 教育部標準字體, Hong Kong 常用字字形表. Same characters, same meanings,
**same readings** — a glyph choice never changes how anything is pronounced.

```ts
toScript(dictionary, tables, "面包", { to: "zh-Hant-TW" }); // "麵包"
toScript(dictionary, tables, "面包", { to: "zh-Hant-HK" }); // "麪包"
```

| 简体 | `zh-Hant-TW` | `zh-Hant-HK` |
| ---- | ------------ | ------------ |
| 群众 | 群眾         | 羣眾         |
| 里面 | 裡面         | 裏面         |
| 卫生 | 衛生         | 衞生         |

A bare `zh-Hant` writes Taiwan. There is no region-free 繁體 to fall back on:
converting character by character from the usual baseline yields 爲, 衆, 峯, 羣,
裏, 麪, which _are_ the Hong Kong forms. Declining to choose means choosing Hong
Kong silently, so a region is always applied and always named.

One of the 58 needs the reading, which is the argument again in miniature.
Taiwan writes 著 for every sense; Hong Kong splits it:

```ts
toScript(dictionary, tables, "看着", { to: "zh-Hant-HK" }); // "看着"
toScript(dictionary, tables, "著作", { to: "zh-Hant-HK" }); // "著作"
```

看著 is `kànzhe` and takes 着; 著作 is `zhùzuò` and keeps 著.

## What it was unsure about

Some conversions cannot be settled by anything. 下面 is a surface or a bowl of
noodles, both `xiàmiàn`, and no reading tells them apart. `toScriptPieces`
reports one choice per character with the evidence that settled it.

```ts
import { isUncertainChoice, toScriptPieces } from "@kensio/pinyinjs";

const { text, choices } = toScriptPieces(dictionary, tables, "下面", {
  to: "zh-Hant",
});

text; // "下面"
choices.filter(isUncertainChoice).map((choice) => choice.from); // ["面"]
choices[1]?.alternatives; // ["麵"]
```

Four kinds of evidence, strongest first:

| `evidence` | Means                                                        |
| ---------- | ------------------------------------------------------------ |
| `locked`   | the character has one form; there was nothing to decide      |
| `word`     | a word some source wrote in both scripts settled it          |
| `reading`  | rival forms existed and the syllable picked between them     |
| `default`  | rival forms existed and nothing separated them — **a guess** |

`isUncertainChoice` is `default` alone. A character settled by its reading is
not a guess: that evidence is the reason this converts more accurately than an
orthographic converter can, and reporting it as doubt would throw the claim
away.

```ts
const { choices } = toScriptPieces(dictionary, tables, "头发", {
  to: "zh-Hant",
});

choices.map((choice) => choice.evidence); // ["locked", "reading"]
```

Over the gold corpus, 97.7% of characters are `locked` and 1.5% are guesses.

## Detecting the input

The script of the text is detected unless you name it, and that matters more
than it sounds. Plenty of characters are current in **both** scripts, so running
繁體 through the 简→繁 tables would rewrite them: 准 is 简体 for 準 and a 繁體
character in its own right, and 准將 would come back 準將.

```ts
toScript(dictionary, tables, "准將", { to: "zh-Hant" }); // "准將", unchanged
toScript(dictionary, tables, "群众", { to: "zh-Hant", from: "Hans" }); // "群眾"
```

Pass `from` when the text is short enough that detection has nothing to go on.
A run of characters both scripts share settles nothing, and the conversion then
assumes the text needs converting.

## This is orthography, not translation

```ts
toScript(dictionary, tables, "软件", { to: "zh-Hant" }); // "軟件"
```

Not 軟體. 軟體 and 软件 are different **words** for the same thing, the way
"lorry" and "truck" are, and swapping one for the other is translation. Other
tools fold a vocabulary substitution list into script conversion; this does not.
pinyinjs is not a translator.

## Accuracy

繁→简 is near-deterministic, so 简→繁→简 has to be the identity for essentially
every word — which makes it a test needing no hand-labelling at all. `pnpm
accuracy` runs it over every key in the dictionary:

| Trip           | words in use | every key |
| -------------- | -----------: | --------: |
| 简→繁→简       |        99.6% |     99.3% |
| 繁→简→繁       |        98.9% |     99.8% |
| 繁TW→繁HK→繁TW |        99.7% |     99.6% |

繁→简→繁 is lossy **by design** and is reported rather than targeted: 卻 and 却
both simplify to 却, and only one of them can come back.

## At the command line

```console
$ pinyinjs script 我们后来发现了头发问题 --to zh-Hant
我們後來發現了頭髮問題
```

See [the command line](../cli/).

<!-- card
```ts
toScript(dictionary, tables, "头发", { to: "zh-Hant" });
// "頭髮", because tóufà

toScript(dictionary, tables, "出发", { to: "zh-Hant" });
// "出發", because chūfā
```
-->
