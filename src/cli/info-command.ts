/**
 * Reporting what is loaded, which is the first thing to check when output
 * looks wrong.
 */
import {
  ATTESTED_SYLLABLES,
  DICTIONARY_SYLLABLES,
} from "../syllable/inventory.js";
import { type Command, dictionaryOf } from "./command.js";

/**
 * Report what is loaded, which is the first thing to check when output looks
 * wrong.
 */
export const INFO: Command = {
  name: "info",
  summary: "which dictionary is loaded, and how big it is",
  argument: "",
  flags: [],
  needsDictionary: true,
  run: (input) => {
    const keys = dictionaryOf(input).size;
    const directory = input.choice.directory;
    return [
      {
        lines: [
          `tier       ${input.choice.tier}`,
          `data       ${directory ?? "the artifacts that shipped"}`,
          `keys       ${keys.toLocaleString("en-GB")}`,
          `syllables  ${String(ATTESTED_SYLLABLES.length)} attested, ${String(DICTIONARY_SYLLABLES.size)} spellings in the inventory`,
        ],
        data: {
          tier: input.choice.tier,
          ...(directory !== undefined && { data: directory }),
          keys,
          attestedSyllables: ATTESTED_SYLLABLES.length,
          inventorySpellings: DICTIONARY_SYLLABLES.size,
        },
      },
    ];
  },
};
