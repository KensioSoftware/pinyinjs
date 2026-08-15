/**
 * The dictionary a build assertion is asked about.
 *
 * Indexed the way the artifact is, so that an assertion interrogates the same
 * lookups a reader would rather than the entry list behind them.
 */
import { isAttestedTone } from "../syllable/inventory.js";
import { type Syllable, writeSyllable } from "../syllable/syllable.js";
import { traditionalForms } from "./artifact.js";
import type { DictionaryEntry } from "./entry.js";

/**
 * One thing that must be true of a freshly built dictionary.
 */
export interface BuildAssertion {
  readonly description: string;
  /** The failure message, or undefined when the assertion holds. */
  readonly check: (dictionary: BuiltDictionary) => string | undefined;
}

/**
 * A merged dictionary, indexed for the assertions to interrogate.
 */
export class BuiltDictionary {
  readonly #byKey: ReadonlyMap<string, DictionaryEntry>;

  readonly entries: readonly DictionaryEntry[];

  /**
   * Index entries by every key they claim, headwords first.
   *
   * The order matters for the same reason it does in the artifact: 发 and 髮
   * both claim 发, and the entry the key names has to win.
   */
  constructor(entries: readonly DictionaryEntry[]) {
    const byKey = new Map<string, DictionaryEntry>();
    for (const entry of entries) {
      byKey.set(entry.hans, entry);
    }
    for (const entry of entries) {
      for (const form of traditionalForms(entry)) {
        if (!byKey.has(form)) {
          byKey.set(form, entry);
        }
      }
    }
    this.#byKey = byKey;
    this.entries = entries;
  }

  /**
   * Every reading the dictionary holds, under every locale it holds one for.
   */
  *#readings(): Generator<readonly Syllable[]> {
    for (const entry of this.entries) {
      yield* [
        entry.readings.cn,
        entry.readings.tw ?? [],
        ...(entry.alternates ?? []),
      ];
    }
  }

  /**
   * The entry for a word under either script, or undefined.
   */
  get(word: string): DictionaryEntry | undefined {
    return this.#byKey.get(word);
  }

  /**
   * A word's zh-CN reading in tone-marked notation, or undefined.
   */
  reading(word: string): string | undefined {
    const entry = this.#byKey.get(word);
    return entry === undefined
      ? undefined
      : entry.readings.cn.map((syllable) => writeSyllable(syllable)).join(" ");
  }

  /**
   * Every distinct toneless syllable the dictionary uses.
   */
  syllableInventory(): ReadonlySet<string> {
    const inventory = new Set<string>();
    for (const reading of this.#readings()) {
      for (const syllable of reading) {
        inventory.add(
          writeSyllable({ ...syllable, erhua: false, tone: undefined }),
        );
      }
    }
    return inventory;
  }

  /**
   * Every syllable the dictionary uses that is not in the tone the inventory
   * says that syllable is written in.
   *
   * The tones are read off the dictionary in the first place, so this is empty
   * by construction — until a source refresh brings in a reading nobody has
   * seen, which is exactly when a reader would start handing that syllable
   * back and the table would have to be regenerated.
   */
  unattestedTones(): ReadonlySet<string> {
    const unattested = new Set<string>();
    for (const reading of this.#readings()) {
      for (const syllable of reading) {
        if (!isAttestedTone(syllable)) {
          unattested.add(writeSyllable({ ...syllable, erhua: false }));
        }
      }
    }
    return unattested;
  }
}
