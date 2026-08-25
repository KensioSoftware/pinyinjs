/**
 * pinyinjs — a toolkit for Chinese hanzi and pinyin.
 *
 * Exports are listed one by one rather than re-exported wholesale, so that the
 * public surface is a deliberate choice rather than whatever happens to be
 * exported internally.
 */

export {
  buildArtifact,
  decodeReading,
  encodeReading,
  findRoundTripFailure,
  readArtifact,
} from "./dictionary/artifact.js";
export type { DictionaryArtifact } from "./dictionary/artifact.js";

export {
  BUILD_ASSERTIONS,
  BuiltDictionary,
  checkBuild,
} from "./dictionary/assertions.js";
export type { BuildAssertion } from "./dictionary/assertions.js";

export { isSameReading, isSameSyllable } from "./dictionary/entry.js";
export type { DictionaryEntry, EntryReadings } from "./dictionary/entry.js";

export {
  attachErhua,
  isErFinal,
  NON_ERHUA_ER_WORDS,
  withErhua,
} from "./dictionary/erhua.js";

export {
  FREQUENCY_BUCKETS,
  FrequencyTable,
} from "./dictionary/frequency-table.js";

export { buildWordCounts, WordCounts } from "./dictionary/word-counts.js";

export { KeyIndex } from "./dictionary/key-index.js";
export type { KeyLookup } from "./dictionary/key-index.js";

export { mergeSources } from "./dictionary/merge.js";
export type {
  MergeResult,
  MergeSources,
  MergeStats,
} from "./dictionary/merge.js";

export {
  OVERRIDE_READINGS,
  READING_OVERRIDES,
  readOverrideReading,
} from "./dictionary/overrides.js";
export type { ReadingOverride } from "./dictionary/overrides.js";

export {
  readAlignedReading,
  readDictionaryReading,
} from "./dictionary/reading.js";
export type { ReadCharacters } from "./dictionary/reading.js";

export { pairScripts, TraditionalTable } from "./dictionary/traditional.js";
export type { ScriptPairing } from "./dictionary/traditional.js";

export { Dictionary } from "./dictionary/dictionary.js";
export type { DictionaryReadings, WordEntry } from "./dictionary/dictionary.js";

export {
  COUNTS_FILE,
  fetchSource,
  loadArtifact,
  loadDictionary,
  loadScriptTables,
  loadWordCounts,
  SCRIPT_FILE,
  tierFiles,
} from "./dictionary/source.js";
export type { DictionarySource } from "./dictionary/source.js";

export {
  convert,
  convertGreedily,
  convertPieces,
  joinPieces,
} from "./decode/convert.js";
export type { ConvertedPiece, ConvertOptions } from "./decode/convert.js";

export { isUncertain, scoreReadings } from "./decode/confidence.js";
export type {
  ReadingAlternative,
  ReadingConfidence,
  ScoredUnit,
} from "./decode/confidence.js";

export {
  decodeReadings,
  decodeRun,
  decodeRunScored,
  decodeSpacing,
} from "./decode/decode.js";

export {
  convertToAnnotatedHtml,
  convertToHtml,
  toAnnotatedHtml,
  toHtml,
} from "./format/html.js";
export {
  convertToWadeGiles,
  toTranscription,
  type TranscriptionOptions,
  type WriteWord,
} from "./format/transcription.js";
export type { HtmlOptions } from "./format/html.js";

export { slug } from "./format/slug.js";
export type {
  SlugOptions,
  SlugSyllables,
  SlugTones,
  SlugUmlaut,
} from "./format/slug.js";

export { decodeGreedily } from "./decode/greedy.js";

export {
  isUncertainChoice,
  SCRIPT_EVIDENCE,
  SCRIPT_TARGETS,
  toScript,
  toScriptPieces,
} from "./decode/script.js";
export type {
  ScriptChoice,
  ScriptConversion,
  ScriptEvidence,
  ScriptOptions,
  ScriptTarget,
} from "./decode/script.js";

