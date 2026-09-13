# Checking typed pinyin

`check` compares typed pinyin with Chinese text and reports a verdict for each
syllable.

```ts
import { check } from "@kensio/pinyinjs";

const marked = check(dictionary, "银行", "yínxíng");
marked.syllables.map((one) => one.verdict); // ["correct", "wrong"]
marked.syllables[1]?.source; // "行"
marked.score; // 0.5
```

Use it to mark pronunciation exercises and highlight missing syllables, wrong
readings or tone mistakes.

<a id="why-a-dictionary-is-worth-having-for-this"></a>

## Accepted variations

The checker accepts several ways to write the same reading.

Tone marks and tone numbers can be mixed within a word. The
[syllable parser](../syllables/) treats `bei3` and `běi` as the same syllable:

```ts
check(dictionary, "北京", "běijīng").isCorrect; // true
check(dictionary, "北京", "bei3jing1").isCorrect; // true
check(dictionary, "北京", "bei3jīng").isCorrect; // true
```

When the decoder is uncertain, the checker accepts its plausible alternatives.
For 行 alone, this includes `xíng`, `háng` and `héng`:

```ts
check(dictionary, "行", "xíng").isCorrect; // true
check(dictionary, "行", "háng").isCorrect; // true
```

A reading that breaks a recognised word is rejected. For example, the 行 in
银行 must be `háng`:

```ts
check(dictionary, "银行", "yínxíng").syllables[1]?.verdict; // "wrong"
```

This uses the same threshold as [`isUncertain`](../confidence/). An alternative
is accepted if choosing it would cost less than one word boundary.

Both underlying tones and [sandhi](../sandhi/) forms are accepted. 你好 can be
`nǐ hǎo` or `ní hǎo`, and 不是 can be `bù shì` or `bú shì`:

```ts
check(dictionary, "你好", "nǐ hǎo").isCorrect; // true
check(dictionary, "你好", "ní hǎo").isCorrect; // true
check(dictionary, "不是", "bú shì").isCorrect; // true
check(dictionary, "不是", "bù shì").isCorrect; // true
```

An omitted tone is reported separately from a wrong tone:

```ts
check(dictionary, "北京", "bei jing").syllables.map((one) => one.verdict);
// ["toneless", "toneless"]
check(dictionary, "北京", "bei3jing3").syllables.map((one) => one.verdict);
// ["correct", "tone"]
```

Apostrophes mark syllable boundaries. The checker accepts their omission when
the syllables are still unambiguous:

```ts
check(dictionary, "西安", "Xī'ān").isCorrect; // true
check(dictionary, "西安", "xi1an1").isCorrect; // true
check(dictionary, "海鸥", "hǎiōu").isCorrect; // true, the mark is optional there
```

For 西安, `xiān` is wrong because it is one syllable. `Xīān` passes because
the two tone marks identify two syllables.

