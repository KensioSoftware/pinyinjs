# Syllables

The syllable layer needs no dictionary and no network. It parses written
pinyin, writes it back in any notation, splits a run of it into syllables, and
answers whether a spelling is well formed.

```ts
import { isSyllable, readSyllable, writeSyllable } from "@kensio/pinyinjs";

readSyllable("jiù"); // { initial: "j", final: "iou", tone: 4 }
readSyllable("jiu4"); // the same, both notations parse
readSyllable("lv4"); // { initial: "l", final: "ü", tone: 4 }
readSyllable("hello"); // undefined
readSyllable("běi3"); // undefined, one notation at a time
```

This is the half of the package that leaves hanzi out entirely. If you are
building a pinyin input field, checking a learner's typing, or converting
between tone notations, none of the dictionary machinery is involved.

## Underlying forms

`initial` and `final` hold the _underlying_ form, the one behind the spelling.
就 is `j` + `iou` and 军 is `j` + `ün`:

```ts
readSyllable("jūn"); // { initial: "j", final: "ün", tone: 1 }
readSyllable("jun1"); // the same
```

The spelling rules that turn `iou` into `iu` after an initial, or drop the
umlaut from `ün` after `j`, are applied when writing. A syllable therefore
compares equal to itself however it was typed, and that is the whole reason for
doing it this way.

Spelling is put back on demand:

```ts
const jiu = { initial: "j", final: "iou", tone: 4 } as const;
writeSyllable(jiu); // "jiù"
writeSyllable(jiu, "numbers"); // "jiu4"
writeSyllable(jiu, "superscript"); // "jiu⁴"
writeSyllable(jiu, "none"); // "jiu"
```

`writeSyllableSpelling` gives the toneless spelling on its own:

```ts
import { writeSyllableSpelling } from "@kensio/pinyinjs";

writeSyllableSpelling({ initial: "j", final: "ün", tone: 1 }); // "jun"
```

## What input is accepted

Either notation, the `v` and `u:` conventions for ü, and raised tone digits:

```ts
readSyllable("lü4"); // { initial: "l", final: "ü", tone: 4 }
readSyllable("lv4"); // the same
readSyllable("lu:4"); // the same
```

One notation at a time. `běi3` is undefined, because a syllable carries one tone
and that spelling states two.

`normaliseUmlaut` does the `v`/`u:` rewrite on its own if you need it earlier:

```ts
import { normaliseUmlaut } from "@kensio/pinyinjs";

normaliseUmlaut("lv"); // "lü"
```

## Well formed and attested are different questions

Parsing answers whether a spelling _could_ be a Mandarin syllable. Whether
Mandarin uses it is a separate question:

```ts
readSyllable("shong"); // { initial: "sh", final: "ong", tone: undefined }
isSyllable("shong"); // true
```

`shong` is a perfectly formed initial plus final that no Mandarin word uses. The
attested inventory is a separate export:

```ts
import { ATTESTED_SYLLABLES, DICTIONARY_SYLLABLES } from "@kensio/pinyinjs";

DICTIONARY_SYLLABLES.has("shong"); // false
DICTIONARY_SYLLABLES.has("zhuang"); // true
ATTESTED_SYLLABLES.length; // 415
```

There are three of these, at three different sizes:

| Export                 | Size | Is                                                     |
| ---------------------- | ---: | ------------------------------------------------------ |
| `ATTESTED_SYLLABLES`   |  415 | the standard toneless syllable inventory               |
| `RARE_SYLLABLES`       |    9 | spellings the dictionary uses that the inventory omits |
| `DICTIONARY_SYLLABLES` |  424 | the two together, what the build validates against     |

The nine rare ones are `bong`, `cei`, `din`, `eng`, `fiao`, `lo`, `rua`, `sei`
and `tei`. They are interjections, dialect readings and onomatopoeia that appear
in the source dictionaries but not in any textbook's table. Validate learner
input against `ATTESTED_SYLLABLES`, and dictionary data against
`DICTIONARY_SYLLABLES`.

## Which tones a syllable is written in

All three of those are toneless, and a toneless inventory is only half of "is
this a syllable of Mandarin?". 咯 is written `lo` and never `ló`, because that
syllable is a sentence-final particle and is only ever neutral. 半 is written
`bàn` and never `bán`, because that one has no second tone.

