import {
  assertArrayEquals,
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertNonNullable,
  assertStringIncludes,
  assertStringStartsWith,
  assertThrowsErrorLike,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import {
  readSyllable,
  type Syllable,
  writeSyllable,
} from "../syllable/syllable.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import {
  buildArtifact,
  decodeReading,
  encodeReading,
  readArtifact,
  readingsByKey,
  findRoundTripFailure,
} from "./artifact.js";
import type { DictionaryArtifact } from "./artifact.js";
import type { DictionaryEntry } from "./entry.js";
import { KeyIndex } from "./key-index.js";

/**
 * Read a space-separated reading, the way a source dictionary is read.
 *
 * An unwritten tone becomes the neutral tone, as it does everywhere in the
 * pipeline: a merged entry's syllables are always fully toned, so `fa` here
 * means 轻声 rather than a tone nobody wrote.
 */
function reading(text: string): readonly Syllable[] {
  return text.split(" ").map((token) => {
    const syllable = readSyllable(token);
    if (syllable === undefined) {
      throw new Error(`not a syllable: ${token}`);
    }
    return { ...syllable, tone: syllable.tone ?? NEUTRAL_TONE };
  });
}

/**
 * An entry, with the fields these tests care about.
 */
function entry(
  hans: string,
  cn: string,
  extra: Partial<DictionaryEntry> = {},
): DictionaryEntry {
  return {
    hans,
    hant: hans,
    readings: { cn: reading(cn) },
    frequency: 0,
    partOfSpeech: "",
    isProperNoun: false,
    ...extra,
  };
}

/**
 * Characters plus two words: 中国 reads as its characters' defaults, 头发 does
 * not.
 */
const ENTRIES: readonly DictionaryEntry[] = [
  entry("中", "zhōng"),
  entry("国", "guó", { hant: "國" }),
  entry("头", "tóu", { hant: "頭" }),
  entry("发", "fā", { hant: "發", alternates: [reading("fà")] }),
  entry("中国", "zhōng guó", {
    hant: "中國",
    partOfSpeech: "ns",
    isProperNoun: true,
    frequency: 129_470,
  }),
  entry("头发", "tóu fa", { hant: "頭髮", partOfSpeech: "n" }),
];

/**
 * The entry an artifact reads back for a key.
 */
function entryFor(artifact: DictionaryArtifact, key: string): DictionaryEntry {
  const at = KeyIndex.from(artifact.keys).lookup(key).index;
  const found = readArtifact(artifact)[at];
  assertNonNullable(found);
  return found;
}

/**
 * The line the artifact holds for a key.
 */
function lineFor(key: string, entries = ENTRIES): string {
  const artifact = buildArtifact(entries);
  const index = KeyIndex.from(artifact.keys);
  return artifact.entries.split("\n")[index.lookup(key).index] ?? "";
}

