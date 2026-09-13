# API

This page lists the public exports by topic. `src/index.ts` defines the package
API.

The package has two JavaScript entry points:

| Import from             | Holds                                                    |
| ----------------------- | -------------------------------------------------------- |
| `@kensio/pinyinjs`      | everything below                                         |
| `@kensio/pinyinjs/node` | `fileSource`, the only thing that touches Node built-ins |

<a id="the-short-version"></a>

## Common functions

| Function                                             | Does                                              |
| ---------------------------------------------------- | ------------------------------------------------- |
| `loadDictionary(source, tier)`                       | load a dictionary from `fileSource`/`fetchSource` |
| `convert(dictionary, text, options?)`                | hanzi → pinyin                                    |
| `convertPieces(dictionary, text, options?)`          | the same, per syllable, with confidence           |
| `convertToHtml(dictionary, text, options?)`          | the same, as HTML                                 |
| `convertToAnnotatedHtml(dictionary, text, options?)` | hanzi and pinyin together, as ruby HTML           |
| `segment(dictionary, text)`                          | split text into words                             |
| `match(dictionary, haystack, query)`                 | where a pinyin query matches a text               |
| `candidates(index, query, options?)`                 | pinyin → the hanzi it could be                    |
| `homophonesOf(index, word, options?)`                | the words read exactly like this one              |
| `ReverseIndex.of(dictionary)`                        | derive the reading → words index                  |
| `check(dictionary, text, typed, options?)`           | mark typed pinyin against the text                |
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

The sections below list the remaining exports and link to their guides.

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

For direct access to the decoder, use `buildLattice`, `allEdges`, `cutPoints`,
`READING_CHARGE`, `decodeReadings`, `decodeRun`, `decodeRunScored`,
`decodeSpacing`, `decodeGreedily`, `shortestPath`, `readingCost`,
`spacingCost`, `projectReadings`, `settledUnits`, `unitsOf`, `isSettled`,
`splitRuns`, and the types `Lattice`, `LatticeEdge`, `ReadingProjection`,
`ReadingUnit`, `DecodedWord`, `ScoredWord`, `TextRun`, `CostOf`.

The reading rules are `READING_RULES`, `MODAL_DE`, `PARTICLE_DE`,
`POTENTIAL_DE`, `TAXI_DI`, `TEACHING_JIAO`, `ATTESTED_ERHUA`, `COUNTED_MEASURE`,
`ADJECTIVAL_CHANG`, `PLAYING_TAN`, `EXPERIENTIAL_GUO` and `SEPARATED_COMPOUND`.
`decodeRun` and `decodeRunScored` accept a custom rule list, including `[]` to
disable rules. Rule helpers include `applyEdgeRules`, `wordEndingAt`,
`wordsEndingAt`, `wordStartingAt`, `wordsStartingAt` and `tagOf`, with the types
`EdgeRule`, `EdgeContext` and `EdgeVerdict`.

