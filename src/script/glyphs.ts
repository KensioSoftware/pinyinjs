import type { Syllable } from "../syllable/syllable.js";
import { toCharacters } from "./characters.js";

/**
 * The regional 繁體 orthographies this package writes.
 *
 * A third axis, independent of the script and locale axes in `script.ts`:
 * Taiwan and Hong Kong write the same characters with the same readings, and
 * disagree about the standard form of 58 of them. See SCRIPTS-AND-LOCALES.md.
 */
export const REGIONS = ["TW", "HK"] as const;

/**
 * A regional 繁體 orthography: `TW` for 教育部標準字體 or `HK` for 常用字字形表.
 *
 * Only meaningful under `Hant`. Singapore and Malaysia differ from the PRC
 * lexically rather than orthographically, so there is no second 简体 standard.
 */
export type Region = (typeof REGIONS)[number];

/**
 * The 繁體 orthography written when the caller does not name one.
 *
 * There is no region-free 繁體 to fall back on: converting character by
 * character from OpenCC's baseline yields 爲, 衆, 峯, 羣, 裏, 麪, which are the
 * Hong Kong forms. Declining to choose would mean choosing Hong Kong silently,
 * so a region is always applied and always named.
 *
 * Taiwan wins it on population, and more to the point because it is the one
 * polity where 繁體 orthography and Mandarin as the spoken standard coincide —
 * which is the intersection a pinyin package serves.
 */
export const DEFAULT_REGION = "TW" satisfies Region;

/**
 * Read a table written as a flat run of `from`/`to` character pairs.
 *
 * Pairs rather than a `Record` so that the tables stay legible as data and cost
 * one string each: these are code rather than an artifact to fetch, for the
 * same reason the transcription tables are — 133 mappings do not justify a
 * download, and they must be available before any dictionary has loaded.
 */
function readPairs(pairs: string): ReadonlyMap<string, string> {
  const characters = toCharacters(pairs);
  const table = new Map<string, string>();
  for (let at = 0; at + 1 < characters.length; at += 2) {
    /* c8 ignore next 2 -- both indices are in range while at + 1 < length */
    table.set(characters[at] ?? "", characters[at + 1] ?? "");
  }
  return table;
}

/**
 * Variant 繁體 forms, mapped to the canonical form this package stores.
 *
 * The canonical form is Taiwan's, because that is what the dictionary's 繁體
 * keys already are: measured on CC-CEDICT's traditional column, 裡 outnumbers
 * 裏 116 to 8, 群 outnumbers 羣 175 to 1 and 麵 outnumbers 麪 138 to 1. So
 * normalisation means mapping toward `TW`, and only Hong Kong output needs a
 * pass away from what is stored.
 *
 * This is what lets Hong Kong text find dictionary keys. 羣眾 and 麪包 are not
 * keys and never will be, so they would otherwise fall back to converting
 * character by character — the same loss 臺灣 had before `hantVariants`.
 * Measured: of the 9,833 dictionary keys with a distinct Hong Kong spelling,
 * 2,358 are already keys and normalisation reaches a further 5,439. The 2,036
 * still out of reach are mostly 臺 written as 台, which the exclusions below
 * deliberately decline to reverse.
 *
 * Nineteen mappings OpenCC makes are deliberately **excluded**, because the
 * variant is itself current in the corpus the dictionary is built from and
 * rewriting it would corrupt legitimate text. Two different reasons, and the
 * second is the one that is easy to miss:
 *
 * 1. The variant is a live 繁體 spelling. 台 is the clearest — OpenCC maps it to
 *    臺, but CC-CEDICT writes 台 164 times against 臺's 208, so it is a spelling
 *    someone chose rather than a Hong Kong-ism. Also 污, 濕, 睾, 祕, 泄.
 * 2. **The variant is a current 简体 character.** Many Hong Kong standard forms
 *    are exactly the mainland simplified form, because the PRC simplification
 *    adopted the same 新字形 conventions Hong Kong did: 着, 温, 脱, 户, 税, 卧,
 *    悦, 兑, 葱, 幺, 棱, 檐, 痹. Normalising those would rewrite 简体 text, and
 *    走着 `zǒuzhe` is the case that caught it.
 *
 * Excluding them costs almost nothing, because a variant current in either
 * script is a key in its own right and resolves without any help from here.
 * Reversing a merge is ambiguous in exactly the way 简→繁 is, and where the
 * evidence says the variant is current, the safe answer is to leave it alone.
 */
