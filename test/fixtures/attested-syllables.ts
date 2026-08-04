/**
 * Re-exported so the syllable inventory has one home.
 *
 * The list moved into `src/` when the merge step needed it: the build asserts
 * that every syllable entering the dictionary is one it already knows, which is
 * the check that catches a source refresh smuggling in a token that is not a
 * syllable at all.
 */
export { ATTESTED_SYLLABLES } from "../../src/syllable/inventory.js";
