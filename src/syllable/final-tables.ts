/**
 * Which final a spelling stands for, where pinyin does not write it in full.
 *
 * The three places the orthography abbreviates — the palatal series dropping
 * its umlaut, iou/uei/uen written -iu/-ui/-un, and the zero-initial forms —
 * plus the finals that stand as a syllable on their own.
 */
import type { Final } from "./phonology.js";
import { ZERO_INITIAL_SPELLINGS } from "./phonology.js";

/**
 * How a written final maps back to its underlying form after a palatal initial,
 * where a written u always stands for ü.
 */
export const PALATAL_FINALS = new Map<string, Final>([
  ["u", "ü"],
  ["ue", "üe"],
  ["uan", "üan"],
  ["un", "ün"],
]);

/**
 * How a written final maps back to its underlying form after any other initial.
 */
export const ABBREVIATED_FINALS = new Map<string, Final>([
  ["iu", "iou"],
  ["ui", "uei"],
  ["un", "uen"],
]);

/**
 * The reverse of {@link ZERO_INITIAL_SPELLINGS}, for reading y- and w- forms.
 */
export const ZERO_INITIAL_FINALS = new Map<string, Final>(
  [...ZERO_INITIAL_SPELLINGS].map(([final, spelling]) => [spelling, final]),
);

/**
 * Finals that are written as-is when they make up a whole syllable on their own.
 *
 * Every other final either takes a y or w onset with no initial (i becomes yi)
 * or cannot stand alone at all (ong only ever follows an initial), so accepting
 * anything outside this set would let underlying forms such as `iou` through as
 * if they were valid spellings.
 */
export const STANDALONE_FINALS = new Set<Final>([
  "a",
  "o",
  "e",
  "ê",
  "er",
  "ai",
  "ei",
  "ao",
  "ou",
  "an",
  "en",
  "ang",
  "eng",
  "m",
  "n",
  "ng",
]);
