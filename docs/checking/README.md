# Checking typed pinyin

`check` marks a pinyin transcription somebody typed against the Chinese text it
was written for, syllable by syllable.

```ts
import { check } from "@kensio/pinyinjs";

const marked = check(dictionary, "银行", "yínxíng");
marked.syllables.map((one) => one.verdict); // ["correct", "wrong"]
marked.syllables[1]?.source; // "行"
marked.score; // 0.5
```

It is for an exercise that wants the mistake identified, and not just a pass or
a fail. A learner types the pinyin for a sentence, and what comes back says
which syllable went wrong and how.

## Why a dictionary is worth having for this

**A string comparison marks a learner wrong for being right**, and there are
six distinct ways it does. Being fair about them is the whole reason this
belongs in a library that already knows how the text is read.

**Either notation.** `bei3` and `běi` are the same syllable, and mix freely
within a word, because the [syllable layer](../syllables/) parses both:

```ts
check(dictionary, "北京", "běijīng").isCorrect; // true
check(dictionary, "北京", "bei3jing1").isCorrect; // true
check(dictionary, "北京", "bei3jīng").isCorrect; // true
```

**A reading the decoder itself was unsure of.** 行 standing on its own is chosen
by a prior alone. `xíng`, `háng` and `héng` were all there for the taking, and
the [confidence](../confidence/) report says so. A learner who guessed the other
way has not made a mistake the library is entitled to call one:

```ts
check(dictionary, "行", "xíng").isCorrect; // true
check(dictionary, "行", "háng").isCorrect; // true
```

The forgiveness stops exactly where the guessing does. 银行 is a word, and
reading its 行 as `xíng` means breaking that word apart, which the decoder
charges for. So this is a real mistake and is marked as one:

```ts
check(dictionary, "银行", "yínxíng").syllables[1]?.verdict; // "wrong"
```

That threshold is the one [`isUncertain`](../confidence/) uses, asked here as a
question. A rejected reading is accepted if taking it would have cost less than
one word boundary.

**Sandhi either way.** 你好 is written `nǐ hǎo` and said `ní hǎo`, and 不是 is
`bú shì` on the page over an underlying `bù shì`. Both forms of both pass. See
[sandhi](../sandhi/) for why the two differ at all:

```ts
check(dictionary, "你好", "nǐ hǎo").isCorrect; // true
check(dictionary, "你好", "ní hǎo").isCorrect; // true
check(dictionary, "不是", "bú shì").isCorrect; // true
check(dictionary, "不是", "bù shì").isCorrect; // true
```

**Tones written or not.** `Syllable.tone` distinguishes "no tone was written"
from the neutral tone, so leaving the tones off is a different report from
getting one wrong:

```ts
check(dictionary, "北京", "bei jing").syllables.map((one) => one.verdict);
// ["toneless", "toneless"]
check(dictionary, "北京", "bei3jing3").syllables.map((one) => one.verdict);
// ["correct", "tone"]
```

**Apostrophes.** The 隔音符号 marks a syllable boundary and carries no sound. It
settles none of these:

```ts
check(dictionary, "西安", "Xī'ān").isCorrect; // true
check(dictionary, "西安", "xi1an1").isCorrect; // true
check(dictionary, "海鸥", "hǎiōu").isCorrect; // true, the mark is optional there
```

The one exception is the 隔音符号 that does real work. `Xīān` is how `xiān` is
spelled, and reading it as two syllables is the thing the mark exists to make
possible. That one is marked wrong, because it says something else.

