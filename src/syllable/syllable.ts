import {
  applyToneMark,
  normaliseSuperscript,
  stripToneMarks,
  SUPERSCRIPT_TONES,
  toneFromMarks,
} from "../tone/tone-mark.js";
import { type Tone, toneFromNotation } from "../tone/tone.js";
import {
  AFTER_INITIAL_SPELLINGS,
  type Final,
  type Initial,
  isPalatalInitial,
  ZERO_INITIAL_SPELLINGS,
} from "./phonology.js";

/**
 * A single Mandarin syllable, decomposed into its phonological parts.
 *
 * The initial and final are the underlying forms rather than the spelling, so
 * 就 parses to `j` + `iou` and 军 to `j` + `ün`. Spelling is reconstructed on
 * demand by {@link writeSyllable}.
 */
export interface Syllable {
  readonly initial: Initial;
  readonly final: Final;
  /**
   * The tone, or undefined when the source wrote no tone at all.
   *
   * Undefined is distinct from the neutral tone: `de` in 我的 is neutral,
   * whereas the `bei` in a typed `beijing` simply has no tone written. Treating
   * the second as neutral would fabricate information — it would round-trip to
   * `bei5`, and would emit the neutral-tone dot in bopomofo.
   */
  readonly tone: Tone | undefined;
  /**
   * Whether the syllable carries the retroflex r suffix of 儿化, as 玩儿 wánr
   * does.
   *
   * This is a suffix on the syllable rather than a syllable of its own, which is
   * what separates 玩儿 wánr from 女儿 nǚ'ér, where 儿 keeps its own syllable.
   */
  readonly erhua?: boolean;
  /**
   * The tone a neutral syllable has when it is not reduced: 快乐 kuàile is a
   * neutral 乐, which is 乐 lè in the fourth.
   *
   * Pinyin never writes it, and nothing here infers it — a syllable that
   * arrives as neutral and nothing else leaves this undefined. It is carried
   * because **Gwoyeu Romatzyh cannot write the neutral tone without it**: GR
   * writes a dot in front of the syllable *in its original tonal spelling*, so
   * 没有 méiyou is `mei.yeou` with 有 yǒu's third-tone spelling behind the dot.
   * Every other system here writes the neutral tone with a mark of its own and
   * has no use for this.
   *
   * Only meaningful alongside a neutral {@link Syllable.tone}. A syllable that
   * is neutral in its own right — 的 de, 么 me, 子 zi — has no original tone to
   * record, which is a different thing from not knowing it, and GR writes those
   * with the basic form.
   */
  readonly originalTone?: Tone;
}

import { normaliseUmlaut, readParts } from "./syllable-parts.js";

export { normaliseUmlaut } from "./syllable-parts.js";
export function readSyllable(text: string): Syllable | undefined {
  const trimmed = normaliseSuperscript(
    normaliseUmlaut(text.trim()).normalize("NFC"),
  );
  if (trimmed === "") {
    return undefined;
  }

  const numberedMatch = /^(.*?)([0-5])$/u.exec(trimmed);
  const body = numberedMatch?.[1] ?? trimmed;
  const numberedTone =
    numberedMatch?.[2] === undefined
      ? undefined
      : toneFromNotation(Number(numberedMatch[2]));

  const markedTone = toneFromMarks(body);
  if (numberedTone !== undefined && markedTone !== undefined) {
    // Mixed notation such as jiù4 is more likely a mistake than an intent.
    return undefined;
  }

  const spelling = stripToneMarks(body).toLowerCase();
  const tone = numberedTone ?? markedTone;

  const parts = readParts(spelling);
  if (parts !== undefined) {
    return { initial: parts[0], final: parts[1], tone };
  }

  // 儿化: wánr is wán carrying an r suffix rather than a syllable in its own
  // right. Tried only after the whole spelling fails, so that ér and èr keep
  // their own reading instead of being read as e with a suffix.
  if (spelling.endsWith("r")) {
    const base = readParts(spelling.slice(0, -1));
    if (base !== undefined) {
      return { initial: base[0], final: base[1], tone, erhua: true };
    }
  }

  return undefined;
}

/**
 * Whether a string is a well-formed Mandarin syllable.
 */
export function isSyllable(text: string): boolean {
  return readSyllable(text) !== undefined;
}

/**
 * Spell a syllable without its tone.
 */
export function writeSyllableSpelling(syllable: Syllable): string {
  const { initial, final } = syllable;
  const suffix = syllable.erhua === true ? "r" : "";
  if (initial === "") {
    return `${ZERO_INITIAL_SPELLINGS.get(final) ?? final}${suffix}`;
  }
  if (isPalatalInitial(initial) && final.startsWith("ü")) {
    return `${initial}${final.replace("ü", "u")}${suffix}`;
  }
  return `${initial}${AFTER_INITIAL_SPELLINGS.get(final) ?? final}${suffix}`;
}

/**
 * How a syllable's tone should be written.
 *
 * `marks` is the standard diacritic notation, `numbers` appends the tone number,
 * `superscript` raises that number, and `none` writes the plain syllable.
 */
export type ToneNotation = "marks" | "numbers" | "superscript" | "none";

/**
 * Spell a syllable, writing its tone in the requested notation.
 */
export function writeSyllable(
  syllable: Syllable,
  notation: ToneNotation = "marks",
): string {
  const spelling = writeSyllableSpelling(syllable);
  switch (notation) {
    case "marks": {
      return applyToneMark(spelling, syllable.tone);
    }
    case "numbers": {
      // An unwritten tone stays unwritten, rather than being invented as 5.
      return syllable.tone === undefined
        ? spelling
        : `${spelling}${String(syllable.tone)}`;
    }
    case "superscript": {
      /* c8 ignore next 3 -- every tone has a raised digit */
      return syllable.tone === undefined
        ? spelling
        : `${spelling}${SUPERSCRIPT_TONES.get(syllable.tone) ?? ""}`;
    }
    case "none": {
      return spelling;
    }
  }
}