export {
  conversionKey,
  convertCharacter,
  convertCharacters,
  formsOf,
  isAmbiguousCharacter,
  readConversionKey,
  readScriptTables,
  writeScriptTables,
} from "./script/conversion.js";
export type { CharacterConversion, ScriptTables } from "./script/conversion.js";

export { buildScriptTables } from "./dictionary/script-tables.js";

export {
  allEdges,
  buildLattice,
  cutPoints,
  READING_CHARGE,
} from "./decode/lattice.js";
export type { Lattice, LatticeEdge } from "./decode/lattice.js";

export {
  isSettled,
  projectReadings,
  settledUnits,
  unitsOf,
} from "./decode/locking.js";
export type { ReadingProjection, ReadingUnit } from "./decode/locking.js";

export {
  applyEdgeRules,
  tagOf,
  wordEndingAt,
  wordStartingAt,
} from "./decode/rules.js";
export type { EdgeContext, EdgeRule, EdgeVerdict } from "./decode/rules.js";

export type {
  PositionalReading,
  ReadingHint,
  ReadingHints,
  WordReading,
} from "./decode/hints.js";

export {
  ADJECTIVAL_CHANG,
  ATTESTED_ERHUA,
  COUNTED_MEASURE,
  EXPERIENTIAL_GUO,
  MODAL_DE,
  PARTICLE_DE,
  PLAYING_TAN,
  POTENTIAL_DE,
  READING_RULES,
  TEACHING_JIAO,
} from "./decode/reading-rules.js";

export { readingCost, shortestPath, spacingCost } from "./decode/viterbi.js";
export type { CostOf } from "./decode/viterbi.js";

export type { DecodedWord, ScoredWord, WordSeparator } from "./decode/word.js";

export { cardinalHanzi, LARGEST_CARDINAL } from "./numerals/cardinal.js";
export type { CardinalOptions } from "./numerals/cardinal.js";

export {
  DIGIT_CHARACTERS,
  numeralSyllable,
  QUANTITY_CHARACTERS,
  UNIT_VALUES,
  yaoSyllable,
} from "./numerals/characters.js";

export {
  fractionHanzi,
  numeralHanzi,
  percentHanzi,
  readNumeral,
  readNumeralHanzi,
} from "./numerals/numerals.js";
export type { NumeralOptions, NumeralStyle } from "./numerals/numerals.js";

export {
  isBopomofo,
  readBopomofo,
  writeBopomofo,
  writeBopomofoWord,
} from "./transcription/bopomofo.js";
export type { BopomofoOptions } from "./transcription/bopomofo.js";

export {
  readWadeGiles,
  readWadeGilesLoosely,
  writeWadeGiles,
  writeWadeGilesSpelling,
  writeWadeGilesWord,
} from "./transcription/wade-giles.js";
export type { WadeGilesOptions } from "./transcription/wade-giles.js";

export {
  readYale,
  writeYale,
  writeYaleSpelling,
  writeYaleWord,
} from "./transcription/yale.js";
export type { YaleOptions } from "./transcription/yale.js";

export {
  readGwoyeu,
  writeGwoyeu,
  writeGwoyeuWord,
} from "./transcription/gwoyeu.js";

export {
  readIpa,
  writeIpa,
  writeIpaSymbols,
  writeIpaWord,
} from "./transcription/ipa.js";
export type { IpaOptions } from "./transcription/ipa.js";

export { segment } from "./decode/segment.js";
export type { Segment } from "./decode/segment.js";

export { match } from "./search/match.js";
export type { MatchRange, PinyinMatch } from "./search/match.js";

export { candidates, homophonesOf } from "./search/candidates.js";
export type {
  CandidateOptions,
  ScriptPreference,
} from "./search/candidates.js";

export { ReverseIndex } from "./search/reverse-index.js";
export type {
  ReverseIndexBuild,
  ReverseIndexData,
} from "./search/reverse-index.js";

