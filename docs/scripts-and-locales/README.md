# Scripts and locales

Script determines which characters are written. Locale determines which
pronunciation standard is used. Configure them independently.

| Axis   | Values            | What differs                 |
| ------ | ----------------- | ---------------------------- |
| Script | `Hans` / `Hant`   | which characters are written |
| Locale | `zh-CN` / `zh-TW` | how they are read            |

For example, traditional characters can be read with Taiwan (`zh-TW`) or
mainland (`zh-CN`) pronunciations. Simplified characters also support either
locale.

<a id="in-practice"></a>

## Choosing a locale

Pass `locale` to select the reading standard:

```ts
convert(dictionary, "垃圾"); // "lājī"
convert(dictionary, "垃圾", { locale: "zh-TW" }); // "lèsè"
```

Both simplified and traditional spellings are dictionary keys. Pinyin conversion
accepts either without a script option:

```ts
convert(dictionary, "银行"); // "yínháng"
convert(dictionary, "銀行"); // "yínháng"
convert(dictionary, "重複"); // "chóngfù"
convert(dictionary, "重覆"); // "chóngfù", the other 繁體 spelling of the same word
```

Lookups use the original characters directly.

<a id="why-繁體-is-a-first-class-key"></a>

## Preserving traditional distinctions

Simplification merged some characters that have different pronunciations.
Keeping traditional keys preserves those distinctions:

```
髮 (fà, hair)  ┐
               ├─→ 发   simplified 发 is a polyphone: fā or fà
發 (fā, send)  ┘

萬 (wàn)  ┐
          ├─→ 万   simplified 万 is a polyphone: wàn or mò
万 (mò)   ┘
```

In the CC-CEDICT single-character entries used here, 806 simplified characters
correspond to multiple traditional characters. The readings differ for 70 of
them.

For these merged characters, traditional input preserves pronunciation
information that simplified input lacks:

> **Traditional Chinese converts more accurately than simplified**, because
> simplification created ambiguity that does not exist in the traditional
> script.

The dictionary keys both scripts to retain this information.

<a id="one-word-more-than-one-繁體-spelling"></a>

## Multiple traditional spellings

A word can have several traditional spellings. 重复 appears as 重複 and 重覆.
下面 and 下麵 have different meanings but the same reading, `xià miàn`.

The dictionary includes each attested spelling as a key. This lets 重覆 use
the word reading `chóng fù` instead of the individual character readings
`zhòng fù`.

```ts
dictionary.lookup("重複")?.reading; // found
dictionary.lookup("重覆")?.reading; // also found, same entry
```

Only spellings attested for the word are added. Combining all character variants
would create incorrect forms such as 方麵 for 方面 and 公裡 for 公里.

<a id="the-locale-delta"></a>

## Taiwan readings

The dictionary stores Taiwan pronunciations only where they differ from the
mainland reading. Both locales share one dictionary.

An entry’s `taiwanReading` contains this alternative:

```ts
const entry = dictionary.lookup("垃圾");
entry?.reading; // lā jī
entry?.taiwanReading; // lè sè
```

`taiwanReading` is absent when the readings agree.

The readings come from CC-CEDICT’s `Taiwan pr.` annotations and Unihan’s dual
`kMandarin` values. Some compound readings are derived from their constituent
words.

<a id="a-delta-is-a-locale-shift"></a>

### Distinguishing a locale change from another sense

A source can list an alternative sense in the same way it lists a Taiwan
pronunciation:

```
地  kMandarin  de dì        地 [de5] /-ly; structural particle/
                            地 [di4] /earth; ground; field/
```

The build rejects a proposed Taiwan reading if the word already has that
reading in 普通话. For example, 地 has a `dì` sense in both locales. It must
not replace the particle `de` under `zh-TW`. Both scripts are
checked when looking for existing senses.

A Taiwan note must also belong to the sense selected for the entry. For
example, 著’s `zhuó` note on its chess-move sense must not change the aspect
particle 着.

<a id="where-the-note-sits-matters"></a>

### Character-level notes

For a single-character entry, the build also checks where the note appears
within the definition:

```
髮 发 [fa4] /hair/Taiwan pr. [fa3]/                    ← its own definition: the entry
和 和 [he2] /(joining two nouns) and; … (Taiwan pr.    ← inside the leading sense
           [han4])/(math.) sum/…
從 从 [cong2] /from; through; via/…/(bound form)       ← inside a later sense
           (Taiwan pr. [zong4]) retainer; attendant/…
```

For example, 從 is `zòng` in bound forms such as 侍從 and 從犯. Its common
uses, including the preposition in 我從北京來, remain `cóng` in Taiwan.

A character entry supplies the fallback reading outside recognised words.
Taiwan notes on later senses are therefore excluded from that fallback.
Compounds keep their own readings, so 肉燥麵 still uses `ròusào miàn`.

This position check applies only to single-character entries. A multi-character
entry is used when its full spelling matches the input.

<a id="a-compound-inherits-its-constituents-delta"></a>

### Compound readings

