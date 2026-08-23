/**
 * Holding a phrase entry to what the words inside it already read.
 *
 * The phrase corpus is a reading source and not a word list, and 251,528 of its
 * 411,956 keys are in neither CC-CEDICT nor jieba. Much of that tail is running
 * text rather than vocabulary — 做什么, 什么意思, 不记得, 一个幽灵在欧洲游荡 —
 * and where a key like that carries a defective reading there is nothing to
 * correct it against, because `settleReading` compares a phrase entry with the
 * CC-CEDICT sense of the *same* headword and CC-CEDICT has no such headword.
 *
 * This is that missing correction, taken from the words inside instead.
 */
import { toCharacters } from "../script/characters.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import type { Syllable } from "../syllable/syllable.js";
import { type DictionaryEntry, isSameReading } from "./entry.js";
import { ConstituentIndex, type Segment } from "./locale-segments.js";

/**
 * What the repair pass changed.
 */
export interface ConstituentRepair {
  readonly entries: readonly DictionaryEntry[];
  /** Entries given a reading from a word inside them. */
  readonly repaired: number;
}

/**
 * Whether a constituent may correct the span it covers.
 *
 * Four tests, and each one rules out a class of damage:
 *
 * 1. **Multi-character only.** A character's own reading is the prior the
 *    phrase entry was built from, so correcting against it says nothing new.
 *    It is the same reasoning `composeLocaleDeltas` gives for the same
 *    restriction.
 * 2. **One syllable per character on both sides**, or the two readings are not
 *    describing the same span character for character.
 * 3. **The span must match no sense CC-CEDICT gives the constituent.** A word
 *    with two readings has two senses, and a phrase using the other one is
 *    right: 分子 is `fēn zǐ` as a molecule and `fèn zǐ` as a member, so
 *    分子结构 keeps the reading it was given. The build's tier check found this
 *    one, which is what that check is for.
 * 4. **No 轻声 may gain a tone.** The phrase corpus writes full tones where
 *    CC-CEDICT has neutral and never the reverse, so a correction pushing the
 *    other way is not a correction at all — it is a constituent that fell
 *    across a boundary. Every 地 in the 268 entries this rules out is the
 *    adverbial particle, and the words claiming it are 心地, 性地 and 野地.
 */
function corrects(
  part: Segment,
  span: readonly Syllable[],
  own: readonly Syllable[],
  senses: readonly (readonly Syllable[])[],
): boolean {
  if (toCharacters(part.text).length < 2 || own.length !== span.length) {
    return false;
  }
  if (senses.some((sense) => isSameReading(sense, span))) {
    return false;
  }
  return !span.some(
    (syllable, at) =>
      syllable.tone === NEUTRAL_TONE && own[at]?.tone !== NEUTRAL_TONE,
  );
}

/**
 * Read a phrase entry as the corroborated words inside it read it.
 *
 * 做什么 is stored `zuò shí mǒ` upstream, and 什么 is `shén me` in the same file
 * and in CC-CEDICT besides. The decode has no way back from that: the four
 * characters are one dictionary key, so the key answers and the word inside it
 * is never asked. 什么意思, 不记得 and 这么说 are the same defect, and between
 * them they account for 160 of the 290 sentences a downstream corpus of 13,182
 * reported as misread.
 *
 * The pass runs over entries **nothing but the phrase corpus attests** — no
 * CC-CEDICT headword under either script, no jieba frequency — and takes each
 * one's constituents from `ConstituentIndex`, the same segmentation the locale
 * composition uses. Only a constituent CC-CEDICT holds may correct anything, so
 * this never trades one uncorroborated reading for another. What survives
 * {@link corrects} replaces the span it covers.
 *
 * Measured on the full dictionary it repairs 1,727 entries of the 250,417 it
 * looks at. Sampled by hand at every 61st, the repairs are neutral tones the
 * corpus wrote out in full (骨头, 大夫, 秀才, 和尚), spellings it got wrong
 * (相扑 `xiàng pū`, 武侯 `wǔ hòu`, 用尽 `yòng jǐn`) and one entry with no tones
 * at all (激昂青云). The doubtful ones are homographs either reading is
 * defensible for: 倒数比 and 面糊盆.
 */
export function repairConstituentReadings(
  entries: readonly DictionaryEntry[],
  sensesOf: (word: string) => readonly (readonly Syllable[])[],
): ConstituentRepair {
  const index = new ConstituentIndex(entries);
  let repaired = 0;

  const repair = (entry: DictionaryEntry): DictionaryEntry => {
    const reading = entry.readings.cn;
    if (
      entry.frequency > 0 ||
      sensesOf(entry.hans).length > 0 ||
      sensesOf(entry.hant).length > 0 ||
      reading.length !== toCharacters(entry.hans).length ||
      reading.length < 2
    ) {
      return entry;
    }

    const path = index.segment(entry.hans);
    if (path === undefined) {
      return entry;
    }

    let corrected = [...reading];
    let isMoved = false;
    for (const part of path) {
      const own = part.entry.readings.cn;
      const senses = [
        ...sensesOf(part.entry.hans),
        ...sensesOf(part.entry.hant),
      ];
      if (senses.length === 0) {
        continue;
      }
      if (!corrects(part, reading.slice(part.from, part.to), own, senses)) {
        continue;
      }
      corrected = [
        ...corrected.slice(0, part.from),
        ...own,
        ...corrected.slice(part.to),
      ];
      isMoved = true;
    }
    if (!isMoved) {
      return entry;
    }

    repaired++;
    return { ...entry, readings: { ...entry.readings, cn: corrected } };
  };

  return { entries: entries.map((entry) => repair(entry)), repaired };
}
