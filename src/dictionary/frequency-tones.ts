/**
 * Repairing the tones Unihan's `kHanyuPinlu` frequency field misreports.
 *
 * The field counts occurrences in running text, and that gives it two blind
 * spots about the neutral tone: it drops tone marks it should carry, and it
 * counts a syllable reduced inside a word as though the bare character read
 * that way. Both are corrected here, before a character's default is settled.
 */
import type { CedictEntry } from "../sources/cedict.js";
import { FREQUENCY_FIELD, type UnihanReadings } from "../sources/unihan.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import { readDictionaryReading } from "./reading.js";

/**
 * Strip the tone marks from a reading, for comparing two spellings.
 */
function tonelessReading(reading: string): string {
  return reading
    .normalize("NFD")
    .replaceAll(/[̀́̄̌]/gu, "")
    .normalize("NFC");
}

/**
 * Whether a reading carries a tone mark.
 */
function isToneMarked(reading: string): boolean {
  return tonelessReading(reading) !== reading;
}

/**
 * Put back a tone that `kHanyuPinlu` left off.
 *
 * The frequency field writes some readings without their tone mark: 李 is
 * `li(36)` there where every dictionary field writes `lǐ`. Read as 轻声 — which
 * is what an unmarked reading means in source data — that makes 李华 come out
 * `Li Huá`, and it is the only Unihan field this happens in.
 *
 * The other fields settle which it is. If they also write the spelling bare,
 * the neutral tone is real and 么, 们, 吧, 裳 keep it. If every one of them
 * writes it with a tone, the frequency field simply omitted the mark, and the
 * tone is taken back. Measured over the real file, 3,799 characters have a
 * `kHanyuPinlu` entry, 60 of those have only unmarked readings, and the split
 * is 45 that should carry a tone against 15 genuine 轻声.
 */
export function resolveFrequencyTones(
  unihan: UnihanReadings,
): readonly string[] {
  const frequencyReadings = unihan.fields.get(FREQUENCY_FIELD) ?? [];
  // A character whose frequency field marks any tone is already trustworthy:
  // there the unmarked readings sit alongside marked ones and mean 轻声.
  if (
    frequencyReadings.length === 0 ||
    frequencyReadings.some((reading) => isToneMarked(reading))
  ) {
    return unihan.readings;
  }

  const elsewhere = [...unihan.fields]
    .filter(([field]) => field !== FREQUENCY_FIELD)
    .flatMap(([, readings]) => readings);

  return unihan.readings.map((reading) => {
    if (isToneMarked(reading)) {
      return reading;
    }
    const sameSpelling = elsewhere.filter(
      (other) => tonelessReading(other) === reading,
    );
    if (sameSpelling.length === 0 || sameSpelling.includes(reading)) {
      return reading;
    }
    return sameSpelling.find((other) => isToneMarked(other)) ?? reading;
  });
}

/**
 * A CC-CEDICT sense that describes a suffix rather than a word.
 *
 * Matches its own wording: 子 is `/noun suffix, as in 椅子[yi3 zi5] "chair"/`,
 * and the other suffix senses are written the same way.
 */
const SUFFIX_SENSE = /\bsuffix\b/iu;

/**
 * Whether CC-CEDICT reads the bare character 轻声 in its own right.
 *
 * The exception to {@link demoteReducedNeutrals}, and the thing that separates
 * a 语气词 from a syllable that is only ever unstressed inside a word. A
 * single-character CC-CEDICT headword with a neutral reading is a claim about
 * the character standing alone, which is exactly what the frequency field's
 * counting cannot distinguish: 吗 is `(question particle for "yes-no"
 * questions)`, 啊 is `modal particle ending sentence`, 得 is `structural
 * particle: used after a verb`. Nine characters carry one — 得, 啊, 吗, 呀, 啦,
 * 哇, 嘛, 罢 and 子 — and their 繁體 spellings with them.
 *
 * **A suffix sense is not such a claim.** 子's neutral headword is `noun
 * suffix, as in 椅子`, which says the character is unstressed *in words*, and
 * words are what the corpus can already see. 子 is `zǐ` on its own — 子曰, 母子
 * — and CPP's human labelling has it `zi3` in 30 of its 38 cases.
 *
 * 罢 is the known loss. CC-CEDICT calls its `ba5` a final particle, so it is
 * held here, and CPP labels the character `ba4` in all 40 of its cases: the
 * particle is the literary 也罢 and 罢了, while a modern bare 罢 is 罢工. Left
 * protected because the rule is about what a source claims of the character,
 * and singling one out because a dataset disagrees is fitting to the dataset.
 */
export function isNeutralAlone(
  character: string,
  entries: readonly CedictEntry[],
): boolean {
  return entries.some((entry) => {
    const reading = readDictionaryReading(character, entry.readings);
    return (
      reading?.length === 1 &&
      reading[0]?.tone === NEUTRAL_TONE &&
      !entry.definitions.some((definition) => SUFFIX_SENSE.test(definition))
    );
  });
}

/**
 * Demote a 轻声 the frequency field counted only inside words.
 *
 * `kHanyuPinlu` counts occurrences in running text, and a character's neutral
 * count there mixes two unrelated things: a character that stands alone
 * unstressed, and one reduced *inside a word*. Where the field writes the same
 * spelling both bare and toned it is reporting that split with no way to say
 * which is which — 西 is `xi(902) xī(738)`, and the 902 are 东西 — and since the
 * field leads {@link import("../sources/unihan.js").READING_FIELDS}, the
 * reduction became the character's reading. 西 read `xi`, so 往西 was `wǎng xi`;
 * 夫 read `fu`, 识 `shi`, 拾 `shi`, 候 `hou`, 姐 `jie`, 友 `you`.
 *
 * So a bare spelling the field also writes with a tone ranks below that twin —
 * demoted rather than dropped, keeping it as a candidate without letting it set
 * the default, exactly as a lone `kHanyuPinlu` reading is. It reaches 50
 * characters, and {@link isNeutralAlone} holds back the ones a source says are
 * neutral on their own.
 *
 * The other half of the same blind spot is already handled: where the field
 * marks *no* tone at all it omitted the mark rather than meaning 轻声, which is
 * {@link resolveFrequencyTones}.
 */
export function demoteReducedNeutrals(
  unihan: UnihanReadings,
  readings: readonly string[],
): readonly string[] {
  const frequency = unihan.fields.get(FREQUENCY_FIELD) ?? [];
  const reduced = new Set(
    frequency.filter(
      (reading) =>
        !isToneMarked(reading) &&
        frequency.some(
          (other) => isToneMarked(other) && tonelessReading(other) === reading,
        ),
    ),
  );
  if (reduced.size === 0) {
    return readings;
  }
  return [
    ...readings.filter((reading) => !reduced.has(reading)),
    ...readings.filter((reading) => reduced.has(reading)),
  ];
}
