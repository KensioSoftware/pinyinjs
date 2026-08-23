/**
 * The two 繁體 glyph mappings that a reading decides, and what reads them.
 *
 * Their own module because everything here is about one table of two entries,
 * and `glyphs.ts` is otherwise about the flat pair tables. The split is what
 * those tables cannot carry.
 */
import type { Syllable } from "../syllable/syllable.js";

/**
 * The glyph mappings whose answer depends on how the character is read.
 *
 * A merge one standard makes and the other does not is a difference between
 * them, and {@link import("./glyphs.js").HONG_KONG_FORMS} is that difference
 * read off OpenCC's tables. The reading is what the tables cannot carry,
 * because a merge is not always total: 蔘 is a variant of 參 in its `shēn`
 * sense alone, so inverting Taiwan's 蔘 → 參 into a blanket 參 → 蔘 rewrites
 * 參加, 參考, 參觀 and 參差 as well.
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
 *   著 stays in the Hong Kong table and this names the exception.
 * - **參** is canonical by default and Hong Kong's form at one reading. Of the
 *   four readings CC-CEDICT gives it — `cān`, `cēn`, `shēn`, `sān` — only `shēn`
 *   is the ginseng that 蔘 writes, and 參加 is far the commonest of the rest. So
 *   參 is **not** in the Hong Kong table and this is the whole of its mapping.
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
 * The form a split writes at a reading, or undefined where none applies.
 *
 * A caller with no syllable gets undefined, which is what sends it to the flat
 * table's answer and makes the choice a guess.
 */
export function splitFormAt(
  character: string,
  syllable: Syllable | undefined,
): string | undefined {
  return READING_SPLITS.get(character)?.get(readingKey(syllable) ?? "");
}

/**
 * Every form a split writes for a character, in the order the table lists them.
 */
export function splitFormsOf(character: string): readonly string[] {
  return [...(READING_SPLITS.get(character)?.values() ?? [])];
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
  return splitFormsOf(character).some((form) => form !== character);
}
