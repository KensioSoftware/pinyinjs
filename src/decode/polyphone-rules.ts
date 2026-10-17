/**
 * The rules that settle a polyphone from the words around it.
 *
 * 弹 is `tán` or `dàn`, and which one a text means is a question about the
 * neighbours rather than about the character. 长 is the same question and has
 * a file of its own, and 好学 is the same question asked of a word. The other rules in `reading-rules.ts` are about particles
 * and 儿化, which is a different kind of evidence.
 */
export { ADJECTIVAL_CHANG } from "./chang-rule.js";
export { PLAYING_TAN } from "./tan-rule.js";
export { EASY_HAO } from "./hao-rule.js";
