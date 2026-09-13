# Candidates

`candidates` finds Chinese words for a pinyin query. `homophonesOf` finds words with the same pronunciation as a supplied word.

```ts
import { candidates, homophonesOf, ReverseIndex } from "@kensio/pinyinjs";

const index = ReverseIndex.of(dictionary);

candidates(index, "shi", { limit: 5 }); // ["是", "时", "事", "使", "市"]
candidates(index, "yinhang"); // ["銀行", "银行", "引吭", "引航", "印航"]
homophonesOf(index, "长城"); // ["長城", "長程", "长程", "常程"]
```

Both functions search the dictionary through a reverse index. Use [matching](../matching/) when you want to search Chinese text that your application already holds.

<a id="what-it-unlocks"></a>

## Common uses

- Look up Chinese words by typing pinyin, such as `yinhang`.
- Display homophones on a dictionary entry.
- Build an input method where users type pinyin and select a Chinese word.

<a id="everything-is-derived-in-memory"></a>

## Building the reverse index

The reverse index is built from the dictionary in memory. It requires no additional data files or network requests.

Build cost and retained memory depend on the dictionary tier:

| tier       |    keys | readings |  build | heap on top of the dictionary |
| ---------- | ------: | -------: | -----: | ----------------------------: |
| `core`     |  16,976 |      408 |   4 ms |                       0.04 MB |
| `standard` |  97,998 |   39,167 |  62 ms |                       0.37 MB |
| `full`     | 723,147 |  201,378 | 510 ms |                       2.03 MB |

These measurements are from a machine about 2.5 times as fast as a mid-range laptop. Building `full` can take around a second on a mid-range phone. Entry counts change when the dictionary is rebuilt.

The index stores sorted reading keys and a `Uint32Array` of dictionary positions. Binary search finds the positions for a reading. The equivalent `Map<string, number[]>` measured 47.83 MB.

<a id="building-it-without-dropping-frames"></a>

## Keeping the browser responsive

The smaller tiers can be built synchronously. Check the timings above against the devices you support:

```ts
const index = ReverseIndex.of(dictionary);
```

For `full`, use incremental construction or a worker to avoid blocking the browser's main thread.

To build incrementally during idle time:

```ts
const build = ReverseIndex.building(dictionary);
const tick = (): void => {
  const index = build.step(20_000);
  if (index === undefined) {
    progressBar.value = build.progress;
    requestIdleCallback(tick);
  } else {
    ready(index);
  }
};
requestIdleCallback(tick);
```

`step` processes up to the specified number of dictionary positions. It returns `undefined` until the index is complete, then returns the index. Sorting the reading keys is a separate step that cannot be split into smaller batches.

To build in a worker, use `serialise` and transfer the typed-array buffers:

```ts
// worker
const built = ReverseIndex.of(Dictionary.from(artifact)).serialise();
postMessage(built, [built.postings.buffer, built.starts.buffer]);

// page
const index = ReverseIndex.from(dictionary, event.data);
```

Reattach the same dictionary when reconstructing the index. Each stored position refers to that dictionary's data. A different tier or dictionary artifact may place another word at the same position.

Construction makes two passes through the dictionary and recalculates readings on the second pass. This keeps peak memory around 25 MB for a 2 MB result. Retaining readings between passes would be about 40% faster but would increase peak memory to about 65 MB.

<a id="what-a-query-may-leave-out"></a>

## Query syntax

Index keys omit tones and spaces and replace ü with u. A query can add these details to filter the candidates for a key.

| Written                 | Finds                               |
| ----------------------- | ----------------------------------- |
| `yinhang`               | everything read yinhang, any tone   |
| `yin hang`, `yin'hang`  | the same; a boundary is not a sound |
| `yin2hang2`, `yínháng`  | 銀行 and 银行, narrowed by tone     |
| `lvse`, `lu:se`, `lüse` | 绿色                                |
| `luse`                  | 绿色 too, since `lu` may be `lü`    |
| `wanr`, `wan`           | 玩儿 either way                     |

Both tone digits and tone marks constrain the result. This differs from [matching](../matching/), which accepts incomplete syllables and ignores tone marks. Candidate lookup compares complete readings.

```ts
candidates(index, "yinhang"); // ["銀行", "银行", "引吭", "引航", "印航"]
candidates(index, "yínháng"); // ["銀行", "银行"]
candidates(index, "yin2hang2"); // the same, written the other way
```

A query using u also matches ü. For example, `lu` can return 绿. An explicit ü spelling, such as `lv`, restricts the result to words with ü.

Erhua readings are indexed with their r-suffix. 玩儿 is stored under `wanr`, and a query for `wan` also searches that group. Only a syllable-final r is optional. The query `e` does not return 儿.

