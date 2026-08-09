import {
  dictionaryOf,
  entry,
  SAMPLE_ENTRIES,
  sampleDictionary,
} from "#test/fixtures/decoder-dictionary.js";
import {
  assertArrayEquals,
  assertArrayLength,
  assertIdentical,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { buildArtifact } from "../dictionary/artifact.js";
import { Dictionary } from "../dictionary/dictionary.js";
import { readingKey, ReverseIndex } from "./reverse-index.js";

const dictionary = sampleDictionary();
const index = ReverseIndex.of(dictionary);

/**
 * The words a reading key reaches, in the order the index holds them.
 */
function words(key: string): readonly string[] {
  return [...index.positionsFor(key)].map((at) => dictionary.wordAt(at));
}

describe("deriving a reverse index", () => {
  describe("readingKey", () => {
    it("drops the spaces, since nobody types them", () => {
      assertIdentical(readingKey("yin2 hang2"), "yinhang");
    });

    it("drops the tone, since the index is keyed toneless", () => {
      assertIdentical(readingKey("shi4"), "shi");
      assertIdentical(readingKey("xi5"), "xi");
    });

    it("writes ü as u, since lu and lv both have to reach 绿", () => {
      assertIdentical(readingKey("lü4 se4"), "luse");
    });

    it("keeps the r of 儿化, which is a letter a typist writes", () => {
      assertIdentical(readingKey("wanr2"), "wanr");
    });
  });

  describe("the groups", () => {
    it("puts every key under the reading it is read by", () => {
      assertArrayEquals(words("yinhang"), ["銀行", "银行"]);
    });

    it("keys both scripts, since both are dictionary keys", () => {
      assertTrue(words("wanr").includes("玩儿"));
      assertTrue(words("wanr").includes("玩兒"));
    });

    it("groups a word whose reading its line does not store", () => {
      // 长大 stores no reading at all: it is exactly its characters' defaults.
      assertArrayEquals(words("zhangda"), ["长大"]);
    });

    it("counts one key for each distinct reading", () => {
      const readings = new Set<string>();
      for (let at = 0; at < dictionary.size; at++) {
        readings.add(readingKey(dictionary.readingsInOrder().readingAt(at)));
      }
      // `ReverseIndex.size` counts keys and is a plain number getter; the
      // rule's Map and Set assertions do not apply to it.
      assertIdentical(index.size, readings.size);
    });

    it("gives nothing for a reading nothing has", () => {
      assertArrayLength([...index.positionsFor("nanjing")], 0);
    });

    it("gives nothing for the empty key", () => {
      assertArrayLength([...index.positionsFor("")], 0);
    });

    it("orders each group likeliest first", () => {
      // 是 sorts after 市 by code unit and comes back first anyway, because a
      // posting is a position and a position indexes the frequency table.
      const ranked = ReverseIndex.of(
        dictionaryOf([
          entry("市", "shì", { frequency: 400 }),
          entry("是", "shì", { frequency: 900_000 }),
          entry("事", "shì", { frequency: 40_000 }),
        ]),
      );
      assertArrayEquals(
        [...ranked.positionsFor("shi")].map((at) =>
          ranked.dictionary.wordAt(at),
        ),
        ["是", "事", "市"],
      );
    });

    it("keeps key order between words of the same frequency", () => {
      // The counting sort is stable, so a group whose words are all equally
      // rare comes back in the order the dictionary holds them rather than in
      // whatever order the fill pass happened to lay down.
      const flat = ReverseIndex.of(
        dictionaryOf([
          entry("北", "běi"),
          entry("背", "běi"),
          entry("贝", "běi"),
        ]),
      );
      assertArrayEquals(
        [...flat.positionsFor("bei")],
        [...flat.positionsFor("bei")].toSorted((left, right) => left - right),
      );
    });
  });

  describe("building it a slice at a time", () => {
    it("reaches the same index as building it in one go", () => {
      const build = ReverseIndex.building(dictionary);
      let stepped = build.step(1);
      let steps = 1;
      while (stepped === undefined) {
        stepped = build.step(1);
        steps++;
      }
      assertTrue(steps > dictionary.size, "a step of one key did the lot");
      assertIdentical(stepped.serialise().keys, index.serialise().keys);
      assertArrayEquals(
        [...stepped.serialise().postings],
        [...index.serialise().postings],
      );
      assertArrayEquals(
        [...stepped.serialise().starts],
        [...index.serialise().starts],
      );
    });

    it("reports progress that only ever goes up, and reaches 1", () => {
      const build = ReverseIndex.building(dictionary);
      let progress = build.progress;
      assertIdentical(progress, 0);
      while (build.step(7) === undefined) {
        assertTrue(build.progress >= progress, "progress went backwards");
        progress = build.progress;
      }
      assertIdentical(build.progress, 1);
    });
  });

  describe("handing it between threads", () => {
    it("wraps what a worker posted back", () => {
      const posted = ReverseIndex.from(dictionary, index.serialise());
      assertArrayEquals(
        [...posted.positionsFor("yinhang")],
        [...index.positionsFor("yinhang")],
      );
    });
  });

  it("derives nothing from an empty dictionary", () => {
    const empty = ReverseIndex.of(Dictionary.from(buildArtifact([])));
    // `ReverseIndex.size` counts keys and is a plain number getter; the rule's
    // Map and Set assertions do not apply to it.
    assertIdentical(empty.size, 0);
    assertArrayLength([...empty.positionsFor("shi")], 0);
  });

  it("skips a key it cannot recover a reading for", () => {
    // A word whose characters are not themselves keys and whose line stores
    // nothing has no reading to be indexed under, and is left out rather than
    // grouped under the empty key.
    const stripped = Dictionary.from({
      ...buildArtifact([entry("银行", "yín háng")]),
      entries: "",
    });
    const derived = ReverseIndex.of(stripped);
    // `ReverseIndex.size` counts keys and is a plain number getter; the rule's
    // Map and Set assertions do not apply to it.
    assertIdentical(derived.size, 0);
  });

  it("names the dictionary it was derived from", () => {
    assertIdentical(index.dictionary, dictionary);
    assertIdentical(index.dictionary.size, SAMPLE_ENTRIES.length + 3);
  });
});
