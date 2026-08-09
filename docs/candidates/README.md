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
direction, and it is the half of search with **no haystack**:
[matching](../matching/) filters Chinese text you already hold, and this answers
a query with nothing behind it but the dictionary.

## What it unlocks

- **Pinyin-only lookup.** Search a dictionary or a sentence corpus by typing
  `yinhang`, with no Chinese input method involved.
- **A homophones section** on a dictionary page, which is a real study aid and
  is otherwise expensive to compute.
- **A browser input method** — type pinyin, pick a candidate, get hanzi — for
  anybody on a device with no Chinese keyboard set up.

## Nothing is downloaded

The index is **derived from the dictionary already in memory**. There is no
second artifact, no extra fetch, and nothing added to `data/`.

That was measured rather than assumed. Shipping a reverse index of the `full`
tier costs 1,924 KB brotli — an 81% increase on that tier's download — and no
encoding can go below about 1,475 KB, because the postings are a permutation of
the key list and that is the information floor. It would still cost the same
2 MB of heap once loaded, and would save under 60% of the work, since the
fetched bytes still have to be scanned and grouped. So the client computes it
from bytes it already has:

| tier       |    keys | readings |  build | heap on top of the dictionary |
| ---------- | ------: | -------: | -----: | ----------------------------: |
| `core`     |  16,976 |      409 |   4 ms |                       0.04 MB |
| `standard` |  97,998 |   39,168 |  65 ms |                       0.37 MB |
| `full`     | 723,147 |  201,379 | 540 ms |                       2.03 MB |

Fifty to sixty times what loading the forward index costs, on a machine about
2.5× a mid-range laptop; a mid-range phone is nearer a second on `full`.

It is held the way the forward index is held, and for the same reason: the
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

`step` returns the index once there is nothing left to do, and undefined until
then. Its argument bounds a step to that many dictionary positions. One pass —
sorting the reading keys — cannot be divided and is a step of its own.

**Or in a worker**, which is what `serialise` is for. The postings are typed
arrays, so they transfer rather than copy:

```ts
// worker
const built = ReverseIndex.of(Dictionary.from(artifact)).serialise();
postMessage(built, [built.postings.buffer, built.starts.buffer]);

// page
const index = ReverseIndex.from(dictionary, event.data);
```

The dictionary is passed again on the way back rather than travelling with the
data, because a posting is a position in one particular artifact and a different
tier would resolve it to a different word.

The build is streaming throughout: each key's reading is recomputed on the
second pass rather than kept from the first. Keeping them instead would be about
40% quicker and would peak at 65 MB rather than 25 MB, for a 2 MB result — which
is the difference between safe and unsafe on a phone.

## What a query may leave out

The index is keyed by the loosest spelling a typist produces — no tones, no
spaces, and ü written as the u on the keyboard. Anything a query says beyond
that narrows the list rather than changing where it is looked up.

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
because a half-typed query does not say where the syllable under the mark ends.
Here the candidate's own reading says, so the mark has somewhere to land.

```ts
candidates(index, "yinhang"); // ["銀行", "银行", "引吭", "引航", "印航"]
candidates(index, "yínháng"); // ["銀行", "银行"]
candidates(index, "yin2hang2"); // the same, written the other way
```

**ü is folded to u, and a query that writes it is honoured.** Nobody types ü, so
`lu` has to reach 绿 — but a typist who went to the trouble of writing `lv` meant
it, and gets only the words that have one.

**儿化 is stored with its r and reachable without it.** 玩儿 is `wanr`, one
syllable over two characters, and it is keyed that way; a query of `wan` asks for
the `wanr` group too. That is a search of two keys rather than a guess at where
an r might be dropped, which is what keeps `e` from answering with 儿.

**A query is a whole reading, not a prefix.** `yinhang` finds 银行 and `yinha`
finds nothing, because a reading key is a key. An input method that wants
candidates while a syllable is half-typed should ask on each completed syllable.

## Likeliest first

A posting is a dictionary position, and a position indexes the frequency table
directly, so the ordering needs no extra data at all — the groups are sorted
during the build by a counting sort over the sixteen frequency buckets, 8.6 ms
for the whole of `full`. A query pays nothing for its order.

```ts
candidates(index, "beijing", { limit: 6 });
// ["北京", "背景", "北境", "背静", "背靜", "倍經"]
```

`limit` takes the top of the list, which is what a candidate bar wants.

## Both scripts, and picking one

繁體 forms are dictionary keys in their own right, so a reading group is
bilingual without being asked — and **36.8% of the `full` tier's candidates are
the 繁體 writing of another candidate in the same group**. Over a third of a
typical list is that pairing.