const CANONICAL_PAIRS =
  "僞偽衹只啓啟喫吃粧妝嫺嫻嬀媯峯峰捝挩敍敘枴柺棁梲" +
  "樑梁枱檯涚涗潙溈潨潀爲為牀床癡痴皁皂竈灶糉粽糭粽" +
  "綫線緼縕繮韁纔才羣群脣唇蒀蒕蔘參蔿蒍藴蘊衆眾衞衛" +
  "裏裡覈核説說輼轀醖醞鉢缽鈎鉤鋭銳鍼針閲閱鮎鯰鰛鰮" +
  "麪麵齶顎";

/**
 * Canonical 繁體 forms, mapped to the form Hong Kong writes.
 *
 * The 58 characters the two standards genuinely disagree about, measured over
 * the 86 that appear in either of OpenCC's variant tables. The other 28 are
 * agreements rather than differences — 爲 → 為 and 衆 → 眾 are both moves *both*
 * standards make, which is easy to get backwards by reading either table alone.
 *
 * Taiwan needs no table of its own: the canonical form is already Taiwan's, so
 * `zh-Hant-TW` output is what the dictionary stores, unaltered.
 */
const HONG_KONG_PAIRS =
  "兌兑叄叁啟啓囪囱媼媪嫻嫺峰峯么幺悅悦慍愠戶户挩捝" +
  "搵揾敓敚敘敍柺枴梲棁榲榅梁樑簷檐檯枱氳氲汙污洩泄" +
  "涗涚溫温溼濕熅煴床牀痺痹著着睪睾稅税縕緼韁繮群羣" +
  "脫脱膃腽臥卧臺台菸煙蒕蒀蔥葱蘊藴蛻蜕衛衞裡裏" +
  "說説轀輼醞醖鉤鈎銳鋭閱閲鯰鮎鰮鰛麵麪顎齶";

/**
 * Variant 繁體 forms mapped to the canonical form, as a table.
 *
 * Exported so the data pipeline can recompute it from OpenCC and fail the build
 * if the two have drifted — these tables are code rather than an artifact, so
 * nothing else would notice an upstream release that moved a character.
 */
export const CANONICAL_FORMS = readPairs(CANONICAL_PAIRS);

/**
 * Canonical 繁體 forms mapped to Hong Kong's, as a table. Verified like
 * {@link CANONICAL_FORMS}.
 */
export const HONG_KONG_FORMS = readPairs(HONG_KONG_PAIRS);

/**
 * The glyph mappings whose answer depends on how the character is read.
 *
 * A merge one standard makes and the other does not is a difference between
 * them, and {@link HONG_KONG_FORMS} is that difference read off OpenCC's tables.
 * The reading is what the tables cannot carry, because a merge is not always
 * total: 蔘 is a variant of 參 in its `shēn` sense alone, so inverting Taiwan's
 * 蔘 → 參 into a blanket 參 → 蔘 rewrites 參加, 參考, 參觀 and 參差 as well.
 *
 * OpenCC resolves this with a phrase table. We resolve it with the reading,
 * which is the point of difference this feature exists for, and which
 * generalises to words no phrase table lists.
 *
 * A reading names the form written at that reading, and the two entries here
 * point opposite ways, which is what {@link isReadingScoped} is for:
 *
 * - **著** is Hong Kong's form by default and canonical at one reading. Taiwan
 *   writes 著 for every sense; Hong Kong splits it, writing 着 for the aspect
 *   particle and its relatives and keeping 著 for `zhù`. CC-CEDICT records the
 *   same split in its 简体 column — `著 着 [zhe5]` against `著 著 [zhu4]` — which
 *   is independent confirmation that the divide is real and where it falls. So
 *   著 stays in {@link HONG_KONG_FORMS} and this names the exception.
 * - **參** is canonical by default and Hong Kong's form at one reading. Of the
 *   four readings CC-CEDICT gives it — `cān`, `cēn`, `shēn`, `sān` — only `shēn`
 *   is the ginseng that 蔘 writes, and 參加 is far the commonest of the rest. So
 *   參 is **not** in {@link HONG_KONG_FORMS} and this is the whole of its
 *   mapping.
 *
 * 著's `zhuó` is deliberately absent, and that is not an oversight: CC-CEDICT
 * writes it both ways — `著 着 [zhuo2]` for wearing or applying, `著 著 [zhuo2]`
 * for 執著 — so the reading genuinely does not settle it. It falls through to
 * the default and is reported as uncertain rather than guessed at silently.
 *
 * **Two is the whole list**, and that is measured rather than assumed. Of the
 * 58 mappings, 39 are stated by Hong Kong's own table and 19 are Taiwan merges
 * read backwards, which is the only direction a partial merge can arrive from.
 * Of those 19, 著 and 參 are the only two whose Hong Kong form covers fewer
 * CC-CEDICT readings than the canonical: 著 has five against 着's four, 參 has
 * four against 蔘's one, and the other 17 cover the same readings or more.
 */
const READING_SPLITS: ReadonlyMap<
  string,
  ReadonlyMap<string, string>