Queries must specify a complete reading. `yinhang` finds 银行, while `yinha` returns no candidates. An input method can request candidates after each completed syllable.

<a id="likeliest-first"></a>

## Ranking and limits

Candidates are sorted by the dictionary's sixteen frequency buckets during index construction. Sorting the full tier measured 8.2 ms. Queries use this precomputed order.

```ts
candidates(index, "beijing", { limit: 6 });
// ["北京", "背景", "北境", "背静", "背靜", "倍經"]
```

`limit` returns the first candidates in that order.

<a id="both-scripts-and-picking-one"></a>

## Choosing a script

The dictionary contains both simplified and traditional spellings. By default, a result can include both. In the measured `full` tier, 36.8% of candidates are traditional spellings of another candidate in the same reading group.

Pass a script preference and script-conversion tables to combine equivalent spellings. The tables are a separate download of about 100 KB:

```ts
const tables = await loadScriptTables(source);

candidates(index, "yinhang"); // ["銀行", "银行", "引吭", "引航", "印航"]
candidates(index, "yinhang", { script: { prefer: "Hans", tables } });
// ["银行", "引吭", "引航", "印航"]
candidates(index, "yinhang", { script: { prefer: "Hant", tables } });
// ["銀行", "引吭", "引航", "印航"]
```

Spellings are paired by their simplified form. If the tables cannot establish a pair, both candidates remain. The preferred spelling inherits the higher rank of the pair, preserving the order of the remaining results.

Without a script preference, both simplified and traditional candidates are returned.

## Homophones

`homophonesOf` filters the same reverse index to words with an identical reading, including tones. Filtering eight common readings in `full` (4,656 candidates) measured 1.9 ms in total.

```ts
homophonesOf(index, "公式", { limit: 5 });
// ["攻势", "攻勢", "公事", "宫室", "宮室"]
homophonesOf(index, "实施", { script: { prefer: "Hans", tables } });
// ["石狮", "十失", "时失", "时师", "石师"]
```

The result excludes the supplied word. With a script preference and conversion tables, it also excludes that word's equivalent spelling in the other script:

```ts
homophonesOf(index, "银行"); // ["銀行"]
homophonesOf(index, "银行", { script: { prefer: "Hans", tables } }); // []
```

<a id="the-keys-the-dictionary-disowns"></a>

## Canonical character forms

`Dictionary.lookup` normalises regional traditional forms before searching. For example, 裏面 resolves to 裡面 and 中峯 to 中峰. In the measured `full` tier, 281 of 723,147 keys resolve to another spelling.

Returning those raw keys could associate a word with the wrong reading. For example, 校覈 derives `xiào hé` from individual characters, while its canonical entry 校核 reads `jiào hé`.

Queries exclude these duplicate forms and return their canonical spellings. Filtering a result is cheaper than normalising the full key list during construction, which measured 43.2 ms.

## Querying by reading key directly

`positionsFor` returns dictionary positions for an index key:

```ts
for (const at of index.positionsFor("yinhang")) {
  dictionary.wordAt(at); // 銀行, 银行, …
  dictionary.frequencyAt(at); // 0 (rarest) to 15
}
```

Pass a folded key with no tones or spaces and ü written as u. This method does not parse a user query. `dictionary.readingsInOrder()` provides each dictionary key's reading as a string without constructing `Syllable` objects.

Use `foldReading` to turn user-supplied pinyin into an index key. `readingKey` performs the same folding for the internal notation used in dictionary artifacts:

```ts
readingKey("yin2 hang2"); // yinhang
readingKey("rèn shí"); // rènshí, a key nothing is stored under
foldReading("rèn shí"); // renshi
foldReading("Lǜ'sè"); // luse
```

You can also use `foldReading` in your own search index. Apply it to both the indexed readings and the query before comparing them.

<a id="where-it-stops"></a>

## Limitations

Candidate lookup supports complete readings only. Use `match` for queries that are still being typed against existing Chinese text. Neither API performs fuzzy matching.

The default ranking uses corpus frequency. Applications with additional context can reorder the returned candidates.

Results are limited to the loaded dictionary. Larger tiers add rare words, but those words are spread across many readings. In the measured data, the largest group contains 301 candidates in `core` and 805 in `full`.

## Uses

- pinyin-only search over a Chinese dictionary or corpus
- a homophones section on a word page
- a browser input method, with `limit` as the candidate bar
- a spelling check, asking what else this reading could be

<!-- card
```ts
const index = ReverseIndex.of(dictionary);

candidates(index, "yinhang");
// 銀行 银行 引吭 引航 印航

homophonesOf(index, "长城"); // 長城 長程 长程 常程
```
-->
