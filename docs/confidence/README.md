# Confidence

The decoder knows when it was guessing, and `convertPieces` tells you. Every
syllable comes back with the reading behind it, what it was chosen over, and
how much taking the alternative would have cost.

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

Greedy longest-match cannot do this. A scored decode can, and for a
learner-facing tool that is a feature rather than a diagnostic: an uncertain
reading can be rendered differently instead of being presented as fact.

## Pieces

`convertPieces(dictionary, text, options?)` returns a `ConvertedPiece[]`. It
takes the same [options](../options/) as `convert`.

A piece is either a syllable or the text between two of them:

| Field        | On a syllable                       | On the text between       |
| ------------ | ----------------------------------- | ------------------------- |
| `text`       | the written syllable, e.g. `"háng"` | a space, or a non-Han run |
| `syllable`   | the `Syllable` behind it            | absent                    |
| `confidence` | how settled it was                  | absent                    |

`joinPieces(pieces)` gives back exactly what `convert` returns, so the pieces
are a decomposition of the answer rather than a different answer.

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

**Locked** means the lattice offers one reading at that position across every
path through it. No amount of scoring can move it, so the decoder does not even
try: locked positions are skipped before the shortest-path decode runs.

A reading a [rule](../converting/#rules-where-the-cost-model-cannot-reach)
settled reports as locked too, and for the same reason: the rules run over the
lattice before anything is decoded, so the 得 of 我得走了 has one reading left by
the time the decode sees it. What the flag says is that nothing downstream chose
it, which stays true, but the 1.46% below is measured over positions the data
locked, not over these.

**Backed by a word** means other readings existed, but reaching any of them
would have meant breaking apart a word the dictionary attests. 长江大桥 reads
`Cháng` rather than `zhǎng` on that basis.

**Uncertain** means a rival reading was available without breaking a word up,
usually a bare polyphone falling back on a character-level prior. That is the
decoder saying it had very little to go on.

## Alternatives and their cost

```ts
const pieces = convertPieces(dictionary, "长江大桥");
pieces[0]?.confidence?.alternatives;
// [{ reading: [ … zhǎng … ], cost: 24.62, … }]
```

An alternative's `cost` is how much more the cheapest conversion taking it
would have cost, in the decoder's own units, including what taking it would
have forced on its neighbours. It is computed by one forward and one backward
sweep of the lattice, which prices every distinct reading a stretch offers.

**Treat it as a measure of how much evidence there was, not as a probability.**
Nothing upstream says how much likelier a character's first reading is than its
second, so every bare polyphone's runner-up sits about one unit away whatever
the real odds are. What the number does separate reliably is _where the
evidence came from_: a rival cheaper than the per-word charge was available
without breaking a word apart, and a dearer one was not.

That cut is the one worth acting on, and it has been measured. On 20,139
hand-labelled polyphonic characters:

| State            |  Wrong |
| ---------------- | -----: |
| locked           |  1.46% |
| backed by a word |  4.46% |
| uncertain        | 27.15% |

So the decoder's errors sit almost entirely on the syllables it already reports
as uncertain, which is exactly what makes the flag worth surfacing.

## The unit is a span, not a character

玩儿 read as `wánr` over two characters is a different claim from 玩 `wán` plus
儿 `ér`, so an alternative carries its own span rather than being pinned to one
character. A consequence: a claim spanning more than one character can never be
the sole claim at a position, because the single-character edge is always there
beside it.

## Cost of asking

Pricing the alternatives is a second sweep of the lattice, about 1.5× the work
of a plain decode, which is why `convert` does not do it. If you only want the
string, call `convert`.

## Showing it to a reader

`convertToHtml` marks uncertain syllables for you and lists what they beat in a
`data-alternatives` attribute; see [HTML output](../html/). The
[`explain` command](../cli/#explain) prints the same information at a terminal.

<!-- card
```ts
const pieces = convertPieces(dictionary, "银行");
pieces.map((piece) => piece.text); // ["yín", "háng"]
pieces[0]?.confidence?.isLocked; // true
pieces[1]?.confidence?.alternatives; // xíng, héng, hàng
```
-->
