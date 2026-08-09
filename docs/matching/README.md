# Matching

`match` filters Chinese text by a pinyin query typed on a Latin keyboard.

```ts
import { match } from "@kensio/pinyinjs";

match(dictionary, "北京大学", "bjdx")?.ranges; // [{ at: 0, length: 4 }]
match(dictionary, "北京大学", "nanjing"); // undefined
```

This is the search box every Chinese site has and no Latin keyboard can type
into. Somebody looking for 北京大学 writes `bjdx`, `beijing`, `beijingdx` or
`bei jing da xue`, and all four should find it while `nanjing` finds nothing.

## What a query may write

| Form            | Written                    |
| --------------- | -------------------------- |
| full syllables  | `beijingdaxue`             |
| the same, apart | `bei jing da xue`          |
| initials        | `bjdx`                     |
| the two mixed   | `beijingdx`, `bjdaxue`     |
| tones as digits | `bei3jing1`                |
| ü as typed      | `lvse` or `lu:se` for 绿色 |

Anything the query starts a syllable with counts while it is being typed, so a
box filtering on every keystroke keeps matching: `b`, `be` and `bei` all match
北京, and 京 joins the highlight at `beij`.

An apostrophe, a hyphen or a space is a syllable boundary rather than noise,
which is what a typist means by writing one. 县 is `xian` and 西安 is `xi an`,
so a query that writes the boundary rules the other one out:

```ts
match(dictionary, "县城", "xian")?.ranges; // [{ at: 0, length: 1 }]
match(dictionary, "县城", "xi an"); // undefined
```

A tone written as a **digit** is honoured — `bei3` matches 北 and `bei1` does
not. A tone written as a **mark** is dropped, because honouring it would mean
knowing where the syllable it sits inside ends, and a query is exactly the text
where that is not settled yet: `bei` may still become `beijing`.

## No index, and none needed

The haystack is Chinese, so nothing is spelled out in advance and searched.
Each character is asked what it can be read as, and the query is tested as a
path over those readings, one character at a time. Nothing is built, nothing is
stored, and the dictionary that converts hanzi to pinyin is the one that does
it.

Which is where this differs from matching against a table of default readings,
as the incumbents do: **every reading a character has is matchable.**

```ts
match(dictionary, "银行", "yh")?.score; // 7 — 银行 is yínháng
match(dictionary, "银行", "yx")?.score; // 5 — a reading 行 has, but not here
```

Both find it. Neither is refused, because a reader who thinks of 行 as `xíng`
is not wrong about the character — and the one that reads the way the text
actually reads is what scores higher. 长江 answers to `cj` above `zj`, and 重庆
to `cq` above `zq`, for the same reason.

The 國語 reading counts too, so 垃圾 is found by `lese` as well as by `laji`,
and the 普通话 reading still ranks first in text a `zh-CN` decode reads as
`lājī`. Somebody typing what they say has not typed it wrongly.

## 儿化

The r of 儿化 belongs to the syllable in front of it rather than to a syllable
of its own — 玩儿 is `wánr`, one syllable over two characters — and that is how
it is typed, so that is how it is matched:

```ts
match(dictionary, "玩儿", "wanr")?.ranges; // [{ at: 0, length: 2 }]
match(dictionary, "一点儿", "yidianr")?.ranges; // [{ at: 0, length: 3 }]
```

Both characters are marked, because the one syllable is how both of them are
read. The characters as themselves still match — `wane` and `we` write 玩 `wán`
and 儿 `ér` — and rank below it, since only one of the two reads the way the
text reads.

The r is offered wherever an 儿 follows rather than only where the dictionary
attests the 儿化, because the query is what says which was meant. 女儿 is
`nǚ'ér` and not `nǚr`, and `nvr` still finds it — below `nver`, which is how it
is actually said.

## Ranking

`score` is a number to sort by, highest first. It weighs three things:

| Worth | For                                                        |
| ----- | ---------------------------------------------------------- |
| 4     | reading the characters the way the text reads them         |
| 2     | starting where a word starts                               |
| 1     | starting at the beginning of the text, decaying with depth |

The first is the share of the matched characters whose settled reading accounts
for what the query wrote, so a match half of which reads correctly is worth 2.
The second is what puts 大学生活 above 北京大学 for `dx`: both hold the word,
and only one of them starts with it.

```ts
const query = "dx";
["大学生活", "上海大学"]
  .map((text) => ({ text, found: match(dictionary, text, query) }))
  .filter((one) => one.found !== undefined)
  .toSorted((a, b) => (b.found?.score ?? 0) - (a.found?.score ?? 0))
  .map((one) => one.text); // ["大学生活", "上海大学"]
```

Scores are comparable within one query and not across queries: what they order
is a list of results, and none of them is a probability. Two matches worth the
same keep the earlier one.

## Ranges, not a boolean

A match comes back as the stretches it covers, in code points from the start of
the text, so a caller can mark them:

```ts
const found = match(dictionary, "我在北京大学学中文", "bjdx");
found?.ranges; // [{ at: 2, length: 4 }]
```

There is more than one range where the query stepped over something with no
reading of its own — a separator inside a name, a space, a bracket:

```ts
match(dictionary, "北京·大学", "bjdx")?.ranges;
// [{ at: 0, length: 2 }, { at: 3, length: 2 }]
```

What comes back is what was matched rather than what was spanned, so the `·`
stays outside the highlight. A character the dictionary **can** read is never
stepped over: a query that does not account for it has not matched around it.

Positions count code points rather than UTF-16 units, exactly as `segment`
does, so a character outside the basic plane counts as the one character it is
and a highlight never lands in the middle of one.

## The core tier is enough

Matching asks the dictionary for a character's readings, and every tier has
them:

```ts
const core = await loadDictionary(fileSource(directory), "core");
match(core, "北京大学", "bjdx")?.ranges; // [{ at: 0, length: 4 }]
```

70 KB, so a page that never loads a word list can still filter. What a bigger
tier buys is the ranking rather than the matching: the reading in context comes
from the decoder, and the decoder knows more words on `standard` and `full`.

## What it does not do

**Guess at a typo.** A part-syllable counts at the end of the query, where it
is something still being typed, and not in the middle of it: `bejing` is a
mistake rather than an abbreviation, and a search box is not the place to
decide which mistake it was.

**Match Latin text in the haystack.** The query is pinyin and the haystack is
Chinese. Matching `iphone` against `iPhone 15 发布` is a substring search, which
every language already has.

## At the command line

```console
$ pinyinjs match --query bjdx 北京大学 我在北京大学学中文 上海大学
[北京大学]  7.00
我在[北京大学]学中文  6.33
上海大学  no match
```

The matches come first, best first, and every text still gets a line. Given no
arguments it reads standard input, so a file of titles is filtered with
`cat titles.txt | pinyinjs match --query bjdx`. `--json` gives one document per
text, with `ranges` and `score` on the ones that matched.

## Uses

- a search box over Chinese titles, names or entries
- filtering a list in the browser, with no round trip and no index
- a pinyin input aid for anybody without a Chinese IME on the device in front
  of them
- highlighting what a query matched, with the ranges it gives back

<!-- card
```ts
match(dictionary, "北京大学", "bjdx")?.ranges;
// [{ at: 0, length: 4 }]

match(dictionary, "银行", "yh")?.score; // 7, yínháng
match(dictionary, "银行", "yx")?.score; // 5, a reading it has
```
-->
