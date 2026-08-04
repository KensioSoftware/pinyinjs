# pinyinjs

A TypeScript toolkit for Chinese hanzi and pinyin: conversion, parsing,
validation, normalisation and formatting.

[https://pinyinjs.dev](https://pinyinjs.dev "PinyinJS docs website")

> **Not released yet.** The syllable layer, the dictionary, the decoder and the
> orthography pass are done and tested; romanisation and numerals are not
> started. See [Status](#status) for exactly what works. The API below is real
> and tested, but it will change before 1.0.

## What it is

Most of the work in hanzi → pinyin is deciding _which_ reading a character takes
in context, and where the word boundaries fall. pinyinjs builds a 461,623-entry
dictionary from four upstream sources, repairs their defects at build time, and
decodes against it.

Two things make it different from the usual approach:

- **Traditional Chinese is a first-class key**, not converted to simplified
  first. That shortcut destroys information: 发 is a polyphone (`fā` or `fà`)
  precisely because simplification merged 發 and 髮, neither of which is
  ambiguous. 806 simplified characters merge more than one traditional
  character, and for 70 of them the readings differ. Where a word has more than
  one current traditional spelling, every one of them is a key: 臺灣 and 台灣
  both find `Táiwān`.
- **Accuracy is measured, not asserted.** Every change is scored against a gold
  corpus, and readings and spacing are scored separately, because a wrong
  reading is an error while wrong spacing is merely untidy.

## Status

| Feature                                                    | State                                   |
| ---------------------------------------------------------- | --------------------------------------- |
| Syllable parsing, tones, validation                        | **works**                               |
| Dictionary: 461,623 entries, both scripts, zh-CN and zh-TW | **works**                               |
| Tone sandhi (一, 不, optional 3-3)                         | **works**                               |
| Hanzi → pinyin conversion                                  | **works** — lattice decoder             |
| Apostrophes, sentence capitals, punctuation                | **works**                               |
| Word grouping (GB/T 16159 分词连写)                        | **partial** — rules plus a curated list |
| Per-syllable confidence and alternatives                   | **works**                               |
| HTML output with tone and confidence classes               | **works**                               |
| Wade-Giles, Bopomofo, Yale, IPA                            | not built                               |
| Numbers, dates, currency                                   | not built                               |

`convert` decodes over a lattice: every dictionary match at every position
becomes an edge, positions that read the same way on every path are locked
outright, and only what is left is scored. Because it scores, it can also say
where it was guessing — see [confidence](#confidence-and-what-was-rejected). `convertGreedily` is the _old_
algorithm — forward longest-match, no scoring, no backtracking — kept so that
every claim about the new one has a measured baseline behind it. Use `convert`.

On the 71-case gold corpus both decoders now read every syllable correctly, so
the corpus can no longer tell them apart on readings; the lattice's win is
spacing, where it is exact against greedy's 98.0% F1. See
[Accuracy](#accuracy) — those figures are asserted by a test, not quoted by
hand.

## Install

```bash
pnpm add @kensio/pinyinjs
```

Not on npm yet — clone the repo until it is. Requires Node 24+, or any browser;
the core imports no Node built-ins.

## Converting hanzi

A dictionary has to be loaded before anything can be converted, because it is a
fetchable file rather than a JavaScript module — a 2.3 MB object literal would
cost real parse time on every page load, and a text blob costs none.

```ts
import { convert, loadDictionary } from "@kensio/pinyinjs";
import { fileSource } from "@kensio/pinyinjs/node";

const source = fileSource("node_modules/@kensio/pinyinjs/data");
const dictionary = await loadDictionary(source, "full");

convert(dictionary, "银行"); // "yínháng"
convert(dictionary, "行长"); // "hángzhǎng"
convert(dictionary, "我要去北京。"); // "Wǒ yào qù Běijīng."
```

A sentence comes back punctuated and capitalised as a sentence, and a word
quoted on its own does not — `银行` is `yínháng`, not `Yínháng`. The source's own
punctuation is the signal, since nothing else distinguishes the two.

In a browser, serve the `data/` directory and fetch it:

```ts
import { convert, fetchSource, loadDictionary } from "@kensio/pinyinjs";

const dictionary = await loadDictionary(fetchSource("/data"), "standard");
convert(dictionary, "长城"); // "Chángchéng"
```

Serve the artifacts uncompressed and let HTTP `Content-Encoding: br` compress
them: `DecompressionStream` has no brotli, and HTTP is the right layer for it.

### Options

```ts
convert(dictionary, "垃圾"); // "lājī"
convert(dictionary, "垃圾", { locale: "zh-TW" }); // "lèsè"
convert(dictionary, "银行", { notation: "numbers" }); // "yin2hang2"
convert(dictionary, "银行", { notation: "superscript" }); // "yin²hang²"
convert(dictionary, "银行", { notation: "none" }); // "yinhang"
convert(dictionary, "好好", { sandhi: { thirdTone: true } }); // "háohǎo"
convert(dictionary, "西安"); // "Xī'ān"
convert(dictionary, "海鸥", { apostrophe: "standard" }); // "hǎiōu"
convert(dictionary, "北京。", { punctuation: "keep" }); // "Běijīng。"
convert(dictionary, "北京。", { capitals: "none" }); // "běijīng."
```

### Orthography

The 隔音符号 goes before any syllable of a word that begins with `a`, `o` or `e`
and is not the first: 西安 is `Xī'ān`, 天安门 is `Tiān'ānmén`, 女儿 is `nǚ'ér`.
`i`, `u` and `ü` surface as `y` and `w` and so can never need one.

GB/T 16159 technically conditions the mark on ambiguity —
如果音节的界限发生混淆 — but essentially every style guide writes it regardless,
which is the `always` default. `apostrophe: "standard"` applies the standard's
own condition instead, by asking the parser whether the run reads back as
itself: `Xīān` reads as the single syllable `xian` so the mark stays, while
`hǎiōu` cannot be read any other way so it goes.

Chinese punctuation with an exact Latin equivalent is rewritten — `。，、；：？！`
— and takes the space its full-width glyph carried, so 你好，世界 is
`nǐ hǎo, shìjiè` rather than `nǐ hǎo,shìjiè`. Brackets and quotation marks are
left alone: 《》 marks a title, which the Latin script sets in italics rather
than with a bracket.

Note that a comma is not evidence of a sentence, so that example is not
capitalised. Only `.!?。！？` start a sentence, deliberately: the alternative is
capitalising every fragment somebody looks up.

分词连写 is applied as typed rules over the decoded words rather than regexes
over the output. The aspect particles 了/着/过 attach to a verb or adjective
(他看了 → `tā kànle`, but 我还给你了。 → `Wǒ huán gěi nǐ le.`, where the 了
closes the sentence instead), a suffix attaches to its stem (作者 → `zuòzhě`), and the
generic half of an administrative place name is written separately and
capitalised (南京市 → `Nánjīng Shì`). Pass `grouping: false` to turn them off.

Beside them sits a small **curated list** of words the standard writes in a way
no rule reaches, each carrying the clause it comes from:

```ts
convert(dictionary, "不是"); // "bú shì" — negative adverb written apart
convert(dictionary, "一个"); // "yí gè"  — numeral and measure word
convert(dictionary, "黄河"); // "Huáng Hé" — proper name and generic term
convert(dictionary, "中国人"); // "Zhōngguórén" — nationality written as one
```

The list exists because measuring says these cannot be rules. jieba tags 不是
and 不但 both `c`, but the standard writes `bú shì` and `bùdàn`; of 247
two-character numeral+量词 candidates a large share are lexicalised, so 大米
stays `dàmǐ` while 一天 separates; and 黄河 is `Huáng Hé` where 青海 is
`Qīnghǎi`, with nothing in the data to tell them apart.

It is deliberately **not** a complete 正词法 implementation. It holds the cases
this package has a reason for, and grows as cases arrive rather than by guessing
at them.

Text that is not Han passes through untouched — punctuation, Latin letters and
digits are left exactly as written, because reading numbers aloud is a separate
problem with its own rules (2026年 is `èr líng èr liù nián`, but 2026个 is
`liǎng qiān líng èr shí liù gè`).

### Confidence, and what was rejected

A lattice decode knows when it is guessing, and greedy longest-match cannot.
`convertPieces` returns the conversion one syllable at a time, each carrying
what the decode chose it over:

```ts
import { convertPieces, isUncertain, writeSyllable } from "@kensio/pinyinjs";

const pieces = convertPieces(dictionary, "银行");
pieces.map((piece) => piece.text); // ["yín", "háng"]
pieces[0]?.confidence?.isLocked; // true — 银 reads one way on every path
pieces[1]?.confidence?.alternatives.map((found) =>
  found.reading.map((syllable) => writeSyllable(syllable)).join(""),
); // ["xíng", "héng", "hàng"] — rejected, and costed
```

Three states, in increasing order of how often they are wrong:

- **locked** — every path through the lattice reads the position the same way,
  so no cost model could have changed it. Nothing is rejected.
- **backed by a word** — other readings existed, and taking one would have meant
  breaking a dictionary word apart. 行 in 银行 is `háng` for that reason.
- **uncertain** — another reading of the same stretch was available for less
  than the price of a word boundary, so the choice rests on a prior and nothing
  else. 行 on its own is `xíng` for that reason. `isUncertain` reports it.

An alternative's `cost` is in the reading decode's own units, where one step is
one frequency bucket and a boundary is 16. It is a measure of how much evidence
the choice had, **not a probability**: a character's alternate readings are
ranked but not weighted upstream, so they sit exactly one bucket apart whatever
the real odds are. [Accuracy](#accuracy) gives what each state is worth,
measured.

### HTML output

```ts
import { convertToHtml } from "@kensio/pinyinjs";

convertToHtml(dictionary, "行");
// <span class="py-syllable py-tone-2 py-uncertain"
//       data-alternatives="háng héng hàng">xíng</span>
```

One element per syllable, carrying `py-tone-1` to `py-tone-5` and, where the
decode was guessing, `py-uncertain` with the readings it turned down. Nothing is
styled and nothing wraps the whole conversion: the classes are hooks, and the
page decides whether a fourth tone is red and an uncertain reading is dotted
underneath. Text that is not Han is escaped rather than marked up.

Pass `toneClasses: false` or `markUncertain: false` to leave either off, and any
`convert` option to change the conversion itself. `toHtml` renders pieces that
have already been converted, for a page that wants to render them more than one
way.

### Tiers

The dictionary ships in three nested sizes, so a page can be useful immediately
and improve as the rest arrives.

| Tier       | Entries | Download (brotli) | Covers                        |
| ---------- | ------: | ----------------: | ----------------------------- |
| `core`     |  16,730 |             70 KB | single characters only        |
| `standard` |  66,730 |            376 KB | 97.9% of exception token mass |
| `full`     | 461,623 |          2,381 KB | everything                    |

"Exception token mass" is the share of running text where a word's reading
differs from its characters' default readings — exactly where a conversion goes
wrong if the entry is missing. Going from `standard` to `full` mostly improves
_spacing_ rather than readings, so re-running as the last tier lands changes
little visibly.

`full` is the default, because accuracy is the point of difference.

## Looking words up

```ts
const entry = dictionary.lookup("头发");
entry?.reading; // [{ initial: "t", final: "ou", tone: 2 }, { initial: "f", final: "a", tone: 5 }]
entry?.isProperNoun; // false
entry?.partOfSpeech; // "n"

dictionary.lookup("頭髮")?.reading; // the same reading, found under 繁體
dictionary.lookup("臺灣")?.reading; // 臺灣 and 台灣 are both keys for 台湾
dictionary.hasPrefix("银"); // true
dictionary.readingsOf("行"); // xíng, háng, héng, hàng — every reading, likeliest first
```

`hasPrefix` is the question a lattice asks at every position, and the index
answers it with the same binary search as an exact lookup — no second structure,
and 2.9 MB of heap for the whole key list.

## Syllables

The syllable layer needs no dictionary and no network, and is useful on its own.

```ts
import { isSyllable, readSyllable, writeSyllable } from "@kensio/pinyinjs";

readSyllable("jiù"); // { initial: "j", final: "iou", tone: 4 }
readSyllable("jiu4"); // the same — both notations parse
readSyllable("lv4"); // { initial: "l", final: "ü", tone: 4 }
readSyllable("hello"); // undefined — not a possible syllable at all

isSyllable("wánr"); // true — 儿化 is a suffix, not a syllable of its own
```

Parsing answers whether a spelling is _well formed_, not whether Mandarin
actually uses it: `shong` parses happily and is not a real syllable. The
attested inventory is separate, and is what the build pipeline validates
against — 408 syllables from the phrase corpus, 424 once the interjections and
the rare readings only Unihan reaches are counted.

```ts
import { ATTESTED_SYLLABLES, DICTIONARY_SYLLABLES } from "@kensio/pinyinjs";

DICTIONARY_SYLLABLES.has("shong"); // false
DICTIONARY_SYLLABLES.has("zhuang"); // true
ATTESTED_SYLLABLES.length; // 415
```

Initials and finals are the _underlying_ forms rather than the spelling, so 就 is
`j` + `iou` and 军 is `j` + `ün`. Spelling is reconstructed on demand:

```ts
const jiu = { initial: "j", final: "iou", tone: 4 } as const;
writeSyllable(jiu); // "jiù"
writeSyllable(jiu, "numbers"); // "jiu4"
writeSyllable(jiu, "superscript"); // "jiu⁴"
writeSyllable(jiu, "none"); // "jiu"
```

Input is tolerant and output is standard by default: `bei3` and `běi` parse
identically and mix freely, as do the `v` and `u:` conventions for ü, and a
raised tone number reads back as the number it is. The one deliberate rejection
is both notations on one syllable (`běi3`), which is more likely a mistake than
an intent.

### Splitting a written word

```ts
import { readWord, splitSyllables } from "@kensio/pinyinjs";

splitSyllables("nǐhǎo"); // ["nǐ", "hǎo"]
splitSyllables("Xī'ān"); // ["Xī", "ān"]
splitSyllables("yinhang"); // ["yin", "hang"]
splitSyllables("guórén"); // ["guó", "rén"], not ["guór", "én"]
readWord("yínháng"); // the same, parsed into Syllable objects
```

A syllable starting with a, o or e takes an apostrophe before it unless it
begins the word, so an unapostrophised run may not start one — which is what
keeps `guórén` from splitting after the r. Where no split obeys that rule the
word was written wrong, and the plain longest-first reading is used anyway:
`hǎiōu` still reads as two syllables.

### Tones

An unwritten tone is distinct from the neutral tone. `Syllable.tone` is
`Tone | undefined`, where undefined means the source wrote no tone at all: the
`de` in 我的 is neutral, whereas the `bei` in a typed `beijing` simply has no
tone written. Conflating them would fabricate information.

```ts
import {
  applyToneMark,
  NEUTRAL_TONE,
  stripToneMarks,
  toneFromMarks,
} from "@kensio/pinyinjs";

applyToneMark("hao", 3); // "hǎo"
applyToneMark("hao", NEUTRAL_TONE); // "hao"
stripToneMarks("hǎo"); // "hao"
toneFromMarks("hǎo"); // 3
```

_Source dictionaries_ write an unmarked syllable to mean neutral, and the build
pipeline resolves them that way. Only user input is genuinely ambiguous.

## Sandhi

The dictionary stores **underlying** tones. Sandhi is a typed pass over the
syllable array, never over a string, so it can be switched off and can apply
across word boundaries — the 客 of 客气 retones the 不 in front of it even
though they are separate entries.

```ts
import { applySandhi, readWord } from "@kensio/pinyinjs";

const buShi = readWord("bùshì") ?? [];
applySandhi(buShi); // bú shì — flattened before a fourth tone

const niHao = readWord("nǐhǎo") ?? [];
applySandhi(niHao); // unchanged by default
applySandhi(niHao, { thirdTone: true }); // ní hǎo
applySandhi(buShi, { yiBu: false }); // unchanged
```

Third-tone sandhi is **off by default** on purpose: standard orthography writes
underlying tones, so 你好 is written `nǐ hǎo` even though it is said `ní hǎo`.
Turn it on when transcribing speech.

## Scripts and locales

Script and locale are independent axes, and conflating them would be wrong:
Taiwan writes `Hant` with `zh-TW` readings, but mainland editions of classical
texts use `Hant` with `zh-CN` readings, and Singapore uses `Hans`.

| Axis   | Values            | What differs                 |
| ------ | ----------------- | ---------------------------- |
| Script | `Hans` / `Hant`   | which characters are written |
| Locale | `zh-CN` / `zh-TW` | how they are read            |

Both scripts are keys in the same dictionary, so nothing is converted at lookup
time. `zh-TW` is stored as a delta over `zh-CN`, since only a few hundred words
differ.

## Building the data

The compiled artifacts are committed to `data/`, so what ships is exactly what
was tested. Rebuilding them is only needed to take a fresh copy of the sources:

```bash
pnpm build:data
```

That fetches the four sources into `.cache/` (gitignored, ~32 MB), merges them,
runs the build assertions, and writes `data/` and `NOTICE`. Nothing already
cached is refetched; pass `--refresh` to take new copies.

**The build fails rather than warns.** No artifact is written unless 儿化 is
repaired both ways, 一 and 不 sandhi is normalised out, the override table is
applied, the polyphone collocations survive, 頭髮 reads `tóufa`, 北京 is a proper
noun, every syllable is one the inventory knows, and every tier reads back
exactly as it was built.

## Accuracy

```bash
pnpm accuracy
```

Scores both decoders against the gold corpus, readings and spacing separately,
broken down by category, and reports how much of the corpus the reading
projection locks.

| Metric                       | Greedy baseline |    Lattice |
| ---------------------------- | --------------: | ---------: |
| Reading accuracy (with tone) |          100.0% | **100.0%** |
| Reading accuracy (toneless)  |          100.0% |     100.0% |
| Exact match                  |           94.4% |      97.2% |
| Spacing (F1)                 |           98.0% |     100.0% |
| Capitalisation               |           98.7% |      98.7% |

Every reading in the corpus is now correct, for both decoders. That is a
statement about the corpus as much as about the code: 71 cases and 159
syllables have no reading headroom left, so they can no longer tell the two
decoders apart. The lattice's measurable win is spacing, where it is exact.

**These figures are asserted, not quoted.** `src/readme.test.ts` parses this
table and checks every number against the scorer, because they went stale
through two releases before anything noticed.

Two of the 71 cases still miss, both the same one: 你好 and 谢谢 are expected
capitalised as greetings, and there is no punctuation in a bare word to signal
that it is an utterance rather than a citation.

### Polyphones

```bash
pnpm polyphones
```

A corpus of 71 cases cannot separate two decoders, so the hard part is measured
against the [CPP dataset](https://github.com/kakaobrain/g2pM) instead: 20,139
polyphonic characters in real sentences, each labelled by hand. It is
deliberately a hard sample — every case is a polyphone, and rare ones are
represented about as often as common ones — so it is a floor for running text
rather than an estimate of it.

| Decoder         | Correct reading |
| --------------- | --------------: |
| Greedy baseline |          88.81% |
| Lattice         |      **89.04%** |

The margin is small but not noise: the lattice is right where greedy is wrong 76
times, and wrong where greedy is right 30 times (McNemar, _p_ ≈ 9 × 10⁻⁶). This
is the first measurement to separate the two decoders on readings at all — the
gold corpus has both at 100% and cannot.

Split by what the decoder said about its own confidence:

| State            |  Cases | Wrong reading |
| ---------------- | -----: | ------------: |
| locked           |  2,060 |         1.46% |
| backed by a word | 12,035 |         4.46% |
| uncertain        |  6,044 |        27.15% |

So the signal is worth having: a syllable the decoder marks uncertain is around
19 times likelier to be wrong than a locked one. On ordinary running text it
lands on 18.7% of the syllables of everyday sentences (Tatoeba, 199,508
syllables) and 13.2% of encyclopedic prose (zh.wikipedia, 168,892) — enough to
be informative, and not so much that marking it drowns the page.

## Data sources

| Source                                                                | Provides                                              | Licence      |
| --------------------------------------------------------------------- | ----------------------------------------------------- | ------------ |
| [Unihan](https://www.unicode.org/charts/unihan.html)                  | character readings, polyphone priors, script variants | Unicode      |
| [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict)   | 简体/繁體 pairs, 儿化, neutral tones, Taiwan readings | CC BY-SA 4.0 |
| [phrase-pinyin-data](https://github.com/mozillazg/phrase-pinyin-data) | the bulk of the word readings                         | MIT          |
| [jieba](https://github.com/fxsjy/jieba)                               | word frequencies and part-of-speech tags              | MIT          |

Every source has verified defects, so the build pipeline is a merge with a
precedence chain rather than a format converter. `NOTICE` is generated from the
same table the pipeline fetches from, so attribution cannot drift from what
actually shipped.

Because CC-CEDICT is CC BY-SA 4.0, the compiled dictionaries in `data/` are
share-alike. The code is Apache-2.0.

## Contributing

```bash
pnpm install
pnpm check     # format, complexity, build, typecheck, test with coverage
```

`pnpm check` must pass: eslint on `strictTypeChecked`, `tsc` with
`exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`, and vitest at 95%
coverage thresholds.

Every example in this README is executed by `src/readme.test.ts` against the
committed dictionary, so the two cannot drift apart unnoticed. Change them
together.

**Verify parsers and transforms against the full real source file, not only
fixtures.** Four defects have been caught that way and none of them by a
fixture — most recently that `kHanyuPinlu` writes 李 as `li(36)` with no tone
mark, which made 李华 come out `Li Huá`. Fixtures validate the assumption you
already had.

## Licence

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
