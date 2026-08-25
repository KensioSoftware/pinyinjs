# Dictionaries

A dictionary is the compiled word list conversion runs against. It is a
fetchable file, so loading one is asynchronous. Keeping it out of the module
graph keeps 10 MB of data out of your bundle.

```ts
import { convert, loadDictionary } from "@kensio/pinyinjs";
import { fileSource } from "@kensio/pinyinjs/node";

const dictionary = await loadDictionary(fileSource("./data"), "full");
convert(dictionary, "银行"); // "yínháng"
```

Load it once and keep it. It is immutable, safe to share across requests, and
decodes individual entries lazily. Building a second one repeats the work for no
gain.

## Sources

`loadDictionary(source, tier)` takes a `DictionarySource`, anything that can
fetch the artifacts by name. Two are provided.

**`fileSource(directory)`** reads from disk, and is the Node one. It lives at
`@kensio/pinyinjs/node`, away from the package root, so the browser path can
never reach a Node built-in:

```ts
import { fileSource } from "@kensio/pinyinjs/node";

const source = fileSource("node_modules/@kensio/pinyinjs/data");
```

**`fetchSource(baseUrl)`** fetches over HTTP, and is exported from the package
root:

```ts
import { fetchSource, loadDictionary } from "@kensio/pinyinjs";

const dictionary = await loadDictionary(fetchSource("/data"), "standard");
```

Serve the package's `data/` directory at that URL and leave the artifacts
uncompressed, letting HTTP `Content-Encoding: br` do the compressing.
`DecompressionStream` has no brotli. The transfer encoding is the only route to
a brotli-compressed artifact in a browser.

## Tiers

| Tier       | Entries | Download (brotli) | Contains               |
| ---------- | ------: | ----------------: | ---------------------- |
| `core`     |  16,970 |             70 KB | single characters only |
| `standard` |  66,970 |            377 KB | the most common words  |
| `full`     | 461,555 |          2,378 KB | every word             |

`full` is the default, and is what a server should use. 2.4 MB costs a server
little, and the extra words are exactly what stops a rare name being read
character by character.

In a browser the tiers are nested. You can start converting before the whole
thing has arrived:

```ts
let dictionary = await loadDictionary(fetchSource("/data"), "standard");
render(convert(dictionary, text));

dictionary = await loadDictionary(fetchSource("/data"), "full");
render(convert(dictionary, text)); // same text, better readings
```

`core` is single characters only. Word-based disambiguation is out of reach,
everything falls back on character priors, and both the readings and the spacing
suffer:

```ts
// core
convert(dictionary, "银行"); // "yín xíng"
convert(dictionary, "我要去北京。"); // "Wǒ yào qù běi jīng."

// standard or full
convert(dictionary, "银行"); // "yínháng"
convert(dictionary, "我要去北京。"); // "Wǒ yào qù Běijīng."
```

It is for the case where 70 KB is the budget and any pinyin beats none.

The entry counts above are dictionary entries. `dictionary.size` counts keys, a
larger number, because 繁體 spellings are keys in their own right. That is
16,976 for `core`, 97,998 for `standard`, and 723,147 for `full`.

## Querying directly

The dictionary answers questions on its own, and `convert` is only one caller.

```ts
const entry = dictionary.lookup("头发");
entry?.reading; // [{ initial: "t", final: "ou", tone: 2 }, { initial: "f", final: "a", tone: 5 }]
entry?.isProperNoun; // false
entry?.partOfSpeech; // "n", jieba's tag

dictionary.lookup("頭髮")?.reading; // the same reading, found under 繁體
dictionary.lookup("重複")?.reading; // 重複 and 重覆 are both keys for 重复
dictionary.hasPrefix("银"); // true, does any word start with this?
dictionary.readingsOf("行"); // xíng, háng, héng, hàng, likeliest first
dictionary.size; // 723147, keys in the full tier, not entries
```

Both scripts are keys in the same dictionary. A 繁體 word is found directly,
with no conversion step before the lookup. See
[scripts and locales](../scripts-and-locales/) for why that matters more than it
sounds like it should.

### WordEntry

| Field           | Type          | Is                                                                |
| --------------- | ------------- | ----------------------------------------------------------------- |
| `word`          | `string`      | the key as stored                                                 |
| `reading`       | `Syllable[]`  | the 普通话 reading                                                |
| `taiwanReading` | `Syllable[]`? | the 國語 reading, absent when it does not differ                  |
| `partOfSpeech`  | `string`      | jieba's tag, or `""` where there is none                          |
| `isProperNoun`  | `boolean`     | drives capitalisation                                             |
| `cost`          | `number`      | decoding cost, quantised from corpus frequency; lower is likelier |