A compound can inherit a Taiwan reading from a constituent word. For example,
垃圾分類 needs the Taiwan reading of 垃圾 even when decoded as one entry:

```ts
convert(dictionary, "垃圾分類", { locale: "zh-TW" }); // was "lājīfēnlèi"
```

The build derives compound readings when these three conditions hold:

| Condition                                   | What it rules out                                   |
| ------------------------------------------- | --------------------------------------------------- |
| The constituent survives segmentation       | 運行狀況 contains 行狀 but reads 運行 + 狀況        |
| The compound reads it as its own entry does | 渾身解數 is `jiě shù`; the marked 解數 is `xiè shù` |
| The constituent is a word, not a character  | see below                                           |

Single-character readings are excluded from this inference because a character’s
locale difference may apply only to certain senses.

This leaves a known gap. 星期 remains `xīngqī` under `zh-TW`, although the
Taiwan Ministry of Education dictionary gives `xīngqí`. A difference recorded
only on a character does not propagate into compounds.

Some homographs require explicit exclusions in `src/dictionary/locale.ts`.
For example, 相親’s matchmaking reading must not propagate into 相親相愛.

<a id="coverage-is-thinner-in-繁體"></a>

## Traditional dictionary coverage

The phrase corpus contains simplified spellings only. CC-CEDICT supplies paired
simplified and traditional forms for a smaller set of words.

The build derives additional traditional keys using each entry’s reading.
For example, `tóu fà` selects 髮 in 頭髮. When alternative characters share a
reading, pronunciation cannot resolve the spelling. That ambiguity affects
whether a traditional input matches the derived key.

<a id="the-tags-and-the-counts-are-thinner-too-and-all-three-are-carried-across"></a>

### Tags, frequency and names

jieba’s part-of-speech tags, frequency counts and name classifications mainly
come from simplified text. Traditional entries can lack those fields or have
less useful values.

Those fields affect context rules, decoder costs and capitalisation:

```ts
convert(dictionary, "我听过这首歌"); // "wǒ tīngguo zhè shǒu gē"
convert(dictionary, "我聽過這首歌"); // "wǒ tīng guò zhè shǒu gē", before this
convert(dictionary, "我见过他"); // "wǒ jiànguo tā"
convert(dictionary, "我見過他"); // "wǒjiàn guo tā", before this
convert(dictionary, "退休后"); // "tuìxiū hòu"
convert(dictionary, "退休後"); // "tuìxiū Hòu", before this
```

The build transfers missing tags and higher frequency counts from the paired
simplified character. It also copies the proper-noun classification, including
when that removes an incorrect name flag.

Character pairs are selected from aggregate word evidence. This avoids using a
rare variant listed on one character entry when common words consistently use
another form. For example, 時 receives 时’s frequency count even if a source
entry names the old variant 旹.

The effect was measured over 48,959 traditional Tatoeba runs, comparing direct
conversion with conversion through simplified spelling:

| The two scripts             | before | tags   | counts | capitals | and name mass |
| --------------------------- | ------ | ------ | ------ | -------- | ------------- |
| write the same pinyin       | 82.18% | 85.08% | 90.01% | 91.56%   | 91.62%        |
| differ over a word boundary | 14.05% | 10.39% | 6.05%  | 6.05%    | 6.05%         |
| differ over a syllable      | 3.19%  | 3.16%  | 2.32%  | 2.32%    | 2.32%         |
| differ over a capital       | 0.58%  | 1.36%  | 1.62%  | 0.06%    | 0.00%         |

Transferred counts cannot exceed the largest original count. The frequency
buckets for simplified entries remain unchanged. In the measured 88,866-line
corpus, all 3,508 changed conversions were in traditional runs.

Copying a name flag also copies any error in that flag. The
[capitalisation rules](../orthography/#capitals) separately check surname
evidence from the names in jieba’s word list.

## detectScript

`detectScript(text, hansOnly, hantOnly)` is a low-level helper that requires
sets of characters specific to each script. It returns `undefined` when the
text is script-neutral. Treat that result as “either script”.

```ts
const { hansOnly, hantOnly } = await loadScriptTables(source);
detectScript("幾乎所有的工作都完成了。", hansOnly, hantOnly); // "Hant"
detectScript("看著你", hansOnly, hantOnly); // undefined
```

The sets exclude characters used in both scripts. For example, 著 appears in
simplified 专著 and 显著 as well as traditional text. It cannot identify a
script by itself. 干, 台 and 里 are also shared.

The sets are derived from paired dictionary headwords. A character belongs to
a script when it appears in at least ten words or at least one twentieth of
its count in the other script. This admits rare characters while filtering
isolated inconsistent spellings.

Pinyin conversion looks up both scripts directly and does not require
`detectScript`.

<!-- card
```ts
convert(dictionary, "垃圾"); // "lājī"
convert(dictionary, "垃圾", { locale: "zh-TW" }); // "lèsè"
convert(dictionary, "銀行"); // "yínháng"
convert(dictionary, "重複"); // "chóngfù"
```
-->
