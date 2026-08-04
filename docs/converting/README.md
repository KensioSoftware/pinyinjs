# Converting

`convert` takes a dictionary and some text and returns pinyin. Everything else
in the package is either something it uses on the way or a different view of
the same answer.

```ts
convert(dictionary, "银行"); // "yínháng"
convert(dictionary, "行长"); // "hángzhǎng"
convert(dictionary, "我要去北京。"); // "Wǒ yào qù Běijīng."
convert(dictionary, "3D银行"); // "3Dyínháng" — non-Han text is left as written
```

The signature is `convert(dictionary, text, options?)`. Options are documented
in full in [options](../options/); this page is about what happens between the
two arguments and the string that comes back.

## Why it is not a lookup table

行 has four readings — `xíng`, `háng`, `héng`, `hàng` — and nothing about the
character says which one to write. 银行 is `yínháng` and 行长 is `hángzhǎng`.
A per-character table cannot get both right, and picking the commonest reading
gets one of them wrong every time.

So the unit is the word, and the words have to be found in the text before
anything can be read. That is segmentation, and it is ambiguous in its own
right: 南京市长江大桥 is 南京市 / 长江 / 大桥 or 南京 / 市长 / 江大桥, and the
two disagree about whether 长 is `cháng` or `zhǎng`.

## What the decoder does

Every dictionary match at every position goes into a lattice — a graph where
each edge is a word and carries the reading that word has. Converting is then
choosing a path.

```
input
  └─ run splitting        Han runs against everything else
  └─ lattice build        every dictionary match per position
  └─ reading projection   collapse edges by reading; lock settled positions
  └─ shortest path        scored decode over the unlocked stretches only
  └─ orthography          grouping, capitals, apostrophes, punctuation
  └─ sandhi               a typed pass over the syllable array
  └─ formatting           diacritics, digits, superscripts or HTML
```

Two things about this are worth knowing as a user.

**Most positions never get scored.** After the lattice is built, the decoder
asks at each position how many distinct readings survive across every path
through it. Where the answer is one, the position is _locked_ and no amount of
scoring can move it — about two thirds of positions in running text. Only the
short stretches between locked positions get a shortest-path decode, and they
are typically two to six characters long.

**Segmentation ambiguity that does not cross a polyphone cannot produce a wrong
reading.** 研究生命起源 splits as 研究生 / 命 or 研究 / 生命 and reads the same
either way. It does change the spacing, which is why segmentation still matters,
but a spacing mistake is ugly and readable where a reading mistake is simply
wrong. The two are held to different bars on purpose.

The consequence you can see from outside is that the decoder knows when it was
choosing, and will tell you: see [confidence](../confidence/).

## Non-Han text

Digits, Latin letters, punctuation and anything else that was never Han pass
through exactly as written.

```ts
convert(dictionary, "3D银行"); // "3Dyínháng"
```

Reading numbers aloud — 3 as `sān`, 2024 as a year — is a separate problem and
a separate package, not yet built. `3` stays `3`.

Full-width punctuation is the exception, because it is Chinese text rather than
foreign text: `。，、；：？！` are rewritten as their Latin equivalents by
default. See [orthography](../orthography/#punctuation).

## Spacing, capitals and apostrophes

`convert` does not return a run of syllables. It returns pinyin written the way
the standard writes it, which means word spacing, capitals on proper nouns and
sentences, and 隔音符号 where a syllable boundary would otherwise be ambiguous.

```ts
convert(dictionary, "他看了"); // "tā kànle"
convert(dictionary, "南京市"); // "Nánjīng Shì"
convert(dictionary, "天安门"); // "Tiān'ānmén"
```

All of that is [orthography](../orthography/), including what it does not do.

## The greedy baseline

`convertGreedily` decodes with longest-match instead — take the longest
dictionary word at each position, never reconsider. It is kept because it is
what the previous generation of this library did, and because having a baseline
in the repository is how the lattice's accuracy gets measured rather than
asserted.

```ts
import { convertGreedily } from "@kensio/pinyinjs";

convert(dictionary, "研究生命起源"); // "yánjiū shēngmìng qǐyuán"
convertGreedily(dictionary, "研究生命起源"); // "yánjiūshēng mìng qǐyuán"
```

Greedy takes 研究生 because it is longer, and 生命 loses. Both readings happen
to be right here — this is the ambiguity that does not cross a polyphone — so
what it costs is the spacing.

Measured on 20,139 hand-labelled polyphonic characters, the lattice reads
89.04% correctly against greedy's 88.81%: 76 characters it gets right that
greedy does not, against 30 the other way. Small, but real. Use `convert`;
`convertGreedily` is there to be compared against, and `pnpm accuracy` and
`pnpm polyphones` in the repository are what compare them.

## Getting more than a string back

| You want                               | Use                                                    |
| -------------------------------------- | ------------------------------------------------------ |
| the pinyin                             | `convert`                                              |
| one piece at a time, with confidence   | `convertPieces` — [confidence](../confidence/)         |
| marked-up HTML                         | `convertToHtml` — [HTML output](../html/)              |
| what the dictionary holds for one word | `dictionary.lookup` — [dictionaries](../dictionaries/) |

`convertPieces` is the general one. `convertToHtml` is exactly
`toHtml(convertPieces(…))`, and `joinPieces(convertPieces(…))` gives back what
`convert` returns, so anything the other two do you can do yourself from the
pieces.

`convert` does not call `convertPieces` internally, though. Pricing the
alternatives costs a second sweep of the lattice — around 1.5× the work — so
`convert` runs the decode that does not do it. Reach for `convertPieces` when
you want the confidence, not as the general form of `convert`.
