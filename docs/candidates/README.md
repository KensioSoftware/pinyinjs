# Candidates

`candidates` answers a pinyin query with the hanzi it could be spelling, and
`homophonesOf` lists the words read exactly like a word you already have.

```ts
import { candidates, homophonesOf, ReverseIndex } from "@kensio/pinyinjs";

const index = ReverseIndex.of(dictionary);

candidates(index, "shi", { limit: 5 }); // ["是", "时", "事", "使", "市"]
candidates(index, "yinhang"); // ["銀行", "银行", "引吭", "引航", "印航"]
homophonesOf(index, "长城"); // ["長城", "長程", "长程", "常程"]
```

Every other index in the package runs hanzi → reading. This is the other
direction, and it is the half of search with **no haystack**.
[matching](../matching/) filters Chinese text you already hold, and this answers
a query with only the dictionary behind it.

## What it unlocks

- **Pinyin-only lookup.** Search a dictionary or a sentence corpus by typing
  `yinhang`, with no Chinese input method involved.
- **A homophones section** on a dictionary page, a real study aid and otherwise
  expensive to compute.
- **A browser input method** (type pinyin, pick a candidate, get hanzi) for
  anybody on a device with no Chinese keyboard set up.

## Everything is derived in memory

The index is **derived from the dictionary already in memory**. There is no
second artifact, no extra fetch, and `data/` is untouched.