> = new Map([
  ["著", new Map([["zhu", "著"]])],
  ["參", new Map([["shen", "蔘"]])],
]);

/**
 * A reading key ignoring tone and 儿化, which never bear on a glyph choice.
 *
 * Tone is dropped because the split that needs it — 著 — divides `zhù` from
 * `zhe` and `zháo`, and those differ in their vowels as well, so the initial
 * and final are enough and are what sources agree on most.
 */
function readingKey(syllable: Syllable | undefined): string | undefined {
  if (syllable === undefined) {
    return undefined;
  }
  return `${syllable.initial}${syllable.final}`;
}

/**
 * Whether a character's regional form depends on how it is read.
 *
 * Exposed so that a conversion can report the choice as uncertain when it had
 * no reading to go on, rather than presenting a default as though it were
 * settled.
 */
export function isReadingSensitive(character: string): boolean {
  return READING_SPLITS.has(character);
}

/**
 * Whether a character's Hong Kong form applies at one reading rather than all.
 *
 * The two shapes {@link READING_SPLITS} holds, told apart by what the split
 * writes. A split naming the character itself is an exception to a mapping that
 * otherwise holds, so the flat table keeps it — 著 is 着 in Hong Kong except at
 * `zhù`. A split naming some other form is the whole of the mapping, so the
 * flat table must not carry it, or every reading would take the regional form.
 *
 * Read by the derivation in `scripts/build-data/glyph-tables.ts`, which would
 * otherwise fail the build for a mapping OpenCC makes and this file declines.
 */
export function isReadingScoped(character: string): boolean {
  const split = READING_SPLITS.get(character);
  if (split === undefined) {
    return false;
  }
  return [...split.values()].some((form) => form !== character);
}

/**
 * Normalise one 繁體 character to the canonical form the dictionary stores.
 *
 * Characters no table knows are returned unchanged, which is the right answer
 * for nearly all of them: the two standards agree about everything except the
 * 58 characters {@link HONG_KONG_FORMS} lists.
 */
export function toCanonicalGlyph(character: string): string {
  return CANONICAL_FORMS.get(character) ?? character;
}

/**
 * Whether any character of a text has a canonical form other than itself.
 */
function hasVariantGlyph(text: string): boolean {
  for (const character of text) {
    if (CANONICAL_FORMS.has(character)) {
      return true;
    }
  }
  return false;
}

/**
 * Normalise a whole 繁體 text to the canonical forms the dictionary stores.
 *
 * Safe to run over 简体 or mixed text, but only because the table is built to
 * make it so: every variant that is also a current 简体 character is excluded,
 * since many Hong Kong forms and mainland simplified forms are the same
 * character. See {@link CANONICAL_FORMS}.
 *
 * Returns the original string when nothing needs normalising, which is nearly
 * always. This sits on the dictionary lookup path, where it is called once per
 * candidate word at every position of a run, so the common case has to cost a
 * scan rather than an allocation.
 *
 * The mapping is one character to one character, which is what makes it safe
 * here: normalising a prefix gives the same answer as taking the prefix of the
 * normalised text, so a lattice scan that prunes on prefixes cannot disagree
 * with the lookup that follows it.
 */
export function toCanonicalGlyphs(text: string): string {
  if (!hasVariantGlyph(text)) {
    return text;
  }
  let normalised = "";
  for (const character of toCharacters(text)) {
    normalised += toCanonicalGlyph(character);
  }
  return normalised;
}

/**
 * Write one canonical character in a region's orthography.
 *
 * The syllable is used only where the character is one the two standards split
 * on a reading; everywhere else it is ignored, because a glyph choice never
 * changes how a character is read.
 */
export function toRegionalGlyph(
  character: string,
  region: Region,
  syllable?: Syllable,
): string {
  if (region === DEFAULT_REGION) {
    return character;
  }
  const split = READING_SPLITS.get(character);
  const kept = split?.get(readingKey(syllable) ?? "");
  if (kept !== undefined) {
    return kept;
  }
  return HONG_KONG_FORMS.get(character) ?? character;
}

/**
 * Write a whole canonical text in a region's orthography.
 *
 * Readings are matched to characters by position, so a caller with a decoded
 * reading can pass it and a caller without one can leave it out. A position
 * with no syllable behind it falls back to the region's default form, which is
 * what {@link isReadingSensitive} lets the caller flag.
 */
export function toRegionalGlyphs(
  text: string,
  region: Region,
  readings: readonly (Syllable | undefined)[] = [],
): string {
  if (region === DEFAULT_REGION) {
    return text;
  }
  let written = "";
  for (const [at, character] of toCharacters(text).entries()) {
    written += toRegionalGlyph(character, region, readings[at]);
  }
  return written;
}
