import { MODAL_DE, NOUN_HUA, PARTICLE_DE, POTENTIAL_DE } from "./de-rule.js";
import { TAXI_DI } from "./taxi-rule.js";
import { COUNTED_MEASURE } from "./measure-rule.js";
import { EXPERIENTIAL_GUO } from "./guo-rule.js";
import { TEACHING_JIAO } from "./jiao-rule.js";
import { DOMINANT_READING } from "./dominant-rule.js";
import { SEPARATED_COMPOUND } from "./split-rule.js";
import { RETURNING_HUAN } from "./huan-rule.js";
import { CONCERNING_GAN } from "./gan-rule.js";
import { COUNTING_ZHI } from "./zhi-rule.js";
import { POTENTIAL_LIAO } from "./liao-rule.js";
import { OBTAINING_DE } from "./obtain-rule.js";
import { REDUPLICATED_VERB } from "./reduplication-rule.js";
import { VERBAL_READING } from "./verbal-rule.js";

export { MODAL_DE, NOUN_HUA, PARTICLE_DE, POTENTIAL_DE } from "./de-rule.js";
export { TAXI_DI } from "./taxi-rule.js";
export { COUNTED_MEASURE } from "./measure-rule.js";
export { EXPERIENTIAL_GUO } from "./guo-rule.js";
export { TEACHING_JIAO } from "./jiao-rule.js";
export { DOMINANT_READING } from "./dominant-rule.js";
export { SEPARATED_COMPOUND } from "./split-rule.js";
export { RETURNING_HUAN } from "./huan-rule.js";
export { CONCERNING_GAN } from "./gan-rule.js";
export { COUNTING_ZHI } from "./zhi-rule.js";
export { POTENTIAL_LIAO } from "./liao-rule.js";
export { OBTAINING_DE } from "./obtain-rule.js";
export { REDUPLICATED_VERB } from "./reduplication-rule.js";
export { VERBAL_READING } from "./verbal-rule.js";
import type { EdgeContext, EdgeRule } from "./rules.js";

/**
 * 儿 does not stand on its own where the dictionary attests the 儿化.
 *
 * 儿化 is a per-word dictionary fact taken from CC-CEDICT's explicit `r5`
 * token, and 2,009 of the 2,067 keys ending in 儿 carry it. What that leaves is
 * an edge: 这边儿, 上边儿 and 旁边儿 are all listed and 那边儿 is not, so
 * 我得跑到那边儿去 read the 儿 as a syllable of its own — `nàbian ér` — and the
 * decode was choosing between 那边 plus 儿 and 那 plus 边儿 on frequency alone.
 *
 * This forbids the bare 儿 edge when the character in front of it makes an
 * attested 儿化 word, so the only paths left are the ones that absorb it. That
 * asserts nothing the dictionary does not already say — 边儿 is `biānr` because
 * CC-CEDICT says so — which is what separates it from synthesising 儿化 with a
 * suffix rule, the thing ORTHOGRAPHY.md rejects and the old project got wrong.
 *
 * Measured over the same 88,866 lines it fires 7 times, and all 7 are right:
 * 照片儿, 出门儿, 热点儿, 辣味儿, 晚会儿, 针管儿, 碍事儿. It is deliberately
 * silent on the 20 bare 儿 with no attested 儿化 behind them, which are 马儿,
 * 门铃儿 and a row of Mongol names transliterated with 儿.
 */
export const ATTESTED_ERHUA: EdgeRule = {
  name: "attested-erhua",
  verdictFor: (context: EdgeContext) => {
    const { characters, edge } = context;
    if (edge.text !== "儿" || edge.from === 0) {
      return "keep";
    }
    /* c8 ignore next -- the edge starts inside the run it was built from */
    const absorbed = `${characters[edge.from - 1] ?? ""}儿`;
    const reading = context.dictionary.lookup(absorbed)?.reading;
    return (reading?.at(-1)?.erhua ?? false) ? "forbid" : "keep";
  },
};

import { ADJECTIVAL_CHANG, EASY_HAO, PLAYING_TAN } from "./polyphone-rules.js";

export { ADJECTIVAL_CHANG, EASY_HAO, PLAYING_TAN } from "./polyphone-rules.js";

/**
 * The rules the lattice decode applies, in order.
 */
export const READING_RULES: readonly EdgeRule[] = [
  MODAL_DE,
  PARTICLE_DE,
  POTENTIAL_DE,
  TAXI_DI,
  NOUN_HUA,
  TEACHING_JIAO,
  ATTESTED_ERHUA,
  COUNTED_MEASURE,
  ADJECTIVAL_CHANG,
  PLAYING_TAN,
  EXPERIENTIAL_GUO,
  SEPARATED_COMPOUND,
  REDUPLICATED_VERB,
  RETURNING_HUAN,
  CONCERNING_GAN,
  COUNTING_ZHI,
  POTENTIAL_LIAO,
  OBTAINING_DE,
  VERBAL_READING,
  DOMINANT_READING,
  EASY_HAO,
];
