# Scripts and locales

Script and locale are two separate axes. Which characters are written and how
they are read vary independently, and collapsing them into a single
"traditional" flag would be wrong.

| Axis   | Values            | What differs                 |
| ------ | ----------------- | ---------------------------- |
| Script | `Hans` / `Hant`   | which characters are written |
| Locale | `zh-CN` / `zh-TW` | how they are read            |

Taiwan writes 繁體 with `zh-TW` readings, but mainland editions of classical
texts use 繁體 with `zh-CN` readings, and Singapore uses 简体. All four
combinations are real.

## In practice

Only the locale is an option to pass:

```ts
convert(dictionary, "垃圾"); // "lājī"
convert(dictionary, "垃圾", { locale: "zh-TW" }); // "lèsè"
```

Script needs no option at all, because both scripts are keys in the same
dictionary:

```ts
convert(dictionary, "银行"); // "yínháng"
convert(dictionary, "銀行"); // "yínháng"
convert(dictionary, "重複"); // "chóngfù"
convert(dictionary, "重覆"); // "chóngfù", the other 繁體 spelling of the same word
```

A lookup happens directly, with no conversion first. There is no "detect the
script, then normalise" step to get wrong.

## Why 繁體 is a first-class key

The obvious implementation is to convert traditional input to simplified and
then look it up. **That destroys information**, because simplification merged
distinct characters:

```
髮 (fà, hair)  ┐
               ├─→ 发   simplified 发 is a polyphone: fā or fà
發 (fā, send)  ┘

萬 (wàn)  ┐
          ├─→ 万   simplified 万 is a polyphone: wàn or mò
万 (mò)   ┘
```

Measured against CC-CEDICT's single-character entries, **806 simplified
characters merge more than one traditional character, and for 70 of them the
readings differ.** Those 70 are unambiguous in traditional and polyphonic in
simplified, and they include some of the most frequent characters in the
language, among them 了, 万, 仇, 卒, 参, 宿, 价, 似, 乘 and 脉.

The consequence is worth stating plainly:

> **Traditional Chinese converts more accurately than simplified**, because
> simplification created ambiguity that does not exist in the traditional
> script.

Anything routing `Hant` through `Hans` throws away the one advantage traditional
input has, and that is why this package keys both.

## One word, more than one 繁體 spelling

A 简体 word can have more than one current 繁體 spelling, and both are the same
word with the same reading. 重复 is written 重複 and 重覆. 下面 is 下面 or 下麵
depending on whether it is a surface or a bowl of noodles, and both read
`xià miàn`.

Storing a single traditional form per entry keys one and silently drops the
other, the same loss this whole design exists to prevent. A spelling the
dictionary lacks is read character by character, which for 重覆 would give
`zhòng fù`, the wrong word, because 重 on its own is `zhòng` and only the entry
says this one is `chóng`. Every attested spelling is keyed instead, which costs
205 extra keys in the full tier.

```ts
dictionary.lookup("重複")?.reading; // found
dictionary.lookup("重覆")?.reading; // also found, same entry
```

Only spellings a source actually writes out _for that word_ are kept. Expanding
every character to its variant set and keying every combination would add
229,482 keys, almost all of them spellings nobody writes, such as 方麵 for 方面
and 公裡 for 公里. The reading disambiguates a character in the word it was read
in, and not everywhere that character appears. 头发 is `tóu fà` so its 发 is 髮,
and 出发 is left untouched.

## The locale delta

Only about 490 items read differently between 普通话 and 國語, so `zh-TW` is
stored as a delta over `zh-CN` instead of a second dictionary. The locale axis
costs almost nothing.

Where an entry has one, it is on the entry:

```ts
const entry = dictionary.lookup("垃圾");
entry?.reading; // lā jī
entry?.taiwanReading; // lè sè
```

`taiwanReading` is absent where the readings agree, the overwhelming majority of
entries.

Two sources feed it. CC-CEDICT's inline `Taiwan pr.` annotations give 335
readings and Unihan's dual `kMandarin` values give 35, with a further 101
composed from a compound's constituents.

### A delta is a locale shift

Both sources write the two the same way and mean different things. CC-CEDICT
hangs `Taiwan pr.` on one _sense_ of a headword, and Unihan's second `kMandarin`
value is as often that headword's second reading as it is a Taiwan one:

```
地  kMandarin  de dì        地 [de5] /-ly; structural particle/
                            地 [di4] /earth; ground; field/
```

Read as a locale shift, that says 國語 turns the adverbial particle into `dì`,
and it does no such thing, with 4,240 entries ending in that particle. The test
that separates the two is whether the offered reading is one the word already
has in 普通话. CC-CEDICT lists 地[di4] itself, so `dì` is a sense. No source
lists 和 as `hàn`, 期 as `qí` or 垃 as `lè`, so those are the real thing. 71
characters and 3 words fail that test, 都, 着, 应, 差, 称, 斗, 舍, 薄 and 万
among them, and the delta is dropped for all of them. The senses of a 繁體
headword are filed under whichever 简体 form each one simplifies to, so that 沈
is `chén` under 沉 and 誰 `shéi` under 谁, and both scripts are searched.

