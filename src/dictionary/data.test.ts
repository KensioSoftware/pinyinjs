import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  assertArrayEquals,
  assertArrayIncludes,
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertNonNullable,
  assertNumberBetween,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { writeSyllable } from "../syllable/syllable.js";
import { decodeReading } from "./artifact.js";
import { isSingleCharacter, toCharacters } from "../script/characters.js";
import { KeyIndex } from "./key-index.js";
import { HYPHENATED_IDIOMS } from "../orthography/idiom-list.js";
import { TIERS } from "./tiers.js";

/**
 * A tier as it is committed to `data/`.
 *
 * Read straight off disk rather than rebuilt, because the point of committing
 * artifacts at all is that CI tests the file that will be published. Building
 * them in CI instead would test one artifact while `npm publish` shipped
 * another, since CC-CEDICT is a rolling file with no version — see
 * DATA-PIPELINE.md.
 */
class Tier {
  readonly #lines: readonly string[];

  #keys?: readonly string[];

  #defaults?: ReadonlyMap<string, string>;

  readonly index: KeyIndex;

  /**
   * Read one tier's artifact files.
   */
  constructor(tier: string) {
    const read = (suffix: string): string =>
      readFileSync(
        fileURLToPath(new URL(`../../data/${tier}.${suffix}`, import.meta.url)),
        "utf8",
      );
    this.index = KeyIndex.from(read("keys"));
    this.#lines = read("entries").split("\n");
  }

  /**
   * Every key, in index order.
   *
   * The index is built for lookup rather than for iteration — `keyAt` slices a
   * fresh string every call — so a sweep over all of them takes them once.
   * Built on demand, since only the sweep wants it.
   */
  get keys(): readonly string[] {
    this.#keys ??= this.index.serialise().split("\n");
    return this.#keys;
  }

  /**
   * What each single character stores, which is what a derived reading is made
   * of.
   *
   * Also built on demand, and for the same reason the artifact has the
   * characters at all: resolving one derived reading means reading its
   * characters, and doing that through the index costs a binary search per
   * character.
   */
  get defaults(): ReadonlyMap<string, string> {
    if (this.#defaults === undefined) {
      const defaults = new Map<string, string>();
      for (const [at, key] of this.keys.entries()) {
        // A character is one UTF-16 code unit, or two for a surrogate pair.
        // The length test alone settles all but a handful, and it is what
        // keeps this off the regex in `toCharacters` for 723,147 keys.
        if (key.length <= 2 && isSingleCharacter(key)) {
          defaults.set(key, this.storedReadingAt(at));
        }
      }
      this.#defaults = defaults;
    }
    return this.#defaults;
  }

