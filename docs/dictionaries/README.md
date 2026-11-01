# Dictionaries

A dictionary supplies the word readings used for Chinese-to-pinyin conversion. Its data is loaded asynchronously from files, separately from the JavaScript bundle.

```ts
import { convert, loadDictionary } from "@kensio/pinyinjs";
import { fileSource } from "@kensio/pinyinjs/node";

const dictionary = await loadDictionary(fileSource("./data"), "full");
convert(dictionary, "银行"); // "yínháng"
```

Load a dictionary once and reuse it. Dictionaries are immutable and safe to share across requests. Individual entries are decoded on first access.

## Sources

`loadDictionary(source, tier)` accepts a `DictionarySource` that retrieves dictionary files by name. PinyinJS provides sources for disk and HTTP access.

`fileSource(directory)` reads from disk in Node.js. Import it from `@kensio/pinyinjs/node`:

```ts
import { fileSource } from "@kensio/pinyinjs/node";

const source = fileSource("node_modules/@kensio/pinyinjs/data");
```

`fetchSource(baseUrl)` loads files over HTTP. Import it from `@kensio/pinyinjs`:

```ts
import { fetchSource, loadDictionary } from "@kensio/pinyinjs";

const dictionary = await loadDictionary(fetchSource("/data"), "standard");
```

Serve the package's `data/` directory at that URL. The server can apply Brotli compression with `Content-Encoding: br`. The browser decompresses the response before PinyinJS reads it.

## Tiers

| Tier       | Entries | Download (brotli) | Contains               |
| ---------- | ------: | ----------------: | ---------------------- |
| `core`     |  16,974 |             70 KB | single characters only |
| `standard` |  66,974 |            377 KB | the most common words  |
| `full`     | 461,572 |          2,378 KB | every word             |

`full` is the default tier and provides the most complete word coverage. It is a suitable default for servers and applications that need uncommon names or vocabulary.

The tiers are nested. In a browser, you can start with a smaller tier and replace it after a larger tier loads:

```ts
let dictionary = await loadDictionary(fetchSource("/data"), "standard");
render(convert(dictionary, text));

dictionary = await loadDictionary(fetchSource("/data"), "full");
render(convert(dictionary, text)); // same text, better readings
```

`core` contains single characters only. It cannot use dictionary words to resolve ambiguous readings or word boundaries:

```ts
// core
convert(dictionary, "银行"); // "yín xíng"
convert(dictionary, "我要去北京。"); // "Wǒ yào qù běi jīng."

// standard or full
convert(dictionary, "银行"); // "yínháng"
convert(dictionary, "我要去北京。"); // "Wǒ yào qù Běijīng."
```

Use `core` when download size is the main constraint and character-level readings are sufficient.

The table counts dictionary entries. `dictionary.size` counts searchable keys, including separate traditional spellings. The key counts are 16,981 for `core`, 98,000 for `standard` and 723,169 for `full`.

## Querying directly

You can query a dictionary directly without converting text:

```ts
const entry = dictionary.lookup("头发");
entry?.reading; // [{ initial: "t", final: "ou", tone: 2 }, { initial: "f", final: "a", tone: 5 }]
entry?.isProperNoun; // false
entry?.partOfSpeech; // "n", jieba's tag

dictionary.lookup("頭髮")?.reading; // the same reading, found under 繁體
dictionary.lookup("重複")?.reading; // 重複 and 重覆 are both keys for 重复
dictionary.hasPrefix("银"); // true, does any word start with this?
dictionary.readingsOf("行"); // xíng, háng, héng, hàng, likeliest first
dictionary.frequencyOf("头发"); // 9, how common it is, 0 rarest to 15
dictionary.size; // 723169, keys in the full tier, not entries
```

Both simplified and traditional spellings are searchable keys. Traditional words are looked up directly. See [scripts and locales](../scripts-and-locales/) for script handling and regional readings.

### WordEntry

