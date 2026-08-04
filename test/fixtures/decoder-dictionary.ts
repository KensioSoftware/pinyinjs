import { buildArtifact } from "../../src/dictionary/artifact.js";
import { Dictionary } from "../../src/dictionary/dictionary.js";
import type { DictionaryEntry } from "../../src/dictionary/entry.js";
import { readSyllable, type Syllable } from "../../src/syllable/syllable.js";
import { NEUTRAL_TONE } from "../../src/tone/tone.js";

/**
 * Read a reading the way the dictionary stores one: fully toned.
 */
export function reading(text: string): readonly Syllable[] {
  return text.split(" ").map((token) => {
    const syllable = readSyllable(token);
    if (syllable === undefined) {
      throw new Error(`not a syllable: ${token}`);
    }
    return { ...syllable, tone: syllable.tone ?? NEUTRAL_TONE };
  });
}

/**
 * A dictionary entry, with the fields these tests care about.
 */
export function entry(
  hans: string,
  cn: string,
  extra: Partial<DictionaryEntry> = {},
): DictionaryEntry {
  return {
    hans,
    hant: hans,
    readings: { cn: reading(cn) },
    frequency: 0,
    partOfSpeech: "",
    isProperNoun: false,
    ...extra,
  };
}

/**
 * A small dictionary built through the real artifact format.
 *
 * Going through {@link buildArtifact} rather than constructing a `Dictionary`
 * directly means these tests exercise the same encoding the committed files
 * use, including the derivable readings that are stored as nothing at all.
 */
export function dictionaryOf(entries: readonly DictionaryEntry[]): Dictionary {
  return Dictionary.from(buildArtifact(entries));
}

/**
 * The dictionary the decoder tests share.
 *
 * Small, but chosen to carry every case the decoder has to handle: a longer
 * word overlapping a shorter one (银行 over 银), a polyphone whose reading
 * depends on the word it is in (行), a proper noun, a 繁體 key, 儿化, a word
 * needing the 隔音符号 (西安) and one that does not strictly need it (海鸥), and
 * 一 and 不 stored with their underlying tones.
 */
export const SAMPLE_ENTRIES: readonly DictionaryEntry[] = [
  entry("银", "yín"),
  entry("行", "xíng", { alternates: [reading("háng"), reading("héng")] }),
  entry("长", "zhǎng", { alternates: [reading("cháng")] }),
  entry("大", "dà"),
  entry("一", "yī"),
  entry("不", "bù"),
  entry("是", "shì"),
  entry("好", "hǎo"),
  entry("个", "gè"),
  entry("天", "tiān"),
  entry("玩", "wán"),
  entry("儿", "ér"),
  entry("北", "běi"),
  entry("京", "jīng"),
  entry("垃", "lā"),
  entry("圾", "jī"),
  entry("西", "xī"),
  entry("安", "ān"),
  entry("海", "hǎi"),
  entry("鸥", "ōu"),
  entry("银行", "yín háng", { hant: "銀行", frequency: 7684 }),
  entry("行长", "háng zhǎng", { hant: "行長", frequency: 419 }),
  entry("长大", "zhǎng dà", { frequency: 1498 }),
  entry("北京", "běi jīng", {
    isProperNoun: true,
    partOfSpeech: "ns",
    frequency: 34_488,
  }),
  entry("玩儿", "wánr", { hant: "玩兒", frequency: 220 }),
  entry("西安", "xī ān", { isProperNoun: true, partOfSpeech: "ns", frequency: 2731 }),
  entry("海鸥", "hǎi ōu", { frequency: 233 }),
  entry("垃圾", "lā jī", {
    readings: { cn: reading("lā jī"), tw: reading("lè sè") },
    frequency: 1165,
  }),
];

/**
 * The shared decoder test dictionary.
 */
export function sampleDictionary(): Dictionary {
  return dictionaryOf(SAMPLE_ENTRIES);
}
