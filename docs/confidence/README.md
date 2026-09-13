# Confidence

`convertPieces` returns pinyin one syllable at a time, with information about alternative readings. Use it when your application needs to show where the conversion is uncertain.

```ts
import { convertPieces, isUncertain, writeSyllable } from "@kensio/pinyinjs";

const pieces = convertPieces(dictionary, "银行");
pieces.map((piece) => piece.text); // ["yín", "háng"]
pieces[1]?.syllable; // { initial: "h", final: "ang", tone: 2 }
pieces[0]?.confidence?.isLocked; // true, nothing else can be read here
pieces[1]?.confidence?.alternatives.map((found) =>
  found.reading.map((syllable) => writeSyllable(syllable)).join(""),
); // ["xíng", "héng", "hàng"]
```

Each syllable includes its selected reading and the additional cost of choosing an alternative. Your UI can use this information to mark readings that may need review.

## Pieces

`convertPieces(dictionary, text, options?)` returns a `ConvertedPiece[]`. It
takes the same [options](../options/) as `convert`.

A piece is either a syllable or the text between two of them:

| Field        | On a syllable                       | On the text between       |
| ------------ | ----------------------------------- | ------------------------- |
| `text`       | the written syllable, e.g. `"háng"` | a space, or a non-Han run |
| `syllable`   | the `Syllable` behind it            | absent                    |
| `confidence` | how settled it was                  | absent                    |

`joinPieces(pieces)` joins the pieces into the same string that `convert` returns.

```ts
const pieces = convertPieces(dictionary, "长江大桥");
joinPieces(pieces); // "Cháng Jiāng Dàqiáo"
```

## The three states

| State            | `isLocked` | `isUncertain` | Meaning                                                    |
| ---------------- | ---------- | ------------- | ---------------------------------------------------------- |
| locked           | `true`     | `false`       | only one reading is possible here                          |
| backed by a word | `false`    | `false`       | other readings exist; taking one means breaking a word up  |
| uncertain        | `false`    | `true`        | another reading of the same characters was nearly as cheap |

```ts
const guesses = (text: string) =>
  convertPieces(dictionary, text).filter(
    (piece) => piece.confidence !== undefined && isUncertain(piece.confidence),
  );

guesses("行").map((piece) => piece.text); // ["xíng"], nothing but a prior chose it
guesses("银行").map((piece) => piece.text); // [], the word settles both syllables
```

A locked position has only one possible reading in the lattice (the graph of candidate words and readings). Scoring cannot change that reading. The decoder skips these positions when comparing alternatives.

Readings selected by a [rule](../converting/#rules-where-the-cost-model-cannot-reach) also report as locked. Rules remove incompatible readings before the decoder scores the candidates. For example, the rule for 得 in 我得走了 leaves only one reading. The 1.50% error rate below covers positions locked by dictionary data and excludes positions locked by rules.

A reading is backed by a word when choosing an alternative would require splitting a dictionary word. In 长江大桥, the word supports `Cháng` over `zhǎng`.

An uncertain reading has an alternative that can be selected without splitting a word. This usually occurs when the decoder chooses among the readings of an individual character using their default ordering.

## Alternatives and their cost

```ts
const pieces = convertPieces(dictionary, "长江大桥");
pieces[0]?.confidence?.alternatives;
// [{ reading: [ … zhǎng … ], cost: 14.62, … }]
```

An alternative's `cost` is the increase in total conversion cost if that reading is used. It includes any changes required to neighbouring readings. The decoder calculates these costs with forward and backward passes through the candidate graph.

The cost measures the difference between candidate conversions. It is not a probability. Character reading order supplies no measured frequency, and the next reading of an isolated character usually costs about one additional unit. An alternative costing less than the per-word charge can be selected without splitting a word. A more expensive alternative requires a split.

The following error rates were measured on 20,139 hand-labelled polyphonic characters:

| State            |  Cases |  Wrong |
| ---------------- | -----: | -----: |
| locked           |  2,065 |  1.50% |
| backed by a word | 12,364 |  4.43% |
| uncertain        |  5,710 | 19.86% |

Uncertain positions account for 28% of the measured characters and about two thirds of the conversion errors.

Use `isUncertain` to identify readings with limited word context. Most uncertain readings have the same cost margin, one `ALTERNATE_PENALTY`. The flag therefore cannot rank them by likelihood. For example, 是 is flagged when no word covers it even though its reading is almost always `shì`. Changing the threshold between one unit and the per-word charge changes the flagged share by about one percentage point.

<a id="the-unit-is-a-span"></a>

## Character spans

An alternative includes the characters it covers. For example, 玩儿 pronounced `wánr` covers two characters, while 玩 `wán` and 儿 `ér` are separate readings. A reading that covers several characters also has single-character alternatives in the graph.

<a id="cost-of-asking"></a>

## Performance

Calculating alternatives requires another pass through the candidate graph and takes about 1.5 times the work of a plain conversion. Use `convert` when you only need the pinyin string.

## Showing it to a reader

`convertToHtml` adds a class to uncertain syllables and lists alternative readings in `data-alternatives`. See [HTML output](../html/). The [`explain` command](../cli/#explain) displays the same information in a terminal.

<!-- card
```ts
const pieces = convertPieces(dictionary, "银行");
pieces.map((piece) => piece.text); // ["yín", "háng"]
pieces[0]?.confidence?.isLocked; // true
pieces[1]?.confidence?.alternatives; // xíng, héng, hàng
```
-->