export { check } from "./grade/check.js";
export type {
  CheckedSyllable,
  CheckOptions,
  CheckRequirement,
  PinyinCheck,
  PinyinVerdict,
  SpacingVerdict,
} from "./grade/check.js";

export { splitRuns } from "./decode/runs.js";
export type { TextRun } from "./decode/runs.js";

export { applySandhi } from "./decode/sandhi.js";
export type { SandhiGrouping, SandhiOptions } from "./decode/sandhi.js";

export {
  DEFAULT_TIER,
  selectTier,
  STANDARD_TIER_WORDS,
  TIERS,
} from "./dictionary/tiers.js";
export type { Tier } from "./dictionary/tiers.js";

export { joinWord, markWord } from "./orthography/apostrophe.js";
export type { ApostropheStyle } from "./orthography/apostrophe.js";

export {
  capitaliseSentenceParts,
  capitaliseSentences,
  capitaliseWord,
  isSentence,
} from "./orthography/capitals.js";
export type { CapitalStyle } from "./orthography/capitals.js";

export {
  applyGrouping,
  ASPECT_PARTICLES,
  GROUPING_RULES,
  NAME_PARTS,
  PLACE_GENERICS,
  SPACED_WORD_LIST,
  SUFFIXES,
} from "./orthography/grouping.js";

export {
  AABB_REDUPLICATION,
  ABAB_REDUPLICATION,
} from "./orthography/reduplication.js";

export { IDIOM_HYPHENS } from "./orthography/idioms.js";

export {
  HYPHENATED_IDIOM_FORMS,
  HYPHENATED_IDIOMS,
} from "./orthography/idiom-list.js";

export type { GroupingRule } from "./orthography/rule.js";

export {
  LONGEST_SPACED_WORD,
  SPACED_WORD_FORMS,
  SPACED_WORDS,
} from "./orthography/word-list.js";
export type { SpacedWord } from "./orthography/word-list.js";

export { rewriteParts } from "./orthography/parts.js";
export type { RewriteCharacters } from "./orthography/parts.js";

export {
  toLatinPunctuation,
  toLatinPunctuationParts,
} from "./orthography/punctuation.js";
export type { PunctuationStyle } from "./orthography/punctuation.js";

export { isSeparableStart, SEPARABLE_VOWELS } from "./syllable/separation.js";

export {
  detectScript,
  DEFAULT_LOCALE,
  isLocale,
  isScript,
  LOCALES,
  SCRIPTS,
} from "./script/script.js";
export type { Locale, Script } from "./script/script.js";

export {
  DEFAULT_REGION,
  isReadingSensitive,
  REGIONS,
  toCanonicalGlyph,
  toCanonicalGlyphs,
  toRegionalGlyph,
  toRegionalGlyphs,
} from "./script/glyphs.js";
export type { Region } from "./script/glyphs.js";

export {
  ATTESTED_SYLLABLES,
  DICTIONARY_SYLLABLES,
  isAttestedTone,
  RARE_SYLLABLES,
  SYLLABLE_TONES,
} from "./syllable/inventory.js";

export {
  FINALS,
  INITIALS,
  isFinal,
  isInitial,
  isPalatalInitial,
} from "./syllable/phonology.js";
export type { Final, Initial } from "./syllable/phonology.js";

export { readWord, splitSyllables } from "./syllable/split.js";

export {
  isSyllable,
  normaliseUmlaut,
  readSyllable,
  writeSyllable,
  writeSyllableSpelling,
} from "./syllable/syllable.js";
export type { Syllable, ToneNotation } from "./syllable/syllable.js";

export {
  applyToneMark,
  stripToneMarks,
  toneFromMarks,
} from "./tone/tone-mark.js";

export { isTone, NEUTRAL_TONE, toneFromNotation, TONES } from "./tone/tone.js";
export type { Tone } from "./tone/tone.js";