| Field              | Type            | Is                                                                 |
| ------------------ | --------------- | ------------------------------------------------------------------ |
| `word`             | `string`        | the key as stored                                                  |
| `reading`          | `Syllable[]`    | the 普通话 reading                                                 |
| `taiwanReading`    | `Syllable[]`?   | the 國語 reading, absent when it does not differ                   |
| `taiwanAlternates` | `Syllable[][]`? | other 國語 readings that hold for one sense only, such as 和 `hàn` |
| `partOfSpeech`     | `string`        | jieba's tag, or `""` where there is none                           |
| `isProperNoun`     | `boolean`       | drives capitalisation                                              |
| `cost`             | `number`        | decoding cost, quantised from corpus frequency; lower is likelier  |

`lookup` returns `undefined` when a word is absent. `partOfSpeech` may be empty because only jieba-sourced entries have tags. Traditional characters inherit the tags of their paired simplified forms. See [shared tags and counts](../scripts-and-locales/#tags-frequency-and-names).

`readingsOf(character)` returns a single character's known readings in preference order:

```ts
import { writeSyllable } from "@kensio/pinyinjs";

dictionary
  .readingsOf("行")
  .map((reading) =>
    reading.map((syllable) => writeSyllable(syllable)).join(""),
  );
// ["xíng", "háng", "héng", "hàng"]
```

`hasPrefix` checks whether any dictionary key begins with the supplied text. It uses the same sorted index as `lookup`.

### By position

Dictionary keys have positions in a sorted list. These methods access entries by position and support derived indexes such as [candidates](../candidates/):

```ts
dictionary.wordAt(0); // the first key in code-unit order
dictionary.frequencyAt(0); // its frequency bucket, 0 rarest to 15
dictionary.readingsInOrder().readingAt(0); // "yin2 hang2", at the string level
```

`readingsInOrder` returns a cursor over reading strings. It derives missing word readings from character defaults without constructing `Syllable` objects. Consume the cursor while building an index, then release it. Keeping all readings in an array measured about 39 MB on `full`.

## Ranking words by frequency

`frequencyOf` returns a word's frequency bucket. Use it to rank words with one lookup per word:

```ts
dictionary.frequencyOf("银行"); // 10
dictionary.frequencyOf("殿下"); // 7
dictionary.frequencyOf("蛋糕店铺子"); // undefined, no such key
```

`undefined` means the word is absent. Bucket 0 means the word is present but has no corpus count. About two thirds of `full` keys fall into that bucket. `frequencyAt` returns the same information by key position.

`cost`, `frequencyAt` and `frequencyOf` use sixteen frequency buckets. Many words therefore have equal values. In a ranking of 120,858 CC-CEDICT headwords, the bucket containing rank 10,000 held 5,934 words.

For finer ranking, load `full.counts` with `loadWordCounts`. It contains one corpus count per key in the `full` tier and adds about 243 KB compressed with Brotli. Normal conversion does not load this file:

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

Pair each count with `wordAt` at the same position. In the example ranking, raw counts reduced the tie at rank 10,000 to 16 words.

Counts are available only for `full`. Check `counts.size` against `dictionary.size` before pairing them. Positions in smaller tiers refer to different keys.

A zero count means the source corpus has no count for that key. Traditional characters inherit counts from their paired simplified forms. For example, 時 has the same count of 103,735 as 时. See [shared tags and counts](../scripts-and-locales/#tags-frequency-and-names).

Raw counts and frequency buckets differ for uncounted proper nouns. Their raw count stays zero, but the decoder assigns a frequency bucket corresponding to a count of 3. This keeps missing counts from making names unnecessarily expensive to decode. The measured `full` tier has 10,676 such keys. Use raw counts for frequency ranking and buckets to inspect decoder scoring.

Counts come from jieba and were collected for segmentation. They help rank common vocabulary but provide limited evidence about rare words. They are not a dedicated measure of how often readers encounter each word.

<a id="what-it-costs-in-memory"></a>

## Memory usage

The lookup index stores sorted keys in a newline-separated string with a `Uint32Array` of offsets. On a measured 412,000-word list, it used about 2.8 MB of heap and took around 14 ms to build. The equivalent `Map` and prefix `Set` used 22.6 MB.

Word entries are decoded on first access. Loading the dictionary does not decode every entry.

<a id="checking-what-got-loaded"></a>

## Inspecting a loaded dictionary

```console
$ pinyinjs info
tier       full
data       the artifacts that shipped
keys       723,169
syllables  415 attested, 424 spellings in the inventory
```

## Where the data comes from

| Source                                                                                               | Provides                                              | Licence         |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------- |
| [Unihan](https://www.unicode.org/charts/unihan.html)                                                 | character readings, polyphone priors, script variants | Unicode         |
| [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict)                                  | 简体/繁體 pairs, 儿化, neutral tones, Taiwan readings | CC BY-SA 4.0    |
| [phrase-pinyin-data](https://github.com/mozillazg/phrase-pinyin-data)                                | the bulk of the word readings                         | MIT             |
| [jieba](https://github.com/fxsjy/jieba)                                                              | word frequencies and part-of-speech tags              | MIT             |
| [教育部 國語辭典](https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/index.html) | Taiwan (國語) readings, as reading facts only         | CC BY-ND 3.0 TW |

Compiled dictionaries are committed and tested with the library. The code uses Apache-2.0, and the data artifacts use CC BY-SA 4.0 because they include CC-CEDICT data.

<a id="taiwan-readings-source"></a>

### Taiwan readings

The `zh-TW` readings come from the Taiwan Ministry of Education's two
dictionaries of the 國語 standard, 《國語辭典簡編本》 and 《重編國語辭典修訂本》.
CC-CEDICT's `Taiwan pr.` notes cover 543 of its lines, and before this source
common words such as 星期, 危險 and 頭髮 read under `zh-TW` exactly as on the
mainland.

These sources were considered:

| Source                                  | Licence            | Used                                                 |
| --------------------------------------- | ------------------ | ---------------------------------------------------- |
| 教育部《國語辭典簡編本》                | CC BY-ND 3.0 TW    | yes, readings only                                   |
| 教育部《重編國語辭典修訂本》            | CC BY-ND 3.0 TW    | yes, readings only, for words the concise one lacks  |
| 中華文化總會《兩岸常用詞典》            | CC BY-NC-ND 3.0 TW | no (non-commercial)                                  |
| Wiktionary's Taiwan pronunciations      | CC BY-SA 4.0       | no (computed by Lua modules, with nothing to export) |
| moedict and g0v exports of the 國語辭典 | CC BY-ND 3.0 TW    | no (the ministry's own download is the same data)    |

The build reads four columns of each spreadsheet (the headword, the order of
its readings, its 漢語拼音 and its variant reading). It never parses a
definition, an example or any other text. `data/` holds a reading only as a
delta on an entry the other sources define, where 國語 differs from 普通话, in
this package's own encoding. A word's pronunciation is a fact about the
language, and no entry of either dictionary is reproduced.

Each dictionary's usage statement (公眾授權使用說明, linked from the download
page) adds conditions to the licence. It asks for attribution in a set form
with the release used, which NOTICE gives. It also asks that no entry's 音讀 be
modified or converted to 简体. This package keys a reading under a word's 简体
spelling as well as its 繁體 ones, on the position that a reading taken as a
fact is no use of an entry. Keying the readings under 繁體 spellings only would
meet the condition at the cost of `zh-TW` on 简体 input.

The dictionary build validates erhua readings, removes applied sandhi from stored 一 and 不, checks the syllable inventory, and verifies that every tier can be read back correctly. A failed validation stops the build.

<!-- card
```ts
const source = fetchSource("/data");
const dictionary = await loadDictionary(source, "full");

dictionary.lookup("头发")?.reading; // tóu fa
dictionary.readingsOf("行"); // xíng, háng, héng, hàng
```
-->