```ts
import { isAttestedTone, readSyllable, SYLLABLE_TONES } from "@kensio/pinyinjs";

SYLLABLE_TONES.get("lo"); // [5]
SYLLABLE_TONES.get("ban"); // [1, 3, 4, 5]
isAttestedTone(readSyllable("ló")); // false
isAttestedTone(readSyllable("lo")); // true, no tone claims nothing
```

424 syllables in five tones would be 2,120 combinations, and only **1,708 of
them are ever written**. A fifth of that grid is empty. The table is extracted
from the merged dictionary, and a build assertion holds it to what the
dictionary uses. A source refresh cannot quietly add a reading outside it.

It is what lets the
[romanisation readers](../romanization/#the-tone-narrows-the-list) settle an
ambiguous spelling on the tone that was written. Wade-Giles `lo²` can only be 羅
luó. A syllable outside the inventory passes without judgement, since
`isAttestedTone` answers which tones a syllable takes and leaves the inventory
itself to the sets above.

`INITIALS` has 21 entries and `FINALS` has 41, with `isInitial`, `isFinal` and
`isPalatalInitial` beside them.

## Splitting written pinyin

```ts
import { readWord, splitSyllables } from "@kensio/pinyinjs";

splitSyllables("nǐhǎo"); // ["nǐ", "hǎo"]
splitSyllables("Xī'ān"); // ["Xī", "ān"]
splitSyllables("yinhang"); // ["yin", "hang"]
splitSyllables("guórén"); // ["guó", "rén"], not ["guór", "én"]
splitSyllables("hǎiōu"); // ["hǎi", "ōu"], missing apostrophe, read anyway
readWord("yínháng"); // the same, parsed into Syllable objects
```

Splitting is greedy in a way that respects the finals. `guórén` cannot split as
`guór` + `én`, because `guór` fails to parse as a syllable. A missing 隔音符号
is recovered where the split is unambiguous.

Note that splitting will find _a_ reading of almost any Latin text, since so
many English letter sequences are also well-formed syllables:

```ts
readWord("nonsense");
// [{ initial: "n", final: "o" }, { initial: "", final: "n" }, … ]
```

If you need to know whether something is really pinyin, check the pieces against
`ATTESTED_SYLLABLES`. `readWord` returning `undefined` will not tell you.

## Tones

```ts
import {
  applyToneMark,
  NEUTRAL_TONE,
  stripToneMarks,
  toneFromMarks,
} from "@kensio/pinyinjs";

applyToneMark("hao", 3); // "hǎo"
applyToneMark("hao", NEUTRAL_TONE); // "hao"
applyToneMark("lü", 4); // "lǜ"
stripToneMarks("hǎo"); // "hao"
stripToneMarks("Xī'ān"); // "Xi'an"
toneFromMarks("hǎo"); // 3
toneFromMarks("hao"); // undefined
```

`applyToneMark` puts the mark on the right vowel for you, and the rule takes
some stating. The standard places it on `a`, failing that on `o` or `e`, failing
that on the last remaining vowel, and it is that last clause which puts the mark
on the `u` of `iu` and the `i` of `ui`. Any mark already present is replaced,
and text with no vowel to carry one comes back unchanged.

### undefined and the neutral tone

`Syllable.tone` is `Tone | undefined`, and the two mean different things:

- **`5` (`NEUTRAL_TONE`)** says this syllable is toneless, and that is a fact
  about the word. The `de` in 我的.
- **`undefined`** says no tone was written. The `bei` in a typed `beijing`, where
  the writer simply did not say.

`toneFromMarks("hao")` gives `undefined` for the same reason. An unmarked
syllable in running text has made no claim about its tone.

## From the command line

```console
$ pinyinjs syllable nǐhǎo
nǐhǎo  nǐ hǎo
  nǐ        n + i, tone 3         nǐ  ni3  ni³
  hǎo       h + ao, tone 3        hǎo  hao3  hao³
```

`syllable` and `sandhi` are the two commands that need no dictionary. They start
without loading one.

<!-- card
```ts
readSyllable("jiù");
// { initial: "j", final: "iou", tone: 4 }
writeSyllable(jiu, "superscript"); // "jiu⁴"
splitSyllables("nǐhǎo"); // ["nǐ", "hǎo"]
splitSyllables("Xī'ān"); // ["Xī", "ān"]
```
-->
