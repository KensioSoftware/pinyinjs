# API

Everything the package exports, grouped by what it is for. Exports are listed
one by one in `src/index.ts` rather than re-exported wholesale, so the surface
is a deliberate choice rather than whatever happened to be internal.

Two entry points:

| Import from             | Holds                                                    |
| ----------------------- | -------------------------------------------------------- |
| `@kensio/pinyinjs`      | everything below                                         |
| `@kensio/pinyinjs/node` | `fileSource`, the only thing that touches Node built-ins |

## The short version

| Function                                             | Does                                              |
| ---------------------------------------------------- | ------------------------------------------------- |
| `loadDictionary(source, tier)`                       | load a dictionary from `fileSource`/`fetchSource` |
| `convert(dictionary, text, options?)`                | hanzi → pinyin                                    |
| `convertPieces(dictionary, text, options?)`          | the same, per syllable, with confidence           |
| `convertToHtml(dictionary, text, options?)`          | the same, as HTML                                 |
| `convertToAnnotatedHtml(dictionary, text, options?)` | hanzi and pinyin together, as ruby HTML           |
| `slug(dictionary, text, options?)`                   | hanzi → a URL-safe slug                           |
| `joinPieces(pieces)` / `toHtml(pieces, options?)`    | render pieces                                     |
| `toAnnotatedHtml(pieces, options?)`                  | render pieces, annotated                          |
| `isUncertain(confidence)`                            | was this syllable a guess?                        |
| `dictionary.lookup / hasPrefix / readingsOf / size`  | query the dictionary                              |
| `readSyllable` / `writeSyllable` / `isSyllable`      | one syllable, no dictionary                       |
| `splitSyllables` / `readWord`                        | split written pinyin                              |
| `applySandhi`                                        | 一, 不 and optional third-tone sandhi             |
| `applyToneMark` / `stripToneMarks` / `toneFromMarks` | tone marks                                        |
| `convertGreedily(...)`                               | the old longest-match decoder, kept as a baseline |

If you are reading this to find one thing, it is almost certainly in that
table. The rest of the page is the full surface.

## Converting

See [converting](../converting/), [options](../options/) and
[confidence](../confidence/).

| Export                                                  | Is                                             |
| ------------------------------------------------------- | ---------------------------------------------- |
| `convert`                                               | hanzi → pinyin                                 |
| `convertPieces`                                         | the same, one piece at a time, with confidence |
| `convertGreedily`                                       | the longest-match baseline                     |
| `joinPieces`                                            | pieces → the string `convert` would return     |
| `isUncertain`                                           | was this syllable a guess?                     |
| `scoreReadings`                                         | price every reading a stretch offers           |
| `ConvertOptions`, `ConvertedPiece`                      | types                                          |
| `ReadingConfidence`, `ReadingAlternative`, `ScoredUnit` | types                                          |

The decoder's own parts are exported too, for anyone building on the lattice
rather than on `convert`: `buildLattice`, `allEdges`, `cutPoints`,
`READING_CHARGE`, `decodeReadings`, `decodeRun`, `decodeRunScored`,
`decodeSpacing`, `decodeGreedily`, `shortestPath`, `readingCost`,
`spacingCost`, `projectReadings`, `settledUnits`, `unitsOf`, `isSettled`,
`splitRuns`, with the types `Lattice`, `LatticeEdge`, `ReadingProjection`,
`ReadingUnit`, `DecodedWord`, `ScoredWord`, `TextRun`, `CostOf`.

The rules that run over the lattice are exported with them: `READING_RULES`,
`MODAL_DE`, `TEACHING_JIAO`, `ATTESTED_ERHUA`, `COUNTED_MEASURE`,
`ADJECTIVAL_CHANG`, `applyEdgeRules`, `wordEndingAt`,
`wordStartingAt`, `tagOf`, and the types `EdgeRule`, `EdgeContext`,
`EdgeVerdict`, since `decodeRun` and `decodeRunScored` take their own list and
an application with its own vocabulary may want to add to it, or pass `[]` to
decode with none.