`lookup` returns `undefined` for a word the dictionary lacks. `partOfSpeech` is
empty far more often than you might expect. Only the jieba-sourced third of the
dictionary carries a tag at all, and a 繁體 character takes the tag of the 简体
character it pairs with, since jieba counted one script and not the other. See
[the tags and the counts are thinner too](../scripts-and-locales/#the-tags-and-the-counts-are-thinner-too-and-both-are-carried-across).

`readingsOf(character)` returns every reading the dictionary knows for a single
character, likeliest first, as reading arrays:

```ts
import { writeSyllable } from "@kensio/pinyinjs";

dictionary
  .readingsOf("行")
  .map((reading) =>
    reading.map((syllable) => writeSyllable(syllable)).join(""),
  );
// ["xíng", "háng", "héng", "hàng"]
```

`hasPrefix` is what makes the lattice cheap to build, since "does any word start
here?" is the question that decides whether to keep walking, and it is answered
by the same binary search as a lookup, with no second index beside it.

### By position

The keys are sorted and numbered, and three methods take that number rather than
a word. They are the seam a second index over the same dictionary is built
through, and [candidates](../candidates/) derives one from them:

```ts
dictionary.wordAt(0); // the first key in code-unit order
dictionary.frequencyAt(0); // its frequency bucket, 0 rarest to 15
dictionary.readingsInOrder().readingAt(0); // "yin2 hang2", at the string level
```

`readingsInOrder` hands back a cursor, because the array it would replace is 39
MB on the full tier. The cursor holds the character defaults that a derived
reading is assembled from (83.25% of the full tier's keys store no reading of
their own). Build what needs it, use it, and let it go. No `Syllable` is
constructed anywhere along that path, and that is what makes a pass over every
key affordable.

## Ranking words by frequency

`cost` and `frequencyAt` are quantised to 16 buckets, which is all the decoder
ever acts on when it weighs one candidate word against another. Ranking a word
list against itself wants more than that. Rank the 120,858 CC-CEDICT headwords
the full tier holds by `cost` and 5,934 of them land on the value at rank
10,000, so a top-10,000 cut of that list is settled inside a band the buckets
put in one place.

`full.counts` holds the corpus count each of those buckets was quantised from,
one per key of the full tier and in the same positions. It is a file of its own
(243 KB brotli), read by `loadWordCounts` and by nothing on the conversion path:

```ts
import { loadDictionary, loadWordCounts } from "@kensio/pinyinjs";
import { fileSource } from "@kensio/pinyinjs/node";

const source = fileSource("node_modules/@kensio/pinyinjs/data");
const dictionary = await loadDictionary(source, "full");
const counts = await loadWordCounts(source);

const corpusCount = new Map<string, number>();
for (let at = 0; at < dictionary.size; at++) {
  corpusCount.set(dictionary.wordAt(at), counts.countOf(at));
}

words.toSorted(
  (left, right) => (corpusCount.get(right) ?? 0) - (corpusCount.get(left) ?? 0),
);
```

The sweep is what pairs the two. Counts are positional, and `wordAt` is what
turns a position into a word. Made this way, the cut at 10,000 lands in a tie 16
words wide.

Counts exist for `full` alone. A ranking over part of the vocabulary answers a
different question, and a caller ranking words has the whole list in hand. Check
`counts.size` against `dictionary.size` before pairing them, since a smaller
tier numbers its keys differently and every position would name another word.

A count of zero means the corpus is silent about that key, which two thirds of
the full tier's keys are. A 繁體 character carries the count of the 简体
character it pairs with, since the corpus was written in one script and the two
are the same character. 時 reads 103,735 because 时 does. See
[the tags and the counts are thinner too](../scripts-and-locales/#the-tags-and-the-counts-are-thinner-too-and-both-are-carried-across).

jieba supplies the counts, and jieba is a segmenter.
Its weights are tuned to make segmentation come out right, and how often a
reader meets a word is a separate measurement (a corpus list such as SUBTLEX-CH
or BCC would be one). These counts rank common vocabulary well and say very
little about the long tail.

## What it costs in memory

The index is a sorted, newline-joined string plus a `Uint32Array` of offsets,
searched by binary search. On the full 412k word list that is about 2.8 MB of
heap and builds in around 14 ms, against 22.6 MB for a `Map` with a prefix
`Set` beside it.

Entries are decoded the first time a word is asked about, not on load, because
decoding all 723,147 would cost far more than the lookups a page actually
performs.

## Checking what got loaded

```console
$ pinyinjs info
tier       full
data       the artifacts that shipped
keys       723,147
syllables  415 attested, 424 spellings in the inventory
```

## Where the data comes from

| Source                                                                | Provides                                              | Licence      |
| --------------------------------------------------------------------- | ----------------------------------------------------- | ------------ |
| [Unihan](https://www.unicode.org/charts/unihan.html)                  | character readings, polyphone priors, script variants | Unicode      |
| [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict)   | 简体/繁體 pairs, 儿化, neutral tones, Taiwan readings | CC BY-SA 4.0 |
| [phrase-pinyin-data](https://github.com/mozillazg/phrase-pinyin-data) | the bulk of the word readings                         | MIT          |
| [jieba](https://github.com/fxsjy/jieba)                               | word frequencies and part-of-speech tags              | MIT          |

The compiled dictionaries are committed to the repository, so what ships is
exactly what was tested. Because CC-CEDICT is CC BY-SA 4.0, the artifacts in
`data/` are share-alike even though the code is Apache-2.0.

The build fails where it could warn. No artifact is written unless 儿化 is
repaired both ways, 一 and 不 sandhi is normalised out of the stored readings,
every syllable is one the inventory knows, and every tier reads back exactly as
it was built.

<!-- card
```ts
const source = fetchSource("/data");
const dictionary = await loadDictionary(source, "full");

dictionary.lookup("头发")?.reading; // tóu fa
dictionary.readingsOf("行"); // xíng, háng, héng, hàng
```
-->
