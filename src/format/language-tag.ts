/**
 * What a written reading declares itself to be, in BCP 47.
 *
 * One place that knows the subtags and the order they go in, since the tag is
 * the same question whether the reading is pinyin or one of the five systems
 * that can stand in for it.
 */
import { DEFAULT_LOCALE, type Locale } from "../script/script.js";
import type { TranscriptionSystem } from "../transcription/systems.js";

/**
 * The pinyin variant's script and its own subtag, which a conversion writes by
 * default.
 */
const PINYIN_SCRIPT = "Latn";
const PINYIN_VARIANT = "pinyin";

/**
 * The BCP 47 region subtag for a reading standard.
 */
export function regionOf(locale: Locale): string {
  switch (locale) {
    case "zh-CN": {
      return "CN";
    }
    case "zh-TW": {
      return "TW";
    }
  }
}

/**
 * What a syllable declares itself to be, in the system it was written in.
 *
 * A syllable element holds Mandarin written in some script that is not the `zh`
 * of the surrounding page and not the `en` of a page that quotes it, and
 * nothing about `yín` on its own says so. The tag is what a screen reader
 * consults before deciding how to pronounce it, and what a browser consults for
 * hyphenation and font selection. Without one, `xíng` is read as whatever the
 * page around it claims to be, which is how pinyin ends up spoken as English.
 *
 * The subtags are registered and mean exactly this. The script is `Latn` for a
 * romanisation and `Bopo` for bopomofo, the region is the reading standard, and
 * the variant names the system where the IANA registry has one. It has `pinyin`
 * and `wadegile`, both with the prefix `zh-Latn`, and `fonipa` for the IPA.
 *
 * | System | `zh-CN` | `zh-TW` |
 * | --- | --- | --- |
 * | pinyin | `zh-Latn-CN-pinyin` | `zh-Latn-TW-pinyin` |
 * | bopomofo | `zh-Bopo-CN` | `zh-Bopo-TW` |
 * | Wade-Giles | `zh-Latn-CN-wadegile` | `zh-Latn-TW-wadegile` |
 * | Yale | `zh-Latn-CN` | `zh-Latn-TW` |
 * | Gwoyeu Romatzyh | `zh-Latn-CN` | `zh-Latn-TW` |
 * | IPA | `zh-Latn-CN-fonipa` | `zh-Latn-TW-fonipa` |
 *
 * **The region is carried by every one of them**, because the distinction it
 * marks is in the reading rather than in the spelling. 垃圾 is `lājī` under
 * `zh-CN` and `lèsè` under `zh-TW`, and it is two different words in bopomofo
 * for the same reason, so the region is read off {@link ConvertOptions.locale}
 * rather than guessed at.
 *
 * Yale and Gwoyeu Romatzyh name themselves nowhere, the registry having no
 * variant for either, so both go out saying only that they are Mandarin in the
 * Latin alphabet. See {@link TranscriptionSystem.variant}.
 *
 * Tone notation does not enter into it. `hang2` is pinyin spelt with a tone
 * number, not another romanisation, so it takes the same tag as `háng`.
 *
 * The cost is the tag repeated on every syllable, which is the price of
 * wrapping nothing around the whole conversion. A caller who would rather
 * declare it once can set `lang: false` and put the same tag on a wrapper of
 * their own, which is inherited by everything inside it.
 */
export function languageTag(
  locale: Locale = DEFAULT_LOCALE,
  system?: TranscriptionSystem,
): string {
  const script = system?.script ?? PINYIN_SCRIPT;
  const variant = system === undefined ? PINYIN_VARIANT : system.variant;
  const tag = `zh-${script}-${regionOf(locale)}`;
  return variant === undefined ? tag : `${tag}-${variant}`;
}
