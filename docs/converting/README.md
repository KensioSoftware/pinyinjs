# Converting

`convert` takes a dictionary and some text and returns pinyin. Everything else
in the package is either something it uses on the way or a different view of
the same answer.

```ts
convert(dictionary, "银行"); // "yínháng"
convert(dictionary, "行长"); // "hángzhǎng"
convert(dictionary, "我要去北京。"); // "Wǒ yào qù Běijīng."
convert(dictionary, "3D银行"); // "sān D yínháng" — the digit is read, the letter is not
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

## Rules, where the cost model cannot reach

Some readings are settled by context rather than by evidence about the
characters, and no amount of frequency data reaches them. Those are handled by
typed rules that run over the lattice — after it is built, before anything is
decoded — and that may only take candidates away, never invent one.

```ts
convert(dictionary, "我得走了"); // "wǒ děi zǒule" — modal
convert(dictionary, "他跑得很快"); // "tā pǎo de hěn kuài" — particle
convert(dictionary, "他得到了"); // "tā dédàole" — the word decides
```

得 is one character with three readings. The dictionary can only carry a
default, and the default is the particle `de`, so every modal 得 read as one
until this. What separates them is entirely contextual: the particle attaches to
the verb or adjective in front of it, so a 得 with a pronoun, adverb or time
word before it and a verb phrase after it is not that particle.

The second rule keeps 儿 from standing on its own where the dictionary says it
should not:

```ts
convert(dictionary, "那边儿"); // "nà biānr", not "nàbian ér"
convert(dictionary, "女儿"); // "nǚ'ér" — a syllable of its own, and stays one
```

儿化 is a per-word dictionary fact, and 2,009 of the 2,067 words ending in 儿
carry it — but 那边儿 is not listed while 这边儿, 上边儿 and 旁边儿 are. Where
the character in front of a 儿 makes an attested 儿化 word, the reading that
leaves 儿 stranded as `ér` is taken off the lattice. That asserts nothing new:
边儿 is `biānr` because the dictionary says so. The spacing is still not what
GB/T 16159 wants — 那边儿 is one word, and this writes two — because the word it
would need is precisely the one missing.

Rules are exported (`READING_RULES`, `MODAL_DE`, `ATTESTED_ERHUA`,
`applyEdgeRules`) and `decodeRun` takes its own list, so an application with its
own domain can add to them or decode with none.

## Non-Han text

Latin letters, punctuation and anything else that was never Han pass through
exactly as written. Digits are the one thing that does not: they are read.

```ts
convert(dictionary, "3D银行"); // "sān D yínháng"
convert(dictionary, "1997年"); // "yī jiǔ jiǔ qī nián"
convert(dictionary, "3D银行", { numbers: "keep" }); // "3Dyínháng"
```

Which style a number takes comes from what follows it — 1997年 is a year and
3个 is a count — and it needs no dictionary: `src/numerals/` is arithmetic and
about twenty readings. [Numbers](../numerals/) has the three rules and what
they deliberately do not guess at. `numbers: "keep"` leaves every digit exactly
as it was written, which is what this did before there was anything to read
them with.

Once a digit _has_ been read, the letters beside it are being said too, which
is why `3D银行` gains a space it keeps none of under `numbers: "keep"`.

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
89.04% correctly against greedy's 88.82%: 75 characters it gets right that
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