  /**
   * The columns recorded for a key, or undefined when it is not a key.
   */
  columns(word: string): readonly string[] | undefined {
    const found = this.index.lookup(word);
    if (!found.isKey) {
      return undefined;
    }
    return (this.#lines[found.index] ?? "").split("\t");
  }

  /**
   * The reading column at a position, empty where the line derives it.
   */
  storedReadingAt(at: number): string {
    const line = this.#lines[at] ?? "";
    const end = line.indexOf("\t");
    return end === -1 ? line : line.slice(0, end);
  }

  /**
   * The reading at a position, in the tone-numbered notation of the file.
   *
   * The stored notation rather than the tone-marked one {@link Tier.reading}
   * returns, because comparing two tiers is comparing what is on disk: equal
   * here is equal byte for byte, with no decoding in between to agree about.
   */
  readingAt(at: number): string {
    const stored = this.storedReadingAt(at);
    if (stored !== "") {
      return stored;
    }
    return toCharacters(this.keys[at] ?? "")
      .map((character) => this.defaults.get(character) ?? "")
      .join(" ");
  }

  /**
   * A word's reading, in tone-marked notation.
   *
   * Rebuilds a derivable reading from its characters' defaults, which is how
   * 87.8% of multi-character entries are stored: as nothing at all.
   */
  reading(word: string): string | undefined {
    const columns = this.columns(word);
    if (columns === undefined) {
      return undefined;
    }
    const stored = columns[0] ?? "";
    const encoded =
      stored === ""
        ? toCharacters(word)
            .map((character) => this.columns(character)?.[0] ?? "")
            .join(" ")
        : stored;
    return decodeReading(encoded)
      ?.map((syllable) => writeSyllable(syllable))
      .join(" ");
  }

  /**
   * A word's 國語 reading, or undefined where it takes the 普通话 one.
   *
   * Never derived from the characters the way {@link Tier.reading} is: the
   * zh-TW column is a delta, and an absent one means the locales agree.
   */
  taiwanReading(word: string): string | undefined {
    return decodeReading(this.columns(word)?.[1] ?? "")
      ?.map((syllable) => writeSyllable(syllable))
      .join(" ");
  }
}

const full = new Tier("full");
const core = new Tier("core");
const standard = new Tier("standard");

describe("the committed dictionary", () => {
  describe("the golden cases, read back off disk", () => {
    it("repairs 儿化 from CC-CEDICT's r5", () => {
      assertIdentical(full.reading("玩儿"), "wánr");
      assertIdentical(full.reading("这儿"), "zhèr");
    });

    it("leaves 儿 its own syllable where it is the word", () => {
      assertIdentical(full.reading("女儿"), "nǚ ér");
      assertIdentical(full.reading("儿子"), "ér zi");
    });

    it("stores underlying tones, with 一 and 不 sandhi normalised out", () => {
      // The runtime sandhi pass turns this into `yì dīng bù shí`; the stored
      // form is deliberately the other one. See MERGE.md.
      assertIdentical(full.reading("一丁不识"), "yī dīng bù shí");
      assertIdentical(full.reading("一不小心"), "yī bù xiǎo xīn");
    });

    it("applies the override table", () => {
      assertIdentical(full.reading("大夫"), "dài fu");
    });

    it("keeps the polyphone collocations apart", () => {
      assertIdentical(full.reading("银行"), "yín háng");
      assertIdentical(full.reading("行长"), "háng zhǎng");
      assertIdentical(full.reading("重复"), "chóng fù");
      assertIdentical(full.reading("会计"), "kuài jì");
    });

    it("takes CC-CEDICT's neutral tones", () => {
      assertIdentical(full.reading("头发"), "tóu fa");
      assertIdentical(full.reading("还是"), "hái shi");
    });

    it("keys 繁體 directly, derived using the reading", () => {
      assertIdentical(full.reading("頭髮"), "tóu fa");
      assertIdentical(full.reading("銀行"), "yín háng");
    });

    it("keys every 繁體 spelling a source writes, not just the first", () => {
      // 台湾 is written both ways and both are current; so is 下面, where the
      // second spelling is the noodles rather than the surface.
      assertIdentical(full.reading("臺灣"), "tái wān");
      assertIdentical(full.reading("台灣"), "tái wān");
      assertIdentical(full.reading("下麵"), "xià miàn");
      assertIdentical(full.reading("下面"), "xià miàn");
    });

    it("marks a proper noun from jieba's tag", () => {
      const columns = full.columns("北京");
      assertNonNullable(columns);
      assertIdentical(columns[2], "ns");
      assertIdentical(columns[3], "p");
    });

    it("carries a zh-TW reading where the locales differ", () => {
      assertIdentical(full.taiwanReading("垃圾"), "lè sè");
    });

    it("carries it on the compounds too, in both scripts", () => {
      // CC-CEDICT marks 垃圾 and 垃圾桶 and stops there, so every other compound
      // used to fall back to the 普通话 reading and the locale switch looked
      // broken on them. Composed from the constituent instead — see locale.ts.
      assertIdentical(full.taiwanReading("垃圾分類"), "lè sè fēn lèi");
      assertIdentical(full.taiwanReading("垃圾分类"), "lè sè fēn lèi");
      assertIdentical(full.reading("垃圾分類"), "lā jī fēn lèi");
      assertIdentical(full.taiwanReading("太空垃圾"), "tài kōng lè sè");
      assertIdentical(full.taiwanReading("垃圾車"), "lè sè chē");
    });

    it("composes from a word and never from a bare character", () => {
      // 从容 is a word with a marked reading, so 从容地 takes it. 會 still
      // carries `huǐ` and would turn 三合會 into `sānhéhuǐ` if characters could
      // contribute — 3,743 entries would compose that way against the 101 that
      // words compose.
      assertIdentical(full.taiwanReading("从容地"), "cōng róng de");
      assertUndefined(full.taiwanReading("一个个地"));
      assertUndefined(full.taiwanReading("三合会"));
    });

    it("refuses a delta that is another 普通话 sense of the same word", () => {
      // CC-CEDICT lists 地[de5] and 地[di4] both, so `dì` is what 地 reads in
      // 普通话 when it means the ground — not what 國語 does to the particle.
      // Storing it made every adverb in 地 read `dì` under zh-TW.
      assertUndefined(full.taiwanReading("地"));
      assertUndefined(full.taiwanReading("都"));
      assertUndefined(full.taiwanReading("着"));
      // The same test reaches a 繁體 headword whose senses are filed under the
      // 简体 forms they simplify to: 沈 is `chén` under 沉, 誰 `shéi` under 谁.
      assertUndefined(full.taiwanReading("沈"));
      assertUndefined(full.taiwanReading("誰"));
      // A real delta leaves no such trace. Nothing in 普通话 reads 和 `hàn`,
      // 期 `qí` or 垃 `lè`.
      assertIdentical(full.taiwanReading("和"), "hàn");
      assertIdentical(full.taiwanReading("期"), "qí");
      assertIdentical(full.taiwanReading("垃"), "lè");
    });

    it("takes the note from a sense that reads the way the entry does", () => {
      // CC-CEDICT hangs `Taiwan pr. [zhuo2]` on 著's chess-move sense, which
      // reads `zhāo`, and `Taiwan pr. [cheng4]` on 稱's `chèn` sense. Reaching
      // across for either described a different word.
      assertUndefined(full.taiwanReading("称"));
      // 髮 keeps its own `fǎ`, and 发 — the 發 that reads `fā` — is left alone.
      assertIdentical(full.taiwanReading("髮"), "fǎ");
      assertUndefined(full.taiwanReading("发"));
    });

    it("leaves a compound the segmentation cuts elsewhere alone", () => {
      // 运行状况 contains the marked word 行状, but reads 运行 + 状况.
      assertUndefined(full.taiwanReading("运行状况"));
      // 皮夹克 is 皮 + 夹克, not the wallet 皮夹.
      assertUndefined(full.taiwanReading("皮夹克"));
      // A homograph no alignment check can see: this 相亲 is the reciprocal
      // one, so it is excluded by name.
      assertUndefined(full.taiwanReading("相亲相爱"));
    });

    it("carries polyphone priors on a character", () => {
      const columns = full.columns("行");
      assertNonNullable(columns);
      assertIdentical(columns[0], "xing2");
      assertNonNullable(columns[4]);
      assertArrayIncludes(columns[4].split(","), "hang2");
    });
  });

  describe("the index", () => {
    it("holds both scripts as keys", () => {
      assertTrue(full.index.has("头发"));
      assertTrue(full.index.has("頭髮"));
    });

    it("answers prefix queries, which is what the lattice needs", () => {
      assertTrue(full.index.hasPrefix("银"));
      assertFalse(full.index.hasPrefix("银行行行行"));
    });

    it("holds the whole merge", () => {
      // Both scripts of 461,555 entries, minus the ones whose scripts agree.
      assertNumberBetween(full.index.size, 700_000, 750_000);
    });
  });

  describe("the curated 成语 list", () => {
    it("lists only words the dictionary holds, in both scripts", () => {
      // A hand-written 繁體 spelling that is not a real word would simply never
      // fire, and nothing else would notice.
      assertArrayEquals(
        HYPHENATED_IDIOMS.filter(
          (idiom) => !full.index.has(idiom.hans) || !full.index.has(idiom.hant),
        ).map((idiom) => `${idiom.hans}/${idiom.hant}`),
        [],
      );
    });

    it("pairs each 简体 entry with the 繁體 one that reads the same", () => {
      for (const idiom of HYPHENATED_IDIOMS) {
        assertIdentical(full.reading(idiom.hant), full.reading(idiom.hans));
      }
    });

    it("lists nothing whose reading is not four syllables", () => {
      // The hyphen is written between the second and third, so a reading that
      // is not one syllable per character cannot take one.
      assertArrayEquals(
        HYPHENATED_IDIOMS.filter(
          (idiom) => (full.reading(idiom.hans) ?? "").split(" ").length !== 4,
        ).map((idiom) => idiom.hans),
        [],
      );
    });
  });

  describe("the tiers", () => {
    it("nests, so a browser can load them in order", () => {
      for (let at = 0; at < core.index.size; at += 97) {
        const key = core.index.keyAt(at);
        assertTrue(standard.index.has(key));
        assertTrue(full.index.has(key));
      }
    });

    it("gives every tier the characters words are written with", () => {
      for (const tier of [core, standard, full]) {
        assertIdentical(tier.reading("银"), "yín");
        assertIdentical(tier.reading("行"), "xíng");
      }
    });

    it("holds a rare character some other entry claims the key of", () => {
      // 卒 is attested with the 繁體 spelling 䘚, so every tier is keyed for 䘚
      // whether or not it holds 䘚's own entry. Read as a spelling of 卒 it is
      // `zú` and read as itself Unihan gives it `zhú`; a tier that answers the
      // first while full answers the second contradicts itself as the larger
      // tier lands, which is what the documented upgrade path cannot survive.
      for (const tier of [core, standard, full]) {
        assertIdentical(tier.reading("䘚"), "zhú");
        assertIdentical(tier.reading("卒"), "zú");
      }
    });

    // Every key in both smaller tiers, resolved the way the loader resolves
    // it. Sampling would not do instead: the keys this is here to catch were
    // 48 of 114,974, and a sample that steps over them proves nothing. The
    // build makes the same check, but the build is not what CI runs — these
    // are the artifacts that get published.
    //
    // Both key lists are sorted the same way and the tiers nest, so this walks
    // them together rather than searching full for each key: one pointer that
    // only ever moves forward, against 114,974 binary searches through 723,147
    // keys and a further search per character of every derived reading. That
    // is the difference between about 50 ms and about 700 ms, and 700 ms on a
    // laptop was enough to time out on a CI runner.
    const WHOLE_INDEX_TIMEOUT = 10_000;

    it(
      "reads every key it shares with full the way full reads it",
      () => {
        const disagreements: string[] = [];
        for (const tier of [core, standard]) {
          let there = 0;
          for (const [here, key] of tier.keys.entries()) {
            let ahead = full.keys[there];
            while (ahead !== undefined && ahead < key) {
              there++;
              ahead = full.keys[there];
            }
            if (ahead !== key) {
              disagreements.push(`${key} is not a key in full`);
            } else if (tier.readingAt(here) !== full.readingAt(there)) {
              disagreements.push(
                `${key} reads ${tier.readingAt(here)}, full reads ${full.readingAt(there)}`,
              );
            }
          }
        }
        assertArrayEquals(disagreements, []);
      },
      WHOLE_INDEX_TIMEOUT,
    );

    it("keeps the phrase tail out of the smaller tiers", () => {
      assertFalse(core.index.has("银行"));
      assertTrue(standard.index.has("银行"));
    });

    it("names every tier in the artifact set", () => {
      assertArrayLength(TIERS, 3);
    });
  });
});