describe("dictionary artifacts", () => {
  describe("reading notation", () => {
    it("writes tone numbers, which are ASCII and survive any encoding", () => {
      assertIdentical(encodeReading(reading("tóu fa")), "tou2 fa5");
    });

    it("writes 儿化 as an r suffix", () => {
      assertIdentical(encodeReading(reading("wánr")), "wanr2");
    });

    it("reads a reading back", () => {
      assertArrayEquals(
        (decodeReading("tou2 fa5") ?? []).map((s) => writeSyllable(s)),
        ["tóu", "fa"],
      );
    });

    it("round-trips 儿化", () => {
      assertTrue(decodeReading("wanr2")?.[0]?.erhua === true);
    });

    it("reads nothing from an empty string", () => {
      assertUndefined(decodeReading(""));
    });

    it("reads nothing when a syllable is malformed", () => {
      assertUndefined(decodeReading("tou2 fx9"));
    });
  });

  describe("building", () => {
    it("keys both scripts into the same artifact", () => {
      const index = KeyIndex.from(buildArtifact(ENTRIES).keys);
      assertTrue(index.has("头发"));
      assertTrue(index.has("頭髮"));
    });

    it("writes one line per key", () => {
      const artifact = buildArtifact(ENTRIES);
      assertArrayLength(
        artifact.entries.split("\n"),
        KeyIndex.from(artifact.keys).size,
      );
    });

    it("stores no reading for a word that is its characters' defaults", () => {
      // 中国 is zhōng + guó, exactly what 中 and 国 read on their own.
      assertStringIncludes(`${lineFor("中国")}|`, "\tns\tp|");
      assertStringStartsWith(lineFor("中国"), "\t");
    });

    it("stores the reading for a word that is not", () => {
      // 头发 is tóu fa, where 发 alone is fā.
      assertStringStartsWith(lineFor("头发"), "tou2 fa5\t");
    });

    it("always stores a single character's reading, which cannot be derived", () => {
      assertStringStartsWith(lineFor("中"), "zhong1");
    });

    it("marks a proper noun", () => {
      assertStringIncludes(lineFor("中国"), "\tp");
    });

    it("stores a character's other readings", () => {
      assertStringIncludes(lineFor("发"), "fa4");
    });

    it("stores a zh-TW reading only when it differs", () => {
      const withTaiwan = [
        entry("垃圾", "lā jī", {
          readings: { cn: reading("lā jī"), tw: reading("lè sè") },
        }),
      ];
      assertStringIncludes(lineFor("垃圾", withTaiwan), "le4 se4");
    });

    it("trims trailing empty columns, which is most lines", () => {
      assertFalse(lineFor("头").endsWith("\t"));
    });
  });

  describe("key conflicts", () => {
    /**
     * 发 and 髮 both claim the key 发 — and unlike 头/頭 they disagree, one
     * reading fā and the other fà.
     */
    const contested: readonly DictionaryEntry[] = [
      entry("发", "fā", { hant: "發", frequency: 5000 }),
      entry("髮", "fà", { hant: "髮" }),
    ];

    it("gives a key to the entry whose own headword it is", () => {
      const found = entryFor(buildArtifact(contested), "发");
      assertIdentical(encodeReading(found.readings.cn), "fa1");
    });

    it("leaves the other entry on its own key", () => {
      const found = entryFor(buildArtifact(contested), "髮");
      assertIdentical(encodeReading(found.readings.cn), "fa4");
    });

    it("lets a character keep its own key against a 繁體 alias", () => {
      // 头 claims 頭 as its 繁體 key, and 頭 is a character entry of its own.
      // They agree here, but the entry named by the key must still win.
      const both: readonly DictionaryEntry[] = [
        entry("头", "tóu", { hant: "頭", frequency: 9000 }),
        entry("頭", "tóu"),
      ];
      const artifact = buildArtifact(both);
      assertArrayLength(artifact.entries.split("\n"), 2);
      assertIdentical(
        encodeReading(entryFor(artifact, "頭").readings.cn),
        "tou2",
      );
    });

    it("keys a second 繁體 spelling on the same entry", () => {
      const artifact = buildArtifact([
        ...ENTRIES,
        entry("台湾", "tái wān", { hant: "台灣", hantVariants: ["臺灣"] }),
      ]);
      assertIdentical(
        encodeReading(entryFor(artifact, "臺灣").readings.cn),
        "tai2 wan1",
      );
      assertIdentical(
        encodeReading(entryFor(artifact, "台灣").readings.cn),
        "tai2 wan1",
      );
    });

    it("lets an entry keep its own key against a second spelling", () => {
      // A variant spelling reaches a key sideways just as a 繁體 form does, so
      // it must not displace the entry that key names.
      const both: readonly DictionaryEntry[] = [
        entry("干", "gān", {
          hant: "乾",
          hantVariants: ["幹"],
          frequency: 9000,
        }),
        entry("幹", "gàn"),
      ];
      const found = entryFor(buildArtifact(both), "幹");
      assertIdentical(encodeReading(found.readings.cn), "gan4");
    });

    it("prefers the commoner entry when neither owns the key", () => {
      const aliases: readonly DictionaryEntry[] = [
        entry("甲", "jiǎ", { hant: "共", frequency: 10 }),
        entry("乙", "yǐ", { hant: "共", frequency: 900 }),
      ];
      const found = entryFor(buildArtifact(aliases), "共");
      assertIdentical(encodeReading(found.readings.cn), "yi3");
    });
  });

  describe("reading back", () => {
    it("recovers every reading, derived ones included", () => {
      const found = entryFor(buildArtifact(ENTRIES), "中国");
      assertIdentical(encodeReading(found.readings.cn), "zhong1 guo2");
    });

    it("recovers a stored reading", () => {
      const found = entryFor(buildArtifact(ENTRIES), "头发");
      assertIdentical(encodeReading(found.readings.cn), "tou2 fa5");
    });

    it("recovers the part of speech and the proper noun bit", () => {
      const found = entryFor(buildArtifact(ENTRIES), "中国");
      assertIdentical(found.partOfSpeech, "ns");
      assertTrue(found.isProperNoun);
    });

    it("recovers a character's other readings", () => {
      const found = entryFor(buildArtifact(ENTRIES), "发");
      assertIdentical(encodeReading(found.alternates?.[0] ?? []), "fa4");
    });

    it("recovers a zh-TW reading", () => {
      const withTaiwan = [
        entry("垃圾", "lā jī", {
          readings: { cn: reading("lā jī"), tw: reading("lè sè") },
        }),
      ];
      const found = entryFor(buildArtifact(withTaiwan), "垃圾");
      assertIdentical(encodeReading(found.readings.tw ?? []), "le4 se4");
    });

    it("reports a key as both scripts, since pairing is not stored", () => {
      const found = entryFor(buildArtifact(ENTRIES), "头发");
      assertIdentical(found.hans, "头发");
      assertIdentical(found.hant, "头发");
    });

    it("reads an empty artifact as nothing", () => {
      assertArrayLength(
        readArtifact({ keys: "", entries: "", frequencies: new Uint8Array() }),
        0,
      );
    });

    it("refuses an artifact whose reading cannot be read", () => {
      const error = assertThrowsErrorLike(() =>
        readArtifact({
          keys: "中",
          entries: "not-a-syllable",
          frequencies: new Uint8Array([0]),
        }),
      );
      assertStringIncludes(error.message, "no readable reading");
    });
  });

  describe("readingsByKey", () => {
    it("answers every key the artifact holds, in both scripts", () => {
      const artifact = buildArtifact(ENTRIES);
      const readings = readingsByKey(artifact);
      assertIdentical(readings.size, KeyIndex.from(artifact.keys).size);
      assertIdentical(readings.get("头发"), "tou2 fa5");
      assertIdentical(readings.get("頭髮"), "tou2 fa5");
    });

    it("resolves a reading the artifact stores as nothing at all", () => {
      // 中国 is its characters' defaults in order, so its line is empty and
      // the answer only exists once the characters have been read.
      assertIdentical(lineFor("中国").split("\t")[0], "");
      assertIdentical(
        readingsByKey(buildArtifact(ENTRIES)).get("中国"),
        "zhong1 guo2",
      );
    });

    it("resolves it from this artifact's characters, not another's", () => {
      // Which is what makes the build's comparison between tiers worth
      // running: an empty line means "the characters, in order", so two
      // artifacts that disagree about a character disagree about every derived
      // reading standing on it, without either line differing by a byte.
      const shifted = [
        entry("中", "zhòng"),
        entry("国", "guó", { hant: "國" }),
        entry("中国", "zhòng guó", { hant: "中國" }),
      ];
      assertIdentical(lineFor("中国", shifted).split("\t")[0], "");
      assertIdentical(
        readingsByKey(buildArtifact(shifted)).get("中国"),
        "zhong4 guo2",
      );
    });
  });

  describe("findRoundTripFailure", () => {
    it("confirms an artifact reads back as it was built", () => {
      assertUndefined(findRoundTripFailure(ENTRIES, buildArtifact(ENTRIES)));
    });

    it("names the key whose reading has drifted", () => {
      const artifact = buildArtifact(ENTRIES);
      const damaged = {
        ...artifact,
        entries: artifact.entries.replaceAll("tou2 fa5", "tou2 fa1"),
      };
      assertIdentical(findRoundTripFailure(ENTRIES, damaged), "头发");
    });

    it("names a key the artifact has lost", () => {
      const artifact = buildArtifact(ENTRIES);
      const keys = artifact.keys.split("\n");
      const lines = artifact.entries.split("\n");
      const dropped = keys.indexOf("头发");
      assertIdentical(
        findRoundTripFailure(ENTRIES, {
          ...artifact,
          keys: keys.toSpliced(dropped, 1).join("\n"),
          entries: lines.toSpliced(dropped, 1).join("\n"),
        }),
        "头发",
      );
    });
  });
});