A note is also only read off a sense that matches the reading the entry settled
on. `Taiwan pr. [zhuo2]` sits on 著's chess-move sense, which reads `zhāo`.
Reaching across for it gave the aspect particle 着 a 國語 reading of `zhuó`, and
15 more characters and a word one just as unrelated.

### Where the note sits matters

The sense test above catches a note offering a reading the word has some other
way. It cannot catch one that offers a reading the word only has in a sense it
never carries alone. CC-CEDICT states the difference by where the note sits:

```
髮 发 [fa4] /hair/Taiwan pr. [fa3]/                    ← its own definition: the entry
和 和 [he2] /(joining two nouns) and; … (Taiwan pr.    ← inside the leading sense
           [han4])/(math.) sum/…
從 从 [cong2] /from; through; via/…/(bound form)       ← inside a later sense
           (Taiwan pr. [zong4]) retainer; attendant/…
```

教育部's dictionary agrees with CC-CEDICT about which senses of 從 are `zòng`,
those being 侍從, 從兄弟 and 從犯, all of them bound forms. 跟隨, 依順, 參與 and
the preposition are `cóng` in Taipei exactly as in Beijing. The delta was read
off the whole headword, so `我從北京來` came out as `wǒ zòng Běijīng lái`.

A character's entry is what every occurrence no longer word covers falls back
to. It has to carry the reading that survives out of context, the one the entry
leads with. A note on a later sense is dropped, and that is 14 characters. They
are 從, 會 (`huǐ`, only 一會兒), 勞 (`lào`, only 慰勞), 燥 (`sào`, only 肉燥),
行 (`xìng`, only 品行), and 勝, 匹, 多, 抵, 枕, 比, 玩, 署, 聽. The compounds
themselves keep theirs, so 肉燥麵 is still `ròusào miàn`.

Only a character is tested this way. A multi-character headword is reached only
where that exact word is written, and the four that carry a note inside a sense
are 相親, 載具, 高挑 and 樂色. Only 相親 has senses that differ, its dominant
one being the matchmaking meeting that really is `xiàngqīn`.

### A compound inherits its constituents' delta

A source marks the delta on whichever headword it happened to list. CC-CEDICT
marks 垃圾 and 垃圾桶 and no other compound, and the decoder prefers the longest
word it finds, so 垃圾分類 was decoded whole and 垃圾's delta was never
consulted:

```ts
convert(dictionary, "垃圾分類", { locale: "zh-TW" }); // was "lājīfēnlèi"
```

Patching entries one at a time cannot keep up, since the compounds are
open-class and the marked words are a closed list. The build composes the delta
instead, and 104 compounds get one. Three conditions have to hold, and each
rules out a way the inference goes wrong:

| Condition                                   | What it rules out                                   |
| ------------------------------------------- | --------------------------------------------------- |
| The constituent survives segmentation       | 運行狀況 contains 行狀 but reads 運行 + 狀況        |
| The compound reads it as its own entry does | 渾身解數 is `jiě shù`; the marked 解數 is `xiè shù` |
| The constituent is a word, not a character  | see below                                           |

**Single characters never contribute.** A character's delta reaches every
compound that character appears in, and the ones that survive the test above are
still not all locale-wide. 會 carries `huǐ`, which would turn 三合會 into
`sānhéhuǐ`. Measured on the full dictionary, letting characters contribute
composes 3,743 entries against the 101 that words compose.

The cost of that decision is real and worth stating. 星期 stays `xīngqī` under
`zh-TW` where 教育部's dictionary gives `xīngqí`, and so does every other
compound whose only locale difference is carried by a character. Closing that
needs a per-character judgement the sources do not contain.

What survives all three conditions is a homograph, two words spelled and read
alike in 普通话, of which only one shifts. 相親 is `xiāngqīn` when it means
"mutually close" and `xiàngqīn` in Taiwan when it means a matchmaking meeting,
so 相親相愛 is excluded by name in `src/dictionary/locale.ts`. Three exclusions
against 104 compounds is the measured ratio.

## Coverage is thinner in 繁體

The phrase corpus that supplies the bulk of the word readings is
simplified-only. Every traditional probe (銀行, 長城, 中國, 發現, 頭髮, 重複) is
absent while every simplified equivalent is present. CC-CEDICT is the only
source giving paired readings at scale, at 124,758 entries against 411,958.

The pipeline closes some of that gap by deriving traditional forms for
simplified-only entries, using the stored reading to resolve the ambiguity. 头发
`tóu fà` means its 发 must be 髮, giving 頭髮. For the 70 merge characters whose
readings differ, that is deterministic. For the other 736 the readings are
identical, so a wrong pick cannot change the pronunciation. It only affects
whether a traditional user's text matches that key.

## detectScript

`detectScript(text, hansOnly, hantOnly)` is exported, and it is a low-level
helper that sits outside the conversion path, since you have to supply the
variant sets. It returns `undefined` for script-neutral text, the common case.
Most characters are unchanged by simplification, so a sentence containing none
of the changed ones reads identically either way. Treat `undefined` as "either"
rather than as a failure.

You do not need it to convert. That is the point of keying both scripts.

<!-- card
```ts
convert(dictionary, "垃圾"); // "lājī"
convert(dictionary, "垃圾", { locale: "zh-TW" }); // "lèsè"
convert(dictionary, "銀行"); // "yínháng"
convert(dictionary, "重複"); // "chóngfù"
```
-->
