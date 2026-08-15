/**
 * Running the build assertions.
 */
import type { DictionaryEntry } from "./entry.js";
import { BuiltDictionary } from "./built-dictionary.js";
import { BUILD_ASSERTIONS } from "./build-assertions.js";

export type { BuildAssertion } from "./built-dictionary.js";
export { BuiltDictionary } from "./built-dictionary.js";
export { BUILD_ASSERTIONS } from "./build-assertions.js";

/**
 * Run every build assertion, returning the failures.
 */
export function checkBuild(
  entries: readonly DictionaryEntry[],
): readonly string[] {
  const dictionary = new BuiltDictionary(entries);
  return BUILD_ASSERTIONS.map((assertion) =>
    assertion.check(dictionary),
  ).filter((failure) => failure !== undefined);
}