Word spacing is reported separately. See [word spacing](#word-spacing).

<a id="the-verdicts"></a>

## Syllable verdicts

The result contains one entry per expected or typed syllable, in order.

| Verdict    | Means                                          |
| ---------- | ---------------------------------------------- |
| `correct`  | right syllable, right tone                     |
| `toneless` | right syllable, no tone written                |
| `tone`     | right syllable, wrong tone                     |
| `wrong`    | wrong syllable                                 |
| `missing`  | a syllable of the reading that was not typed   |
| `extra`    | a syllable typed that the reading does not use |

The `spacing` field reports word spacing separately from the syllable verdict.

An unmarked neutral-tone syllable is `correct`. Pinyin normally writes the
neutral tone without a mark:

```ts
check(dictionary, "我的书", "wǒ de shū").isCorrect; // true
```

<a id="being-strict-about-tones"></a>

### Requiring tones

By default, `toneless` counts as correct. Set `tones: "required"` to count it
as a mistake. The verdict remains `toneless` in either mode.

```ts
check(dictionary, "北京", "bei jing").isCorrect; // true
check(dictionary, "北京", "bei jing", { tones: "required" }).isCorrect; // false
```

## Word spacing

The `spacing` field reports whether word boundaries match. For example,
`yín háng` has the right syllables for 银行 but splits one word into two:

```ts
const split = check(dictionary, "银行", "yín háng");
split.syllables.map((one) => one.verdict); // ["correct", "correct"]
split.syllables.map((one) => one.spacing); // ["correct", "split"]
```

| Spacing   | Means                                         |
| --------- | --------------------------------------------- |
| `correct` | a word begins here, or does not, as it should |
| `split`   | a word was written as two                     |
| `joined`  | two words were written as one                 |

`spacing` is undefined for a missing or extra syllable because it has no
counterpart to compare.

Spacing is always reported. Set `spacing: "required"` to include it in the score:

```ts
check(dictionary, "银行", "yín háng").isCorrect; // true
check(dictionary, "银行", "yín háng", { spacing: "required" }).isCorrect; // false
```

Spacing is excluded from the score by default. The
[orthography implementation](../orthography/) covers only part of the standard,
and some valid spellings may differ from its output. Enable spacing checks
when the exercise is specifically testing word boundaries.

<a id="the-tolerance"></a>

### Accepted boundaries

With `spacing: "required"`, the checker accepts these variations:

```ts
const graded = { spacing: "required" } as const;
```

Both orthographic grouping and dictionary word boundaries are accepted.
Orthographic grouping joins aspect particles to verbs and separates the generic
part of a place name. `grouping: false` uses dictionary words directly:

```ts
check(dictionary, "他看了", "tā kànle", graded).isCorrect; // true, 分词连写
check(dictionary, "他看了", "tā kàn le", graded).isCorrect; // true, the words
check(dictionary, "南京市", "Nánjīng Shì", graded).isCorrect; // true
check(dictionary, "南京市", "Nánjīngshì", graded).isCorrect; // true
```

A hyphenated word can be written with a space or joined without the hyphen.
For example, 干干净净 is normally `gāngān-jìngjìng`:

```ts
check(dictionary, "干干净净", "gāngān-jìngjìng", graded).isCorrect; // true
check(dictionary, "干干净净", "gāngān jìngjìng", graded).isCorrect; // true
check(dictionary, "干干净净", "gāngānjìngjìng", graded).isCorrect; // true
```

Other missing or extra boundaries are reported as spacing mistakes:

```ts
check(dictionary, "我要去北京。", "wǒyàoqùběijīng", graded).syllables.map(
  (one) => one.spacing,
); // ["correct", "joined", "joined", "joined", "correct"]
```

<a id="what-each-syllable-carries"></a>

## Syllable details

| Field       | Is                                                      |
| ----------- | ------------------------------------------------------- |
| `verdict`   | one of the six above                                    |
| `spacing`   | `correct`, `split` or `joined`                          |
| `isCorrect` | whether it counts as right in the score                 |
| `expected`  | the `Syllable` expected here, or undefined for an extra |
| `actual`    | the `Syllable` typed here, or undefined for a missing   |
| `text`      | what was typed, exactly as written                      |
| `source`    | the characters the expected syllable reads              |
| `at`        | where those characters start, in code points            |

Use `source` and `at` to highlight the characters associated with a mistake.

```ts
const marked = check(dictionary, "我要去银行", "wǒ yào qù yínxíng");
marked.syllables
  .filter((one) => !one.isCorrect)
  .map((one) => [one.source, one.at, one.text]);
// [["行", 4, "xíng"]]
```

`text` preserves what the learner typed. If it cannot be parsed as a syllable,
`actual` is undefined and the verdict is `wrong`.

<a id="the-score"></a>

## Score

`score` is the proportion of reported syllables counted as correct, from 0 to 1.
`isCorrect` is true when every reported syllable counts as correct.

The denominator includes extra typed syllables. Adding a syllable and omitting
a syllable both reduce the score.

```ts
check(dictionary, "北京", "běi běi jīng").score; // 2/3
check(dictionary, "北京市", "běi shì").score; // 2/3
```

<a id="the-two-readings-are-aligned-first"></a>

## Alignment

The checker aligns expected and typed syllables by their toneless spellings
before grading them. A missing syllable does not shift every subsequent
syllable into the wrong position:

```ts
check(dictionary, "北京市", "běi shì").syllables.map((one) => one.verdict);
// ["correct", "missing", "correct"]
```

Unmatched syllables within each gap are paired as substitutions. For 银行 typed
as `yínxíng`, `yín` aligns and `xíng` is one wrong syllable in place of `háng`.

## Options

`check` accepts every [conversion option](../options/), plus `tones` and
`spacing` to control scoring.

| Option    | Default      | Values                     |
| --------- | ------------ | -------------------------- |
| `tones`   | `"optional"` | `"optional"`, `"required"` |
| `spacing` | `"optional"` | `"optional"`, `"required"` |

Use `readings` when the exercise requires a particular pronunciation:

```ts
check(dictionary, "这篇文章不太长。", "zhè piān wénzhāng bú tài cháng", {
  readings: { 太长: "tài cháng" },
}).isCorrect; // true
```

`locale: "zh-TW"` grades against the 國語 reading, so 垃圾 reads `lèsè` where
`zh-CN` reads `lājī`.

## At the command line

```console
$ pinyinjs check 银行 yínxíng
银行  yínháng  50%
  银     yín     yín     correct
  行     háng    xíng    wrong

$ pinyinjs check 银行 "yín háng" --require-spacing
银行  yínháng  50%
  银     yín     yín     correct
  行     háng    háng    correct   split
```

The CLI prints the text, expected reading and score, followed by each syllable
with its source characters, expected reading, typed text and verdict. Spacing
mistakes appear beside the affected syllables.

The first argument is Chinese text. Remaining arguments are joined as the typed
pinyin, so `pinyinjs check 北京市 běijīng shì` works without quoting the pinyin.
For standard input, provide one tab-separated pair per line:

```console
$ printf '银行\tyínxíng\n北京\tbei3jing3\n' | pinyinjs check
```

Use `--require-tones` and `--require-spacing` to include them in the score.
Conversion flags also apply. For example, `--locale zh-TW` checks 國語 readings.
`--json` includes every result field, including `at` and `source`.

<a id="cost"></a>

## Conversion cost

Each check performs three conversions. The first supplies the expected reading
and its [confidence report](../confidence/). The second reverses both sandhi
settings to obtain the alternative tone forms. These two conversions cover all
four sandhi combinations because 一/不 sandhi and third-tone sandhi affect
different syllables. The third conversion supplies the alternative word
spacing.

<!-- card
```ts
check(dictionary, "银行", "yínxíng");
// ["correct", "wrong"], at 行

check(dictionary, "你好", "ní hǎo");
// correct: said with sandhi
```
-->