**Word spacing.** An axis of its own, because it is a mistake in its own right.
See [word spacing](#word-spacing) below.

## The verdicts

One entry per syllable expected or typed, in order.

| Verdict    | Means                                          |
| ---------- | ---------------------------------------------- |
| `correct`  | right syllable, right tone                     |
| `toneless` | right syllable, no tone written                |
| `tone`     | right syllable, wrong tone                     |
| `wrong`    | wrong syllable                                 |
| `missing`  | a syllable of the reading that was not typed   |
| `extra`    | a syllable typed that the reading does not use |

Word spacing is reported beside them, on `spacing`, and never folded in. See
[word spacing](#word-spacing).

A neutral-tone syllable typed with no mark is `correct` and not `toneless`,
because that is how pinyin writes the neutral tone:

```ts
check(dictionary, "我的书", "wǒ de shū").isCorrect; // true
```

### Being strict about tones

`toneless` counts as correct by default, which is what an exercise teaching the
syllables before the tones wants. `tones: "required"` counts it wrong, and
reports the same verdict either way. An application can always tell the two
kinds of tone mistake apart, whatever it decides to do about them.

```ts
check(dictionary, "北京", "bei jing").isCorrect; // true
check(dictionary, "北京", "bei jing", { tones: "required" }).isCorrect; // false
```

## Word spacing

Where the words go is its own axis, reported on `spacing` and separate from the
syllable's own verdict, because it is a separate mistake. `yín háng` reads 银行
perfectly and writes it as two words:

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

It is undefined for a syllable that was only expected or only typed, since it
has no counterpart to compare against.

Like everything else here, it is reported whatever the caller does with it, and
counted only when asked for:

```ts
check(dictionary, "银行", "yín háng").isCorrect; // true
check(dictionary, "银行", "yín háng", { spacing: "required" }).isCorrect; // false
```

Off by default, because the 分词连写 it grades against falls short of a complete
正词法 implementation ([orthography](../orthography/) says where it stops), and
a learner can write a word the standard writes differently from the way this
does. Turn it on for an exercise where the spacing is the point.

### The tolerance

These all grade the spacing and share one option:

```ts
const graded = { spacing: "required" } as const;
```

**Two spacing conventions, and both are accepted.** 分词连写 is what puts an
aspect particle on its verb and separates the generic half of a place name. The
words the dictionary knows are what `grouping: false` writes. Both come out of
this package, and a learner may have been taught either:

```ts
check(dictionary, "他看了", "tā kànle", graded).isCorrect; // true, 分词连写
check(dictionary, "他看了", "tā kàn le", graded).isCorrect; // true, the words
check(dictionary, "南京市", "Nánjīng Shì", graded).isCorrect; // true
check(dictionary, "南京市", "Nánjīngshì", graded).isCorrect; // true
```

**A hyphen allows both.** 干干净净 is `gāngān-jìngjìng`, one orthographic word
with a boundary written inside it, so rendering that mark as a space has not
invented a boundary and running it together has not lost one:

```ts
check(dictionary, "干干净净", "gāngān-jìngjìng", graded).isCorrect; // true
check(dictionary, "干干净净", "gāngān jìngjìng", graded).isCorrect; // true
check(dictionary, "干干净净", "gāngānjìngjìng", graded).isCorrect; // true
```

What is left after that is a real mistake, a word broken in half or a sentence
with no boundaries in it at all:

```ts
check(dictionary, "我要去北京。", "wǒyàoqùběijīng", graded).syllables.map(
  (one) => one.spacing,
); // ["correct", "joined", "joined", "joined", "correct"]
```

## What each syllable carries

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

`source` and `at` are what showing the mistake against the text needs. The
answer alone cannot say which 行 of a sentence was misread, and highlighting the
character the learner got wrong is more use than printing the right answer at
them.

```ts
const marked = check(dictionary, "我要去银行", "wǒ yào qù yínxíng");
marked.syllables
  .filter((one) => !one.isCorrect)
  .map((one) => [one.source, one.at, one.text]);
// [["行", 4, "xíng"]]
```

`text` is kept separately from `actual` because what was typed need not be a
syllable at all. Something unreadable comes back as written, with `actual`
undefined and a `wrong` verdict.

## The score

`score` is the share of the reported syllables that counted as correct, from 0
to 1, and `isCorrect` is whether all of them did.

It is over the entries reported, and not over the expected reading, so that
inventing a syllable costs as much as dropping one. An answer padded with
syllables has more entries than the reading has, and scoring against the reading
alone would let it pad for free.

```ts
check(dictionary, "北京", "běi běi jīng").score; // 2/3
check(dictionary, "北京市", "běi shì").score; // 2/3
```

## The two readings are aligned first

A syllable dropped halfway through an answer would otherwise put everything
after it out of step, and be reported as a mistake on every syllable that
follows instead of on the one that caused it. So the two readings are aligned
first, on their toneless spellings, by the same machinery that scores the
decoder against the gold corpus:

```ts
check(dictionary, "北京市", "běi shì").syllables.map((one) => one.verdict);
// ["correct", "missing", "correct"]
```

What the alignment leaves unmatched is then paired off within each gap, and that
is what makes a substitution one mistake instead of two. 银行 typed `yínxíng`
anchors on `yín`, leaving one expected `háng` against one typed `xíng`. That is
one wrong syllable, and not a missing one plus an invented one.

## Options

Every [conversion option](../options/) is accepted and passed to the conversion
the answer is read from, plus the two that say what a perfect score requires.

| Option    | Default      | Values                     |
| --------- | ------------ | -------------------------- |
| `tones`   | `"optional"` | `"optional"`, `"required"` |
| `spacing` | `"optional"` | `"optional"`, `"required"` |

`readings` is the one worth knowing about here. No rule settles every polyphone,
but an exercise knows which sense its own sentence uses, where the decoder can
only weigh the evidence:

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

The heading is the text, the answer as the conversion writes it, and the score.
Then one line per syllable, holding the characters, what was expected, what was
typed, the verdict, and the spacing where it went wrong.

Everything after the first argument is joined back up, so unquoted pinyin works
(`pinyinjs check 北京市 běijīng shì`). A piped file is one pair per line,
separated by a tab, since both halves can have spaces in them:

```console
$ printf '银行\tyínxíng\n北京\tbei3jing3\n' | pinyinjs check
```

`--require-tones` and `--require-spacing` are the two flags of its own. Every
conversion flag works too, so `--locale zh-TW` grades against 國語. `--json`
carries every field, `at` and `source` included.

## Cost

Three conversions of the text, and each one answers a different question. The
first is the answer, with the [confidence](../confidence/) report that says
where the decoder was guessing. The second is the opposite corner of the sandhi
square, and it is what gives every syllable both of its tonal forms. 一 and 不
sandhi applies to syllables in the first and fourth tones and third-tone sandhi
only to syllables in the third. The two passes never touch the same syllable,
and two corners are enough for all four. The third is the other spacing
convention, and that is where a boundary's tolerance comes from.

<!-- card
```ts
check(dictionary, "银行", "yínxíng");
// ["correct", "wrong"], at 行

check(dictionary, "你好", "ní hǎo");
// correct: said with sandhi
```
-->
