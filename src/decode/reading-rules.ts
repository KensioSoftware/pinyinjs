import { MODAL_DE, NOUN_HUA, PARTICLE_DE, POTENTIAL_DE } from "./de-rule.js";
import { CALCULATING_SUAN, COMPLEMENT_DE } from "./complement-rule.js";
import { ADVERBIAL_DI, ASPECTUAL_PARTICLE } from "./particle-rule.js";
import { TAXI_DI } from "./taxi-rule.js";
import { COUNTED_MEASURE } from "./measure-rule.js";
import { COUNTED_GE } from "./ge-rule.js";
import { COUNTED_NAME } from "./name-count-rule.js";
import { MODAL_CAI } from "./cai-rule.js";
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
import { LOCATIVE_SHANG_PU, SPREADING_PU } from "./pu-rule.js";
import { RESULTATIVE_ZHAO } from "./zhao-rule.js";
import { VERBAL_DE_QUESHI } from "./dique-rule.js";
import { COMPASS_DONGXI } from "./dongxi-rule.js";

export { MODAL_DE, NOUN_HUA, PARTICLE_DE, POTENTIAL_DE } from "./de-rule.js";
export { CALCULATING_SUAN, COMPLEMENT_DE } from "./complement-rule.js";
export { ADVERBIAL_DI, ASPECTUAL_PARTICLE } from "./particle-rule.js";
export { TAXI_DI } from "./taxi-rule.js";
export { COUNTED_MEASURE } from "./measure-rule.js";
export { COUNTED_GE } from "./ge-rule.js";
export { COUNTED_NAME } from "./name-count-rule.js";
export { MODAL_CAI } from "./cai-rule.js";
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
export { LOCATIVE_SHANG_PU, SPREADING_PU } from "./pu-rule.js";
export { RESULTATIVE_ZHAO } from "./zhao-rule.js";
export { VERBAL_DE_QUESHI } from "./dique-rule.js";
export { COMPASS_DONGXI } from "./dongxi-rule.js";
import type { EdgeRule } from "./rules.js";
import { ATTESTED_ERHUA } from "./erhua-rule.js";

export { ATTESTED_ERHUA } from "./erhua-rule.js";

import {
  ADJECTIVAL_CHANG,
  ADJECTIVAL_MEI,
  EASY_HAO,
  PLAYING_TAN,
  SUMMING_DOU,
} from "./polyphone-rules.js";

export {
  ADJECTIVAL_CHANG,
  ADJECTIVAL_MEI,
  EASY_HAO,
  PLAYING_TAN,
  SUMMING_DOU,
} from "./polyphone-rules.js";

/**
 * The rules the lattice decode applies, in order.
 */
export const READING_RULES: readonly EdgeRule[] = [
  MODAL_DE,
  PARTICLE_DE,
  POTENTIAL_DE,
  COMPLEMENT_DE,
  CALCULATING_SUAN,
  ASPECTUAL_PARTICLE,
  ADVERBIAL_DI,
  TAXI_DI,
  NOUN_HUA,
  TEACHING_JIAO,
  ATTESTED_ERHUA,
  COUNTED_MEASURE,
  COUNTED_GE,
  COUNTED_NAME,
  ADJECTIVAL_CHANG,
  PLAYING_TAN,
  EXPERIENTIAL_GUO,
  SEPARATED_COMPOUND,
  REDUPLICATED_VERB,
  RETURNING_HUAN,
  LOCATIVE_SHANG_PU,
  SPREADING_PU,
  CONCERNING_GAN,
  COUNTING_ZHI,
  POTENTIAL_LIAO,
  RESULTATIVE_ZHAO,
  OBTAINING_DE,
  VERBAL_READING,
  DOMINANT_READING,
  EASY_HAO,
  ADJECTIVAL_MEI,
  SUMMING_DOU,
  MODAL_CAI,
  VERBAL_DE_QUESHI,
  COMPASS_DONGXI,
];
