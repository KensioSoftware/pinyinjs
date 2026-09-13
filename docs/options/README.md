# Options

Pass a `ConvertOptions` object as the third argument to `convert`, `convertPieces` or `convertToHtml`. The [command line](../cli/) exposes the same settings as flags.

```ts
convert(dictionary, text, { notation: "numbers", capitals: "none" });
```

| Option        | Default                            | Values                                            |
| ------------- | ---------------------------------- | ------------------------------------------------- |
| `locale`      | `"zh-CN"`                          | `"zh-CN"`, `"zh-TW"`                              |
| `notation`    | `"marks"`                          | `"marks"`, `"numbers"`, `"superscript"`, `"none"` |
| `apostrophe`  | `"always"`                         | `"always"`, `"standard"`, `"never"`               |
| `capitals`    | `"auto"`                           | `"auto"`, `"proper"`, `"none"`                    |
| `punctuation` | `"latin"`                          | `"latin"`, `"keep"`                               |
| `grouping`    | `true`                             | `false` turns off GB/T 16159 word spacing         |
| `numbers`     | `"read"`                           | `"keep"` leaves every digit as it was written     |
| `sandhi`      | `{ yiBu: true, thirdTone: false }` | `{ yiBu?: boolean; thirdTone?: boolean }`         |

`convertToHtml` also accepts HTML-specific options. See [HTML output](../html/#options).

## locale

Select mainland (`zh-CN`) or Taiwan (`zh-TW`) Mandarin readings.

```ts
convert(dictionary, "垃圾"); // "lājī"
convert(dictionary, "垃圾", { locale: "zh-TW" }); // "lèsè"
```

Most words have the same reading in both locales. The dictionary stores Taiwan readings only where they differ. Locale controls pronunciation independently of the input script. See [scripts and locales](../scripts-and-locales/).

## notation

Choose how tones are written.

```ts
convert(dictionary, "银行"); // "yínháng"
convert(dictionary, "银行", { notation: "numbers" }); // "yin2hang2"
convert(dictionary, "银行", { notation: "superscript" }); // "yin²hang²"
convert(dictionary, "银行", { notation: "none" }); // "yinhang"
```

| Value           | Writes                                     |
| --------------- | ------------------------------------------ |
| `"marks"`       | standard diacritics: `yínháng`             |
| `"numbers"`     | a trailing digit per syllable: `yin2hang2` |
| `"superscript"` | the same digit raised: `yin²hang²`         |
| `"none"`        | no tone at all: `yinhang`                  |

Neutral tone is written as 5 in numbered notations and without a mark in `marks`. With `superscript`, a plain substring query such as `yin` also matches `yin²`.

## apostrophe

Control the apostrophe (隔音符号) used to distinguish syllable boundaries.

```ts
convert(dictionary, "西安"); // "Xī'ān"
convert(dictionary, "天安门"); // "Tiān'ānmén"
convert(dictionary, "海鸥", { apostrophe: "standard" }); // "hǎiōu"
```

| Value        | Writes it                                                |
| ------------ | -------------------------------------------------------- |
| `"always"`   | before any non-initial syllable starting `a`, `o` or `e` |
| `"standard"` | only where leaving it out would read as something else   |
| `"never"`    | not at all                                               |

The rule applies to non-initial syllables beginning with `a`, `o` or `e` within a word. Initial `i`, `u` and `ü` are written with `y` or `w`.

`"standard"` inserts an apostrophe only when the spelling would otherwise be ambiguous. `"always"` inserts it before every eligible syllable and is the default.

## capitals

```ts
convert(dictionary, "银行"); // "yínháng", not "Yínháng"
convert(dictionary, "我要去北京。"); // "Wǒ yào qù Běijīng."
convert(dictionary, "北京。", { capitals: "none" }); // "běijīng."
```

| Value      | Capitalises                                    |
| ---------- | ---------------------------------------------- |
| `"auto"`   | proper nouns, and the first word of a sentence |
| `"proper"` | proper nouns only                              |
| `"none"`   | nothing                                        |

Sentence-initial capitalisation requires sentence punctuation in the source. A comma does not begin a new sentence:

```ts
convert(dictionary, "你好，世界"); // "nǐ hǎo, shìjiè"
```

## punctuation

```ts
convert(dictionary, "北京。"); // "Běijīng."
convert(dictionary, "北京。", { punctuation: "keep" }); // "Běijīng。"
```

| Value     | Does                                                                 |
| --------- | -------------------------------------------------------------------- |
| `"latin"` | rewrites `。，、；：？！` as their Latin equivalents, with the space |
| `"keep"`  | leaves every mark as it was                                          |

Latin replacements include the appropriate following space. Brackets and quotation marks are preserved under either setting.

## grouping

```ts
convert(dictionary, "南京市"); // "Nánjīng Shì"
convert(dictionary, "南京市", { grouping: false }); // "Nánjīngshì"
```

`true` applies the supported GB/T 16159 word-spacing rules. These join aspect particles and suffixes and separate generic terms in place names. `false` keeps each decoded word as one unbroken pinyin string.

See [orthography](../orthography/) for the rules and limitations.

## numbers

```ts
convert(dictionary, "我有3个"); // "wǒ yǒu sān gè"
convert(dictionary, "1998年"); // "yī jiǔ jiǔ bā nián"
convert(dictionary, "我有3个", { numbers: "keep" }); // "wǒ yǒu3gè"
```

| Value    | Does                                                     |
| -------- | -------------------------------------------------------- |
| `"read"` | says the digits, taking the style from what follows them |
| `"keep"` | leaves every digit exactly as it was written             |

See [numbers](../numerals/) for automatic style selection and cases where digits are preserved.

## sandhi

```ts
convert(dictionary, "不是"); // "bú shì"
convert(dictionary, "一个"); // "yí gè"
convert(dictionary, "好好", { sandhi: { thirdTone: true } }); // "háohǎo"
```

| Field       | Default | Does                                              |
| ----------- | ------- | ------------------------------------------------- |
| `yiBu`      | `true`  | 一 and 不 tone changes                            |
| `thirdTone` | `false` | third tone before third tone: `nǐ hǎo` → `ní hǎo` |

Third-tone sandhi is off by default. Written pinyin normally retains the underlying tones, so 你好 is written `nǐ hǎo` while spoken as `ní hǎo`. Enable it when transcribing pronunciation. See [sandhi](../sandhi/).

Settings are merged with the defaults. For example, `{ thirdTone: true }` keeps `yiBu` enabled.

<!-- card
```ts
convert(dictionary, "垃圾", { locale: "zh-TW" }); // "lèsè"
convert(dictionary, "银行", { notation: "numbers" });
// "yin2hang2"
convert(dictionary, "海鸥", { apostrophe: "standard" });
// "hǎiōu"
```
-->