Use `ConvertOptions.readings` to supply a pronunciation directly. Reading rules
can keep or drop existing edges. Reading hints can also supply new readings.
The types are `ReadingHints`, `ReadingHint`, `WordReading` and
`PositionalReading`. See
[custom readings](../converting/#readings-you-assert-yourself).

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
| `BOPOMOFO`, `WADE_GILES`, `YALE`, `GWOYEU`, `IPA`    | one system, as a table entry             |
| `TRANSCRIPTION_SYSTEMS`, `transcriptionSystemNamed`  | all five, and one by name                |
| `BopomofoOptions`, `WadeGilesOptions`, `YaleOptions` | types                                    |
| `IpaOptions`, `WriteWord`                            | types                                    |
| `TranscriptionSystem`, `TranscriptionSystemName`     | types                                    |

The transcription tables are in `src/transcription/`.

## HTML

See [HTML output](../html/).

| Export                   | Is                             |
| ------------------------ | ------------------------------ |
| `convertToHtml`          | hanzi → marked-up pinyin       |
| `convertToAnnotatedHtml` | hanzi → hanzi with its reading |
| `toAnnotatedHtml`        | render pieces, annotated       |
| `toHtml`                 | render pieces you already have |
| `HtmlOptions`            | type                           |

## Segmentation

See [segmenting](../segmenting/).

| Export    | Is                                                |
| --------- | ------------------------------------------------- |
| `segment` | text → the words in it                            |
| `Segment` | type: one word, or one stretch that was never Han |

## Matching

See [matching](../matching/).

| Export        | Is                                                |
| ------------- | ------------------------------------------------- |
| `match`       | where a pinyin query matches a text, and how well |
| `PinyinMatch` | type: the ranges a query matched, and its score   |
| `MatchRange`  | type: one stretch, in code points from the start  |

## Candidates

See [candidates](../candidates/).

| Export              | Is                                                                               |
| ------------------- | -------------------------------------------------------------------------------- |
| `candidates`        | a pinyin query → the hanzi it could be, likeliest first                          |
| `homophonesOf`      | the words read exactly as this one is                                            |
| `ReverseIndex`      | the reading → words index: `of`, `building`, `from`, `positionsFor`, `serialise` |
| `readingKey`        | a stored reading → the key the index holds it under                              |
| `foldReading`       | pinyin written any way at all → that same key                                    |
| `CandidateOptions`  | type: `limit` and `script`                                                       |
| `ScriptPreference`  | type: which script to keep, and the tables that can tell                         |
| `ReverseIndexBuild` | type: a build being driven a slice at a time                                     |
| `ReverseIndexData`  | type: the pieces, for posting between threads                                    |

`ReverseIndex` is built from a loaded `Dictionary` without another download.
It uses `Dictionary.wordAt`, `Dictionary.frequencyAt` and
`Dictionary.readingsInOrder`.

## Checking typed pinyin

See [checking](../checking/).

| Export             | Is                                                               |
| ------------------ | ---------------------------------------------------------------- |
| `check`            | mark a typed transcription against the text it was written for   |
| `PinyinCheck`      | type: the verdicts, the score, and the reading expected          |
| `CheckedSyllable`  | type: one syllable's verdict, and the characters it reads        |
| `PinyinVerdict`    | type: `correct`, `toneless`, `tone`, `wrong`, `missing`, `extra` |
| `SpacingVerdict`   | type: `correct`, `split` or `joined`                             |
| `CheckOptions`     | type: every `ConvertOptions` field, plus `tones` and `spacing`   |
| `CheckRequirement` | type: `optional` or `required`                                   |

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

| Export                                                        | Is                                                                    |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `loadDictionary`                                              | build a `Dictionary` from a source and a tier                         |
| `loadArtifact`                                                | the artifact without the `Dictionary` around it                       |
| `fetchSource`                                                 | an HTTP source                                                        |
| `fileSource`                                                  | a filesystem source, from `@kensio/pinyinjs/node`                     |
| `tierFiles`                                                   | which files a tier needs                                              |
| `Dictionary`                                                  | the class: `lookup`, `frequencyOf`, `hasPrefix`, `readingsOf`, `size` |
| `dictionary.wordAt / frequencyAt / readingsInOrder`           | the same by position, for a second index over it                      |
| `loadWordCounts`, `WordCounts`, `COUNTS_FILE`                 | raw corpus counts for `full`, for ranking words                       |
| `TIERS`, `DEFAULT_TIER`, `STANDARD_TIER_WORDS`, `selectTier`  | the tiers                                                             |
| `WordEntry`, `DictionaryReadings`, `DictionarySource`, `Tier` | types                                                                 |

The dictionary build API includes `buildArtifact`, `readArtifact`,
`encodeReading`, `decodeReading`, `findRoundTripFailure`, `mergeSources`,
`checkBuild`, `BUILD_ASSERTIONS`, `BuiltDictionary`, `KeyIndex`,
`FrequencyTable`, `FREQUENCY_BUCKETS`, `buildWordCounts`, `TraditionalTable`,
`pairScripts`, `attachErhua`, `withErhua`, `isErFinal`, `NON_ERHUA_ER_WORDS`,
`readDictionaryReading`, `readAlignedReading`, `isSameReading`, `isSameSyllable`,
`OVERRIDE_READINGS`, `READING_OVERRIDES` and `readOverrideReading`. The types
are `DictionaryArtifact`, `DictionaryEntry`, `EntryReadings`, `KeyLookup`,
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

See [script conversion](../script-conversion/) for converting between
simplified and traditional characters.

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

The public API follows semantic versioning, including the exported decoder and
dictionary-build functions.

Two kinds of change can occur without a major release:

- Dictionary updates and reading rules can change the pronunciation or word
  boundaries returned for a text. The accuracy harnesses measure these changes.
- The dictionary artifact format can change. Use `loadDictionary` to read it.
  The `./data/*` exports allow applications to serve the files, but direct
  parsing of their contents is unsupported.

`Dictionary` has a private constructor. Create instances with `Dictionary.from`
or a loader. Minor releases may add optional `WordEntry` fields.

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