The index cannot collapse it on its own. `buildArtifact` deliberately does not
record which 简体 form pairs with which 繁體 one, because conversion never needs
the pairing, so saying that 銀行 is 银行 needs the script tables — about 100 KB
that the hanzi → pinyin path does not otherwise fetch. That cost is asked for at
the call site rather than hidden:

```ts
const tables = await loadScriptTables(source);

candidates(index, "yinhang"); // ["銀行", "银行", "引吭", "引航", "印航"]
candidates(index, "yinhang", { script: { prefer: "Hans", tables } });
// ["银行", "引吭", "引航", "印航"]
candidates(index, "yinhang", { script: { prefer: "Hant", tables } });
// ["銀行", "引吭", "引航", "印航"]
```

Words are paired by their 简体 form in both directions rather than by converting
toward the preference, because simplification is many-to-one and the 简体 form is
the one both writings agree on. A pair the tables cannot make meet is left as
two candidates rather than guessed at. The kept writing takes the rank of the
better-placed of the two, so collapsing a list never reorders what is left.

Narrowing to 简体 by default would have been the wrong answer: it drops 繁體
readers entirely, and both scripts being keys is what makes the dictionary work
in the first place.

## Homophones

`homophonesOf` is the toned question, and it is answered from the same toneless
index by narrowing the group to the words whose reading is the same string.
Across the eight busiest readings in `full` — 4,659 candidates — that narrowing
costs 1.2 ms in total, which is why there is no second index keyed by tone.

```ts
homophonesOf(index, "公式", { limit: 5 });
// ["攻势", "攻勢", "公事", "宫室", "宮室"]
homophonesOf(index, "实施", { script: { prefer: "Hans", tables } });
// ["石狮", "十失", "时失", "时师", "石师"]
```

The word itself is never in its own list. Neither is its other-script writing,
where a script preference is given — 銀行 is not a homophone of 银行 but the same
word spelled for a different reader, and saying so needs the tables:

```ts
homophonesOf(index, "银行"); // ["銀行"]
homophonesOf(index, "银行", { script: { prefer: "Hans", tables } }); // []
```

## The keys the dictionary disowns

`Dictionary.lookup` folds regional 繁體 glyph forms before it searches, so 裏面
finds 裡面 and 中峯 finds 中峰. A consequence is that **281 of the `full` tier's
723,147 keys can never be returned by it**: they are in the blob, but every
lookup of them lands somewhere else.

A reverse index built off the raw key list would offer them, and one of them
would be offered under a reading that is not its own — 校覈 derives to `xiào hé`
from its characters where the 校核 it folds to reads `jiào hé`.

They are left out, and **at the query rather than at the build**, which is what
makes it free. Filtering the whole key list with `toCanonicalGlyphs` costs
52.9 ms on `full` — a 19% build tax to remove 0.04% of the candidates — where
filtering one answer costs nothing anybody can measure. Dropping them is not
losing anything: the canonical writing of each is already in the list.

## Querying by reading key directly

`positionsFor` is the layer underneath, for anything that wants the postings
rather than the words:

```ts
for (const at of index.positionsFor("yinhang")) {
  dictionary.wordAt(at); // 銀行, 银行, …
  dictionary.frequencyAt(at); // 0 (rarest) to 15
}
```

The key is the folded spelling, not a query: toneless, no spaces, ü written u.
`dictionary.readingsInOrder()` is the cursor the build itself runs on, giving
every key's reading at the string level with no `Syllable` constructed anywhere.

## What it does not do

**Prefix or fuzzy matching.** A reading key is a key. `match` is the tool for a
query that is still being typed against text you hold.

**Rank by anything but corpus frequency.** There is no context to rank by — that
is what having no haystack means. An application with its own signal should sort
the candidates it gets back.

**Come with its own dictionary.** The candidates are the dictionary's keys, so
what a bigger tier buys is a longer tail. It buys less than you would think: the
busiest reading in `core` has 302 words and in `full` it has 805, because the
tail a bigger tier adds is rare words spread thinly across many readings. An
input method's candidate bar is a `core`-sized problem even when the dictionary
is not.

## Uses

- pinyin-only search over a Chinese dictionary or corpus
- a homophones section on a word page
- a browser input method, with `limit` as the candidate bar
- a spelling check: what else could this reading be?

<!-- card
```ts
const index = ReverseIndex.of(dictionary);

candidates(index, "yinhang");
// 銀行 银行 引吭 引航 印航

homophonesOf(index, "长城"); // 長城 長程 长程 常程
```
-->
