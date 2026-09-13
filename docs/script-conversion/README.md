# Script conversion

`toScript` converts between simplified (简体) and traditional (繁體) Chinese.

```ts
import { loadScriptTables, toScript } from "@kensio/pinyinjs";

const tables = await loadScriptTables(source);

toScript(dictionary, tables, "我们后来发现了头发问题", { to: "zh-Hant" });
// "我們後來發現了頭髮問題"
```

Load the script tables as well as a dictionary. The tables are separate from the data used for pinyin conversion. See [dictionaries](../dictionaries/) for setting up a data source.

<a id="why-a-pinyin-package-converts-scripts-better"></a>

## Resolving ambiguous characters

A simplified character can correspond to several traditional characters. PinyinJS first reads the text, then uses the selected pronunciation to choose among those forms.

```ts
toScript(dictionary, tables, "头发", { to: "zh-Hant" }); // "頭髮"
toScript(dictionary, tables, "出发", { to: "zh-Hant" }); // "出發"
```

For example, 发 can become 發 or 髮. The readings of 头发 (`tóufà`) and 出发 (`chūfā`) select the appropriate form. Readings also distinguish forms of 干 and 只:

| Text   | Reading    | 繁體   |
| ------ | ---------- | ------ |
| 干燥   | `gānzào`   | 乾燥   |
| 干部   | `gànbù`    | 幹部   |
| 干扰   | `gānrǎo`   | 干擾   |
| 一只猫 | `yìzhīmāo` | 一隻貓 |
| 只有   | `zhǐyǒu`   | 只有   |

This can resolve a character even when the script-conversion tables do not contain the complete phrase.

<a id="both-directions-need-it"></a>

## Traditional to simplified conversion

Some traditional characters also have more than one simplified mapping. The reading selects among them:

```ts
toScript(dictionary, tables, "乾燥", { to: "zh-Hans" }); // "干燥"
toScript(dictionary, tables, "乾隆", { to: "zh-Hans" }); // "乾隆"
```

乾 is 干 when it is `gān` and stays 乾 when it is `qián`.

## Taiwan and Hong Kong

Taiwan and Hong Kong use different standard forms for 58 characters. These regional forms represent the same characters and readings.

```ts
toScript(dictionary, tables, "面包", { to: "zh-Hant-TW" }); // "麵包"
toScript(dictionary, tables, "面包", { to: "zh-Hant-HK" }); // "麪包"
```

| 简体 | `zh-Hant-TW` | `zh-Hant-HK` |
| ---- | ------------ | ------------ |
| 群众 | 群眾         | 羣眾         |
| 里面 | 裡面         | 裏面         |
| 卫生 | 衛生         | 衞生         |

`zh-Hant` uses Taiwan forms by default. Specify the Hong Kong target when you need forms such as 爲, 衆, 峯, 羣, 裏 and 麪.

Two regional mappings also depend on pronunciation:

Taiwan uses 著 across its senses. Hong Kong distinguishes 著 and 着:

```ts
toScript(dictionary, tables, "看着", { to: "zh-Hant-HK" }); // "看着"
toScript(dictionary, tables, "著作", { to: "zh-Hant-HK" }); // "著作"
```

看著 is `kànzhe` and takes 着. 著作 is `zhùzuò` and keeps 著.

The variant 蔘 applies only to the `shēn` reading of 參 (ginseng):

```ts
toScript(dictionary, tables, "人参", { to: "zh-Hant-HK" }); // "人蔘"
toScript(dictionary, tables, "参加", { to: "zh-Hant-HK" }); // "參加"
toScript(dictionary, tables, "参差", { to: "zh-Hant-HK" }); // "參差"
```

Without a reading, 著 defaults to 着 and 參 defaults to 參. These choices are reported as uncertain. `isReadingSensitive` identifies these characters.

Of the 58 regional mappings, 39 come from Hong Kong's standard table and 19 reverse Taiwan mergers. 著 and 參 are the reading-sensitive cases among those mergers.

<a id="what-it-was-unsure-about"></a>

## Inspecting conversion choices

Some choices remain ambiguous after reading the text. For example, 下面 can refer to a surface or noodles, both pronounced `xiàmiàn`. `toScriptPieces` returns the selected form and supporting evidence for each character.

```ts
import { isUncertainChoice, toScriptPieces } from "@kensio/pinyinjs";

const { text, choices } = toScriptPieces(dictionary, tables, "下面", {
  to: "zh-Hant",
});

text; // "下面"
choices.filter(isUncertainChoice).map((choice) => choice.from); // ["面"]
choices[1]?.alternatives; // ["麵"]
```

Evidence has four levels, from strongest to weakest:

| `evidence` | Means                                                        |
| ---------- | ------------------------------------------------------------ |
| `locked`   | the character has one form; there was nothing to decide      |
| `word`     | a word some source wrote in both scripts settled it          |
| `reading`  | rival forms existed and the syllable picked between them     |
| `default`  | rival forms existed and nothing separated them — **a guess** |

`alternatives` is empty when the evidence is `locked`. The original character can itself be an alternative. For example, 万 usually becomes 萬 but remains 万 in the surname 万俟.

```ts
const { choices } = toScriptPieces(dictionary, tables, "一万人", {
  to: "zh-Hant",
});

choices[1]?.evidence; // "default"
choices[1]?.alternatives; // ["万"]
```

Alternatives use the target region's forms. A Hong Kong conversion offers 麪 where Taiwan offers 麵. Regional rules can also remove ambiguity. Hong Kong uses 台 for both Taiwan forms 台 and 臺, so 台北 remains 台北 without an uncertain choice.

`isUncertainChoice` is true only for `default` evidence. Choices resolved by a reading are treated as settled.

```ts
const { choices } = toScriptPieces(dictionary, tables, "头发", {
  to: "zh-Hant",
});

choices.map((choice) => choice.evidence); // ["locked", "reading"]
```

In the reference corpus, 97.6% of character choices were `locked` and 1.7% used the default. Run `pnpm accuracy` to reproduce the measurement.

## Detecting the input

The converter detects the input script unless you supply `from`. Detection prevents a valid traditional form from being treated as simplified input. For example, traditional 准將 should retain 准.

```ts
toScript(dictionary, tables, "准將", { to: "zh-Hant" }); // "准將", unchanged
toScript(dictionary, tables, "群众", { to: "zh-Hant", from: "Hans" }); // "群眾"
```

Set `from` when short input consists only of characters shared by both scripts. Without evidence for the source script, the converter assumes the input needs conversion.

<a id="this-is-orthography-not-translation"></a>

## Vocabulary is preserved

```ts
toScript(dictionary, tables, "软件", { to: "zh-Hant" }); // "軟件"
```

Script conversion changes character forms while preserving word choice. It does not replace 软件 with the Taiwan term 軟體. Vocabulary substitution requires a separate application step.

## Accuracy

The accuracy check converts simplified dictionary keys to traditional and back. Most should reproduce the original simplified word. Run it with `pnpm accuracy`:

| Trip           | words in use | every key |
| -------------- | -----------: | --------: |
| 简→繁→简       |        99.6% |     99.3% |
| 繁→简→繁       |        98.9% |     99.8% |
| 繁TW→繁HK→繁TW |        99.7% |     99.6% |

A traditional-to-simplified-to-traditional conversion can lose distinctions. For example, 卻 and 却 both simplify to 却, so only one form can be reconstructed. The check reports this loss.

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
