# Options

Every field of `ConvertOptions`, what each value does, and what it looks like.
These are the third argument to `convert`, `convertPieces` and `convertToHtml`,
and each one is also a flag on the [command line](../cli/).

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

`convertToHtml` takes all of these plus two of its own; see
[HTML output](../html/#options).

## locale

Which reading to write where 普通话 and 國語 differ.

```ts
convert(dictionary, "垃圾"); // "lājī"
convert(dictionary, "垃圾", { locale: "zh-TW" }); // "lèsè"
```

Only about 490 items differ at all, so `zh-TW` is stored as a delta over
`zh-CN` and most words are unaffected by this option. Note that locale is not
the same axis as script; see [scripts and locales](../scripts-and-locales/).

## notation

How the tone is written.

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

The neutral tone is 5 in the numbered notations and unmarked in `marks`.
`superscript` is the useful one for prose that has to stay searchable: a reader
can ignore the digits, and `yin` still matches `yin²`.

## apostrophe

Where to write the 隔音符号, the apostrophe that stops a syllable boundary from
being misread.

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

`a`, `o` and `e` are the complete trigger set: `i`, `u` and `ü` surface as `y`
and `w` at the start of a syllable and cannot create the ambiguity.

GB/T 16159 technically conditions the apostrophe on there being an actual
ambiguity, which is what `"standard"` implements. Essentially every style guide
and implementation writes it unconditionally, which is why `"always"` is the
default.

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

"The first word of a sentence" needs the source to be punctuated as one. That
is the only thing separating 学生 looked up as a word from 这是我的书。written
as a sentence, and a comma does not count:

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

Full-width marks carry their own trailing space, so the Latin replacement takes
one. Brackets and quotation marks are left alone under either value.

## grouping

```ts
convert(dictionary, "南京市"); // "Nánjīng Shì"
convert(dictionary, "南京市", { grouping: false }); // "Nánjīngshì"
```

`true` applies 分词连写, the GB/T 16159 word-spacing rules: aspect particles
attach to their verb, suffixes to their stem, and the generic half of a place
name separates and capitalises. `false` writes each decoded word as one
unbroken run.

What the rules cover and where they stop is [orthography](../orthography/).

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

See [numbers](../numerals/) for which style a number takes and why, and for
what it deliberately does not guess at.

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

Third-tone sandhi is off by default because standard orthography writes the
underlying tone: 你好 is written `nǐ hǎo` even though it is said `ní hǎo`.
Turn it on when transcribing speech rather than writing pinyin. More in
[sandhi](../sandhi/).

The object is merged with the defaults, so `{ thirdTone: true }` leaves `yiBu`
on.

<!-- card
```ts
convert(dictionary, "垃圾", { locale: "zh-TW" }); // "lèsè"
convert(dictionary, "银行", { notation: "numbers" });
// "yin2hang2"
convert(dictionary, "海鸥", { apostrophe: "standard" });
// "hǎiōu"
```
-->
