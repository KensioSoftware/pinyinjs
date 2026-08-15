/**
 * What must hold of every build, or no artifact is produced.
 *
 * These test the **stored** form, which is deliberately not what a user sees:
 * sandhi is normalised out of the dictionary and reapplied at runtime, so
 * 一丁不识 is stored as `yī dīng bù shí` and only becomes `yì dīng bù shí` after
 * the runtime pass. The gold corpus asserts that output form. Asserting `yì`
 * here would be permanently unsatisfiable — see MERGE.md.
 */
import type { BuildAssertion } from "./built-dictionary.js";
import { CHARACTER_READINGS } from "./character-readings.js";
import { ENTRY_INVARIANTS } from "./entry-invariants.js";
import { INVENTORY_INVARIANTS } from "./inventory-invariants.js";
import { TONE_INVARIANTS } from "./tone-invariants.js";
import { WORD_READINGS } from "./word-readings.js";

export const BUILD_ASSERTIONS: readonly BuildAssertion[] = [
  ...WORD_READINGS,
  ...CHARACTER_READINGS,
  ...TONE_INVARIANTS,
  ...ENTRY_INVARIANTS,
  ...INVENTORY_INVARIANTS,
];