That was measured. Shipping a reverse index of the `full` tier costs 1,995 KB
brotli (an 84% increase on that tier's download) and no encoding can go below
about 1,474 KB, because the postings are a permutation of the key list and that
is the information floor. It would still cost the same 2 MB of heap once loaded,
and would save under 60% of the work, since the fetched bytes still have to be
scanned and grouped. So the client computes it from bytes it already has:

| tier       |    keys | readings |  build | heap on top of the dictionary |
| ---------- | ------: | -------: | -----: | ----------------------------: |
| `core`     |  16,976 |      408 |   4 ms |                       0.04 MB |
| `standard` |  97,998 |   39,167 |  62 ms |                       0.37 MB |
| `full`     | 723,147 |  201,378 | 510 ms |                       2.03 MB |

Twenty-five to sixty times what loading the forward index costs, on a machine
about 2.5× a mid-range laptop. A mid-range phone is nearer a second on `full`.
The counts move a little whenever the dictionary is rebuilt, and that is why the
tests bracket them instead of pinning them.

It is held the way the forward index is held, and for the same reason. The
reading keys are one sorted blob searched by binary search, and the postings are
a `Uint32Array` of dictionary positions. The same content in a
`Map<string, number[]>` is 47.83 MB.

## Building it without dropping frames

`core` is inside a frame and `standard` is inside four, so build them and move
on:

```ts
const index = ReverseIndex.of(dictionary);
```

`full` is thirty-odd frames, which belongs off the main thread. Two ways, and
the API is shaped for both.

**A slice at a time**, driven from idle time:

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

`step` returns the index once the work is done, and undefined until then. Its
argument bounds a step to that many dictionary positions. One pass, sorting the
reading keys, cannot be divided and is a step of its own.

**Or in a worker**, and that is what `serialise` is for. The postings are typed
arrays, and they transfer instead of copying:

```ts
// worker
const built = ReverseIndex.of(Dictionary.from(artifact)).serialise();
postMessage(built, [built.postings.buffer, built.starts.buffer]);

// page
const index = ReverseIndex.from(dictionary, event.data);
```

The dictionary is passed again on the way back, and never travels with the data,
because a posting is a position in one particular artifact and a different tier
would resolve it to a different word.

The build is streaming throughout. Each key's reading is recomputed on the
second pass, and none is kept from the first. Keeping them instead would be
about 40% quicker and would peak at 65 MB against 25 MB, for a 2 MB result. That
is the difference between safe and unsafe on a phone.

## What a query may leave out

The index is keyed by the loosest spelling a typist produces, with no tones, no
spaces, and ü written as the u on the keyboard. Anything a query says beyond
that narrows the list without changing where it is looked up.

| Written                 | Finds                               |
| ----------------------- | ----------------------------------- |
| `yinhang`               | everything read yinhang, any tone   |
| `yin hang`, `yin'hang`  | the same; a boundary is not a sound |
| `yin2hang2`, `yínháng`  | 銀行 and 银行, narrowed by tone     |
| `lvse`, `lu:se`, `lüse` | 绿色                                |
| `luse`                  | 绿色 too, since `lu` may be `lü`    |
| `wanr`, `wan`           | 玩儿 either way                     |

Tones count whether they are written as digits or as marks. This is the one
place they differ from [matching](../matching/), which has to drop a tone mark
because a half-typed query leaves the end of the syllable under the mark open.
Here the candidate's own reading settles it, and the mark has somewhere to land.

```ts
candidates(index, "yinhang"); // ["銀行", "银行", "引吭", "引航", "印航"]
candidates(index, "yínháng"); // ["銀行", "银行"]
candidates(index, "yin2hang2"); // the same, written the other way
```

**ü is folded to u, and a query that writes it is honoured.** Nobody types ü, so
`lu` has to reach 绿. A typist who went to the trouble of writing `lv` meant it,
and gets only the words that have one.

**儿化 is stored with its r and reachable without it.** 玩儿 is `wanr`, one
syllable over two characters, and it is keyed that way. A query of `wan` asks
for the `wanr` group too. That is a search of two keys, and never a guess at
where an r might be dropped. That is what keeps `e` from answering with 儿.

**A query is a whole reading, not a prefix.** `yinhang` finds 银行 where `yinha`
comes back empty, because a reading key is a key. An input method that wants
candidates while a syllable is half-typed should ask on each completed syllable.

## Likeliest first

A posting is a dictionary position, and a position indexes the frequency table
directly. The ordering needs no extra data at all. The groups are sorted during
the build by a counting sort over the sixteen frequency buckets, 8.2 ms for the
whole of `full`. A query pays for none of it.

```ts
candidates(index, "beijing", { limit: 6 });
// ["北京", "背景", "北境", "背静", "背靜", "倍經"]
```

`limit` takes the top of the list, the shape a candidate bar wants.

## Both scripts, and picking one

繁體 forms are dictionary keys in their own right, and a reading group comes out
bilingual without being asked. **36.8% of the `full` tier's candidates are the
繁體 writing of another candidate in the same group.** Over a third of a typical
list is that pairing.

The index cannot collapse it on its own. `buildArtifact` deliberately leaves out
which 简体 form pairs with which 繁體 one, because conversion never needs the
pairing, so saying that 銀行 is 银行 needs the script tables, about 100 KB the
hanzi → pinyin path never otherwise fetches. That cost is asked for at the call
site, in the open:

```ts
const tables = await loadScriptTables(source);

candidates(index, "yinhang"); // ["銀行", "银行", "引吭", "引航", "印航"]
candidates(index, "yinhang", { script: { prefer: "Hans", tables } });
// ["银行", "引吭", "引航", "印航"]
candidates(index, "yinhang", { script: { prefer: "Hant", tables } });
// ["銀行", "引吭", "引航", "印航"]
```

Words are paired by their 简体 form in both directions, and never by converting
toward the preference, because simplification is many-to-one and the 简体 form
is the one both writings agree on. A pair the tables cannot make meet is left as
two candidates and never guessed at. The kept writing takes the rank of the
better-placed of the two, so collapsing a list never reorders what is left.

Narrowing to 简体 by default would have been the wrong answer. It drops 繁體
readers entirely, and both scripts being keys is what makes the dictionary work
in the first place.

## Homophones

`homophonesOf` is the toned question, and it is answered from the same toneless
index by narrowing the group to the words whose reading is the same string.
Across the eight busiest readings in `full` (4,656 candidates) that narrowing
costs 1.9 ms in total, and that is why there is no second index keyed by tone.

```ts
homophonesOf(index, "公式", { limit: 5 });
// ["攻势", "攻勢", "公事", "宫室", "宮室"]
homophonesOf(index, "实施", { script: { prefer: "Hans", tables } });
// ["石狮", "十失", "时失", "时师", "石师"]
```

The word itself is never in its own list, and nor is its other-script writing
where a script preference is given. 銀行 is the same word as 银行 spelled for a
different reader, which makes it no homophone at all, and saying so needs the
tables:

```ts
homophonesOf(index, "银行"); // ["銀行"]
homophonesOf(index, "银行", { script: { prefer: "Hans", tables } }); // []
```

## The keys the dictionary disowns

`Dictionary.lookup` folds regional 繁體 glyph forms before it searches, so 裏面
finds 裡面 and 中峯 finds 中峰. A consequence is that **281 of the `full` tier's
723,147 keys can never be returned by it**. They are in the blob, but every
lookup of them lands somewhere else.

A reverse index built off the raw key list would offer them, and one of them
under a reading that belongs to another word. 校覈 derives to `xiào hé` from its
characters where the 校核 it folds to reads `jiào hé`.

They are left out **at the query and not at the build**, and that is what makes
it free. Filtering the whole key list with `toCanonicalGlyphs` costs 43.2 ms on
`full` (a build tax of nearly a tenth to remove 0.04% of the candidates) where
filtering one answer is too cheap to measure. The canonical writing of each is
already in the list, so dropping them loses no candidate.

## Querying by reading key directly

`positionsFor` is the layer underneath, for anything that wants the postings
instead of the words:

```ts
for (const at of index.positionsFor("yinhang")) {
  dictionary.wordAt(at); // 銀行, 银行, …
  dictionary.frequencyAt(at); // 0 (rarest) to 15
}
```

The key is the folded spelling and never a query. It is toneless, has no spaces,
and writes ü as u. `dictionary.readingsInOrder()` is the cursor the build itself
runs on, giving every key's reading at the string level with no `Syllable`
constructed anywhere.

## Where it stops

**Prefix or fuzzy matching.** A reading key is a key. `match` is the tool for a
query that is still being typed against text you hold.

**Rank by anything but corpus frequency.** There is no context to rank by, and
that is what having no haystack means. An application with its own signal should
sort the candidates it gets back.

**Come with its own dictionary.** The candidates are the dictionary's keys, so
what a bigger tier buys is a longer tail. It buys less than you would think. The
busiest reading in `core` has 301 words and in `full` it has 805, because the
tail a bigger tier adds is rare words spread thinly across many readings. An
input method's candidate bar stays a `core`-sized problem however big the
dictionary gets.

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
