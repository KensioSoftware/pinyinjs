# Dictionaries

A dictionary is the compiled word list conversion runs against. It is a
fetchable file rather than a JavaScript module, which is what keeps 10 MB of
data out of your bundle, so loading it is asynchronous.

```ts
import { convert, loadDictionary } from "@kensio/pinyinjs";
import { fileSource } from "@kensio/pinyinjs/node";

const dictionary = await loadDictionary(fileSource("./data"), "full");
convert(dictionary, "银行"); // "yínháng"
```

Load it once and keep it. It is immutable, safe to share across requests, and
decodes individual entries lazily, so there is nothing to gain from building a
second one.

## Sources

`loadDictionary(source, tier)` takes a `DictionarySource`, which is just
something that can fetch the artifacts by name. Two are provided.

**`fileSource(directory)`** reads from disk, and is the Node one. It lives at
`@kensio/pinyinjs/node` rather than the package root so that nothing on the
browser path can reach a Node built-in:

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
`DecompressionStream` has no brotli, so decompressing in JavaScript is not a
real alternative.

## Tiers

| Tier       | Entries | Download (brotli) | Contains               |
| ---------- | ------: | ----------------: | ---------------------- |
| `core`     |  16,730 |             70 KB | single characters only |
| `standard` |  66,730 |            376 KB | the most common words  |
| `full`     | 461,623 |          2,381 KB | every word             |

`full` is the default, and is what a server should use: 2.4 MB is nothing
there, and the extra words are exactly what stops a rare name being read
character by character.

In a browser the tiers are nested, so you can start converting before the whole
thing has arrived:

```ts
let dictionary = await loadDictionary(fetchSource("/data"), "standard");
render(convert(dictionary, text));

dictionary = await loadDictionary(fetchSource("/data"), "full");
render(convert(dictionary, text)); // same text, better readings
```

`core` is single characters only, so it cannot do word-based disambiguation at
all. Everything falls back on character priors, and both the readings and the
spacing suffer:

```ts
// core
convert(dictionary, "银行"); // "yín xíng"
convert(dictionary, "我要去北京。"); // "Wǒ yào qù běi Jīng."

// standard or full
convert(dictionary, "银行"); // "yínháng"
convert(dictionary, "我要去北京。"); // "Wǒ yào qù Běijīng."
```

It is for the case where 70 KB is the budget and any pinyin beats none.

The entry counts above are dictionary entries. `dictionary.size` counts keys,
which is a larger number, because 繁體 spellings are keys in their own right:
16,975 for `core`, 97,997 for `standard`, 723,149 for `full`.

## Querying directly

The dictionary is useful on its own, not only as an argument to `convert`.

```ts
const entry = dictionary.lookup("头发");
entry?.reading; // [{ initial: "t", final: "ou", tone: 2 }, { initial: "f", final: "a", tone: 5 }]
entry?.isProperNoun; // false
entry?.partOfSpeech; // "n", jieba's tag

dictionary.lookup("頭髮")?.reading; // the same reading, found under 繁體
dictionary.lookup("重複")?.reading; // 重複 and 重覆 are both keys for 重复
dictionary.hasPrefix("银"); // true, does any word start with this?
dictionary.readingsOf("行"); // xíng, háng, héng, hàng, likeliest first
dictionary.size; // 723149, keys in the full tier, not entries
```

Both scripts are keys in the same dictionary, so nothing is converted before a
lookup. See [scripts and locales](../scripts-and-locales/) for why that matters
more than it sounds like it should.

### WordEntry

| Field           | Type          | Is                                                                |
| --------------- | ------------- | ----------------------------------------------------------------- |
| `word`          | `string`      | the key as stored                                                 |
| `reading`       | `Syllable[]`  | the 普通话 reading                                                |
| `taiwanReading` | `Syllable[]`? | the 國語 reading, absent when it does not differ                  |
| `partOfSpeech`  | `string`      | jieba's tag, or `""` where there is none                          |
| `isProperNoun`  | `boolean`     | drives capitalisation                                             |
| `cost`          | `number`      | decoding cost, quantised from corpus frequency; lower is likelier |

`lookup` returns `undefined` for a word it does not have. `partOfSpeech` is
empty far more often than you might expect: only the jieba-sourced third of the
dictionary carries a tag at all.

`readingsOf(character)` returns every reading the dictionary knows for a single
character, likeliest first, as reading arrays rather than strings:

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

## What it costs in memory

The index is a sorted, newline-joined string plus a `Uint32Array` of offsets,
searched by binary search. On the full 412k word list that is about 2.8 MB of
heap and builds in around 14 ms, against 22.6 MB for a `Map` with a prefix
`Set` beside it.

Entries are decoded the first time a word is asked about, not on load, because
decoding all 723,149 would cost far more than the lookups a page actually
performs.

## Checking what got loaded

```console
$ pinyinjs info
tier       full
data       the artifacts that shipped
keys       723,149
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

The build fails rather than warns: no artifact is written unless 儿化 is
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