Readings a caller asserts are supplied through `ConvertOptions.readings` rather
than through the rules, since a rule can only keep or drop an edge and a hint is
a reading no source attests. The types are `ReadingHints`, `ReadingHint`,
`WordReading` and `PositionalReading`; see
[readings you assert yourself](../converting/#readings-you-assert-yourself).

## Numbers

See [numbers](../numerals/).

| Export                                                | Is                                  |
| ----------------------------------------------------- | ----------------------------------- |
| `numeralHanzi`                                        | number → 汉字                       |
| `readNumeral`                                         | number → syllables                  |
| `readNumeralHanzi`                                    | written numerals → syllables        |
| `percentHanzi`, `fractionHanzi`                       | 百分之九十五, 四分之三              |
| `cardinalHanzi`                                       | the counting half on its own        |
| `numeralSyllable`, `yaoSyllable`                      | one numeral character's reading     |
| `DIGIT_CHARACTERS`, `UNIT_VALUES`, `LARGEST_CARDINAL` | the tables                          |
| `QUANTITY_CHARACTERS`                                 | the 汉字 a quantity is written with |
| `NumeralOptions`, `NumeralStyle`, `CardinalOptions`   | types                               |

## Romanisation

See [romanisation](../romanization/).

| Export                                               | Is                                       |
| ---------------------------------------------------- | ---------------------------------------- |
| `writeBopomofo`, `writeBopomofoWord`                 | syllable, or word → 注音符號             |
| `readBopomofo`                                       | 注音符號 → syllable                      |
| `isBopomofo`                                         | whether the text is written in it at all |
| `writeWadeGiles`, `writeWadeGilesWord`               | syllable, or word → Wade-Giles           |
| `writeWadeGilesSpelling`                             | the same without the tone                |
| `readWadeGiles`                                      | Wade-Giles → every syllable it can be    |
| `readWadeGilesLoosely`                               | the same, allowing for dropped marks     |
| `splitWadeGiles`, `readWadeGilesWord`                | a word that dropped its hyphens          |
| `writeYale`, `writeYaleWord`, `writeYaleSpelling`    | syllable, word, or the toneless spelling |
| `readYale`                                           | Yale → every syllable it can be          |
| `writeGwoyeu`, `writeGwoyeuWord`, `readGwoyeu`       | Gwoyeu Romatzyh, both directions         |
| `writeIpa`, `writeIpaWord`, `writeIpaSymbols`        | IPA, with or without the tone letters    |
| `readIpa`                                            | IPA → every syllable it can be           |
| `convertToWadeGiles`, `toTranscription`              | hanzi → a system, end to end             |
| `BopomofoOptions`, `WadeGilesOptions`, `YaleOptions` | types                                    |
| `IpaOptions`, `WriteWord`                            | types                                    |

The syllable tables live in `src/transcription/` rather than `src/romanization/`,
since bopomofo has a script of its own and IPA is a transcription rather than a
spelling, so half of them are not romanisations. The docs path keeps the older
name because it is published.

## HTML

See [HTML output](../html/).

| Export                   | Is                             |
| ------------------------ | ------------------------------ |
| `convertToHtml`          | hanzi → marked-up pinyin       |
| `convertToAnnotatedHtml` | hanzi → hanzi with its reading |
| `toAnnotatedHtml`        | render pieces, annotated       |
| `toHtml`                 | render pieces you already have |
| `HtmlOptions`            | type                           |

## Slugs

See [slugs](../slug/).

| Export          | Is                         |
| --------------- | -------------------------- |
| `slug`          | hanzi → a URL-safe slug    |
| `SlugOptions`   | type                       |
| `SlugTones`     | type: `numbers` or `none`  |
| `SlugSyllables` | type: `join` or `separate` |
| `SlugUmlaut`    | type: `v` or `u`           |

## Dictionaries

See [dictionaries](../dictionaries/).

| Export                                                       | Is                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------ |
| `loadDictionary`                                             | build a `Dictionary` from a source and a tier          |
| `loadArtifact`                                               | the artifact without the `Dictionary` around it        |
| `fetchSource`                                                | an HTTP source                                         |
| `fileSource`                                                 | a filesystem source, from `@kensio/pinyinjs/node`      |
| `tierFiles`                                                  | which files a tier needs                               |
| `Dictionary`                                                 | the class: `lookup`, `hasPrefix`, `readingsOf`, `size` |
| `TIERS`, `DEFAULT_TIER`, `STANDARD_TIER_WORDS`, `selectTier` | the tiers                                              |
| `WordEntry`, `DictionarySource`, `Tier`                      | types                                                  |

The build pipeline is exported as well, since the artifacts are reproducible
from the sources: `buildArtifact`, `readArtifact`, `encodeReading`,
`decodeReading`, `findRoundTripFailure`, `mergeSources`, `checkBuild`,
`BUILD_ASSERTIONS`, `BuiltDictionary`, `KeyIndex`, `FrequencyTable`,
`FREQUENCY_BUCKETS`, `TraditionalTable`, `pairScripts`, `attachErhua`,
`withErhua`, `isErFinal`, `NON_ERHUA_ER_WORDS`, `readDictionaryReading`,
`readAlignedReading`, `isSameReading`, `isSameSyllable`, `OVERRIDE_READINGS`,
`READING_OVERRIDES`, `readOverrideReading`, with the types
`DictionaryArtifact`, `DictionaryEntry`, `EntryReadings`, `KeyLookup`,
`BuildAssertion`, `MergeSources`, `MergeResult`, `MergeStats`,
`ReadingOverride` and `ReadCharacters`.

## Syllables

See [syllables](../syllables/).

| Export                                                           | Is                                         |
| ---------------------------------------------------------------- | ------------------------------------------ |
| `readSyllable`                                                   | parse one syllable, either notation        |
| `writeSyllable`                                                  | write one, in any notation                 |
| `writeSyllableSpelling`                                          | the toneless spelling                      |
| `isSyllable`                                                     | is this a well-formed syllable?            |
| `normaliseUmlaut`                                                | `v` and `u:` → `ü`                         |
| `splitSyllables`                                                 | split written pinyin into syllable strings |
| `readWord`                                                       | the same, parsed into `Syllable` objects   |
| `ATTESTED_SYLLABLES`                                             | the 415-syllable standard inventory        |
| `RARE_SYLLABLES`                                                 | the 9 the dictionary adds                  |
| `DICTIONARY_SYLLABLES`                                           | both, as a set                             |
| `SYLLABLE_TONES`                                                 | which tones each syllable is written in    |
| `isAttestedTone`                                                 | is this syllable written in that tone?     |
| `INITIALS`, `FINALS`, `isInitial`, `isFinal`, `isPalatalInitial` | phonology                                  |
| `SEPARABLE_VOWELS`, `isSeparableStart`                           | what triggers an apostrophe                |
| `Syllable`, `Initial`, `Final`, `ToneNotation`                   | types                                      |

## Tones and sandhi

See [sandhi](../sandhi/).

| Export                                    | Is                                    |
| ----------------------------------------- | ------------------------------------- |
| `applySandhi`                             | 一, 不 and optional third-tone sandhi |
| `applyToneMark`                           | write a tone onto a toneless syllable |
| `stripToneMarks`                          | take them off                         |
| `toneFromMarks`                           | read the tone off a marked syllable   |
| `toneFromNotation`                        | read it off a numbered one            |
| `TONES`, `NEUTRAL_TONE`, `isTone`         | the tone values                       |
| `Tone`, `SandhiOptions`, `SandhiGrouping` | types                                 |

## Orthography

See [orthography](../orthography/).

| Export                                                                                                   | Is                               |
| -------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `applyGrouping`                                                                                          | 分词连写 over decoded words      |
| `GROUPING_RULES`, `ASPECT_PARTICLES`, `SUFFIXES`, `PLACE_GENERICS`                                       | the rules                        |
| `ADDRESS_PREFIX`                                                                                         | 老王 is `Lǎo Wáng`               |
| `NAME_PARTS`                                                                                             | 齐白石 is `Qí Báishí`            |
| `AABB_REDUPLICATION`, `ABAB_REDUPLICATION`                                                               | the 重叠 hyphens                 |
| `IDIOM_HYPHENS`, `HYPHENATED_IDIOMS`, `HYPHENATED_IDIOM_FORMS`                                           | the 成语 hyphen and its list     |
| `SPACED_WORD_LIST`, `SPACED_WORDS`, `SPACED_WORD_FORMS`, `LONGEST_SPACED_WORD`                           | the curated list                 |
| `capitaliseSentences`, `capitaliseSentenceParts`, `capitaliseWord`, `isSentence`                         | capitals                         |
| `markWord`, `joinWord`                                                                                   | apostrophes                      |
| `toLatinPunctuation`, `toLatinPunctuationParts`                                                          | punctuation                      |
| `rewriteParts`                                                                                           | the shared part-rewriting helper |
| `GroupingRule`, `SpacedWord`, `CapitalStyle`, `ApostropheStyle`, `PunctuationStyle`, `RewriteCharacters` | types                            |

## Scripts and locales

See [scripts and locales](../scripts-and-locales/).

| Export                                                         | Is                                              |
| -------------------------------------------------------------- | ----------------------------------------------- |
| `detectScript`                                                 | the script a text is in, given the variant sets |
| `SCRIPTS`, `LOCALES`, `isScript`, `isLocale`, `DEFAULT_LOCALE` | the values                                      |
| `toCanonicalGlyph`, `toCanonicalGlyphs`                        | 繁體 glyph forms to the Taiwan standard         |
| `toRegionalGlyph`, `toRegionalGlyphs`                          | the Taiwan standard to a region's forms         |
| `isReadingSensitive`                                           | whether a glyph choice needs the reading        |
| `REGIONS`, `DEFAULT_REGION`                                    | the regional 繁體 orthographies                 |
| `Script`, `Locale`, `Region`, `ScriptPairing`                  | types                                           |

## Script conversion

简体 ↔ 繁體, which is orthography and not translation. See
[scripts and locales](../scripts-and-locales/).

| Export                                               | Is                                         |
| ---------------------------------------------------- | ------------------------------------------ |
| `toScript`                                           | 简体 ↔ 繁體, end to end                    |
| `toScriptPieces`                                     | the same, per character, with evidence     |
| `isUncertainChoice`                                  | was this character a guess?                |
| `loadScriptTables`, `SCRIPT_FILE`                    | fetch the conversion tables                |
| `SCRIPT_TARGETS`, `SCRIPT_EVIDENCE`                  | the values                                 |
| `buildScriptTables`                                  | derive the tables from a merged dictionary |
| `readScriptTables`, `writeScriptTables`              | the artifact, both directions              |
| `convertCharacter`, `convertCharacters`              | conversion without the dictionary          |
| `isAmbiguousCharacter`, `formsOf`                    | what forms a character can take            |
| `conversionKey`, `readConversionKey`                 | how a reading is keyed                     |
| `ScriptTarget`, `ScriptOptions`, `ScriptChoice`      | types                                      |
| `ScriptConversion`, `ScriptEvidence`, `ScriptTables` | types                                      |
| `CharacterConversion`                                | types                                      |

## Stability

**Everything on this page is covered by semantic versioning from 1.0.0.** That
includes the decoder internals and the build pipeline, which were exported
because they are useful and testable rather than because anyone needed them.
Committing to them is the price of having exported them, and the alternative was
to withdraw them at 1.0 for the sake of a smaller promise.

Two things are deliberately outside it, because they are not the API:

- **The readings themselves.** A dictionary rebuild can change what a word
  converts to, which is what a source refresh is for, and every rule this
  package adds is measured in exactly those terms. The figures in
  `docs/orthography/` and the accuracy harnesses are where those changes are
  recorded.
- **The artifact format under `data/`.** It is loaded by `loadDictionary` and
  read by nothing else; `./data/*` is exported so a page can be served the
  files, not so they can be parsed by hand.

`Dictionary` is a class with a private constructor, so `Dictionary.from` and the
loaders are the only ways to build one. New optional fields may appear on
`WordEntry`, as `nameBoundaries` did, which is additive and not a break.

<!-- card
```ts
import {
  convert,
  convertPieces,
  convertToHtml,
  loadDictionary,
  readSyllable,
  writeBopomofo,
} from "@kensio/pinyinjs";
```
-->
