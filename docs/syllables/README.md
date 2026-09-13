# Syllables

Use the syllable functions to parse, validate and format written pinyin without loading a dictionary.

```ts
import { isSyllable, readSyllable, writeSyllable } from "@kensio/pinyinjs";

readSyllable("jiù"); // { initial: "j", final: "iou", tone: 4 }
readSyllable("jiu4"); // the same, both notations parse
readSyllable("lv4"); // { initial: "l", final: "ü", tone: 4 }
readSyllable("hello"); // undefined
readSyllable("běi3"); // undefined, one notation at a time
```

These functions are useful for pinyin input fields, learner exercises and conversion between tone notations.

## Underlying forms

`initial` and `final` store the underlying syllable components. For example, 就 contains `j` + `iou`, while 军 contains `j` + `ün`:

```ts
readSyllable("jūn"); // { initial: "j", final: "ün", tone: 1 }
readSyllable("jun1"); // the same
```

Formatting applies the spelling rules. It contracts `iou` to `iu` after an initial and removes the umlaut from `ün` after `j`. Different accepted spellings therefore produce the same underlying syllable.

Choose a notation when formatting the syllable:

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

<a id="what-input-is-accepted"></a>

## Accepted input

Input can use tone marks, tone digits, superscript digits, or `v` and `u:` for ü:

```ts
readSyllable("lü4"); // { initial: "l", final: "ü", tone: 4 }
readSyllable("lv4"); // the same
readSyllable("lu:4"); // the same
```

A syllable must use one tone notation. Mixed notation such as `běi3` returns `undefined`.

`normaliseUmlaut` converts the `v` and `u:` conventions separately:

```ts
import { normaliseUmlaut } from "@kensio/pinyinjs";

normaliseUmlaut("lv"); // "lü"
```

<a id="well-formed-and-attested-are-different-questions"></a>

## Parsing and validation

A successful parse means the spelling has a valid initial and final. Use an inventory check to determine whether Mandarin uses that combination:

```ts
readSyllable("shong"); // { initial: "sh", final: "ong", tone: undefined }
isSyllable("shong"); // true
```

For example, `shong` can be parsed but is absent from the standard Mandarin inventory:

```ts
import { ATTESTED_SYLLABLES, DICTIONARY_SYLLABLES } from "@kensio/pinyinjs";

DICTIONARY_SYLLABLES.has("shong"); // false
DICTIONARY_SYLLABLES.has("zhuang"); // true
ATTESTED_SYLLABLES.length; // 415
```

Choose the inventory appropriate to your input:

| Export                 | Size | Is                                                     |
| ---------------------- | ---: | ------------------------------------------------------ |
| `ATTESTED_SYLLABLES`   |  415 | the standard toneless syllable inventory               |
| `RARE_SYLLABLES`       |    9 | spellings the dictionary uses that the inventory omits |
| `DICTIONARY_SYLLABLES` |  424 | the two together, what the build validates against     |

The dictionary inventory additionally includes nine rare syllables, `bong`, `cei`, `din`, `eng`, `fiao`, `lo`, `rua`, `sei` and `tei`. They occur in dialect readings, interjections and onomatopoeia. Use `ATTESTED_SYLLABLES` for learner input and `DICTIONARY_SYLLABLES` when validating dictionary data.

<a id="which-tones-a-syllable-is-written-in"></a>

## Valid tone combinations

The syllable inventories omit tone. Some syllables use only a subset of the five tones. For example, `lo` occurs only in neutral tone, while `bàn` occurs but `bán` does not.

```ts
import { isAttestedTone, readSyllable, SYLLABLE_TONES } from "@kensio/pinyinjs";

SYLLABLE_TONES.get("lo"); // [5]
SYLLABLE_TONES.get("ban"); // [1, 3, 4, 5]
isAttestedTone(readSyllable("ló")); // false
isAttestedTone(readSyllable("lo")); // true, no tone claims nothing
```

The dictionary contains 1,708 of the 2,120 possible combinations of 424 syllables and five tones. A build assertion keeps the exported tone inventory consistent with those readings.

[Romanisation readers](../romanization/#the-tone-narrows-the-list) use this inventory to narrow ambiguous spellings. For example, Wade-Giles `lo²` can only represent 羅, `luó`. `isAttestedTone` accepts syllables outside its inventory without judging them. Use the inventory sets separately when validating the syllable itself.

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

Splitting uses valid syllable forms to choose boundaries. For example, `guórén` cannot become `guór` + `én` because `guór` is invalid. A missing apostrophe can be recovered when the boundary is unambiguous.

<a id="the-tone-mark-says-where-a-syllable-ends"></a>

### Using tone marks to find boundaries

Tone marks provide additional boundary information:

```ts
splitSyllables("bùān"); // ["bù", "ān"], 不安 without its apostrophe
splitSyllables("xīan1"); // ["xī", "an1"], 西安 half typed
splitSyllables("xīa"); // ["xīa"], the mark misplaced on one syllable
```

Two tone marks cannot belong to one syllable. A misplaced mark and a syllable boundary have equal cost, and ties favour the longer syllable. This keeps `xīa` together. For `xīan1`, the tone information makes the complete reading cheaper than `xīa` + `n1`.

Many Latin letter sequences can be parsed as pinyin, including English words:

```ts
readWord("nonsense");
// [{ initial: "n", final: "o" }, { initial: "", final: "n" }, … ]
```

Validate the parsed pieces against `ATTESTED_SYLLABLES` when checking a pinyin input field. A successful `readWord` call alone does not establish that the input is pinyin.

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

`applyToneMark` places the mark on `a`, otherwise on `o` or `e`, otherwise on the last vowel. This puts the mark on `u` in `iu` and on `i` in `ui`. It replaces an existing mark and leaves text without a vowel unchanged.

### undefined and the neutral tone

`Syllable.tone` distinguishes an explicit neutral tone from an unspecified tone:

- `5` (`NEUTRAL_TONE`) means the syllable has neutral tone, as in the particle `de` in 我的.
- `undefined` means the input did not specify a tone, as in `bei` in `beijing`.

For example, `toneFromMarks("hao")` returns `undefined` because the spelling contains no tone mark.

## From the command line

```console
$ pinyinjs syllable nǐhǎo
nǐhǎo  nǐ hǎo
  nǐ        n + i, tone 3         nǐ  ni3  ni³
  hǎo       h + ao, tone 3        hǎo  hao3  hao³
```

The `syllable` and `sandhi` commands run without loading a dictionary.

<!-- card
```ts
readSyllable("jiù");
// { initial: "j", final: "iou", tone: 4 }
writeSyllable(jiu, "superscript"); // "jiu⁴"
splitSyllables("nǐhǎo"); // ["nǐ", "hǎo"]
splitSyllables("Xī'ān"); // ["Xī", "ān"]
```
-->
