import {
  dictionaryOf,
  entry,
  reading,
  sampleDictionary,
} from "#test/fixtures/decoder-dictionary.js";
import {
  assertArrayLength,
  assertIdentical,
  assertNonNullable,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { match } from "./match.js";

const dictionary = sampleDictionary();

/**
 * Where a query matched, each range as `at+length`, or the empty string.
 */
function ranges(haystack: string, query: string): string {
  return (match(dictionary, haystack, query)?.ranges ?? [])
    .map((range) => `${String(range.at)}+${String(range.length)}`)
    .join(" ");
}

/**
 * What a match scored, for the assertions about ranking.
 */
function score(haystack: string, query: string): number {
  const found = match(dictionary, haystack, query);
  assertNonNullable(found, `${haystack} does not match ${query}`);
  return found.score;
}

describe("matching a query against a text", () => {
  it("matches full syllables written out", () => {
    assertIdentical(ranges("北京", "beijing"), "0+2");
  });

  it("matches full syllables written apart", () => {
    assertIdentical(ranges("北京", "bei jing"), "0+2");
  });

  it("matches initials", () => {
    assertIdentical(ranges("北京", "bj"), "0+2");
    assertIdentical(ranges("北京市", "bjs"), "0+3");
  });

  it("matches the two mixed, either way round", () => {
    assertIdentical(ranges("北京", "beij"), "0+2");
    assertIdentical(ranges("北京", "bjing"), "0+2");
  });

  it("matches a query still being typed, letter by letter", () => {
    // And covers what has been typed rather than what it will become: 京 is
    // not matched until the query reaches it, so a highlight grows as the
    // typing does.
    const typed = [
      ["b", "0+1"],
      ["be", "0+1"],
      ["bei", "0+1"],
      ["beij", "0+2"],
      ["beiji", "0+2"],
      ["beijing", "0+2"],
    ] as const;
    for (const [query, expected] of typed) {
      assertIdentical(ranges("北京", query), expected, query);
    }
  });

  it("takes a tone written as a digit, and holds the query to it", () => {
    assertIdentical(ranges("北京", "bei3jing1"), "0+2");
    // 北 is běi, so a query saying first tone is asking for something else.
    assertIdentical(ranges("北京", "bei1jing1"), "");
  });

  it("returns undefined where nothing matches", () => {
    assertUndefined(match(dictionary, "北京", "nanjing"));
    assertUndefined(match(dictionary, "北京", "qqq"));
    // A query longer than anything the text can spell.
    assertUndefined(match(dictionary, "北京", "beijingdaxue"));
  });

  it("returns undefined for an empty query or an empty text", () => {
    assertUndefined(match(dictionary, "北京", ""));
    assertUndefined(match(dictionary, "北京", "   "));
    assertUndefined(match(dictionary, "", "bj"));
  });

  it("matches text it cannot read as nothing at all", () => {
    assertUndefined(match(dictionary, "hello world", "bj"));
  });

  it("counts positions in code points", () => {
    // 𠮷 is two UTF-16 units and one character, and a range counting units
    // would send a caller's highlight through the middle of it.
    assertIdentical(ranges("𠮷北京", "bj"), "1+2");
  });
});

describe("matching over what the text writes between characters", () => {
  it("steps over a character with no reading of its own", () => {
    assertIdentical(ranges("北 京", "bj"), "0+1 2+1");
  });

  it("reports what was matched rather than what was spanned", () => {
    assertIdentical(ranges("银hello行", "yh"), "0+1 6+1");
  });

  it("never ends a match on something it only stepped over", () => {
    assertIdentical(ranges("北。", "b"), "0+1");
  });

  it("gives nothing back where stepping over leads nowhere either", () => {
    assertUndefined(match(dictionary, "银hello行", "yq"));
  });

  it("will not step over a character it can read", () => {
    // 京 has a reading, so a query that does not account for it has not
    // matched 北 and 市 either side of it.
    assertIdentical(ranges("北京市", "bs"), "");
  });
});

describe("matching every reading a character has", () => {
  it("matches a polyphone by either of its readings", () => {
    assertIdentical(ranges("银行", "yh"), "0+2");
    assertIdentical(ranges("银行", "yx"), "0+2");
  });

  it("ranks the reading the text takes above the one it does not", () => {
    // The whole point: 银行 is yínháng here, and `yx` has found a reading 行
    // has rather than the reading it has in this word.
    assertTrue(score("银行", "yh") > score("银行", "yx"));
    assertTrue(score("行长", "hz") > score("行长", "xz"));
  });

  it("matches a character's 國語 reading as well as its 普通话 one", () => {
    // 圾 is jī in 普通话 and sè in 國語, and somebody typing what they say has
    // not typed it wrongly. The reading in context still ranks above it.
    const both = dictionaryOf([
      entry("垃", "lā", { readings: { cn: reading("lā"), tw: reading("lè") } }),
      entry("圾", "jī", { readings: { cn: reading("jī"), tw: reading("sè") } }),
    ]);
    const taiwan = match(both, "垃圾", "lese");
    const mainland = match(both, "垃圾", "laji");
    assertNonNullable(taiwan);
    assertNonNullable(mainland);
    assertArrayLength(taiwan.ranges, 1);
    assertTrue(mainland.score > taiwan.score);
  });

  it("prefers the likelier reading where the text says nothing", () => {
    // 行 standing alone is xíng, and both queries match it. Nothing here has
    // settled anything, so the dictionary's own order is what is left.
    assertTrue(score("行", "x") > score("行", "h"));
  });
});

describe("ranking one match against another", () => {
  it("ranks a match that starts a word above one inside a word", () => {
    // Both start at the second character, both spell it as the text reads it,
    // and only one of them starts where a word starts: 长大 is a word of
    // 行长大, where 京市 is the tail of 北京市.
    assertIdentical(score("行长大", "zd") - score("北京市", "js"), 2);
  });

  it("ranks an earlier match above a later one", () => {
    assertTrue(score("北京", "bj") > score("𠮷北京", "bj"));
  });

  it("takes the earliest of two matches worth the same", () => {
    assertIdentical(ranges("北京北京", "bj"), "0+2");
  });

  it("scores a whole word, read as the text reads it, at the top", () => {
    // The scale is worth pinning: 4 for reading it the way the text does, 2
    // for starting a word, and 1 for starting the text.
    assertIdentical(score("北京", "bj"), 7);
  });
});

describe("matching where a reading is not one syllable per character", () => {
  it("takes the r of 儿化 onto the syllable in front of it", () => {
    // 玩儿 is wánr, one syllable over two characters, and `wanr` is what
    // somebody looking for it types. Both characters are matched, since the
    // one syllable is how both of them are read.
    assertIdentical(ranges("玩儿", "wanr"), "0+2");
    assertIdentical(ranges("去玩儿吧", "wanr"), "1+2");
  });

  it("matches the characters as themselves as well", () => {
    // 玩 is wán and 儿 is ér, which is what somebody who did not think of it
    // as 儿化 writes — and it is the reading in context that ranks them.
    assertIdentical(ranges("玩儿", "we"), "0+2");
    assertIdentical(ranges("玩儿", "wane"), "0+2");
    assertTrue(score("玩儿", "wanr") > score("玩儿", "we"));
    assertTrue(score("玩儿", "we") > score("玩儿", "wane"));
  });

  it("stops at the syllable the query stopped at", () => {
    // `wan` has not reached the r yet, so the 儿 is not marked yet either.
    assertIdentical(ranges("玩儿", "wan"), "0+1");
  });

  it("matches a character read as more than one syllable", () => {
    // 瓩 is one character and `qiānwǎ`, so the query accounts for its syllables
    // in order — and may run out between them, which is a query still typing.
    const kilowatt = dictionaryOf([entry("瓩", "qiān wǎ")]);
    for (const query of ["qianwa", "qian", "qw", "q"]) {
      assertArrayLength(match(kilowatt, "瓩", query)?.ranges ?? [], 1, query);
    }
    assertUndefined(match(kilowatt, "瓩", "qianwan"));
  });

  it("scores the word's own reading at the top, as it does anywhere", () => {
    // 4 for reading it the way the text reads it, 2 for starting a word, 1 for
    // starting the text — the same scale as any other whole-word match.
    assertIdentical(score("玩儿", "wanr"), 7);
    // Half of `we` reads as the text reads it: 玩 could be the wánr, and the
    // 儿 written as `e` could not.
    assertIdentical(score("玩儿", "we"), 5);
  });
});
