import { characterCount } from "../script/characters.js";
import { DICTIONARY_SYLLABLES, isAttestedTone } from "../syllable/inventory.js";
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

/**
 * Assert one word reads a particular way.
 */
function reads(word: string, expected: string, why: string): BuildAssertion {
  return {
    description: `${word} → ${expected} (${why})`,
    check: (dictionary: BuiltDictionary): string | undefined => {
      const actual = dictionary.reading(word);
      if (actual === undefined) {
        return `${word} is missing from the dictionary`;
      }
      return actual === expected
        ? undefined
        : `${word} reads ${actual}, expected ${expected}`;
    },
  };
}

/**
 * What must hold of every build, or no artifact is produced.
 *
 * These test the **stored** form, which is deliberately not what a user sees:
 * sandhi is normalised out of the dictionary and reapplied at runtime, so
 * 一丁不识 is stored as `yī dīng bù shí` and only becomes `yì dīng bù shí` after
 * the runtime pass. The gold corpus asserts that output form. Asserting `yì`
 * here would be permanently unsatisfiable — see MERGE.md.
 *
 * Each one stands for a whole class of upstream defect that a source refresh
 * could reintroduce, so a failure here means the merge no longer repairs
 * something it used to, not merely that one word is wrong.
 */
export const BUILD_ASSERTIONS: readonly BuildAssertion[] = [
  reads("玩儿", "wánr", "儿化 repaired from CC-CEDICT's r5"),
  reads("女儿", "nǚ ér", "儿 keeps its own syllable here"),
  reads("这儿", "zhèr", "儿化 despite upstream writing a tone on the er"),
  reads("儿子", "ér zi", "儿化 exception list consulted"),
  reads("一丁不识", "yī dīng bù shí", "一 sandhi normalised out"),
  reads("一不小心", "yī bù xiǎo xīn", "一 and 不 sandhi normalised out"),
  reads("大夫", "dài fu", "override applied over both sources"),
  reads("银行", "yín háng", "polyphone survives"),
  reads("行长", "háng zhǎng", "polyphone survives"),
  reads("头发", "tóu fa", "CC-CEDICT wins on the neutral tone"),
  reads("还是", "hái shi", "CC-CEDICT wins on the neutral tone"),
  reads("頭髮", "tóu fa", "繁體 derived using the reading, and keyed directly"),
  reads("重複", "chóng fù", "one of two 繁體 spellings, both keyed"),
  reads("重覆", "chóng fù", "the other, on the same entry"),
  reads("下麵", "xià miàn", "both spellings of a word CC-CEDICT writes twice"),
  // kHanyuPinlu writes 李 as `li(36)`, with no tone mark. Read as 轻声 — which
  // is what an unmarked reading means everywhere else in source data — 李华
  // comes out `Li Huá`. The other Unihan fields all write `lǐ`, and that is
  // what settles it. 们 is the control: genuinely neutral, and written bare by
  // the other fields too, so it must not be "corrected".
  reads("李", "lǐ", "a tone kHanyuPinlu left off is restored"),
  reads("们", "men", "a genuine 轻声 is not given a tone it never had"),
  {
    description: "北京 is a proper noun (jieba POS carried through)",
    check: (dictionary: BuiltDictionary): string | undefined =>
      dictionary.get("北京")?.isProperNoun === true
        ? undefined
        : "北京 is not marked as a proper noun",
  },
  {
    // jieba tags all four of these a proper noun; CC-CEDICT writes their
    // pinyin in lower case, and the decoder capitalises straight off this bit.
    description: "沙发, 城市, 阿姨 and 长大 are not proper nouns",
    check: (dictionary: BuiltDictionary): string | undefined => {
      const wrong = ["沙发", "城市", "阿姨", "长大"].filter(
        (word) => dictionary.get(word)?.isProperNoun === true,
      );
      return wrong.length === 0
        ? undefined
        : `marked as proper nouns: ${wrong.join(", ")}`;
    },
  },
  {
    // The veto only demotes. These stay proper nouns, and 人民政府 is the
    // control that shows the veto still fires on an institution.
    description: "齐白石, 国务院 and 湖北 stay proper nouns",
    check: (dictionary: BuiltDictionary): string | undefined => {
      const wrong = ["齐白石", "国务院", "湖北"].filter(
        (word) => dictionary.get(word)?.isProperNoun !== true,
      );
      return wrong.length === 0
        ? undefined
        : `no longer proper nouns: ${wrong.join(", ")}`;
    },
  },
  {
    description: "头发 derives 頭髮 rather than 頭發",
    check: (dictionary: BuiltDictionary): string | undefined => {
      const hant = dictionary.get("头发")?.hant;
      return hant === "頭髮"
        ? undefined
        : `头发 derived ${hant ?? "nothing"}, expected 頭髮`;
    },
  },
  {
    // Membership rather than a count. MERGE.md asked for "exactly 408 after the
    // merge", which is the phrase corpus's own inventory — but the merged
    // dictionary also carries Unihan's and CC-CEDICT's rare characters, whose
    // readings are legitimately outside it (鞥 ēng, 覅 fiào, 挼 ruá). Fixing the
    // count would either exclude those or bless whatever a refresh adds; naming
    // the permitted set does neither.
    description: "every syllable used is one the inventory knows",
    check: (dictionary: BuiltDictionary): string | undefined => {
      const unknown = [...dictionary.syllableInventory()].filter(
        (syllable) => !DICTIONARY_SYLLABLES.has(syllable),
      );
      return unknown.length === 0
        ? undefined
        : `readings use ${String(unknown.length)} syllable(s) outside the inventory: ${unknown.join(", ")}`;
    },
  },
  {
    // The romanisation readers narrow an ambiguous spelling on the tone that
    // was written — `lo²` is 羅 luó and not a 咯 that is only ever neutral —
    // so a tone the table has never heard of is a syllable those readers will
    // refuse to hand back. Regenerate `SYLLABLE_TONES` when this fails.
    description: "every syllable is used in a tone the inventory knows",
    check: (dictionary: BuiltDictionary): string | undefined => {
      const unattested = [...dictionary.unattestedTones()];
      return unattested.length === 0
        ? undefined
        : `readings use ${String(unattested.length)} syllable(s) in a tone the inventory does not list: ${unattested.join(", ")}`;
    },
  },
  {
    description: "every entry's syllable count matches its character count",
    check: (dictionary: BuiltDictionary): string | undefined => {
      for (const entry of dictionary.entries) {
        const characters = characterCount(entry.hans);
        const erhua = entry.readings.cn.filter(
          (syllable) => syllable.erhua === true,
        ).length;
        // Punctuation is written but unread, so it is allowed to have no
        // syllable; a reading may therefore be shorter but never longer.
        if (entry.readings.cn.length + erhua > characters) {
          return `${entry.hans} has ${String(entry.readings.cn.length)} syllables for ${String(characters)} characters`;
        }
      }
      return;
    },
  },
];

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
