/**
 * Gwoyeu Romatzyh (國語羅馬字), in both directions.
 *
 * GR is the odd one of the five. Every other system here writes a syllable and
 * then marks its tone — a diacritic, a raised digit, a tone letter — so the
 * spelling is one mapping over the inventory and the tone rides on top of it.
 * GR spells the tone *into* the syllable: 山 shān is `shan`, 陝 shǎn is `shaan`,
 * 善 shàn is `shann`. So it is four mappings rather than one, related by the
 * tonal rules below, and reading it back is an index keyed per tone.
 *
 * The rules come from Wikipedia's *Spelling in Gwoyeu Romatzyh*, which states
 * them as a rule of thumb per tone plus a handful of clauses. They are
 * implemented here as stated, with one amendment recorded in
 * {@link zeroInitial}, and the whole of it is scored against a different page's
 * four GR columns in [syllabary.test.ts](syllabary.test.ts).
 *
 * Three things follow from the tone being in the spelling:
 *
 * - **There is no toneless form.** The basic form *is* the first tone, so a
 *   syllable whose tone was never written cannot be told from one written in
 *   the first tone. That is bopomofo's shortfall exactly, arrived at from the
 *   other direction — see `docs/romanization/`.
 * - **The neutral tone is a dot in front**, and the syllable behind it keeps
 *   its original tonal spelling: 没有 méiyou is `mei.yeou`, with 有 yǒu's third
 *   tone still spelled. That is what {@link Syllable.originalTone} is for. A
 *   syllable that is neutral in its own right has no original tone, and takes
 *   the basic form: 什么 shénme is `shern.me`.
 * - **儿化 is a fusion rather than a suffix**, and it is spelled out here rime
 *   by rime as Chao gives it. See {@link RHOTACISED_RIMES}.
 */
import {
  DICTIONARY_SYLLABLES,
  narrowToAttested,
} from "../syllable/inventory.js";
import { readSyllable, type Syllable } from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";

import type { ContourTone } from "./gwoyeu-tonal-forms.js";

/**
 * The four tones, for building the index.
 */
const CONTOUR_TONES: readonly ContourTone[] = [1, 2, 3, 4];

import { NEUTRAL_MARK, rhotacisedTone, toneForm } from "./gwoyeu-spelling.js";

export { writeGwoyeu, writeGwoyeuWord } from "./gwoyeu-spelling.js";

/**
 * Every syllable each spelling stands for, keyed per tone.
 *
 * The other readers here index the inventory once and read the tone off the
 * marks; GR has no marks, so the index is built four times over and each entry
 * carries the tone its spelling means. That is the whole practical difference
 * between reading GR and reading the rest.
 */
function indexTonalForms(): ReadonlyMap<string, readonly Syllable[]> {
  const index = new Map<string, Syllable[]>();
  const add = (key: string, syllable: Syllable): void => {
    const found = index.get(key);
    if (found === undefined) {
      index.set(key, [syllable]);
    } else {
      found.push(syllable);
    }
  };
  for (const pinyin of DICTIONARY_SYLLABLES) {
    const syllable = readSyllable(pinyin);
    /* c8 ignore next 3 -- inventory.test.ts holds the parser to the inventory */
    if (syllable === undefined) {
      continue;
    }
    for (const tone of CONTOUR_TONES) {
      add(toneForm(syllable, tone), { ...syllable, tone });
      const rhotacised = { ...syllable, tone, erhua: true };
      add(rhotacisedTone(rhotacised, tone), rhotacised);
    }
  }
  return index;
}

const INDEX = indexTonalForms();

/**
 * Look a spelling up.
 *
 * The rhotacised forms are in the same index as the plain ones rather than
 * being found by taking an `-l` off the end, because GR's 儿化 is a fusion and
 * there is nothing to take off: `wal` is 玩儿 wánr and `wa` is not a syllable
 * anybody wrote. It is also why one spelling can be several syllables — `jiel`
 * is 今儿 jīnr and 鸡儿 jīr — which the index holds as it holds any other
 * collision.
 */
function lookUp(spelling: string): readonly Syllable[] {
  return INDEX.get(spelling) ?? [];
}

/**
 * Read a Gwoyeu Romatzyh syllable: `jiow` becomes 就 jiù.
 *
 * A leading dot is the neutral tone, and it wins over whatever tone the
 * spelling behind it carries — `.yeou` is a neutral 友, which is what GR means
 * by it. The tone it displaces is kept as the {@link Syllable.originalTone},
 * since that is exactly what the spelling behind the dot recorded and it is
 * what writing the syllable back needs.
 *
 * Returns every syllable the spelling stands for, and nothing at all for a
 * spelling no syllable of the inventory writes.
 *
 * Narrowed after the dot has been applied rather than before it, since the dot
 * is what says which tone was written: `ell` is 二 èr or 恩儿 ēnr, and a
 * neutral `.ell` is neither of those tones.
 */
export function readGwoyeu(text: string): readonly Syllable[] {
  const written = text.trim().normalize("NFC").toLowerCase();
  const isNeutral = written.startsWith(NEUTRAL_MARK);
  const found = lookUp(
    isNeutral ? written.slice(NEUTRAL_MARK.length) : written,
  );
  return narrowToAttested(
    isNeutral
      ? found.map((syllable) => ({
          ...syllable,
          tone: NEUTRAL_TONE,
          ...(syllable.tone !== undefined && { originalTone: syllable.tone }),
        }))
      : found,
  );
}
