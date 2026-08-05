# Scripts and locales

Script and locale are two axes, not one. Which characters are written and how
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
convert(dictionary, "重覆"); // "chóngfù" — the other 繁體 spelling of the same word
```

Nothing is converted before a lookup. There is no "detect the script, then
normalise" step to get wrong.

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
language: 了, 万, 仇, 卒, 参, 宿, 价, 似, 乘, 脉.

The consequence is worth stating plainly:

> **Traditional Chinese converts more accurately than simplified**, because
> simplification created ambiguity that does not exist in the traditional
> script.

Anything routing `Hant` through `Hans` throws away the one advantage
traditional input has, which is why this package does not.

## One word, more than one 繁體 spelling

A 简体 word can have more than one current 繁體 spelling, and both are the same
word with the same reading. 重复 is written 重複 and 重覆; 下面 is 下面 or 下麵
depending on whether it is a surface or a bowl of noodles, and both read
`xià miàn`.

Storing a single traditional form per entry keys one and silently drops the
other, which is the same loss this whole design exists to prevent. A spelling
that is not a key is read character by character, which for 重覆 would give
`zhòng fù` — the wrong word, because 重 on its own is `zhòng` and only the entry
says this one is `chóng`. Every attested spelling is keyed instead, which costs
205 extra keys in the full tier.

```ts
dictionary.lookup("重複")?.reading; // found
dictionary.lookup("重覆")?.reading; // also found, same entry
```

Only spellings a source actually writes out _for that word_ are kept. Expanding
every character to its variant set and keying every combination would add
229,482 keys, almost all of them spellings nobody writes — 方麵 for 方面, 公裡
for 公里. The reading disambiguates a character in the word it was read in, not
everywhere that character appears: 头发 is `tóu fà` so its 发 is 髮, and that
says nothing about 出发.

## The locale delta

Only about 640 items read differently between 普通话 and 國語, so `zh-TW` is
stored as a delta over `zh-CN` rather than as a second dictionary. The locale
axis costs almost nothing.

Where an entry has one, it is on the entry:

```ts
const entry = dictionary.lookup("垃圾");
entry?.reading; // lā jī
entry?.taiwanReading; // lè sè
```

`taiwanReading` is absent where the readings do not differ, which is the
overwhelming majority of entries.

Sources for the two: CC-CEDICT's inline `Taiwan pr.` annotations give 540 word
readings, and Unihan's dual `kMandarin` values give 101 character readings.

## Coverage is thinner in 繁體

The phrase corpus that supplies the bulk of the word readings is
simplified-only — every traditional probe (銀行, 長城, 中國, 發現, 頭髮, 重複)
is absent while every simplified equivalent is present. CC-CEDICT is the only
source giving paired readings at scale, at 124,758 entries against 411,958.

The pipeline closes some of that gap by deriving traditional forms for
simplified-only entries, using the stored reading to resolve the ambiguity —
头发 `tóu fà` means its 发 must be 髮, giving 頭髮. For the 70 merge characters
whose readings differ, that is deterministic. For the other 736 the readings
are identical, so a wrong pick cannot change the pronunciation; it only affects
whether a traditional user's text matches that key.

## detectScript

`detectScript(text, hansOnly, hantOnly)` is exported, but it is a low-level
helper rather than part of the conversion path — you have to supply the variant
sets. It returns `undefined` for script-neutral text, which is the common case:
most characters are unchanged by simplification, so a sentence containing none
of the changed ones reads identically either way. Treat `undefined` as "either",
not as a failure.

You do not need it to convert. That is the point of keying both scripts.

<!-- card
```ts
convert(dictionary, "垃圾"); // "lājī"
convert(dictionary, "垃圾", { locale: "zh-TW" }); // "lèsè"
convert(dictionary, "銀行"); // "yínháng"
convert(dictionary, "重複"); // "chóngfù"
```
-->
